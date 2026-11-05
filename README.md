# SAGE — Secure Access for Guests & Equipment

A responsive campus visitor and equipment pass prototype with an immersive ocean-tech interface. The workspace includes a React/Vite staff and visitor interface, an Express API, SQLite persistence, QR-coded digital passes, and versioned migrations for guests, visitor accounts, passes, equipment, staff, gate logs, and sessions.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

1. Open the project folder in VS Code.
2. In **Terminal 1**, install dependencies and start the API:

```powershell
npm install
npm run server
```

The API listens on port `3001`. On first boot it creates `data/` and `data/sage.sqlite` if needed, applies database migrations, and seeds local demo accounts when the staff and visitor tables are empty.

3. Open **Terminal 2** and start the Vite frontend:

```powershell
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). The Vite development server proxies `/api` requests to `http://localhost:3001`.

If the frontend reports a network or API error, confirm Terminal 1 still shows `SAGE API listening on http://localhost:3001`, then check `http://localhost:3001/api/health` for `{"status":"ok"}`. Server-side failures are logged in Terminal 1; API errors are returned as JSON.

## Prototype accounts

Local demo accounts are seeded when the corresponding tables are empty and `NODE_ENV` is not `production`:

| Role | Email |
|---|---|
| Facilities Officer | `facility@feu.edu.ph` |
| Campus Security Guard | `guard@feu.edu.ph` |
| Guest / Visitor | `visitor@feu.edu.ph` |

All three use `SageDemo2026!` by default. Override the seed password with `SAGE_DEMO_PASSWORD`, or set `SAGE_SEED_DEMO=false` to disable demo seeding. The demo credentials and seeded records are for local prototyping only. Set `SAGE_DB_PATH` to use a different SQLite file.

The sign-in screen uses one email-and-password form for both staff and visitor accounts. The API identifies the account type after validating credentials and routes staff to the operations console or visitors to their personal pass dashboard. Visitors can create an account from the sign-in screen, or look up a pass using its Reference ID for a read-only digital pass view. Reference lookups expose only the pass holder's name, affiliation, pass details, and registered equipment. Signed-in visitor profiles are independent from staff accounts; profile passwords are bcrypt-hashed, and each visitor can only list or retrieve passes belonging to their account. Guest pass approval status refreshes automatically while the portal is open.

Public visitor registration is available from the sign-in screen. New visitors receive a welcome email after account creation, and each submitted visit request triggers a confirmation email with its schedule and equipment details. Staff-created passes also collect the guest's email and send the same confirmation; when the email belongs to an existing visitor account, the pass is attached to that account. These messages are sent by the API using SMTP; if delivery fails, the account or request is still created and the visitor sees a notice.

The interface uses the ocean-tech palette: deepest midnight `#021024`, midnight navy `#052659`, steel blue `#5483B3`, misted ice blue `#7DA0CA`, and soft glowing cyan-white `#C1E8FF`. The login is a full-screen hero with a slow ambient background and a frosted glass sign-in panel.

## Production build

```sh
npm run build
$env:NODE_ENV="production"
$env:SESSION_SECRET="replace-with-a-long-random-secret"
npm start
```

In production, configure HTTPS and a strong `SESSION_SECRET`. Cookies are HTTP-only, secure, SameSite strict, and expire after eight hours. Passwords are stored as bcrypt hashes; the application does not seed demo accounts in production.

## Deploy the frontend on Vercel

The Vercel deployment serves the Vite frontend and proxies `/api/*` requests to the Express API at `https://sage-system-z02p.onrender.com`. The API must be deployed and reachable separately; Vercel's static frontend cannot run the SQLite-backed server itself.

For the API service on Render, use `npm install` as the build command and `npm start` as the start command. Set `NODE_ENV=production`, a strong `SESSION_SECRET`, and `SAGE_DB_PATH=/var/data/sage.sqlite`, then attach a persistent disk mounted at `/var/data`. Without that disk, the SQLite database and sessions can be lost when the service restarts or scales. The API trusts Render's one-hop HTTPS proxy so secure session cookies are returned correctly.

Configure these SMTP environment variables on the Render API service (not Vercel), so the backend can send account and visit-request emails:

| Variable | Gmail example |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASSWORD` | A Google App Password (not your regular Gmail password) |
| `SMTP_FROM` | Your Gmail address, or omit to use `SMTP_USER` |

For Gmail, enable 2-Step Verification and create an App Password in your Google Account. Store it only as the Render `SMTP_PASSWORD` environment variable. If SMTP is missing or delivery fails, the account/pass request still succeeds and the API logs the delivery error; the visitor is notified in the app.

Deploy this repository to Vercel after configuring the API service. The rewrite in `vercel.json` sends API requests to the Render URL above; update that destination if the API's URL changes. Verify the API is awake at `https://sage-system-z02p.onrender.com/api/health` before testing registration.

## API

Sessions are persisted in SQLite. Staff endpoints require an authenticated staff session; visitor endpoints require the visitor session created by visitor registration or sign-in.

| Method | Route | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | Public | Health check |
| `POST` | `/api/auth/login` | Public | Authenticate staff or visitor credentials and create the matching session |
| `POST` | `/api/auth/logout` | Signed in | End the current session |
| `GET` | `/api/auth/session` | Signed in | Current staff identity and role |
| `POST` | `/api/guest/auth/register` | Public | Create a visitor profile and session |
| `POST` | `/api/guest/auth/login` | Public | Sign in to a visitor account |
| `POST` | `/api/guest/auth/logout` | Visitor | End the visitor session |
| `GET` | `/api/guest/auth/session` | Visitor | Current visitor profile |
| `POST` | `/api/guest/passes` | Visitor | Submit a visit and equipment request |
| `GET` | `/api/guest/passes` | Visitor | List the signed-in visitor’s passes |
| `GET` | `/api/guest/passes/:id` | Visitor | Retrieve an owned visitor pass |
| `GET` | `/api/guest/passes/reference/:referenceId` | Public | Read-only lookup of a pass by its Reference ID |
| `GET` | `/api/summary` | Staff | Dashboard counts and recent movements |
| `GET` | `/api/passes?q=` | Staff | Search by exact reference ID or guest name |
| `GET` | `/api/passes/:id` | Staff | Pass, guest, equipment, and movement details |
| `POST` | `/api/passes` | Facilities Officer | Register a guest, pending pass, and optional items |
| `PATCH` | `/api/passes/:id/validity` | Facilities Officer | Change a pass validity window |
| `PATCH` | `/api/passes/:id/approval` | Facilities Officer | Approve or decline a pending pass |
| `PATCH` | `/api/assets/:id/clearance` | Facilities Officer | Clear or deny an individual item |
| `POST` | `/api/passes/:id/logs` | Staff | Record a valid guest or cleared-item entry/exit |

Approval assigns a unique `SAGE-<year>-<random>` reference. Gate logging checks the approved validity window, equipment ownership and clearance, and movement direction; the staff ID comes from the authenticated session, never from the client. Gate logs are append-only through the API.

Visitor QR codes encode the approved pass reference ID for presentation at the gate. Visitor sessions can only access their own pass records; staff search and gate actions remain on the staff API. Pending and approved visitor pass statuses refresh every 12 seconds while the visitor portal is visible.

## Validation

```sh
npm test
npm run build
```
