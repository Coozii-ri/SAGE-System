# SAGE — Secure Access for Guests & Equipment

A responsive, dark-mode campus visitor and equipment pass prototype. The workspace includes a React/Vite staff and visitor interface, an Express API, SQLite persistence, QR-coded digital passes, and versioned migrations for guests, visitor accounts, passes, equipment, staff, gate logs, and sessions.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

```sh
npm install
npm run server
```

In a second terminal:

```sh
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). The Vite development server proxies `/api` requests to `http://localhost:3001`.

The database is created at `data/sage.sqlite` on first start. Set `SAGE_DB_PATH` to use a different file.

## Prototype accounts

Demo accounts are seeded only when the database has no staff accounts and `NODE_ENV` is not `production`:

| Role | Email |
|---|---|
| Facilities Officer | `facilities@sage.campus` |
| Campus Security Guard | `guard@sage.campus` |

Both use `SageDemo2026!` by default. Override the seed password with `SAGE_DEMO_PASSWORD`, or set `SAGE_SEED_DEMO=false` to disable demo seeding. The demo credentials and seeded records are for local prototyping only.

Visitors can create their own account from **Visitor access** on the sign-in screen. Visitor profiles are independent from staff accounts; profile passwords are bcrypt-hashed, and each visitor can only list or retrieve passes belonging to their account. Guest pass approval status refreshes automatically while the portal is open.

## Production build

```sh
npm run build
$env:NODE_ENV="production"
$env:SESSION_SECRET="replace-with-a-long-random-secret"
npm start
```

In production, configure HTTPS and a strong `SESSION_SECRET`. Cookies are HTTP-only, secure, SameSite strict, and expire after eight hours. Passwords are stored as bcrypt hashes; the application does not seed demo accounts in production.

## API

Sessions are persisted in SQLite. Staff endpoints require an authenticated staff session; visitor endpoints require the visitor session created by visitor registration or sign-in.

| Method | Route | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | Public | Health check |
| `POST` | `/api/auth/login` | Public | Create a staff session |
| `POST` | `/api/auth/logout` | Signed in | End the current session |
| `GET` | `/api/auth/session` | Signed in | Current staff identity and role |
| `POST` | `/api/guest/auth/register` | Public | Create a visitor profile and session |
| `POST` | `/api/guest/auth/login` | Public | Sign in to a visitor account |
| `POST` | `/api/guest/auth/logout` | Visitor | End the visitor session |
| `GET` | `/api/guest/auth/session` | Visitor | Current visitor profile |
| `POST` | `/api/guest/passes` | Visitor | Submit a visit and equipment request |
| `GET` | `/api/guest/passes` | Visitor | List the signed-in visitor’s passes |
| `GET` | `/api/guest/passes/:id` | Visitor | Retrieve an owned visitor pass |
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
