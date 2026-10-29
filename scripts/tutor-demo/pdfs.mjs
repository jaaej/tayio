// The demo's sample files, drawn with pdf-lib so the seed needs no binary
// fixtures: a worksheet and its solutions, students' answer sheets (with the
// mistakes a tutor would circle), a week booklet and a formula sheet.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const A4 = [595.28, 841.89];
const MARGIN = 56;
const INK = rgb(0.11, 0.12, 0.16);
const MUTED = rgb(0.42, 0.45, 0.52);
const PEN = rgb(0.1, 0.22, 0.62);
const RULE = rgb(0.86, 0.88, 0.92);

async function page(title, subtitle) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setAuthor("Taiyo Tuition");
  const fonts = {
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    regular: await doc.embedFont(StandardFonts.Helvetica),
    hand: await doc.embedFont(StandardFonts.TimesRomanItalic),
  };
  const p = doc.addPage(A4);
  let y = A4[1] - MARGIN;
  p.drawText("TAIYO TUITION", { x: MARGIN, y, size: 9, font: fonts.bold, color: MUTED });
  y -= 26;
  p.drawText(title, { x: MARGIN, y, size: 20, font: fonts.bold, color: INK });
  y -= 20;
  if (subtitle) {
    p.drawText(subtitle, { x: MARGIN, y, size: 11, font: fonts.regular, color: MUTED });
    y -= 14;
  }
  p.drawLine({
    start: { x: MARGIN, y },
    end: { x: A4[0] - MARGIN, y },
    thickness: 1,
    color: RULE,
  });
  return { doc, fonts, page: p, y: y - 28 };
}

/** Draw `text` wrapped to the page width; returns the next baseline. */
function wrap(p, text, { x, y, size, font, color, width = A4[0] - MARGIN - x }) {
  const words = text.split(/\s+/);
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      p.drawText(line, { x, y, size, font, color });
      y -= size * 1.45;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    p.drawText(line, { x, y, size, font, color });
    y -= size * 1.45;
  }
  return y;
}

/** A question sheet: numbered questions, optionally with worked answers. */
async function questionSheet({ title, subtitle, questions, answers }) {
  const { doc, fonts, page: p, y: top } = await page(title, subtitle);
  let y = top;
  questions.forEach((q, i) => {
    p.drawText(`${i + 1}.`, { x: MARGIN, y, size: 12, font: fonts.bold, color: INK });
    y = wrap(p, q, { x: MARGIN + 22, y, size: 12, font: fonts.regular, color: INK });
    if (answers) {
      y = wrap(p, answers[i], { x: MARGIN + 22, y: y - 2, size: 12, font: fonts.hand, color: PEN });
    }
    y -= answers ? 14 : 40;
  });
  return doc.save();
}

/**
 * A student's answer sheet: their name, then each answer in "handwriting".
 * Wrong answers stay wrong on purpose, for the tutor to mark up in the demo.
 */
async function answerSheet({ title, student, lines }) {
  const { doc, fonts, page: p, y: top } = await page(title, `Name: ${student}`);
  let y = top;
  lines.forEach((line, i) => {
    p.drawText(`${i + 1})`, { x: MARGIN, y, size: 14, font: fonts.hand, color: PEN });
    y = wrap(p, line, { x: MARGIN + 26, y, size: 14, font: fonts.hand, color: PEN });
    p.drawLine({
      start: { x: MARGIN, y: y + 6 },
      end: { x: A4[0] - MARGIN, y: y + 6 },
      thickness: 0.5,
      color: RULE,
    });
    // Room under each answer for the tutor's pen.
    y -= 34;
  });
  return doc.save();
}

/** Booklet or formula sheet: headed sections of short paragraphs. */
async function notesSheet({ title, subtitle, sections }) {
  const { doc, fonts, page: p, y: top } = await page(title, subtitle);
  let y = top;
  for (const s of sections) {
    p.drawText(s.heading, { x: MARGIN, y, size: 13, font: fonts.bold, color: INK });
    y -= 20;
    for (const para of s.lines) {
      y = wrap(p, para, { x: MARGIN, y, size: 11.5, font: fonts.regular, color: INK });
      y -= 4;
    }
    y -= 14;
  }
  return doc.save();
}

export const LINEAR_QUESTIONS = [
  "Solve x + 7 = 15",
  "Solve 3x = 24",
  "Solve 2x - 5 = 11",
  "Solve 3(x + 2) = 21",
  "Solve x/4 + 3 = 8",
  "Solve 5x + 4 = 2x + 19",
  "Solve 4(2x - 1) = 3x + 11",
  "A taxi charges $4 plus $2 per km. A trip cost $18. Write and solve an equation for the distance.",
];

export const LINEAR_SOLUTIONS = [
  "x = 15 - 7, so x = 8",
  "x = 24 / 3, so x = 8",
  "2x = 16, so x = 8",
  "x + 2 = 7, so x = 5",
  "x/4 = 5, so x = 20",
  "3x + 4 = 19, 3x = 15, so x = 5",
  "8x - 4 = 3x + 11, 5x = 15, so x = 3",
  "4 + 2d = 18, 2d = 14, so the trip was d = 7 km",
];

export function linearWorksheet() {
  return questionSheet({
    title: "Linear equations: practice set",
    subtitle: "Y8 Mathematics · Show every step",
    questions: LINEAR_QUESTIONS,
  });
}

export function linearSolutions() {
  return questionSheet({
    title: "Linear equations: solutions",
    subtitle: "Y8 Mathematics · Worked answers",
    questions: LINEAR_QUESTIONS,
    answers: LINEAR_SOLUTIONS,
  });
}

export function linearAnswers(student, lines) {
  return answerSheet({ title: "Linear equations: practice set", student, lines });
}

export function weekBooklet({ subject, weekNumber, title, sections }) {
  return notesSheet({
    title: `Week ${weekNumber}: ${title}`,
    subtitle: `${subject} · Class booklet`,
    sections,
  });
}

/** Chloe's VCE working: right until the last step of Q4, the one she asks about. */
export function factorTheoremAnswers() {
  return answerSheet({
    title: "Factor theorem problem set",
    student: "Chloe Tan",
    lines: [
      "P(1) = 1 - 6 + 11 - 6 = 0, so (x - 1) is a factor",
      "P(-2) = -8 + 4 + 10 - 6 = 0, so (x + 2) is a factor",
      "x³ + 2x² - 5x - 6 = (x + 1)(x - 2)(x + 3)",
      "(2x³ - 3x² - 11x + 6) ÷ (x - 3) = 2x² + 3x + 2, so the roots are 3, -1/2, -2",
      "k = 4",
    ],
  });
}

export function essayPlanner() {
  return notesSheet({
    title: "Persuasive essay planner",
    subtitle: "Y9 English · TEEL paragraphs",
    sections: [
      { heading: "Introduction", lines: ["Hook the reader.", "State your contention in one sentence.", "Preview your three arguments."] },
      {
        heading: "Body paragraphs (x3)",
        lines: [
          "Topic sentence: one argument per paragraph.",
          "Evidence: a fact, example or expert view.",
          "Explanation: why the evidence supports your contention.",
          "Link: back to your contention.",
        ],
      },
      { heading: "Rebuttal", lines: ["Name the strongest opposing view, then explain why it falls short."] },
      { heading: "Conclusion", lines: ["Restate your contention in new words and end with a call to action."] },
    ],
  });
}

export function formulaSheet() {
  return notesSheet({
    title: "Algebra rules: formula sheet",
    subtitle: "Y8 Mathematics",
    sections: [
      {
        heading: "Inverse operations",
        lines: [
          "Undo + with -, and - with +.",
          "Undo x with ÷, and ÷ with x.",
          "Whatever you do to one side, do to the other.",
        ],
      },
      {
        heading: "Expanding brackets",
        lines: ["a(b + c) = ab + ac", "a(b - c) = ab - ac", "-(x - 3) = -x + 3"],
      },
      {
        heading: "Checking a solution",
        lines: [
          "Substitute your answer back into the original equation.",
          "Both sides must give the same number.",
        ],
      },
    ],
  });
}
