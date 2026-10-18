import { spawn, spawnSync } from "node:child_process";
import { generateKeyPairSync, createPublicKey } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * E2E backend + app server.
 *
 * Playwright starts this in place of `next start`. It:
 *  1. boots the open-source Convex backend via `convex dev` (the local
 *     anonymous deployment from `.env.local`, created on first CI run),
 *  2. provisions deterministic model + Convex Auth env,
 *  3. seeds prompt templates until the function push lands,
 *  4. starts Next.js.
 *
 * No cloud account, no managed service, no real model calls.
 */

const PORT = process.env.PORT ?? "3100";
const APP_URL = `http://127.0.0.1:${PORT}`;
const CONVEX_URL = process.env.FABULA_E2E_CONVEX_URL ?? "http://127.0.0.1:3210";
const envPath = join(process.cwd(), ".env.local");
const authDir = join(process.cwd(), ".convex", "e2e-auth");

let shuttingDown = false;
let convexProcess: ReturnType<typeof spawn> | null = null;
let nextProcess: ReturnType<typeof spawn> | null = null;
let instanceName = "";

function log(message: string): void {
  console.log(`[e2e-server] ${message}`);
}

function ensureLocalDeploymentFile(): void {
  let content = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  if (!/^CONVEX_DEPLOYMENT=/m.test(content)) {
    content = [
      "CONVEX_DEPLOYMENT=anonymous:anonymous-fabula-e2e",
      "NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210",
      "NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211",
      "",
    ].join("\n");
    writeFileSync(envPath, content);
    log("created .env.local with an anonymous local deployment");
  }
  const match = /^CONVEX_DEPLOYMENT=(.+)$/m.exec(content);
  const deployment = match?.[1]?.trim();
  if (!deployment) {
    throw new Error(".env.local has no CONVEX_DEPLOYMENT");
  }
  if (!deployment.startsWith("anonymous:")) {
    throw new Error(
      `E2E requires a local anonymous Convex deployment, found "${deployment}". ` +
        "Point .env.local at a local backend or run on a clean checkout.",
    );
  }
  instanceName = deployment.replace(/^anonymous:/, "");
  if (!/^NEXT_PUBLIC_CONVEX_URL=http:\/\/127\.0\.0\.1:3210/m.test(content)) {
    content = content.replace(
      /^NEXT_PUBLIC_CONVEX_URL=.*$/m,
      "NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210",
    );
    writeFileSync(envPath, content);
  }
  process.env.NEXT_PUBLIC_CONVEX_URL = CONVEX_URL;
}

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function runConvexCli(args: string[], timeoutMs = 60_000): Promise<{
  ok: boolean;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
    const child = spawn("bunx", ["convex", ...args], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ ok: false, stdout, stderr: `${stderr}\n(timeout)` });
    }, timeoutMs);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: String(error) });
    });
  });
}

function ensureAuthKeys(): { privateKeyPath: string; jwksPath: string } {
  mkdirSync(authDir, { recursive: true });
  const privateKeyPath = join(authDir, "private.pem");
  const jwksPath = join(authDir, "jwks.json");

  if (!existsSync(privateKeyPath) || !existsSync(jwksPath)) {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const jwk = createPublicKey(privateKey).export({ format: "jwk" });
    writeFileSync(privateKeyPath, privateKey);
    writeFileSync(
      jwksPath,
      JSON.stringify({ keys: [{ ...jwk, alg: "RS256", use: "sig" }] }),
    );
  }
  return { privateKeyPath, jwksPath };
}

async function provisionEnv(): Promise<void> {
  const deadline = Date.now() + 90_000;
  const withRetry = async (
    args: string[],
  ): Promise<{ ok: boolean; stdout: string; stderr: string }> => {
    let last = { ok: false, stdout: "", stderr: "" };
    while (Date.now() < deadline) {
      last = await runConvexCli(args);
      if (last.ok) return last;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return last;
  };

  const set = async (name: string, value: string): Promise<void> => {
    const result = await withRetry(["env", "set", name, value]);
    if (!result.ok) {
      throw new Error(`Failed to set ${name}: ${result.stderr || result.stdout}`);
    }
  };
  const setFromFile = async (name: string, path: string): Promise<void> => {
    const result = await withRetry(["env", "set", name, "--from-file", path]);
    if (!result.ok) {
      throw new Error(`Failed to set ${name}: ${result.stderr || result.stdout}`);
    }
  };

  await set("FABULA_MODEL_FAKE", "1");
  await set("SITE_URL", APP_URL);

  const existingKey = await withRetry(["env", "get", "JWT_PRIVATE_KEY"]);
  const existingJwks = await withRetry(["env", "get", "JWKS"]);
  if (
    !existingKey.ok ||
    existingKey.stdout.trim().length === 0 ||
    !existingJwks.ok ||
    existingJwks.stdout.trim().length === 0
  ) {
    const { privateKeyPath, jwksPath } = ensureAuthKeys();
    await setFromFile("JWT_PRIVATE_KEY", privateKeyPath);
    await setFromFile("JWKS", jwksPath);
    log("provisioned Convex Auth JWT keys");
  }
}

async function seedUntilReady(): Promise<void> {
  const deadline = Date.now() + 90_000;
  let lastError = "";
  while (Date.now() < deadline) {
    const child = spawn("bun", ["run", "seed"], {
      env: {
        ...process.env,
        NEXT_PUBLIC_CONVEX_URL: CONVEX_URL,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      output += String(chunk);
    });
    const code = await new Promise<number | null>((resolve) =>
      child.on("exit", resolve),
    );
    if (code === 0) {
      log(output.trim() || "templates seeded");
      return;
    }
    lastError = output;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Seeding did not succeed: ${lastError}`);
}

function terminate(child: ReturnType<typeof spawn> | null): void {
  if (!child || child.killed) return;
  try {
    child.kill("SIGTERM");
  } catch {
    // already gone
  }
}

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`received ${signal}; stopping`);
  terminate(nextProcess);
  terminate(convexProcess);
  // convex dev can detach its local backend; scope the kill to this project's
  // backend (the local instance name is the project's, not the .env alias).
  spawnSync(
    "pkill",
    ["-f", `convex-local-backend.*${process.cwd().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`],
    { stdio: "ignore" },
  );
  setTimeout(() => process.exit(0), 500);
}

async function main(): Promise<void> {
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  ensureLocalDeploymentFile();
  log(`starting local backend (${instanceName})`);
  convexProcess = spawn("bunx", ["convex", "dev"], {
    env: process.env,
    stdio: "inherit",
  });
  convexProcess.on("exit", (code) => {
    if (!shuttingDown && code !== 0) {
      console.error(`[e2e-server] convex dev exited with ${code}`);
      process.exit(1);
    }
  });

  await waitForHttp(`${CONVEX_URL}/version`, 120_000);
  log("backend is up");

  await provisionEnv();
  log("env provisioned (fake model + auth)");

  await seedUntilReady();
  log("prompt templates ready");

  nextProcess = spawn("bun", ["run", "start"], {
    env: {
      ...process.env,
      PORT,
      NEXT_PUBLIC_CONVEX_URL: CONVEX_URL,
    },
    stdio: "inherit",
  });
  nextProcess.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`[e2e-server] next exited with ${code}`);
      terminate(convexProcess);
      process.exit(code ?? 1);
    }
  });
}

main().catch((error) => {
  console.error("[e2e-server] failed:", error);
  shutdown("failure");
  process.exit(1);
});
