# Cloudflare verification

15 November 2026. Node 22.22.2, pnpm 10.11.0, Wrangler 4.162.0, Cloudflare Workers local runtime and local D1. This replaces the earlier Node-server verification as the current deployment target.

- Type check: passed.
- Cloudflare production build: passed, generating the Worker entry point and assets.
- Unit/component/password tests: 3 files, 9 tests passed.
- API/browser suite: 8 scenarios covering roles, ownership, CRUD, assignment, progress, notifications, reports, registration/logout, category/user administration, image evidence and mobile layout. The additional scenario tests concurrent progress updates and invalid-category rollback.
- Initial D1 SQL migration and idempotent seed applied successfully to local D1.
- Screenshots are captured from the actual live HTTPS application, using synthetic demonstration records.

Remote migration, seed and deployment completed. All eight API/browser tests also passed against https://campusfix.campusfix.workers.dev (26.4 seconds). The public health endpoint returns 200 with status ok. See cloudflare-status.md for the final version and persistence evidence. Do not run destructive integration tests against a real campus database.

Password hashing now uses Web Crypto PBKDF2-SHA-256, 100,000 iterations, random salts and a separate HMAC-SHA-256 password pepper. D1 atomic batches replace Prisma runtime transactions. Evidence upload size is about 1 MB. The existing schema remains in Prisma format as a model/migration source; the runtime uses bound SQL.

The earlier production dependency audit reported zero high/critical findings and lower-severity transitive tooling findings. It is retained as historical evidence, not asserted as a fresh audit of the Cloudflare conversion. Formal penetration testing, load capacity and institutional accessibility certification are not claimed.
