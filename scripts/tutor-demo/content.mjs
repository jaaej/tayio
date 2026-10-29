// Who and what the tutor demo shows. Dates live in seed.mjs: everything here
// is placed relative to the day the seed runs, so "today's lesson" is always
// today.

/** Set on every demo auth user's app_metadata; the reset only touches these. */
export const DEMO_TAG = "tutor-demo";

export const TUTOR = { email: "tutor@taiyo.com", first: "Tom", last: "Tutor", password: "demo1234" };

/** Where the old dev tutor@taiyo.com account (and all its QA data) moves to. */
export const LEGACY_TUTOR_EMAIL = "qa.tutor@taiyo.com";

export const COLLEAGUE = {
  email: "maya.collins@example.com",
  first: "Maya",
  last: "Collins",
};

export const OTHERS_PASSWORD = "demo1234";

/**
 * Each subject's weeks, in teaching order. `current` is the index of the
 * week the demo day falls in; the rest of the term is laid out around it.
 */
export const SUBJECTS = {
  y8: {
    name: "Y8 Mathematics",
    year: "Year 8",
    color: "blue",
    current: 9,
    topics: [
      { name: "Number", from: 0 },
      { name: "Algebra", from: 4 },
      { name: "Linear relationships", from: 12 },
      { name: "Measurement", from: 14 },
    ],
    weeks: [
      "Integers and order of operations",
      "Fractions and decimals",
      "Percentages",
      "Ratios and rates",
      "Index laws",
      "Algebraic expressions",
      "Substitution",
      "Like terms and simplifying",
      "Solving two-step equations",
      "Equations with brackets",
      "Unknowns on both sides",
      "Equations from word problems",
      "Plotting linear graphs",
      "Gradient and intercepts",
      "Area of composite shapes",
      "Volume of prisms",
      "Pythagoras' theorem",
      "Probability",
      "Term revision",
      "Term test",
    ],
  },
  y9e: {
    name: "Y9 English",
    year: "Year 9",
    color: "red",
    current: 9,
    topics: [
      { name: "Reading closely", from: 0 },
      { name: "Persuasive writing", from: 6 },
      { name: "Analysing argument", from: 9 },
      { name: "Creative writing", from: 13 },
    ],
    weeks: [
      "Reading for main ideas",
      "Inference and evidence",
      "Character and voice",
      "Setting and atmosphere",
      "Theme in short fiction",
      "Writing analytical paragraphs",
      "Persuasive language techniques",
      "Structuring an argument",
      "Writing a persuasive essay",
      "Analysing an opinion piece",
      "Comparing two arguments",
      "Visual persuasion",
      "Oral presentations",
      "Narrative structure",
      "Show, don't tell",
      "Dialogue and pacing",
      "Editing your own writing",
      "Vocabulary in context",
      "Term revision",
      "Writing assessment",
    ],
  },
  vce: {
    name: "VCE Methods 1/2",
    year: "Year 11",
    color: "navy",
    current: 9,
    topics: [
      { name: "Functions", from: 0 },
      { name: "Polynomials", from: 6 },
      { name: "Calculus", from: 13 },
    ],
    weeks: [
      "Functions and relations",
      "Domain and range",
      "Linear functions",
      "Quadratic functions",
      "Completing the square",
      "The discriminant",
      "Polynomial expansion",
      "Polynomial long division",
      "The factor theorem",
      "Cubic graphs",
      "Solving cubic equations",
      "Quartic graphs",
      "Transformations",
      "Rates of change",
      "Limits and first principles",
      "Differentiation rules",
      "Tangents and normals",
      "Stationary points",
      "Exam revision",
      "Practice exam",
    ],
  },
};

/** The weekly "what we cover" line for any week, from its title. */
export function weekDescription(title) {
  return `This week we work through ${title.toLowerCase()}, with worked examples in class and practice to finish at home.`;
}

export function weekObjectives(title) {
  return [
    `Explain the key idea behind ${title.toLowerCase()}`,
    "Work through the class examples without help",
    "Check your own answers and fix mistakes",
  ].join("\n");
}

/**
 * The students. `persona` drives their attendance, notes and marks so each
 * profile tells a different story:
 * - strong: on time, high marks
 * - steady: fine, a few slips
 * - brackets: tries hard, keeps dropping the bracket step (the marking demo)
 * - late: hands work in late or not at all (Students to bump)
 * - absent: missed a lesson through illness
 * - new: on a free trial that started recently
 */
export const STUDENTS = [
  // Tom's Y8 Mathematics class
  { key: "ethan", first: "Ethan", last: "Lim", year: "Year 8", school: "Glen Waverley Secondary College", cls: "y8", persona: "brackets", parent: { first: "Grace", last: "Lim" } },
  { key: "olivia", first: "Olivia", last: "Park", year: "Year 8", school: "Balwyn High School", cls: "y8", persona: "strong", parent: { first: "David", last: "Park" } },
  { key: "noah", first: "Noah", last: "Williams", year: "Year 8", school: "Box Hill High School", cls: "y8", persona: "late", parent: { first: "Sarah", last: "Williams" } },
  { key: "ava", first: "Ava", last: "Thompson", year: "Year 8", school: "Camberwell High School", cls: "y8", persona: "absent", parent: { first: "Kate", last: "Thompson" } },
  { key: "lucas", first: "Lucas", last: "Nguyen", year: "Year 8", school: "Mount Waverley Secondary College", cls: "y8", persona: "late", parent: { first: "Minh", last: "Nguyen" } },
  { key: "zara", first: "Zara", last: "Ahmed", year: "Year 8", school: "Glen Waverley Secondary College", cls: "y8", persona: "new", parent: { first: "Fatima", last: "Ahmed" } },
  // Tom's Y9 English class
  { key: "mia", first: "Mia", last: "Rossi", year: "Year 9", school: "Kew High School", cls: "y9e", persona: "strong", parent: { first: "Laura", last: "Rossi" } },
  { key: "jack", first: "Jack", last: "O'Brien", year: "Year 9", school: "Camberwell High School", cls: "y9e", persona: "steady", parent: { first: "Sean", last: "O'Brien" } },
  { key: "sophie", first: "Sophie", last: "Chen", year: "Year 9", school: "Balwyn High School", cls: "y9e", persona: "steady", parent: { first: "Helen", last: "Chen" } },
  { key: "leo", first: "Leo", last: "Martin", year: "Year 9", school: "Box Hill High School", cls: "y9e", persona: "steady", parent: { first: "Paul", last: "Martin" } },
  // Tom's one-on-one VCE Methods 1/2 student
  { key: "chloe", first: "Chloe", last: "Tan", year: "Year 11", school: "MacRobertson Girls' High School", cls: "vce", persona: "strong", parent: { first: "Ken", last: "Tan" } },
  // Maya's Y8 Mathematics class (the lesson on the cover board)
  { key: "isaac", first: "Isaac", last: "Kumar", year: "Year 8", school: "Vermont Secondary College", cls: "maya", persona: "steady" },
  { key: "ruby", first: "Ruby", last: "Walsh", year: "Year 8", school: "Blackburn High School", cls: "maya", persona: "strong" },
  { key: "henry", first: "Henry", last: "Diaz", year: "Year 8", school: "Vermont Secondary College", cls: "maya", persona: "steady" },
  { key: "amelia", first: "Amelia", last: "Ford", year: "Year 8", school: "Blackburn High School", cls: "maya", persona: "steady" },
];

export function demoEmail(first, last) {
  const clean = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
  return `${clean(first)}.${clean(last)}@example.com`;
}

/** What each student wrote on last week's Y8 worksheet (questions in pdfs.mjs). */
export const Y8_ANSWERS = {
  ethan: [
    "x = 15 - 7 = 8",
    "x = 24 / 3 = 8",
    "2x = 16, x = 8",
    "3x + 2 = 21, 3x = 19, x = 6.33",
    "x/4 = 5, x = 20",
    "3x + 4 = 19, x = 5",
    "8x - 1 = 3x + 11, 5x = 12, x = 2.4",
    "4 + 2d = 18, d = 7 km",
  ],
  olivia: [
    "x = 8",
    "x = 8",
    "2x = 16, x = 8",
    "x + 2 = 7, x = 5",
    "x/4 = 5, x = 20",
    "3x = 15, x = 5",
    "8x - 4 = 3x + 11, 5x = 15, x = 3",
    "4 + 2d = 18, 2d = 14, d = 7 km",
  ],
  noah: [
    "x = 8",
    "x = 8",
    "2x = 16, x = 8",
    "3x + 6 = 21, 3x = 15, x = 5",
    "x/4 = 11, x = 44",
    "7x = 23",
  ],
};

/** Ava typed her answers in the box instead of uploading a file. */
export const Y8_TEXT_ANSWER =
  "1) x = 8\n2) x = 8\n3) x = 8\n4) 3x + 6 = 21 so 3x = 15 and x = 5\n5) x = 20\n6) 3x + 4 = 19, 3x = 15, x = 5\n7) I wasn't sure how to start this one\n8) 4 + 2d = 18, d = 7 km";

/** Y9 persuasive essays, handed in as text. */
export const Y9_ESSAYS = {
  mia: `Should students wear school uniforms?

School uniforms do more than make a school look tidy: they take pressure off students every single morning. When everyone wears the same clothes, nobody is judged for not owning the latest brands, and the time spent choosing an outfit goes into getting ready to learn.

Critics argue that uniforms limit self-expression. Yet students express themselves in far more meaningful ways, through the ideas they share in class, the sports they play and the art they create. A blazer does not silence any of that.

Uniforms also build a sense of belonging. Wearing the school colours at an interschool sports day tells students they are part of something bigger than themselves.

For these reasons, uniforms should stay. They are fairer, simpler and they bring a school community together.`,
  jack: `Uniforms are bad

I think school uniforms are a bad idea because they are uncomfortable and expensive. My blazer costs over two hundred dollars and it is too hot in summer. Also everyone looks the same which is boring.

Some people say uniforms stop bullying but people still get bullied anyway so that doesn't work. Students should be allowed to wear what they want because it is their choice.

In conclusion uniforms should be banned.`,
  sophie: `The case against compulsory uniforms

Every morning, thousands of families pay for clothes that students are only allowed to wear at school. A full uniform at many Melbourne schools costs more than $500, a cost that falls hardest on families who can least afford it.

Supporters claim uniforms reduce bullying, but research on this is mixed at best. Students who want to single someone out will find another reason, from shoes to phones.

Instead, schools could adopt a simple dress code: neat, safe and appropriate. This keeps standards while trusting students to make sensible choices.

Uniforms are a tradition, but tradition alone is not a reason to keep a policy that costs families so much.`,
  leo: `Why uniforms help

Uniforms help students focus. When I wear my uniform I feel like I am in school mode. It also makes mornings faster.

Another reason is safety, because teachers on excursions can spot students easily in a crowd.

Overall I think uniforms are good for schools.`,
};

/**
 * The comment a tutor would leave the family after a lesson, and the odd
 * internal note, by persona. A list rotates by lesson, so a student's history
 * does not repeat itself word for word.
 */
export const NOTE_BY_PERSONA = {
  strong: {
    parent: [
      "A great lesson. {first} finished the extension questions and helped explain one to the class.",
      "{first} is working at a high level. We will keep adding challenge questions.",
      "Another strong week from {first}, with neat and accurate working throughout.",
    ],
  },
  steady: {
    parent: [
      "{first} worked well today. Slowing down to check the final step will lift the marks further.",
      "A solid lesson. {first} is making steady progress.",
      "{first} contributed well in class discussion today.",
    ],
  },
  brackets: {
    parent: [
      "{first} is putting in real effort. We are practising expanding brackets; 10 minutes of the booklet questions at home would help.",
      "{first} worked hard today. The booklet examples are a good place to revise at home.",
      "{first} stayed focused all lesson. We will keep practising the bracket step.",
    ],
    internal: "Check expanding brackets again next lesson before moving on.",
  },
  late: {
    parent: [
      "{first} did well in class today. Please help {first} plan homework time: last week's sheet is still to come in.",
      "{first} answered well in class. Homework needs to come in on time to keep up.",
      "A good lesson for {first} once settled in.",
    ],
    internal: "Second week in a row without homework. Raise with parent if it happens again.",
  },
  absent: {
    parent: [
      "{first} worked carefully today and the working is very neat.",
      "Welcome back, {first}. The class booklet has the examples from the missed lesson.",
      "A good lesson for {first}.",
    ],
  },
  new: {
    parent: "{first} made a lovely start. We are getting used to setting out each step on its own line.",
    internal: "Free trial student. Give the admin team feedback before the trial ends.",
  },
};

/** Feedback on the homework already marked, by persona. */
export const FEEDBACK_BY_PERSONA = {
  strong: { score: 95, feedback: "Excellent work. Every step is shown and checked." },
  steady: { score: 78, feedback: "Good work. Watch the signs when you move terms across the equals sign." },
  brackets: { score: 64, feedback: "Good effort. Q3 and Q5: collect like terms before you simplify. Have a look at the worked examples in the booklet." },
  late: { score: 58, feedback: "Several questions left out. Please finish Q6 to Q8 and show your working." },
  absent: { score: 72, feedback: "Nicely set out. Q4 needed the brackets expanded first." },
  new: { score: 70, feedback: "A great first homework with us. Keep writing each step on a new line." },
};
