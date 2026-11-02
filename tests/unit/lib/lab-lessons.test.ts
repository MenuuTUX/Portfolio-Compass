import { describe, expect, it } from "bun:test";
import { startGuided, toRequest } from "@/lib/lab/lab-form";
import { applyTweak, extractTickers, LESSONS, liveNotes } from "@/lib/lab/lessons";
import { parseTickers } from "@/lib/tickers";

describe("guided lessons", () => {
  it("starts in the first lesson with a valid request", () => {
    const form = startGuided();
    expect(form.lessonId).toBe(LESSONS[0].id);
    expect(form.universe).toEqual(["SPY"]);
    expect("request" in toRequest(form)).toBe(true);
  });

  for (const lesson of LESSONS) {
    describe(lesson.title, () => {
      it("defines decide(day) and quotes at least one valid ticker", () => {
        expect(lesson.code).toContain("def decide(day):");
        const tickers = extractTickers(lesson.code);
        expect(tickers.length).toBeGreaterThan(0);
        expect(parseTickers(tickers, 50)).toEqual(tickers);
      });

      it("keeps every note on a line that holds its text", () => {
        expect(liveNotes(lesson, lesson.code)).toEqual(lesson.notes);
      });

      it("applies every tweak, keeps notes valid, and only uses valid tickers", () => {
        for (const tweak of lesson.tweaks) {
          const next = applyTweak(lesson.code, tweak);
          expect(next).not.toBeNull();
          expect(next).not.toBe(lesson.code);
          expect(liveNotes(lesson, next!).length).toBeGreaterThan(0);
          const tickers = extractTickers(next!);
          expect(parseTickers(tickers, 50)).toEqual(tickers);
        }
      });
    });
  }

  it("swaps 60/40 to 40/60 in one pass", () => {
    const split = LESSONS.find((l) => l.id === "split")!;
    const swapped = applyTweak(split.code, split.tweaks[1])!;
    expect(swapped).toContain('{"SPY": 0.4, "AGG": 0.6}');
  });

  it("returns null when the text a tweak targets is gone", () => {
    expect(applyTweak("def decide(day):\n    return None\n", LESSONS[0].tweaks[0])).toBeNull();
  });

  it("drops a note once its line changes", () => {
    const l = LESSONS[0];
    expect(liveNotes(l, l.code.replace('return "SPY"', 'return "AGG"')).map((n) => n.line)).toEqual([1]);
  });
});
