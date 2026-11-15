# CampusFix

University maintenance and service request management for MIT 8333, 2026/2027. Built in a new folder using Nuxt 4, Vue 3, TypeScript, Tailwind, Nitro, Prisma and SQLite. SQLite is the assessment's permitted relational database alternative to PostgreSQL.

## Run locally

Use Node 22.22 or newer compatible Node 22 LTS and pnpm 10.11.0. From this folder:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:deploy
DEMO_PASSWORD=CampusFix-Demo-2026 pnpm db:seed
pnpm dev
```

Open http://127.0.0.1:3000. The `.env.example` database URL is relative to `prisma/schema.prisma`; the file is `prisma/campusfix.db`. Prisma CLI and Nuxt dev load `.env`. For the production server, explicitly export DATABASE_URL (use an absolute `file:` path) because Node does not automatically load this file.

Demo emails: `student@campusfix.demo`, `staff@campusfix.demo`, `officer@campusfix.demo`, `admin@campusfix.demo`. The command above sets their password to `CampusFix-Demo-2026`. These are deliberately public local demo credentials, not hosting credentials. Existing seeded users are preserved on reseeding. Use a new database to create users with a different demo password.

## Implemented behavior

Students and staff register, submit requests with photo evidence, search and track their own requests, edit open requests, and confirm deletion of open requests. Officers see assigned requests and record progress/completion notes. Administrators assign/reassign officers, cancel requests, manage user roles and active status, manage categories, inspect audit records and export CSV reports.

Nine advanced feature categories are represented: sessions, backend role authorization, image evidence, in-app notifications, search/filter/pagination, audit trail, OpenAPI documentation, CSV export, and automatic status refresh. Refresh uses 15-second polling, not a WebSocket or instantaneous push channel. The first eight meet the assessment's optional-feature wording; polling is an additional convenience.

The API owns authorization. UI visibility never grants access. Passwords use bcrypt (cost 12). Random session tokens are hashed in the database and sent in HttpOnly, SameSite=Lax cookies, expiring after eight hours. Production HTTPS enables Secure cookies. Writes reject foreign Origin headers. Login and registration share a per-IP attempt limit. Public registration allows only student/staff roles. Disabling an account denies existing sessions on the next request. Status changes use an atomic transaction and a conditional status check. Audit records are retained when requests are deleted.

## Verify

Use a disposable demo database; integration tests write and delete sample records.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
# In one terminal, from CampusFix, export an absolute database path:
export DATABASE_URL="file:$PWD/prisma/campusfix.db"
NODE_ENV=production HOST=127.0.0.1 pnpm start
# In another terminal:
pnpm test:e2e
```

`BASE_URL` changes the integration test target. `DEMO_PASSWORD` changes the test login password. Browser screenshots are saved in `docs/screenshots/`; machine-readable results are in `docs/test-results.json`. See `docs/verification.md` for observed results and limitations.

## Deployment

The application needs a Node server and persistent database storage. A static website host cannot run its APIs. Dockerfile, Compose and Render Blueprint are included. Hosting has not been provisioned and there is no claimed public deployment URL.

Local container option: `docker compose up --build`. This uses an HTTP-only localhost port and sets `COOKIE_SECURE=false`. In another terminal run `docker compose exec -e DEMO_PASSWORD=CampusFix-Demo-2026 campusfix pnpm db:seed`. The named volume retains the database.

For Render: push this folder to your own repository, create a Blueprint from `render.yaml`, and approve the paid instance and disk in your hosting account. The Docker startup applies migrations and starts the server. In the host shell run `DEMO_PASSWORD='a password you choose' pnpm db:seed`. Keep `COOKIE_SECURE=true`, use the HTTPS URL, verify `/api/health`, log in as each role, create/assign/complete a request, then restart and confirm data persists. Record the URL and verification evidence in report section 10. No credentials should be committed.

For another host mount persistent storage at `/data`, set `DATABASE_URL=file:/data/campusfix.db`, expose port 3000 behind HTTPS and set `COOKIE_SECURE=true`. Run a single instance for SQLite. Back up the database using SQLite backup tooling or a consistent volume snapshot. PostgreSQL scale-out requires changing the Prisma provider, generating a PostgreSQL migration and testing against that database; it is not claimed as verified here.

## Structure and documentation

- `app.vue`, `components/`, `assets/css/`: frontend.
- `server/api/[...path].ts`: REST routes and validation.
- `server/utils/`: database, authentication and workflow policy.
- `prisma/`: relational schema, initial migration and idempotent seed.
- `tests/`: component, policy, API and browser tests.
- `docs/api.md`, `public/openapi.json`: API guide and importable OpenAPI definition.
- `docs/report.md`: the assessment's 12-section technical report.
- `docs/architecture.md`: architecture and relationship diagrams.

## Practical limits

Photo evidence is stored as a bounded data URL in the database and returned only through authorized request reads. This is suitable for a small assessment demo; production should use private object storage, content inspection and quotas. The request body limit checks Content-Length; a reverse proxy must enforce a hard streaming body limit too. The login limiter is process-local and does not coordinate multiple instances. There is no password recovery/email verification flow. Public staff registration is allowed by the demo policy; a university deployment should verify staff membership. Completion timestamps are inferred from the last request update. Notifications are in-app only. The application is tested for its documented workflow, not certified for institutional production use.

## References

Nuxt Node deployment: https://nuxt.com/docs/3.x/getting-started/deployment
Prisma SQLite connector: https://www.prisma.io/docs/orm/v6/overview/databases/sqlite
Assessment source: CA - MIT 8333 - Advanced Web Application Development (Virtual lab).pdf, MIVA Open University, pages 1-3.
