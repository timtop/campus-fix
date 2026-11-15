# Observed verification

Date: 15 November 2026. Environment: local macOS ARM64, Node 22.22.2, pnpm 10.11.0, SQLite/Prisma. Browser: Playwright Chromium headless. Target: the built production Node server on loopback, not a public deployment.

- `pnpm typecheck`: passed with no type errors.
- `pnpm test`: 2 files, 7 tests passed (authorization/workflow/CSV policies and Vue status component).
- `pnpm build`: production client and server compiled successfully.
- `pnpm test:e2e`: 7 tests passed. Four API scenarios and three browser scenarios; tests include multiple assertions and workflows.
- Committed SQL migration applied to a separate empty SQLite database successfully.
- Nine screenshots captured from the actual application; desktop and mobile output inspected.
- Production dependency audit: zero high/critical findings; one low and two moderate findings remain in transitive tooling dependencies (deepmerge and minimatch). Audit JSON includes dependency paths. No claim of a clean security audit is made.
- Docker executable exists, but Docker daemon was not running. Container build/run was not verified.
- No public hosting deployment or remote database verification occurred. No hosting credentials or URL are claimed.

Initial failures were corrected before final checks: mismatched HTML tag, recursive Nuxt request inference, missing tool types, Node path selection, SQLite file initialization, password accessible name, empty registration name in login payload and missing Playwright browser. Final logs are stored beside this file in evidence/.

Tests use the seeded accounts and write demo records. Use a disposable database. Seed data and screenshot counts are synthetic. No coverage percentage, load capacity or full penetration-test result is asserted.
