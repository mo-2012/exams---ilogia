import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  boolean,
  float,
  json,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// iLogia Exams — examination platform tables
// Mirrors the proposed Supabase entities (see supabase/ migration files).
// FK columns referencing a serial() PK use bigint unsigned to match MySQL.
// ============================================================================

export const subjects = mysqlTable("exam_subjects", {
  id: serial("id").primaryKey(),
  nameAr: varchar("name_ar", { length: 255 }).notNull(),
  nameEn: varchar("name_en", { length: 255 }),
  icon: varchar("icon", { length: 64 }),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const topics = mysqlTable(
  "exam_topics",
  {
    id: serial("id").primaryKey(),
    subjectId: bigint("subject_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => subjects.id),
    nameAr: varchar("name_ar", { length: 255 }).notNull(),
    nameEn: varchar("name_en", { length: 255 }),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [index("topics_subject_idx").on(t.subjectId)],
);

export const exams = mysqlTable(
  "exams",
  {
    id: serial("id").primaryKey(),
    subjectId: bigint("subject_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => subjects.id),
    topicId: bigint("topic_id", { mode: "number", unsigned: true }).references(
      () => topics.id,
    ),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    instructions: text("instructions"),
    difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"])
      .notNull()
      .default("medium"),
    durationMinutes: int("duration_minutes").notNull().default(30),
    passingScore: int("passing_score"), // percentage 0-100, null = not configured
    maxAttempts: int("max_attempts").notNull().default(1),
    startsAt: timestamp("starts_at"), // null = available immediately when published
    endsAt: timestamp("ends_at"), // null = no closing date
    status: mysqlEnum("status", ["draft", "published", "closed"])
      .notNull()
      .default("draft"),
    // when may a student see correct answers & explanations
    reviewPolicy: mysqlEnum("review_policy", ["immediate", "after_close", "never"])
      .notNull()
      .default("after_close"),
    multiSelectScoring: mysqlEnum("multi_select_scoring", [
      "all_or_nothing",
      "partial",
    ])
      .notNull()
      .default("all_or_nothing"),
    createdBy: bigint("created_by", { mode: "number", unsigned: true }).references(
      () => users.id,
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("exams_subject_idx").on(t.subjectId),
    index("exams_status_idx").on(t.status),
  ],
);

export const questions = mysqlTable(
  "exam_questions",
  {
    id: serial("id").primaryKey(),
    examId: bigint("exam_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => exams.id),
    topicId: bigint("topic_id", { mode: "number", unsigned: true }).references(
      () => topics.id,
    ),
    type: mysqlEnum("type", ["mcq_single", "mcq_multi", "true_false", "text"]).notNull(),
    text: text("text").notNull(),
    explanation: text("explanation"),
    imageUrl: text("image_url"),
    marks: float("marks").notNull().default(1),
    difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"])
      .notNull()
      .default("medium"),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("questions_exam_idx").on(t.examId)],
);

export const questionOptions = mysqlTable(
  "exam_options",
  {
    id: serial("id").primaryKey(),
    questionId: bigint("question_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => questions.id),
    text: text("text").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [index("options_question_idx").on(t.questionId)],
);

export const examAttempts = mysqlTable(
  "exam_attempts",
  {
    id: serial("id").primaryKey(),
    examId: bigint("exam_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => exams.id),
    userId: bigint("user_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    status: mysqlEnum("status", ["in_progress", "submitted", "expired"])
      .notNull()
      .default("in_progress"),
    startedAt: timestamp("started_at").notNull(),
    deadlineAt: timestamp("deadline_at").notNull(), // server is source of truth
    submittedAt: timestamp("submitted_at"),
    score: float("score"), // null until finalized
    maxScore: float("max_score"),
    percentage: float("percentage"),
    passed: boolean("passed"), // null when no passing score configured
    correctCount: int("correct_count").notNull().default(0),
    incorrectCount: int("incorrect_count").notNull().default(0),
    unansweredCount: int("unanswered_count").notNull().default(0),
    pendingGradingCount: int("pending_grading_count").notNull().default(0),
    timeUsedSeconds: int("time_used_seconds").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("attempts_exam_idx").on(t.examId),
    index("attempts_user_idx").on(t.userId),
  ],
);

export const examAnswers = mysqlTable(
  "exam_answers",
  {
    id: serial("id").primaryKey(),
    attemptId: bigint("attempt_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => examAttempts.id),
    questionId: bigint("question_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => questions.id),
    selectedOptionIds: json("selected_option_ids").$type<number[]>(),
    textAnswer: text("text_answer"),
    isCorrect: boolean("is_correct"), // null = not auto-gradable / pending review
    marksAwarded: float("marks_awarded"),
    gradedBy: bigint("graded_by", { mode: "number", unsigned: true }).references(
      () => users.id,
    ),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("answers_attempt_question_uniq").on(t.attemptId, t.questionId),
    index("answers_attempt_idx").on(t.attemptId),
  ],
);

export type Subject = typeof subjects.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Exam = typeof exams.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type QuestionOption = typeof questionOptions.$inferSelect;
export type ExamAttempt = typeof examAttempts.$inferSelect;
export type ExamAnswer = typeof examAnswers.$inferSelect;
