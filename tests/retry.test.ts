import { describe, expect, test } from "vitest";
import { backoffDelays, withRetry } from "../convex/lib/retry";

describe("backoffDelays", () => {
  test("exponential with a 4x factor", () => {
    expect(backoffDelays(3, 500)).toEqual([500, 2000]);
    expect(backoffDelays(1)).toEqual([]);
    expect(backoffDelays(4, 100)).toEqual([100, 400, 1600]);
  });
});

describe("withRetry", () => {
  test("returns on first success without sleeping", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls += 1;
      return "ok";
    });
    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  test("retries with injected sleep and succeeds", async () => {
    const delays: number[] = [];
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("boom");
        return "late";
      },
      { sleep: async (ms) => void delays.push(ms) },
    );
    expect(result).toBe("late");
    expect(delays).toEqual([500, 2000]);
  });

  test("exhausts attempts and rethrows the last error", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error(`fail ${calls}`);
        },
        { attempts: 3, sleep: async () => {} },
      ),
    ).rejects.toThrow("fail 3");
    expect(calls).toBe(3);
  });

  test("onRetry reports attempt numbers", async () => {
    const retries: number[] = [];
    await withRetry(
      async () => {
        throw new Error("x");
      },
      {
        attempts: 3,
        sleep: async () => {},
        onRetry: (attempt) => void retries.push(attempt),
      },
    ).catch(() => undefined);
    expect(retries).toEqual([1, 2]);
  });
});
