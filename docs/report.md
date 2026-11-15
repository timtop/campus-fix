# CampusFix: University maintenance and service request management

MIT 8333 - Advanced Web Application Development (Virtual lab)
MIVA Open University | 2026/2027 continuous assessment | 40 marks
Prepared 15 November 2026

The student's name and matriculation number were not supplied. Add your real identification before submission. This report describes the delivered implementation and distinguishes local verification from work that still needs a hosting account.

## 1. Introduction and problem statement

The assessment describes a university receiving complaints through phone calls, paper, WhatsApp and office visits. These channels scatter information, make progress difficult to follow and leave responsibility unclear. A leaking pipe may be reported repeatedly while an electrical fault has no recorded owner.

CampusFix centralizes these requests. A student or staff member records a fault with a location, category, priority and optional image. An administrator assigns an officer. The officer records progress and completion. The requester can read the history without contacting the maintenance office. Administrators can review counts and export records for further analysis.

The scope is campus maintenance coordination. CampusFix does not process payments, automate physical repairs or integrate with university identity systems. Demonstration records and accounts are synthetic.

## 2. System objectives

Provide an accessible browser interface for submitting and tracking faults. Give every submitted request an identifiable owner and an explicit status. Restrict each maintenance officer to assigned requests. Let administrators assign work, manage access and categorize faults. Preserve progress notes and administrative activity for accountability. Produce repeatable tests and a submission containing actual output screenshots and application source.

Acceptance is demonstrated by a complete workflow: create a request as a student, deny another user's access, assign an officer as an administrator, move the request through IN_PROGRESS to COMPLETED, and verify the student's notification and timeline. The API tests exercise this workflow in the local Workers runtime.

## 3. Requirement analysis

There are four stored roles and three dashboard families. STUDENT and STAFF share the requester interface. OFFICER sees assigned work. ADMIN sees campus-wide requests and administrative tools. Public registration cannot select OFFICER or ADMIN; an existing administrator grants those roles.

Frontend requirements map to the login/registration screen, request form, request list filters, request detail timeline, assignment controls, reports and user/category management. Forms use native required/minimum/maximum validation; the API repeats validation independently. Errors and successful actions appear in visible status messages. Narrow layouts reorganize the navigation and reduce table columns while keeping request details available.

Backend requirements map to cookie sessions, per-operation authorization, CRUD routes, assignment routes and transactional status changes. Request reads and list counts use the user's access scope. A guessed request identifier does not bypass ownership rules. An officer cannot inspect unassigned work or cancel requests.

The database contains all six required concepts: users, roles, requests, categories, assignments and status logs. Sessions, notifications and audit records support advanced behavior. SQLite meets the assessment's relational-database option and makes the project runnable without an external database service.

Eight listed advanced features are implemented: session authentication, role authorization, image evidence, in-app notifications, search/filter/pagination, audit trail, OpenAPI documentation and CSV export. Automatic 15-second polling is also implemented. It is periodic refresh rather than instantaneous server-push real-time delivery.

Nonfunctional requirements include server-side data isolation, safe password handling, predictable errors, a persistent database and repeatable builds. The delivered tests cover the documented workflow; performance under campus-wide load and formal accessibility certification remain outside the verified scope.

## 4. Frontend technologies used

Nuxt and Vue provide a component-based interface. TypeScript checks application and tool configuration types. Tailwind runs through PostCSS; a custom CSS layer defines the CampusFix palette, layout, responsive behavior and component states. The source entry is app.vue, with StatusBadge as a reusable component.

The interface uses muted green surfaces and clear record rows. Navigation follows the user's role. The administrator sees four request counts above the queue; students and staff see their own request tracker; officers see assigned work. A detail dialog contains the description, current officer, evidence image and chronological status notes. Forms show validation requirements before submission and return server errors when necessary.

Vue reactive state holds filters, form input, current user and the active view. A common action wrapper handles busy, success and error feedback. After a mutation the interface reloads authorized data. Fifteen-second polling refreshes lists and notifications when a user is signed in and no form/detail dialog is open. The app deliberately keeps authorization decisions on the server.

## 5. Backend technologies used

Nuxt Nitro compiles the REST backend for Cloudflare Workers. Zod validates submitted fields. Parameterized SQL accesses Cloudflare D1 through a DB binding. Web Crypto PBKDF2-SHA-256 hashes passwords with 100,000 iterations, random salts and a separate HMAC-SHA-256 password pepper. Web Crypto generates 32 random bytes for each session token and hashes the token with SHA-256 before storage.

The browser receives an HttpOnly, SameSite=Lax session cookie. Sessions expire after eight hours and logout deletes the server record. Each protected operation reads the user's current active flag and role. Production enables Secure cookies behind HTTPS. Foreign Origin headers are rejected for writes, API responses are not cached, and password hashes are omitted from user responses.

A process-local login/registration limiter allows 20 attempts per IP in 15 minutes. It provides a basic single-instance defense; a shared limiter and verified proxy configuration are needed for multiple servers. Content-Length is checked before API writes, while a production proxy must also impose a streaming request-body limit.

Status changes check the allowed state transition and use an atomic D1 batch. A conditional update requires the request to remain in the status/version originally read. D1 executes the mutation and dependent writes in an atomic batch. A unique operation log gates notifications and audit inserts; concurrency tests verify that competing progress updates produce one successful history entry. Assignment validates an active OFFICER before recording the assignment and notifying the participants.

## 6. Database used and relationships

Cloudflare D1 stores relational SQLite data behind a Worker binding. The Prisma schema documents the relational model and generated the initial migration; Prisma Client is not used at runtime. The initial SQL migration creates tables, uniqueness rules, foreign keys and the owner/status index. Wrangler applies committed D1 SQL migrations separately to local emulation or the remote database. Seed logic upserts the four roles, six fault categories and four demonstration users, then creates eight example requests only if none exist.

Role to User is one-to-many. User to ServiceRequest and Category to ServiceRequest are one-to-many. ServiceRequest to Assignment is one-to-zero-or-one for the current officer; a unique requestId prevents multiple current assignments. User to Assignment is one-to-many. ServiceRequest to StatusLog is one-to-many; each log also references its actor. User to Session and User to Notification are one-to-many.

Deleting a request cascades to its assignment and status logs. Audit records retain independent actor and target identifiers, so a deletion action remains visible. Categories in use cannot be deleted. User management changes role and active status instead of deleting identities that existing history references.

Workers use the shared D1 binding rather than writing a local database file. Local D1 state under .wrangler is separate from the remote database. Existing prisma/campusfix.db files belong to the earlier local implementation and are not used by the Worker.

## 7. API documentation

The base path is /api. Authentication routes register, log in, identify the current user and log out. Request routes list, create, read, update, delete, assign and change progress. Administrative routes manage categories and users, return audit actions and produce reports/CSV. Notifications belong to the current user. A public health route performs a database query.

Creation requires title, description, location, categoryId and priority. Title length is 5-160 characters, description 15-3000 and location 3-200. Priority is LOW, NORMAL or HIGH. Optional evidence is a bounded PNG/JPEG/WebP data URL of approximately 1 MB or less. Only the owner can edit an OPEN request. The owner can delete an OPEN request; an administrator can delete any request after the UI confirmation.

The workflow is OPEN -> ASSIGNED -> IN_PROGRESS -> COMPLETED. An administrator may cancel a nonterminal request. Terminal requests cannot be reopened or reassigned. Status notes require 5-1000 characters.

Success responses use HTTP 200. Validation uses 400; authentication 401; denied access 403; missing records 404; record/workflow conflicts 409; declared oversized bodies 413; excessive authentication attempts 429. Unhandled server failures return a generic 500 message. docs/api.md contains the endpoint contract and public/openapi.json is importable into Swagger/Postman. An endpoint table and OpenAPI source are included in this submission appendix.

## 8. Screenshots of major interfaces

The screenshots in this submission were captured by Playwright from the live HTTPS deployment on Cloudflare Workers. They are browser renders of CampusFix, not mockups. Each image is captioned in the PDF with its role and purpose. The screenshot directory contains login, administrator dashboard, reports, people management, officer dashboard, student dashboard, submission form, request tracking and mobile output.

## 9. Testing evidence

Verification results and command logs are recorded in docs/verification.md and docs/evidence/. The final test summary accompanies this section in the PDF. Only observed successful commands are described as passing. Initial failures are retained in the report's challenges section as resolved issues rather than presented as final results.

Policy tests check owner/admin access, assigned-officer access, rejection of unrelated users, ordered status transitions and CSV formula escaping. Component tests check readable multiword status text and updates when a status changes. Password tests check random salts, correct/wrong passwords and malformed stored hashes. API integration tests check anonymous/cross-origin rejection, restricted roles, private record access, validation, CRUD, assignment, ordered progress, notifications, CSV output, registration privilege escalation and logout revocation.

Browser tests exercise login, image request creation, editing and deletion, administrator reporting/category creation, people management visibility, officer/student dashboards, detail history and a mobile width assertion. They also capture the screenshots. The suite passed against the local Worker/D1 emulator and again against the deployed HTTPS application and remote D1 database. The initial migration is separately exercised against an empty database.

Additional Cloudflare tests verify concurrent officer updates and atomic rollback of a request with an invalid category. These tests verify representative behavior, not every possible path. They do not prove resistance to all attacks, load capacity, email delivery or public hosting. No coverage percentage is claimed. Remote database connectivity and the documented live workflows passed after authorization; load testing and institutional production readiness are not claimed.

## 10. Deployment information

Live URL: https://campusfix.campusfix.workers.dev

CampusFix is deployed on Cloudflare Workers with the DB binding connected to the user's D1 database. Cloudflare authorization was verified, the empty database inspected, the initial SQL migration applied and four demonstration users seeded with a generated private password. Login details are delivered separately and excluded from the submission and source archive.

The HTTPS health endpoint returns HTTP 200 with status ok. All eight API/browser scenarios pass against the public URL, including request CRUD, backend authorization, officer assignment/completion, notifications, reporting, mobile layout, concurrent updates and rollback. Nine unit/component/password tests also pass. Screenshots in section 8 were captured from the actual deployed application. The same Worker build was redeployed to check D1 persistence; observed results and deployment version are recorded in docs/cloudflare-status.md.

The first public checks encountered TLS handshake failures while the newly registered workers.dev address became available. Once HTTPS responded, live login exposed a platform PBKDF2 limit that the local emulator did not enforce. The production code now uses Cloudflare's supported 100,000 iterations with random salts and a separate HMAC-SHA-256 password pepper. The pepper is stored as a Cloudflare Worker secret; its value and the account password are not present in source or report. The corrected deployment passed the live suite.

Wrangler applies D1 migrations and deploys the cloudflare_module build. D1 data persists separately from Worker versions. No Docker daemon or persistent local server disk is needed. Local .wrangler data remains separate from the remote database. The local .dev.vars copy of the password pepper must be backed up privately; changing the pepper requires a planned password reset. HTTPS sessions use Secure cookies automatically.

## 11. Challenges encountered and solutions

The source PDF was not present at the referenced /mnt/data path on this computer. The original attachment was retrieved through the referenced conversation and read from its available local attachment path, preserving the actual assessment requirements.

Package downloads required network-enabled execution. The shell initially selected an older Node executable; verification commands were changed to use Node 22. The initial dependency audit identified advisories, prompting dependency updates and another verification cycle. Current audit results are recorded with the final evidence.

Type checking exposed deeply recursive inferred types for the catch-all API route and missing Node tool types. The UI now uses an explicit fetch boundary, while TypeScript continues to check application code. A mismatched HTML closing tag was corrected before the build passed. The browser suite exposed an inaccessible password label and a login payload containing an empty registration name; both were fixed and retested.

The Prisma engine initially failed when its SQLite file did not exist. The earlier Node version used a file initializer before migrations; the Cloudflare version uses Wrangler D1 migrations instead. The original SQLite migration was verified on a separate empty file; the Cloudflare conversion also applies the D1 migration to a separate local D1 database. The matching Playwright browser was missing and was installed before collecting screenshots. Cloudflare deployment replaces the earlier Docker/Render configuration. Cloudflare authorization was completed and remote deployment verified.

Evidence images are bounded database data URLs rather than external object-storage files. This avoids public file paths and simplifies the assessment demo, at the cost of larger records and responses. A real university deployment should add private storage, content inspection, user quotas, verified institutional email and a password recovery process. Dialogs contain keyboard focus, close with Escape and return focus to their trigger. A wider assistive-technology review remains future work.

## 12. Conclusion

CampusFix implements the university maintenance workflow with role-specific interfaces, authenticated REST endpoints, relational persistence, request assignment, progress history and eight listed advanced features. The source, test evidence and actual screenshots accompany this report. Local checks and live deployment evidence are stated separately. The application has been published and checked using the authorized Cloudflare account. The student must add their real identification before submitting the report.

References: MIVA Open University MIT 8333 assessment, pages 1-3; Nuxt deployment documentation (https://nuxt.com/docs/3.x/getting-started/deployment); Prisma SQLite documentation (https://www.prisma.io/docs/orm/v6/overview/databases/sqlite). Framework links explain the general stack; implementation and test claims are supported by the included source and local evidence.
