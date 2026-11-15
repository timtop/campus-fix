# Cloudflare live deployment

Live URL: https://campusfix.campusfix.workers.dev
Deployment verified: 15 November 2026.
Active version after persistence redeployment: 41fd5575-6da0-4fcb-8697-5a1fcd226fc9.
Database: campusfix-db; binding DB; ID f1fef92f-fe46-46b7-839d-a5cc6963fdc7.

Cloudflare authorization was confirmed. The selected database was empty, its initial migration was applied, and four demonstration users, six categories and eight requests were seeded. The generated private password and password pepper are excluded from this report, source archive and submission PDF. The pepper is configured as a Cloudflare Worker secret. Private account login details are delivered separately to the project owner.

Observed checks:

- Cloudflare production build and TypeScript check passed.
- Nine unit/component/password checks passed.
- All eight API/browser scenarios passed against the live HTTPS URL in 26.4 seconds.
- The public database health endpoint returned HTTP 200 with status ok.
- Live browser tests captured all nine interface screenshots.
- The same tested Worker build was redeployed. The request snapshot was unchanged across deployment, and HTTPS login/request reads were checked again. See evidence/live-persistence.json.

Initial HTTPS probes failed during address activation. After the address became reachable, live login exposed Cloudflare's 100,000-iteration PBKDF2 cap. Password hashing was updated to the supported limit with random salts and an independent HMAC-SHA-256 pepper. Only the four newly created demo hashes were reinitialized. The corrected deployment passed the full live suite.

Testing used synthetic demonstration records. The tests may leave an inactive integration account, category and audit/notification records. Do not run the full mutation suite on an institutional production database. No load-test capacity or formal security certification is claimed.
