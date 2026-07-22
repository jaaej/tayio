export type Difficulty = "sprint" | "easy" | "medium" | "hard" | "genius";
export type Question = { text: string; answer: number };

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function sprint(): Question {
  const a = randInt(1, 20);
  const b = randInt(1, 20);
  return { text: `${a} + ${b}`, answer: a + b };
}

function easy(): Question {
  const a = randInt(1, 99);
  const b = randInt(1, 99);
  return { text: `${a} + ${b}`, answer: a + b };
}

function medium(): Question {
  switch (pick(["add", "sub", "mult"])) {
    case "add": {
      const a = randInt(10, 99);
      const b = randInt(10, 99);
      return { text: `${a} + ${b}`, answer: a + b };
    }
    case "sub": {
      const a = randInt(10, 99);
      const b = randInt(10, a);
      return { text: `${a} - ${b}`, answer: a - b };
    }
    default: {
      const a = randInt(2, 12);
      const b = randInt(2, 9);
      return { text: `${a} × ${b}`, answer: a * b };
    }
  }
}

function hard(): Question {
  switch (pick(["add", "sub", "mult", "div"])) {
    case "add": {
      const a = randInt(11, 99);
      const b = randInt(11, 99);
      return { text: `${a} + ${b}`, answer: a + b };
    }
    case "sub": {
      let a = randInt(11, 99);
      let b = randInt(11, 99);
      if (b > a) [a, b] = [b, a];
      return { text: `${a} - ${b}`, answer: a - b };
    }
    case "mult": {
      const a = randInt(2, 12);
      const b = randInt(2, 100);
      return { text: `${a} × ${b}`, answer: a * b };
    }
    default: {
      const d = randInt(2, 12);
      const q = randInt(2, 100);
      return { text: `${d * q} ÷ ${d}`, answer: q };
    }
  }
}

const PERCENT_STEP: Record<number, number> = { 10: 10, 20: 5, 25: 4, 50: 2, 75: 4 };

function genius(): Question {
  switch (
    pick(["add3", "sub3", "mult2", "div", "order", "square", "cube", "percent"])
  ) {
    case "add3": {
      const a = randInt(100, 999);
      const b = randInt(100, 999);
      return { text: `${a} + ${b}`, answer: a + b };
    }
    case "sub3": {
      const a = randInt(100, 999);
      const b = randInt(100, 999);
      return { text: `${a} - ${b}`, answer: a - b }; // may be negative
    }
    case "mult2": {
      const a = randInt(11, 99);
      const b = randInt(11, 99);
      return { text: `${a} × ${b}`, answer: a * b };
    }
    case "div": {
      const d = randInt(3, 20);
      const q = randInt(10, 50);
      return { text: `${d * q} ÷ ${d}`, answer: q };
    }
    case "order": {
      const a = randInt(2, 20);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      if (Math.random() < 0.5) {
        return { text: `${a} + ${b} × ${c}`, answer: a + b * c };
      }
      return { text: `(${a} + ${b}) × ${c}`, answer: (a + b) * c };
    }
    case "square": {
      const n = randInt(10, 25);
      return { text: `${n}²`, answer: n * n };
    }
    case "cube": {
      const n = randInt(5, 12);
      return { text: `${n}³`, answer: n * n * n };
    }
    default: {
      const p = pick([10, 20, 25, 50, 75]);
      const base = PERCENT_STEP[p] * randInt(2, 20);
      return { text: `${p}% of ${base}`, answer: (base * p) / 100 };
    }
  }
}

export function generateQuestion(difficulty: Difficulty): Question {
  switch (difficulty) {
    case "sprint":
      return sprint();
    case "easy":
      return easy();
    case "medium":
      return medium();
    case "hard":
      return hard();
    case "genius":
      return genius();
  }
}
