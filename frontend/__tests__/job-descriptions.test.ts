import { describe, expect, it, vi } from "vitest";
import { createConcurrencyLimiter, createInFlightDeduper } from "@/lib/job-descriptions";

describe("job description async helpers", () => {
  it("keeps active work within the configured concurrency limit", async () => {
    const runLimited = createConcurrencyLimiter(3);
    let activeCount = 0;
    let maxActiveCount = 0;

    const results = await Promise.all(
      Array.from({ length: 9 }, (_, index) =>
        runLimited(async () => {
          activeCount += 1;
          maxActiveCount = Math.max(maxActiveCount, activeCount);
          await new Promise((resolve) => setTimeout(resolve, 1));
          activeCount -= 1;
          return index;
        }),
      ),
    );

    expect(maxActiveCount).toBe(3);
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("shares an in-flight request for the same description hash", async () => {
    const dedupe = createInFlightDeduper<string, string>();
    let releaseRequest!: (value: string) => void;
    const task = vi.fn(() => new Promise<string>((resolve) => {
      releaseRequest = resolve;
    }));

    const first = dedupe("description-hash", task);
    const second = dedupe("description-hash", task);

    expect(second).toBe(first);
    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(1);

    releaseRequest("verified description");
    await expect(Promise.all([first, second])).resolves.toEqual([
      "verified description",
      "verified description",
    ]);

    await expect(dedupe("description-hash", async () => "fresh request")).resolves.toBe("fresh request");
  });
});