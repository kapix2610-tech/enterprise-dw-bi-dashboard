# Datawise BI Platform

Datawise is a business intelligence dashboard with CSV/Excel ingestion, automatic metrics, anomaly scanning, reports, and an AI chat workspace.

## Local setup

1. Create `dw-bi-backend/.env` using `dw-bi-backend/.env.example` as a reference. Keep any existing `.env` file; never commit it.
2. Configure a MongoDB Atlas connection:
   - Create a database user with a strong password.
   - Allow your development IP in Atlas **Network Access**.
   - Put the Atlas connection string in `MONGODB_URI`. URL-encode special characters in the database-user password.
   - Set `MONGODB_DB=datawise` (or the database name in your connection string).
3. Generate a private signing secret with Node.js:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   Set the output as `JWT_SECRET`; it must be at least 32 characters. Do not use a frontend environment variable for secrets.
4. From the project root, run `npm start`. The launcher reuses Datawise services already running on port 5000/3000 instead of starting duplicates. If either port is occupied by another app, stop that app or set `DATAWISE_API_PORT` / `DATAWISE_DASHBOARD_PORT` to free ports.
5. Open `http://localhost:3000`. The sign-in screen reports backend and database readiness; signup and login remain disabled until MongoDB is connected.
6. To enable registration, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `FRONTEND_URL` in the backend `.env`, using credentials from an email delivery provider. Restart the backend after changing env values.

The backend `.env.example` documents SMTP and optional AI provider settings, plus allowed frontend origins. Signup checks that the email domain has mail/DNS records, emails a time-limited confirmation link, and creates the account only after that link is clicked. Domain checks cannot prove an individual mailbox exists; confirmation delivery proves the registrant can receive mail at it. For a deployed frontend, set `REACT_APP_API_URL` in `dw-bi-dashboard/.env` to the backend URL and set the backend's `FRONTEND_URL` and `CORS_ORIGIN` to the frontend's exact origin(s).

## Authentication and persistence

- Accounts use bcrypt password hashes; passwords are never stored in plaintext.
- Login creates a signed, expiring token and a MongoDB-backed session record. `GET /api/auth/me` validates it; `POST /api/auth/logout` revokes it.
- Account, upload, report, and chat data require a live MongoDB connection. Unconfirmed registrations expire and do not create login-capable users.
- Each account can create and switch between separate domain workspaces (for example, Education and Hospital); each workspace saves its own selected metrics and uploaded-data history.
- Deleting a workspace removes only its saved setup. Its datasets remain available in Data history under **All workspaces** or the archived-workspace filter; dataset deletion remains a separate, explicit action.
- Data history can reopen datasets, preview uploaded rows, and delete an individual upload or older/all uploads together with related chats and reports.
- Dashboard navigation and KPI cards reflect only the active workspace's selected metrics; saved uploads restore when that workspace is opened again. Use **Edit** beside the workspace selector to change its metrics, or **＋ New** to set up another domain.
- AI reports can be downloaded as PDF, Word, or PowerPoint; exports include branded headings, bold section titles, selected-metric summaries and visual comparisons, with PowerPoint also providing a full-slide chart and recommendation pages.

## Live REST API data

Open **Import your data → REST API** in the workspace where the live data should appear. Provide a source name, an HTTPS JSON GET endpoint, and its bearer token. If the endpoint returns rows in a nested array, provide its dot-separated path (for example, `data.records`). The accepted response is an array of JSON objects at the root, under `data`, or at the configured path; empty arrays are supported. Datawise encrypts the token in the backend using the signing secret; it is never sent back to the dashboard.

Connecting tests and imports a first snapshot immediately. The backend refreshes the source every five minutes, and the dashboard checks for refreshed snapshots every 30 seconds. Use **Refresh now** to sync manually, or **Disconnect** to stop future requests while retaining the latest snapshot in Data history. Each account can connect one REST API per workspace.

For safety, endpoints must use standard-port HTTPS and resolve to public IPv4 addresses. URL credentials, secret-like query parameters, redirects, and private/local network targets are rejected. Responses are limited to 10 MB, 50,000 rows, and 20 seconds; ensure the backend host can reach the endpoint. Configure a strong `JWT_SECRET` before connecting sources.

If the database status remains unavailable, verify the MongoDB URI, Atlas database-user credentials, Atlas Network Access allowlist, and the backend log. The backend retries a failed connection automatically, and the sign-in page rechecks readiness. An Atlas connection cannot be fixed by frontend changes if the current IP is blocked.

## Validation

```powershell
npm test -- --watchAll=false
npm run build
npm --prefix ..\dw-bi-backend test
```

## Deployment notes

Build the dashboard with `npm run build`. Configure backend environment variables in the hosting provider's secret manager, not in source control. Set a strong `JWT_SECRET`, `MONGODB_URI`, `MONGODB_DB`, `PORT`, production `CORS_ORIGIN`, `FRONTEND_URL`, and authenticated SMTP delivery credentials; configure AI credentials only when needed. Never commit `.env` files or expose backend credentials in frontend code.
