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
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Tiered roles were added in migrations 0017/0018. The four original values
// (student/parent/tutor/admin) are retained: every ACCOUNT is migrated to a
// tiered role, but the coarse values still appear as announcement audience
// targets and DM/discussion display prefixes. See src/lib/roles.ts.
export const userRoleEnum = pgEnum("user_role", [
  "student",
  "parent",
  "tutor",
  "admin",
  "admin_unrestricted",
  "admin_restricted",
  "student_unrestricted",
  "student_restricted",
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

export const classTypeEnum = pgEnum("class_type", ["group", "one_on_one"]);

export const rescheduleStatusEnum = pgEnum("reschedule_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
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

export const mathGameDifficultyEnum = pgEnum("math_game_difficulty", [
  "sprint",
  "easy",
  "medium",
  "hard",
  "genius",
]);

export const resourceTypeEnum = pgEnum("resource_type", [
  "past_paper",
  "worksheet",
  "answer_sheet",
  "notes",
  "formula_sheet",
  "writing_template",
  "exam_guide",
  "video",
]);

export const resourceKindEnum = pgEnum("resource_kind", ["file", "link"]);

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
    isPrimaryContact: boolean("is_primary_contact").notNull().default(false),
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
  classType: classTypeEnum("class_type").notNull().default("group"),
  location: text("location"),
  onlineLink: text("online_link"),
  lessonPlan: text("lesson_plan"),
  isRecurring: boolean("is_recurring").notNull().default(true),
  weekday: integer("weekday"),
  startTime: time("start_time"),
  endTime: time("end_time"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deliveryModeEnum = pgEnum("delivery_mode", [
  "in_person",
  "online",
]);

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
    deliveryMode: deliveryModeEnum("delivery_mode"),
    adminNotes: text("admin_notes"),
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
    recordingUrl: text("recording_url"),
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

// Self-serve reschedule requests (spec 2026-07-10). Group ≥24h reschedules
// execute directly and never create a row here; 1-on-1 (always) and group <24h
// create a pending row that a tutor or admin approves.
export const rescheduleRequests = pgTable(
  "reschedule_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    originalLessonId: uuid("original_lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    requestedById: uuid("requested_by_id")
      .notNull()
      .references(() => profiles.id),
    reason: text("reason"),
    status: rescheduleStatusEnum("status").notNull().default("pending"),
    // 1-on-1 target: a new makeup slot with the same tutor.
    targetTutorId: uuid("target_tutor_id").references(() => profiles.id),
    targetDate: date("target_date"),
    targetStartTime: time("target_start_time"),
    targetEndTime: time("target_end_time"),
    // group target: an existing lesson to join.
    targetLessonId: uuid("target_lesson_id").references(() => lessons.id, {
      onDelete: "cascade",
    }),
    decidedById: uuid("decided_by_id").references(() => profiles.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("reschedule_requests_status_idx").on(t.status),
    index("reschedule_requests_student_idx").on(t.studentId),
  ],
);

export type RescheduleRequest = typeof rescheduleRequests.$inferSelect;
export type ClassType = (typeof classTypeEnum.enumValues)[number];

export const creditGrantReasonEnum = pgEnum("credit_grant_reason", [
  "cancellation",
  "reschedule_no_slot",
  "admin_grant",
]);
export type CreditGrantReason = (typeof creditGrantReasonEnum.enumValues)[number];
export const creditStatusEnum = pgEnum("credit_status", [
  "active",
  "redeemed",
  "expired",
]);

export const classCredits = pgTable(
  "class_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    termId: uuid("term_id").notNull().references(() => terms.id, { onDelete: "cascade" }),
    grantReason: creditGrantReasonEnum("grant_reason").notNull(),
    grantedFromLessonId: uuid("granted_from_lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    grantedById: uuid("granted_by_id").notNull().references(() => profiles.id),
    status: creditStatusEnum("status").notNull().default("active"),
    redeemedOnLessonId: uuid("redeemed_on_lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    redeemedById: uuid("redeemed_by_id").references(() => profiles.id),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    expiresAt: date("expires_at").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("class_credits_student_status_idx").on(t.studentId, t.status),
    index("class_credits_term_idx").on(t.termId),
  ],
);
export type ClassCredit = typeof classCredits.$inferSelect;

export const lessonCancellations = pgTable(
  "lesson_cancellations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    cancelledById: uuid("cancelled_by_id").notNull().references(() => profiles.id),
    termId: uuid("term_id").notNull().references(() => terms.id, { onDelete: "cascade" }),
    creditId: uuid("credit_id").references(() => classCredits.id, { onDelete: "set null" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lesson_cancellations_student_term_idx").on(t.studentId, t.termId)],
);
export type LessonCancellation = typeof lessonCancellations.$inferSelect;

export const allowanceKindEnum = pgEnum("allowance_kind", [
  "reschedule",
  "cancellation",
]);

// Admin top-ups to a student's per-term reschedule/cancellation allowance
// (migration 0032). The effective cap for a kind is 3 + sum(bonus) for that
// student+term+kind. Server-only (RLS deny-all, no client policies).
export const allowanceAdjustments = pgTable(
  "allowance_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    termId: uuid("term_id")
      .notNull()
      .references(() => terms.id, { onDelete: "cascade" }),
    kind: allowanceKindEnum("kind").notNull(),
    bonus: integer("bonus").notNull(),
    grantedById: uuid("granted_by_id").notNull().references(() => profiles.id),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("allowance_adjustments_student_term_idx").on(t.studentId, t.termId)],
);
export type AllowanceAdjustment = typeof allowanceAdjustments.$inferSelect;

/**
 * Per-student leave / holiday periods. A contiguous date range [startDate,
 * endDate] (inclusive) during which the student is away from ALL their classes
 * - so tutors don't mark them absent every day of a known holiday. Multiple
 * separate holidays = multiple rows. Admin-managed; read server-side only.
 */
export const studentLeave = pgTable(
  "student_leave",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    note: text("note"),
    createdById: uuid("created_by_id").notNull().references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("student_leave_student_idx").on(t.studentId),
    index("student_leave_dates_idx").on(t.startDate, t.endDate),
  ],
);
export type StudentLeave = typeof studentLeave.$inferSelect;

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
  isTest: boolean("is_test").notNull().default(false),
  weekId: uuid("week_id").references((): any => subjectWeeks.id, { onDelete: "set null" }),
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

export const adminSettings = pgTable("admin_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  pinHash: text("pin_hash"),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Owner-only tutor payroll/reference details (PII), migration 0035. One
// optional row per tutor; read/written only by the owner-gated /admin/tutors
// page. Isolated from public.profiles so it never leaks into other queries.
export const tutorBankDetails = pgTable("tutor_bank_details", {
  tutorId: uuid("tutor_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  accountName: text("account_name"),
  bsb: text("bsb"),
  accountNumber: text("account_number"),
  note: text("note"),
  updatedById: uuid("updated_by_id").references(() => profiles.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
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

export const discussionThreads = pgTable(
  "discussion_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id").references(() => subjects.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("discussion_threads_subject_idx").on(t.subjectId),
    index("discussion_threads_activity_idx").on(t.lastActivityAt),
  ],
);

export const discussionReplies = pgTable("discussion_replies", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => discussionThreads.id, { onDelete: "cascade" }),
  // Nullable: top-level replies have parentReplyId = null;
  // a "reply to a reply" stores the id of the parent reply here.
  // Only 1 level of nesting supported - children of a reply cannot themselves have children.
  parentReplyId: uuid("parent_reply_id"),
  authorId: uuid("author_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// Append-only audit trail for changes to admin-managed tables. Written by
// trigger only (migration 0006); never written by application code.
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id"),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    tableName: text("table_name").notNull(),
    oldData: jsonb("old_data"),
    newData: jsonb("new_data"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_logs_created_at_idx").on(t.createdAt),
    index("audit_logs_actor_idx").on(t.actorId),
    index("audit_logs_table_idx").on(t.tableName),
  ],
);

export const discussionAttachments = pgTable(
  "discussion_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Exactly one of threadId / replyId is set (enforced by a check
    // constraint in migration 0016): the attachment hangs off the question
    // or off a specific reply.
    threadId: uuid("thread_id").references(() => discussionThreads.id, {
      onDelete: "cascade",
    }),
    replyId: uuid("reply_id").references(() => discussionReplies.id, {
      onDelete: "cascade",
    }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    storagePath: text("storage_path").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("discussion_attachments_thread_idx").on(t.threadId),
    index("discussion_attachments_reply_idx").on(t.replyId),
  ],
);

export type DiscussionThread = typeof discussionThreads.$inferSelect;
export type DiscussionReply = typeof discussionReplies.$inferSelect;
export type DiscussionAttachment = typeof discussionAttachments.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

export const dmThreads = pgTable(
  "dm_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userAId: uuid("user_a_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("dm_threads_pair_idx").on(t.userAId, t.userBId),
    index("dm_threads_a_idx").on(t.userAId),
    index("dm_threads_b_idx").on(t.userBId),
  ],
);

export const dmMessages = pgTable(
  "dm_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => dmThreads.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("dm_messages_thread_idx").on(t.threadId, t.createdAt)],
);

export const dmReads = pgTable(
  "dm_reads",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => dmThreads.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.threadId] })],
);

export type DmThread = typeof dmThreads.$inferSelect;
export type DmMessage = typeof dmMessages.$inferSelect;

// --- Curriculum ---------------------------------------------------------

export const terms = pgTable(
  "terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    year: integer("year").notNull(),
    termNumber: integer("term_number").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("terms_year_term_idx").on(t.year, t.termNumber)],
);

export const subjectTopics = pgTable(
  "subject_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subject_topics_subject_name_idx").on(t.subjectId, t.name),
    index("subject_topics_subject_idx").on(t.subjectId),
  ],
);

export const subjectWeeks = pgTable(
  "subject_weeks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    termId: uuid("term_id")
      .notNull()
      .references(() => terms.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").references(() => subjectTopics.id, { onDelete: "set null" }),
    weekNumber: integer("week_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    videoUrl: text("video_url"),
    bookletUrl: text("booklet_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subject_weeks_unique_idx").on(t.subjectId, t.termId, t.weekNumber),
    index("subject_weeks_subject_idx").on(t.subjectId),
    index("subject_weeks_term_idx").on(t.termId),
  ],
);

export const tutorWeekSections = pgTable(
  "tutor_week_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    subjectWeekId: uuid("subject_week_id")
      .notNull()
      .references(() => subjectWeeks.id, { onDelete: "cascade" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tutor_week_sections_tutor_week_idx").on(t.tutorId, t.subjectWeekId),
    index("tutor_week_sections_week_idx").on(t.subjectWeekId),
  ],
);

export const tutorWeekAttachments = pgTable(
  "tutor_week_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => tutorWeekSections.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    // 'file' → uploaded file in storage (storagePath set); 'link' → external
    // URL such as a video or resource link (url set). See migration 0015.
    kind: text("kind").notNull().default("file"),
    storagePath: text("storage_path"),
    url: text("url"),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tutor_week_attachments_section_idx").on(t.sectionId)],
);


export const resources = pgTable(
  "resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").references(() => subjectTopics.id, {
      onDelete: "set null",
    }),
    type: resourceTypeEnum("type").notNull(),
    kind: resourceKindEnum("kind").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    storageBucket: text("storage_bucket"),
    storagePath: text("storage_path"),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    externalUrl: text("external_url"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    sourceAttachmentId: uuid("source_attachment_id").references(
      () => tutorWeekAttachments.id,
      { onDelete: "cascade" },
    ),
    isPublished: boolean("is_published").notNull().default(true),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: uuid("removed_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    removedReason: text("removed_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("resources_subject_published_idx").on(t.subjectId, t.isPublished),
    index("resources_subject_type_idx").on(t.subjectId, t.type),
    index("resources_topic_idx").on(t.topicId),
  ],
);

export type Resource = typeof resources.$inferSelect;

export const studentWeekProgress = pgTable(
  "student_week_progress",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    subjectWeekId: uuid("subject_week_id")
      .notNull()
      .references(() => subjectWeeks.id, { onDelete: "cascade" }),
    videoWatchedAt: timestamp("video_watched_at", { withTimezone: true }),
    bookletOpenedAt: timestamp("booklet_opened_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.subjectWeekId] })],
);

export type Term = typeof terms.$inferSelect;
export type SubjectTopic = typeof subjectTopics.$inferSelect;
export type SubjectWeek = typeof subjectWeeks.$inferSelect;
export type TutorWeekSection = typeof tutorWeekSections.$inferSelect;
export type TutorWeekAttachment = typeof tutorWeekAttachments.$inferSelect;
export type StudentWeekProgress = typeof studentWeekProgress.$inferSelect;

// ------------------------------------------------------------------------

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

// Backend rate limiting (migration 0014). Written/read only server-side via
// the postgres role and the check_rate_limit() function; RLS-locked with no
// policies. Table def kept here for schema discipline; not queried via the ORM.
export const rateLimits = pgTable(
  "rate_limits",
  {
    bucket: text("bucket").notNull(),
    identifier: text("identifier").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.identifier] })],
);

export const mathGameScores = pgTable(
  "math_game_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    difficulty: mathGameDifficultyEnum("difficulty").notNull(),
    score: integer("score").notNull(),
    playedAt: timestamp("played_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("math_game_scores_board_idx").on(t.difficulty, t.score.desc()),
    index("math_game_scores_student_idx").on(t.studentId, t.difficulty),
  ],
);

export const quizStatusEnum = pgEnum("quiz_status", [
  "draft",
  "requested",
  "pending_review",
  "changes_requested",
  "approved",
]);

export const quizQuestionTypeEnum = pgEnum("quiz_question_type", [
  "multiple_choice",
  "true_false",
  "context",
]);

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    subjectWeekId: uuid("subject_week_id")
      .notNull()
      .references(() => subjectWeeks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: quizStatusEnum("status").notNull().default("draft"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id),
    assignedTutorId: uuid("assigned_tutor_id").references(() => profiles.id),
    note: text("note"),
    approvedBy: uuid("approved_by").references(() => profiles.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("quizzes_subject_week_unique_idx").on(t.subjectWeekId),
    index("quizzes_assigned_tutor_idx").on(t.assignedTutorId),
  ],
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    type: quizQuestionTypeEnum("type").notNull(),
    position: integer("position").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => quizQuestions.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("quiz_questions_quiz_idx").on(t.quizId),
    index("quiz_questions_parent_idx").on(t.parentId),
  ],
);

export const quizOptions = pgTable(
  "quiz_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => quizQuestions.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    position: integer("position").notNull(),
  },
  (t) => [index("quiz_options_question_idx").on(t.questionId)],
);

export const quizAttachments = pgTable(
  "quiz_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    questionId: uuid("question_id").references(() => quizQuestions.id, {
      onDelete: "cascade",
    }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    fileName: text("file_name").notNull(),
    storageBucket: text("storage_bucket").notNull(),
    storagePath: text("storage_path").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("quiz_attachments_quiz_idx").on(t.quizId),
    index("quiz_attachments_question_idx").on(t.questionId),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Homework = typeof homework.$inferSelect;
export type HomeworkAssignment = typeof homeworkAssignments.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type QuizAttachment = typeof quizAttachments.$inferSelect;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
