import { describe, it, expect } from "vitest";
import { generateQuestion, type Difficulty } from "./question-generator";

const DIFFICULTIES: Difficulty[] = ["sprint", "easy", "medium", "hard", "genius"];
const N = 2000;

describe("generateQuestion", () => {
  it("always returns an integer answer and a non-empty prompt", () => {
    for (const d of DIFFICULTIES) {
      for (let i = 0; i < N; i++) {
        const q = generateQuestion(d);
        expect(Number.isInteger(q.answer)).toBe(true);
        expect(q.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("sprint is addition with both operands 1..20 and a correct sum", () => {
    for (let i = 0; i < N; i++) {
      const q = generateQuestion("sprint");
      const m = q.text.match(/^(\d+) \+ (\d+)$/);
      expect(m).not.toBeNull();
      const a = Number(m![1]);
      const b = Number(m![2]);
      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(20);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(20);
      expect(q.answer).toBe(a + b);
    }
  });

  it("easy is 2-operand addition with a correct sum", () => {
    for (let i = 0; i < N; i++) {
      const q = generateQuestion("easy");
      const m = q.text.match(/^(\d+) \+ (\d+)$/);
      expect(m).not.toBeNull();
      expect(q.answer).toBe(Number(m![1]) + Number(m![2]));
    }
  });

  it("sprint/easy/medium/hard never produce a negative answer", () => {
    for (const d of ["sprint", "easy", "medium", "hard"] as Difficulty[]) {
      for (let i = 0; i < N; i++) {
        expect(generateQuestion(d).answer).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("division text divides cleanly (no remainder)", () => {
    for (const d of ["hard", "genius"] as Difficulty[]) {
      for (let i = 0; i < N; i++) {
        const q = generateQuestion(d);
        const m = q.text.match(/^(\d+) ÷ (\d+)$/);
        if (m) {
          const dividend = Number(m[1]);
          const divisor = Number(m[2]);
          expect(dividend % divisor).toBe(0);
          expect(q.answer).toBe(dividend / divisor);
        }
      }
    }
  });

  it("percent questions yield whole-number answers", () => {
    for (let i = 0; i < N; i++) {
      const q = generateQuestion("genius");
      const m = q.text.match(/^(\d+)% of (\d+)$/);
      if (m) {
        const p = Number(m[1]);
        const base = Number(m[2]);
        expect(q.answer).toBe((base * p) / 100);
        expect(Number.isInteger((base * p) / 100)).toBe(true);
      }
    }
  });
});
