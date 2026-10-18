import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

/**
 * Self-host release drill (PLAN §15.6, Phase 8.7). Runs the whole release
 * sequence against the Docker Compose stack — or any compatible container
 * engine — and fails loudly on the first broken step:
 *
 *   1. compose up (unless --skip-up)
 *   2. backend health
 *   3. admin key (generate via compose exec when not supplied)
 *   4. deploy Convex functions against the self-hosted backend
 *   5. seed prompt templates
 *   6. smoke (backend + templates + app)
 *   7. backup the data volume and verify the archive (--backup-dir)
 *   8. image upgrade → smoke → rollback → smoke (--upgrade-tag/--rollback-tag)
 *   9. optional destructive restore check (--restore-from)
 *
 * Every step is idempotent; the script is safe to re-run. It is what the
 * nightly `selfhost` CI job executes.
 */

const { values } = parseArgs({
  options: {
    "compose-file": { type: "string", default: "docker-compose.yml" },
    "env-file": { type: "string", default: "docker/.env" },
    "backend-url": {
      type: "string",
      default: process.env.CONVEX_SELF_HOSTED_URL ?? "http://127.0.0.1:3210",
    },
    "app-url": {
      type: "string",
      default: process.env.FABULA_APP_URL ?? "http://127.0.0.1:3000",
    },
    "skip-up": { type: "boolean", default: false },
    "skip-deploy": { type: "boolean", default: false },
    "backup-dir": { type: "string" },
    "restore-from": { type: "string" },
    "upgrade-tag": { type: "string" },
    "rollback-tag": { type: "string" },
    engine: { type: "string" },
  },
  allowPositionals: false,
});

const backendUrl = values["backend-url"] as string;
const appUrl = values["app-url"] as string;
const envFile = values["env-file"] as string;
const composeFile = values["compose-file"] as string;

function detectEngine(): string {
  if (values.engine) return values.engine as string;
  const docker = spawnSync("docker", ["--version"], { stdio: "ignore" });
  if (docker.status === 0) return "docker";
  const podman = spawnSync("podman", ["--version"], { stdio: "ignore" });
  if (podman.status === 0) return "podman";
  throw new Error("No container engine found (install docker or podman).");
}

const engine = detectEngine();
const composeArgs = ["compose", "--env-file", envFile, "-f", composeFile];

function run(
  label: string,
  command: string,
  args: string[],
  options: { env?: Record<string, string>; capture?: boolean; allowFailure?: boolean } = {},
): string {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, {
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`Step failed: ${label} (exit ${result.status ?? "signal"})`);
  }
  return (result.stdout ?? "").trim();
}

async function waitForHealthy(url: string, attempts = 60): Promise<void> {
  console.log(`\n▶ Waiting for backend health at ${url}/version`);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${url}/version`);
      if (response.ok) {
        const version = (await response.json()) as { version?: string };
        console.log(`  healthy (${version.version ?? "unknown"})`);
        return;
      }
    } catch {
      // not up yet
    }
    if (attempt % 5 === 0) console.log(`  still waiting (${attempt}/${attempts})…`);
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`Backend never became healthy at ${url}/version`);
}

function composeUp(): void {
  run("compose up -d --build", engine, [...composeArgs, "up", "-d", "--build"]);
}

function adminKey(): string {
  const fromEnv = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY;
  if (fromEnv && fromEnv.length > 10) return fromEnv;
  const output = run("generate admin key", engine, [
    ...composeArgs,
    "exec",
    "-T",
    "backend",
    "./generate_admin_key.sh",
  ], { capture: true });
  // Script output includes the key on its own line (prefix convex-self-hosted|).
  const key = output
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.includes("|") && line.length > 20);
  if (!key) throw new Error(`Could not parse an admin key from: ${output.slice(0, 200)}`);
  return key;
}

function deployFunctions(key: string): void {
  const env = {
    CONVEX_SELF_HOSTED_URL: backendUrl,
    CONVEX_SELF_HOSTED_ADMIN_KEY: key,
  };
  const dev = spawnSync("bunx", ["convex", "dev", "--once"], {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (dev.status === 0) return;
  console.log("  `convex dev --once` failed — retrying with `convex deploy --yes`");
  const deploy = spawnSync("bunx", ["convex", "deploy", "--yes"], {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (deploy.status !== 0) {
    throw new Error("Both `convex dev --once` and `convex deploy --yes` failed.");
  }
}

function seed(): void {
  run("seed prompt templates", "bun", ["run", "seed"], {
    env: { NEXT_PUBLIC_CONVEX_URL: backendUrl },
  });
}

function smoke(): void {
  run("self-host smoke", "bun", ["run", "selfhost:smoke"], {
    env: { NEXT_PUBLIC_CONVEX_URL: backendUrl, FABULA_APP_URL: appUrl },
  });
}

function setImageTag(tag: string): void {
  if (!existsSync(envFile)) throw new Error(`Env file not found: ${envFile}`);
  const content = readFileSync(envFile, "utf8");
  const next = content.match(/^CONVEX_IMAGE_TAG=/m)
    ? content.replace(/^CONVEX_IMAGE_TAG=.*$/m, `CONVEX_IMAGE_TAG=${tag}`)
    : `${content.trimEnd()}\nCONVEX_IMAGE_TAG=${tag}\n`;
  writeFileSync(envFile, next);
  console.log(`  CONVEX_IMAGE_TAG=${tag}`);
}

function backup(dir: string): string {
  mkdirSync(dir, { recursive: true });
  const volumeList = run(
    "find convex data volume",
    engine,
    ["volume", "ls", "--format", "{{.Name}}"],
    { capture: true },
  );
  const volume = volumeList
    .split("\n")
    .find((name) => name.includes("convex") && name.includes("data"));
  if (!volume) throw new Error(`No convex data volume found in: ${volumeList.slice(0, 300)}`);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const tarball = join(dir, `convex-data-${stamp}.tgz`);
  run(`backup volume ${volume}`, engine, [
    "run",
    "--rm",
    "-v",
    `${volume}:/data`,
    "-v",
    `${join(process.cwd(), dir)}:/backup`,
    "alpine",
    "tar",
    "czf",
    `/backup/${tarball.split("/").pop()}`,
    "-C",
    "/data",
    ".",
  ]);
  const size = statSync(tarball).size;
  if (size < 2048) throw new Error(`Backup looks empty: ${tarball} (${size} bytes)`);
  // Verify the archive lists entries (restorability smoke).
  run("verify backup archive", engine, [
    "run",
    "--rm",
    "-v",
    `${join(process.cwd(), dir)}:/backup`,
    "alpine",
    "tar",
    "tzf",
    `/backup/${tarball.split("/").pop()}`,
  ], { capture: true });
  console.log(`  backup verified: ${tarball} (${Math.round(size / 1024)} kB)`);
  return tarball;
}

function restore(tarball: string): void {
  const absolute = tarball.startsWith("/") ? tarball : join(process.cwd(), tarball);
  if (!existsSync(absolute)) throw new Error(`Backup not found: ${absolute}`);
  const dir = absolute.split("/").slice(0, -1).join("/");
  const file = absolute.split("/").pop();
  // Destructive: replace the backend data volume contents, then restart.
  run("stop backend for restore", engine, [...composeArgs, "stop", "backend"]);
  const volumeList = run(
    "find convex data volume",
    engine,
    ["volume", "ls", "--format", "{{.Name}}"],
    { capture: true },
  );
  const volume = volumeList
    .split("\n")
    .find((name) => name.includes("convex") && name.includes("data"));
  if (!volume) throw new Error("No convex data volume found for restore.");
  run("restore backup into volume", engine, [
    "run",
    "--rm",
    "-v",
    `${volume}:/data`,
    "-v",
    `${dir}:/backup`,
    "alpine",
    "sh",
    "-c",
    `rm -rf /data/* /data/..?* /data/.[!.]* 2>/dev/null; tar xzf /backup/${file} -C /data`,
  ]);
  run("start backend after restore", engine, [...composeArgs, "start", "backend"]);
}

async function main(): Promise<void> {
  console.log(`Fabula self-host drill (engine: ${engine}, backend: ${backendUrl})`);

  if (!values["skip-up"]) composeUp();
  await waitForHealthy(backendUrl);

  if (!values["skip-deploy"]) {
    const key = adminKey();
    deployFunctions(key);
  }
  seed();
  smoke();

  if (values["backup-dir"]) {
    const tarball = backup(values["backup-dir"] as string);
    if (values["restore-from"]) {
      restore(values["restore-from"] as string);
      await waitForHealthy(backendUrl, 24);
      smoke();
    } else {
      console.log(`\n(restore drill skipped — pass --restore-from ${tarball} to test it)`);
    }
  }

  if (values["upgrade-tag"]) {
    setImageTag(values["upgrade-tag"] as string);
    composeUp();
    await waitForHealthy(backendUrl);
    smoke();
    if (values["rollback-tag"]) {
      setImageTag(values["rollback-tag"] as string);
      composeUp();
      await waitForHealthy(backendUrl);
      smoke();
    }
  }

  console.log("\n✔ Self-host drill passed.");
}

main().catch((error: unknown) => {
  console.error(
    "\nSelf-host drill FAILED:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
