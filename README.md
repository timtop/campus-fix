# CampusFix

MIT 8333 university maintenance system. Nuxt 4, Vue, TypeScript and Tailwind run on Cloudflare Workers; Cloudflare D1 stores relational data. The Prisma schema documents the model and generated the initial SQL migration. The runtime uses parameterized D1 SQL and atomic batches rather than Prisma Client transactions.

## Local setup

Use Node 22.22+ (Node 22) and pnpm 10.11.0. From CampusFix:

```sh
pnpm install --frozen-lockfile
pnpm setup:local
DEMO_PASSWORD=CampusFix-Demo-2026 pnpm seed:local
pnpm build
pnpm preview --port 8787
```

Open http://localhost:8787. Local D1 data lives under `.wrangler/state/v3/d1/`. It is separate from your remote D1 database and the old `prisma/campusfix.db` file. `pnpm dev` is also available with Nitro's Cloudflare binding emulation; the production-runtime checks use `pnpm build` then `pnpm preview`.

Demo emails: student@campusfix.demo, staff@campusfix.demo, officer@campusfix.demo, admin@campusfix.demo. The seed command above sets their password to `CampusFix-Demo-2026`. These are public assessment accounts. Reseeding does not overwrite an existing user's password or role. For public hosting, choose a password you control when seeding and keep it private; never store it in the repository. Existing deployed credentials are in the separate private handoff file. PASSWORD_PEPPER is required for new password hashes; keep its value consistent with the Worker secret. The local copy is in gitignored .dev.vars. Changing the pepper invalidates existing hashes, so do not rotate it without a planned password reset.

## Cloudflare deployment

The supplied `wrangler.jsonc` binds `DB` to the database ID supplied for this project. The database name is configured as campusfix-db; confirm it matches your Cloudflare account. Nitro generates the Worker entry point and asset configuration during the build.

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 info DB
pnpm db:remote
# Set PASSWORD_PEPPER as a Worker secret using wrangler secret put PASSWORD_PEPPER.
# Supply the same PASSWORD_PEPPER and your DEMO_PASSWORD in the shell environment, then:
pnpm seed:remote
pnpm deploy
```

`db:remote` and `seed:remote` change the selected remote database. Initial setup is intended for a new CampusFix database. Inspect an existing database before applying migrations. Never upload the local .db file as a static website asset. No Docker or persistent local filesystem is needed on Cloudflare.

After deployment, verify `/api/health`, log in as each role, submit and assign a request, complete it, inspect notifications/timeline and export a report. Re-deploy and confirm records persist. Record the actual public URL and verification results in report section 10. Login cookies become Secure automatically on HTTPS. Cloudflare OAuth credentials are managed by Wrangler outside the project and excluded from submission artifacts.

## Verification

Start the built Worker on port 8787, then:

```sh
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
BASE_URL=http://127.0.0.1:8787 pnpm test:e2e
```

Tests write demonstration records, so use the local test database rather than a live production database. The suite covers request CRUD, ownership/roles, assignment/progress, notifications, category/user administration, registration/logout, image evidence, reports/CSV, mobile layout, concurrent progress updates and rollback on invalid foreign keys. Screenshots and results are written under docs/.

## Security and consistency

Passwords use Web Crypto PBKDF2-SHA-256 with 100,000 iterations plus an HMAC-SHA-256 password pepper stored separately as a Worker secret and independent random salts. Random session tokens are stored as SHA-256 digests, sent only in HttpOnly, SameSite=Lax cookies, and expire after eight hours. The API checks the current role, active flag and request access on every protected operation. Foreign Origin headers are rejected for writes.

D1 batches are atomic. Status and assignment writes use optimistic checks against the previous state/version; follow-up logs, notifications and audits depend on the operation's unique log record. Concurrent duplicate status changes produce one success and one conflict. The backend uses bound SQL parameters rather than interpolating user values into queries.

Eight listed advanced features: sessions, role authorization, image evidence, in-app notifications, search/filter/pagination, audit trail, OpenAPI documentation and CSV export. Status lists also refresh every 15 seconds; this is polling, not server push.

## Limits

Evidence uploads are PNG/JPEG/WebP data URLs limited to about 1 MB to keep records within D1 row-size limits. Larger or production-scale media should use private R2 storage. Input is bounded and MIME/data URL shape is validated; content inspection and quotas remain future work. The attempt limiter is per Worker isolate and is not a global abuse defense. Password recovery, verified university membership, formal load testing and institutional identity integration are not implemented.

## Files

- `server/api/[...path].ts`: HTTP routes and D1 SQL.
- `server/utils/`: D1 access, sessions, password hashing and policies.
- `d1/migrations/`: active D1 SQL migrations.
- `prisma/schema.prisma`: model and historical SQL-generation source.
- `scripts/seed-d1.ts`: idempotent D1 demo seed, local or remote.
- `wrangler.jsonc`, `nuxt.config.ts`: Cloudflare configuration.
- `docs/api.md`, `public/openapi.json`: API contracts.
- `docs/report.md`, `docs/evidence/`, `docs/screenshots/`: assessment report and observed evidence.

The earlier Node/SQLite implementation's local .db files are historical and are not used by this Worker. The source archive excludes environment files, databases, .wrangler state, dependencies and generated builds.
