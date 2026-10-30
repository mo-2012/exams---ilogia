# Deployment — iLogia Exams

## How this app ships

The platform deploys the project as a **dynamic** version: a `bootstrap` runs
`node dist/boot.js`, and the deploy zip contains only `bootstrap` + `dist/` +
`.env` + `package.json` (no `node_modules`). The build therefore bundles all
server dependencies into `dist/boot.js` with esbuild — keep the `build` script
in `package.json` exactly as it is.

Self-check after any change to the build (must pass before saving a version):

```bash
npm run build
mkdir /tmp/cold && cp -r dist package.json .env /tmp/cold/
cd /tmp/cold && NODE_ENV=production node dist/boot.js   # must listen on :3000
```

## Publishing

1. Save a version (the version card gives an instant preview).
2. Click **「publish」** in the Kimi UI to put the site on the public web.
3. Publishing serves the frontend from `dist/public` and runs the Hono server
   with `NODE_ENV=production node dist/boot.js`.

## Custom domain: exams.ilogia-eg.com

After publishing, point `exams.ilogia-eg.com` at the published URL:

1. In the Kimi site settings, add the custom domain `exams.ilogia-eg.com`.
2. At the DNS provider for `ilogia-eg.com`, create a **CNAME** record:
   `exams` → the published `<name>.ok.kimi.link` host.
3. Wait for DNS propagation and TLS issuance, then verify
   `https://exams.ilogia-eg.com` loads and sign-in works end-to-end.

## Database

- The app uses the platform-managed MySQL database (`DATABASE_URL` in `.env`,
  generated at init — never edit it).
- `npm run db:push` syncs `db/schema.ts` to the database (development).
  For production changes prefer `npm run db:generate` + `npm run db:migrate`.
- **Never** drop tables or run `db:push --force` — attempts and answers are
  user data.
- Data persists across versions and redeploys; new versions do not wipe it.

## Operations notes

- **Grading queue**: admins see attempts with pending essay answers under
  `/admin` → exam → attempts. Grading an essay recomputes the attempt totals
  automatically.
- **Closing an exam**: set status to `closed` from the admin panel. With the
  `after_close` review policy, students can review their answers only after
  that point.
- **Time authority**: the server clock is the only source of truth. If the
  server time is wrong, every deadline is wrong — keep the host on NTP.
- **Test users**: `test-admin-001` / `test-student-001` exist in the dev
  database from end-to-end verification. Delete them (and their attempts)
  before go-live if you want a clean slate.

## Future: migration onto the existing iLogia Supabase project

The master plan is to unify with the main iLogia site (Supabase project
`zugwicbbfbefbbwugfxq`). `docs/supabase-migration.sql` contains the prepared
Postgres schema with Row-Level Security for that migration. Rules that still
apply when that work starts:

- Do **not** create another Supabase project — use the existing one.
- Do **not** modify existing production tables without approval — the exam
  tables are all prefixed `exam_` to avoid collisions.
- Never place a Service Role key in frontend code; never disable RLS to make
  development easier.
- Port `api/lib/grading.ts` to a `security definer` Postgres function or an
  Edge Function so scoring stays server-side.
