# آيلوجيا للاختبارات — iLogia Exams

Online examination platform for **iLogia** (Egyptian EdTech). Arabic-first (RTL) with English as a secondary language, for students and educational administrators.

Target domain: `exams.ilogia-eg.com`

## What this is

A complete, full-stack examination platform:

- **Student side** — dashboard, exam catalogue with filters, exam details, a dedicated timed exam room (desktop + mobile), results with per-question review, attempt history, analytics, profile.
- **Admin side** — overview, subject/topic management, exam builder (all settings), question editor (all four question types), attempt review, and **manual grading of subjective (essay) answers**.
- **Real data only** — no fake grades, no fake students, no fake analytics. Empty states are shown where there is no data.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui, React Router v7, Lucide icons |
| Backend | Hono + tRPC 11 (end-to-end typed) |
| Database | MySQL via Drizzle ORM |
| Auth | Kimi OAuth 2.0 (JWT session cookie) |
| Fonts | IBM Plex Sans Arabic (UI) + Noto Naskh Arabic (display) |

Design identity: iLogia Design System v3 "Academic Prestige" (green `#005542`, ivory `#FBF9F5`, gold `#D4AF37`), matching the live ilogia-eg.com identity.

## Security model (read this before changing anything)

1. **Server-controlled timing.** `deadline_at` is computed and stored on the server when an attempt starts. The browser countdown only *displays* `deadlineAt − serverNow`; changing the device clock cannot extend an exam. Expiry is enforced lazily on every attempt-related call and with a 90-second submit grace window (`SUBMIT_GRACE_MS` in `api/lib/grading.ts`).
2. **Server-only scoring.** `finalizeAttempt()` in `api/lib/grading.ts` grades every answer on the server. The browser never sends a score, and the server would not accept one.
3. **Answer keys never leak.** The `exams.attempt` procedure strips `isCorrect` from options before sending questions to the browser. Results only reveal correct answers when the exam's review policy allows it (`immediate` / `after_close` / `never`).
4. **Subjective answers are graded by humans.** `text` questions are stored as *pending* (`is_correct = null`) until an administrator assigns marks from the admin panel. They are never auto-graded.
5. **No duplicate submissions.** `submit` is idempotent — a second call returns `{ duplicate: true }` without changing anything.
6. **Role-based permissions.** All `/admin/*` routes and the whole `adminRouter` require the `admin` role. There is no fake/frontend-only admin check.
7. **Refresh & disconnect recovery.** Answers autosave (debounced) to the server; reloading the exam room restores the in-progress attempt, saved answers, and the true remaining time.

## Question types

| Type | Grading |
|---|---|
| `mcq_single` | exact match, automatic |
| `mcq_multi` | per-exam setting: `all_or_nothing` or `partial` ((correct picks − wrong picks) × marks/correct count, floored at 0) |
| `true_false` | exact match, automatic |
| `text` | **manual** — pending until an admin grades it, then totals are recomputed |

## Routes

`/` dashboard · `/exams` catalogue · `/exams/:id` details · `/exam/:attemptId` exam room · `/results/:attemptId` results · `/history` · `/analytics` · `/profile` · `/admin` panel (role-gated) · `/login`

## Commands

```bash
npm run dev        # dev server with HMR at http://localhost:3000
npm run build      # production build → dist/ (frontend → dist/public, server → dist/boot.js)
npm start          # NODE_ENV=production node dist/boot.js
npm run check      # type-check
npm run db:push    # sync Drizzle schema to the database
npx tsx db/seed.ts # seed the Arabic demo exam bank (idempotent)
```

## Project structure

```
api/            Hono + tRPC server (router.ts, exams-router.ts, admin-router.ts, lib/grading.ts)
contracts/      shared constants/types across the client/server boundary
db/             schema.ts (Drizzle) + seed.ts (Arabic exam bank)
src/pages/      route pages; src/pages/admin/ the admin panel
src/components/ AppLayout (RTL header + mobile bottom nav), shared UI
src/lib/        labels.ts (Arabic maps & formatters)
docs/           DEPLOYMENT.md, supabase-migration.sql
```

## Accounts & data

- Sign-in is via **Kimi OAuth**. The platform owner's account automatically receives the `admin` role; grant admin to others by setting `role = 'admin'` in the `users` table.
- The development database currently contains two technical test users (`test-admin-001`, `test-student-001`) used for end-to-end verification, plus the seeded Arabic exam bank (6 subjects, 7 exams). Remove the test users before go-live if desired; all exam content is editable from the admin panel.

## Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — publishing, custom domain, operations.
- [docs/supabase-migration.sql](docs/supabase-migration.sql) — prepared schema + RLS for the **future** migration onto the existing iLogia Supabase project (not executed; see the header comments).
