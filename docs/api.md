# REST API

Base path `/api`. All protected endpoints use the `campus_session` cookie from login. Requests and responses are JSON except CSV export. `public/openapi.json` can be imported into Swagger Editor or Postman. Start the app and retrieve `/openapi.json`. Authentication is an opaque session token, not a JWT.

## Authentication

POST `/auth/register`: `{name,email,password,roleId}`. Password 12-72 characters; role is STUDENT or STAFF. Returns public user and session cookie.
POST `/auth/login`: `{email,password}`. Returns public user and session cookie.
GET `/auth/me`: current public user. POST `/auth/logout`: revoke current session and clear cookie.

## Requests

GET `/requests?search=&status=&categoryId=&page=1`: scoped list `{items,total,page,pages}`, six per page. Administrator sees all, officer sees assigned, student/staff sees owned.
POST `/requests`: student/staff only. Body `{title,description,location,categoryId,priority,image?}`. Title 5-160, description 15-3000, location 3-200 characters; priority LOW/NORMAL/HIGH. Optional image: PNG/JPEG/WebP base64 data URL, max approximately 2 MB. Returns created request.
GET `/requests/{id}`: authorized request with category, public owner, assignment/officer and status logs/actors.
PATCH `/requests/{id}`: owner, OPEN only. Same required fields as creation except image cannot be changed.
DELETE `/requests/{id}`: owner when OPEN, or administrator. Deletes request and dependent logs/assignment, keeps audit record.
POST `/requests/{id}/assign`: admin only, `{officerId}`. Officer must be active. Assigns or reassigns a nonterminal request and notifies owner/officer.
PATCH `/requests/{id}/status`: admin or assigned officer, `{status,note}`. Note 5-1000 characters. ASSIGNED -> IN_PROGRESS -> COMPLETED. Admin can set CANCELLED from any nonterminal state. Concurrent changes return 409.

## Administration

GET `/categories`: any signed-in user. POST `/categories`: admin, `{name}`. PATCH `/categories/{id}`: admin, `{name}`. DELETE `/categories/{id}`: admin, unused categories only.
GET `/users`: admin only, public users. PATCH `/users/{id}`: admin, `{roleId,active}`. Cannot change own account. An inactive user's sessions are denied immediately.
GET `/reports`: admin only, total, status counts, category counts, average resolution hours (nullable).
GET `/reports/export`: admin only, downloadable CSV. Formula-leading cells are prefixed with a quote; embedded quotes are escaped.
GET `/audit`: admin only, latest 100 actions in descending time order.
GET `/notifications`: current user's latest 30 notifications. PATCH `/notifications`: mark own notifications read.
GET `/health`: public database connectivity probe, `{status:"ok"}`.

## Errors and security

400 invalid input; 401 missing/invalid session or wrong credentials; 403 wrong role/owner or foreign Origin; 404 missing resource/route; 409 duplicate/in-use record, invalid status or concurrent change; 413 declared oversized body; 429 authentication attempt limit; 500 generic server failure. Error messages are in `statusMessage`; password hashes and session records are never returned in user responses. All successful operations currently return 200. API responses are `Cache-Control: no-store`.

Example: sign in through the app, then use the authenticated browser console only on the local demo to call `fetch('/api/requests').then(r=>r.json()).then(console.log)`. Postman clients should retain cookies and omit Origin or use the app's exact origin. Never place real session tokens in screenshots or source submissions.
