import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  date,
  time,
  numeric,
  jsonb,
  pgEnum,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", [
  "student",
  "parent",
  "tutor",
  "admin",
]);

export const lessonStatusEnum = pgEnum("lesson_status", [
  "upcoming",
  "completed",
  "cancelled",
  "missed",
  "rescheduled",
  "makeup",
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "late",
  "left_early",
  "makeup_attended",
]);

export const homeworkStatusEnum = pgEnum("homework_status", [
  "not_started",
  "viewed",
  "submitted",
  "late",
  "marked",
  "returned",
  "resubmission_requested",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "unpaid",
  "paid",
  "overdue",
  "partially_paid",
  "refunded",
  "cancelled",
]);

export const masteryEnum = pgEnum("mastery_level", [
  "not_started",
  "needs_work",
  "improving",
  "strong",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "in_app",
  "email",
]);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    role: userRoleEnum("role").notNull(),
    email: text("email").notNull().unique(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    yearLevel: text("year_level"),
    school: text("school"),
    bio: text("bio"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("profiles_role_idx").on(t.role)],
);

export const familyLinks = pgTable(
  "family_links",
  {
    parentId: uuid("parent_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("parent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.parentId, t.studentId] })],
);

export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  yearLevel: text("year_level"),
  description: text("description"),
});

export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  subjectId: uuid("subject_id")
    .notNull()
    .references(() => subjects.id),
  tutorId: uuid("tutor_id")
    .notNull()
    .references(() => profiles.id),
  capacity: integer("capacity").notNull().default(8),
  location: text("location"),
  onlineLink: text("online_link"),
  isRecurring: boolean("is_recurring").notNull().default(true),
  weekday: integer("weekday"),
  startTime: time("start_time"),
  endTime: time("end_time"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const enrollments = pgTable(
  "enrollments",
  {
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.classId, t.studentId] })],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => profiles.id),
    date: date("date").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    status: lessonStatusEnum("status").notNull().default("upcoming"),
    location: text("location"),
    onlineLink: text("online_link"),
    rescheduledFrom: uuid("rescheduled_from"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lessons_date_idx").on(t.date), index("lessons_class_idx").on(t.classId)],
);

export const lessonNotes = pgTable("lesson_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  tutorId: uuid("tutor_id")
    .notNull()
    .references(() => profiles.id),
  topicCovered: text("topic_covered"),
  keyConcepts: text("key_concepts"),
  performance: text("performance"),
  strengths: text("strengths"),
  struggles: text("struggles"),
  nextLessonFocus: text("next_lesson_focus"),
  parentVisibleComment: text("parent_visible_comment"),
  internalNote: text("internal_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attendance = pgTable(
  "attendance",
  {
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: attendanceStatusEnum("status").notNull(),
    note: text("note"),
    markedAt: timestamp("marked_at", { withTimezone: true }).notNull().defaultNow(),
    markedBy: uuid("marked_by").references(() => profiles.id),
  },
  (t) => [primaryKey({ columns: [t.lessonId, t.studentId] })],
);

export const homework = pgTable("homework", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
  tutorId: uuid("tutor_id")
    .notNull()
    .references(() => profiles.id),
  title: text("title").notNull(),
  description: text("description"),
  attachmentUrl: text("attachment_url"),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  allowResubmission: boolean("allow_resubmission").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const homeworkAssignments = pgTable(
  "homework_assignments",
  {
    homeworkId: uuid("homework_id")
      .notNull()
      .references(() => homework.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: homeworkStatusEnum("status").notNull().default("not_started"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    submissionUrl: text("submission_url"),
    submissionText: text("submission_text"),
    score: numeric("score", { precision: 5, scale: 2 }),
    feedback: text("feedback"),
    markedAt: timestamp("marked_at", { withTimezone: true }),
    markedBy: uuid("marked_by").references(() => profiles.id),
  },
  (t) => [primaryKey({ columns: [t.homeworkId, t.studentId] })],
);

export const progressTopics = pgTable("progress_topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id")
    .notNull()
    .references(() => subjects.id),
  topic: text("topic").notNull(),
  mastery: masteryEnum("mastery").notNull().default("not_started"),
  updatedBy: uuid("updated_by").references(() => profiles.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentId: uuid("parent_id")
    .notNull()
    .references(() => profiles.id),
  studentId: uuid("student_id")
    .references(() => profiles.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("AUD"),
  status: invoiceStatusEnum("status").notNull().default("unpaid"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  dueDate: date("due_date").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  description: text("description"),
  lineItems: jsonb("line_items"),
});

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id")
    .notNull()
    .references(() => profiles.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audienceRole: userRoleEnum("audience_role"),
  audienceClassId: uuid("audience_class_id").references(() => classes.id, {
    onDelete: "cascade",
  }),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull().default("in_app"),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);

export const tutorAvailability = pgTable(
  "tutor_availability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    weekday: integer("weekday"),
    date: date("date"),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    isAvailable: boolean("is_available").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tutor_availability_tutor_idx").on(t.tutorId),
    index("tutor_availability_date_idx").on(t.date),
  ],
);

export const profilesRelations = relations(profiles, ({ many }) => ({
  parentLinks: many(familyLinks, { relationName: "parent" }),
  studentLinks: many(familyLinks, { relationName: "student" }),
  taughtClasses: many(classes),
  enrollments: many(enrollments),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  subject: one(subjects, { fields: [classes.subjectId], references: [subjects.id] }),
  tutor: one(profiles, { fields: [classes.tutorId], references: [profiles.id] }),
  lessons: many(lessons),
  enrollments: many(enrollments),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  class: one(classes, { fields: [lessons.classId], references: [classes.id] }),
  tutor: one(profiles, { fields: [lessons.tutorId], references: [profiles.id] }),
  notes: many(lessonNotes),
  attendance: many(attendance),
}));

export type Profile = typeof profiles.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Homework = typeof homework.$inferSelect;
export type HomeworkAssignment = typeof homeworkAssignments.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
