import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Theme contrast gate: every `--x` color that has a matching
 * `--x-foreground` must meet WCAG 2.2 AA (≥ 4.5:1) in both themes, and the
 * focus ring must stay visible against the stage (≥ 3:1, non-text UI).
 *
 * Parses src/app/globals.css directly so the test cannot drift from the
 * shipped tokens.
 */

const CSS_PATH = join(process.cwd(), "src/app/globals.css");
const css = readFileSync(CSS_PATH, "utf8");

type RGB = [number, number, number];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: RGB): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function linearToSrgb(channel: number): number {
  const c = clamp01(channel);
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function oklchToRgb(l: number, c: number, hDeg: number): RGB {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const blue = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(blue)];
}

function parseColor(raw: string): RGB {
  const value = raw.trim();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex?.[1]) {
    const digits = hex[1];
    if (digits.length === 3) {
      return digits.split("").map((digit) => parseInt(digit + digit, 16) / 255) as RGB;
    }
    return [
      parseInt(digits.slice(0, 2), 16) / 255,
      parseInt(digits.slice(2, 4), 16) / 255,
      parseInt(digits.slice(4, 6), 16) / 255,
    ];
  }

  const rgb = /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)/i.exec(value);
  if (rgb?.[1] && rgb[2] && rgb[3]) {
    return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
  }

  const oklch = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i.exec(value);
  if (oklch?.[1] && oklch[3] && oklch[4]) {
    const lightness = Number(oklch[1]) / (oklch[2] === "%" ? 100 : 1);
    return oklchToRgb(lightness, Number(oklch[3]), Number(oklch[4]));
  }

  throw new Error(`contrast.test: unsupported color value "${raw}"`);
}

function extractVars(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match?.[1]) throw new Error(`contrast.test: block ${selector} not found in globals.css`);
  const vars: Record<string, string> = {};
  for (const chunk of match[1].split(";")) {
    const entry = /--([\w-]+)\s*:\s*([^;]+)/.exec(chunk.trim());
    if (entry?.[1] && entry[2]) vars[`--${entry[1]}`] = entry[2].trim();
  }
  return vars;
}

const rootVars = extractVars(":root");
const darkVars = extractVars(".dark");
/** What dark mode actually resolves to (role palette etc. inherit from :root). */
const effectiveDark: Record<string, string> = { ...rootVars, ...darkVars };

function foregroundPairs(vars: Record<string, string>): Array<{ label: string; ratio: number }> {
  const pairs: Array<{ label: string; ratio: number }> = [];
  for (const [key, raw] of Object.entries(vars)) {
    const suffix = /^--(.+)-foreground$/.exec(key)?.[1];
    if (!suffix) continue;
    const baseKey = `--${suffix}`;
    const baseRaw = vars[baseKey];
    if (!baseRaw || !/^(#|rgb|oklch)/i.test(baseRaw)) continue;
    pairs.push({
      label: `${key} on ${baseKey}`,
      ratio: contrastRatio(parseColor(raw), parseColor(baseRaw)),
    });
  }
  return pairs;
}

describe("theme tokens exist", () => {
  const required = [
    "--background",
    "--foreground",
    "--card",
    "--card-foreground",
    "--popover",
    "--popover-foreground",
    "--primary",
    "--primary-foreground",
    "--secondary",
    "--secondary-foreground",
    "--muted",
    "--muted-foreground",
    "--accent",
    "--accent-foreground",
    "--destructive",
    "--destructive-foreground",
    "--border",
    "--input",
    "--ring",
  ];

  test.each(required)(":root and .dark define %s", (token) => {
    expect(rootVars[token], `light theme missing ${token}`).toBeDefined();
    expect(darkVars[token], `dark theme missing ${token}`).toBeDefined();
  });

  test("the 8-slot identity palette is complete", () => {
    for (const slot of ["amber", "teal", "violet", "rose", "sky", "lime", "orange", "indigo"]) {
      expect(rootVars[`--role-${slot}`], `missing --role-${slot}`).toBeDefined();
      expect(
        rootVars[`--role-${slot}-foreground`],
        `missing --role-${slot}-foreground`,
      ).toBeDefined();
    }
  });

  test("reading measure + type scale are defined", () => {
    expect(rootVars["--reading-measure"]).toBe("72ch");
    expect(css).toContain("--text-hero");
  });
});

describe("WCAG AA contrast (normal text ≥ 4.5:1)", () => {
  test("light theme pairs", () => {
    const pairs = foregroundPairs(rootVars);
    expect(pairs.length).toBeGreaterThanOrEqual(18);
    for (const pair of pairs) {
      expect(pair.ratio, `${pair.label}: ${pair.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("dark theme pairs (role palette inherited)", () => {
    const pairs = foregroundPairs(effectiveDark);
    expect(pairs.length).toBeGreaterThanOrEqual(18);
    for (const pair of pairs) {
      expect(pair.ratio, `${pair.label}: ${pair.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("non-text UI contrast (≥ 3:1)", () => {
  test("focus ring stays visible against the stage in both themes", () => {
    const light = contrastRatio(parseColor(rootVars["--ring"] ?? ""), parseColor(rootVars["--background"] ?? ""));
    const dark = contrastRatio(
      parseColor(effectiveDark["--ring"] ?? ""),
      parseColor(effectiveDark["--background"] ?? ""),
    );
    expect(light, `light ring: ${light.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    expect(dark, `dark ring: ${dark.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
  });
});
