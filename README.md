# BalanceVault

BalanceVault is a hackathon demonstration of account onboarding, administrator review, and a simulated ledger. It explores how authentication, role checks, ownership checks, and audit records fit into a small web application. It is not a bank or a production financial service.

> **Demo safety:** All balances and ledger entries are synthetic. Do not enter real financial or personal information, connect real money, or use this application for real financial activity.

## What works

- Register and log in with email and password.
- Hash passwords with bcrypt and issue a seven-day JWT.
- Create accounts in `PENDING` status and let an administrator approve them.
- List a user's own accounts and ledger entries; administrators can list all accounts, entries, and users.
- Post simulated deposits and withdrawals. The account balance and ledger entry are written in a database transaction; withdrawals that would make the balance negative are rejected.
- Write audit records for account creation, ledger operations, and account approvals.
- Restrict administrator API endpoints with server-side role checks and ledger operations with an account-ownership check.
- Seed a non-administrator demo user for trying the application.

The public demo credentials are `demo@balancevault.dev` / `demo123`. They are for synthetic demo data only. No administrator is created by default.

## Technology and architecture

- Frontend: React, Vite, React Router, Axios
- Backend: Node.js, Express, Zod
- Persistence: PostgreSQL via Prisma
- Authentication: bcrypt password hashes and bearer JWTs

```text
Browser (React)
  └─ Axios requests with Bearer JWT
       └─ Express API
            ├─ Authentication, validation, role and ownership checks
            └─ Prisma
                 └─ PostgreSQL
```

### Data model

- `User`: identity, password hash, role, and creation time.
- `Account`: belongs to a user; stores type, synthetic balance, currency, and onboarding status.
- `LedgerEntry`: belongs to an account; records a simulated deposit or withdrawal.
- `AuditLog`: optional actor, action, details, and timestamp.

The Prisma schema is in [`backend/prisma/schema.prisma`](./backend/prisma/schema.prisma). Amounts currently use floating-point fields, so this schema is not suitable for real-money accounting.

### Authentication and authorization

Registration always assigns the `USER` role on the server. Login returns a bearer JWT; the frontend stores it in browser `localStorage` and sends it with API requests. The backend verifies the token and looks up the current user for protected requests. Administrator routes also check the user's role on the backend; hiding a page in the frontend is not the security boundary.

To provision the initial administrator, configure both `ADMIN_EMAIL` and `ADMIN_PASSWORD` before starting the backend. The backend requires a valid email and a password of at least 16 bytes, creates the administrator only when that email does not already exist, and fails if the email belongs to a non-admin user. It does not reset an existing administrator's password. Keep these values private and do not use the public demo password.

## Run locally

Prerequisites: Node.js, npm, and a running PostgreSQL instance.

1. Install the root tooling:

   ```sh
   npm install
   ```

2. Copy `backend/.env.example` to `backend/.env`. Set `DATABASE_URL` to your PostgreSQL connection string and set `JWT_SECRET` to a random secret of at least 32 bytes. For example:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Keep `FRONTEND_ORIGIN=http://localhost:5173` for local development.

3. Generate the Prisma client and apply the schema to your database:

   ```sh
   cd backend
   npm run db:generate
   npm run db:push
   npm run dev
   ```

4. In a second terminal, start the frontend:

   ```sh
   cd frontend
   npm run dev
   ```

5. Open <http://localhost:5173>.

`db:push` applies the current Prisma schema; it does not create a versioned migration history. Switching an existing SQLite database to PostgreSQL does not transfer its data.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Backend port; defaults to `4000`. |
| `JWT_SECRET` | Yes | Private random secret of at least 32 bytes. The backend refuses to start if missing or too short. |
| `FRONTEND_ORIGIN` | Yes | One exact HTTP(S) frontend origin, with no path or trailing slash; for local development use `http://localhost:5173`. |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma. |
| `ADMIN_EMAIL` | No | Email for creating the initial administrator. Set together with `ADMIN_PASSWORD`. |
| `ADMIN_PASSWORD` | No | Initial administrator password, at least 16 bytes. Set together with `ADMIN_EMAIL`. |
| `VITE_API_URL` | No | Frontend API base URL; defaults to `http://localhost:4000`. Set this to the deployed backend URL for a hosted frontend. |

Never commit `.env` files or put secrets in frontend variables. Only non-secret values belong in `VITE_*` variables.

## Verification

From the repository root:

```sh
npm --prefix frontend run lint
npm --prefix frontend run build
node --check backend/src/server.js
```

With `DATABASE_URL` set in the backend environment, validate and generate the Prisma client:

```sh
cd backend
npx prisma validate
npm run db:generate
```

There is currently no automated backend integration-test script. These commands do not verify a live PostgreSQL connection or exercise authorization flows. Test registration, login, account onboarding/approval, and ledger operations against a non-production database before a demonstration. Confirm unauthenticated admin requests are rejected and ordinary users cannot access admin routes or another user's account.

## Deployment

The repository includes a Render Blueprint in `render.yaml` for both the API and static frontend, so it can deploy from a public GitHub repository without connecting a Vercel account. It uses Render's free web-service plan for the API and a free static site; the API may spin down after inactivity.

1. In Render, create a Blueprint from this repository's `main` branch and apply `render.yaml`.
2. Set `DATABASE_URL` privately to a PostgreSQL database URL. Render generates `JWT_SECRET`; the Blueprint sets the API CORS origin and frontend API URL to the two Render service domains.
3. Before using a fresh PostgreSQL database, apply the Prisma schema from the backend directory with `npm run db:push`, using the production `DATABASE_URL`. Verify the URL before running this command; it changes the target database and does not migrate existing data.
4. Verify `https://balancevault-api-vd3d.onrender.com/api/health`, then test registration, login, account onboarding/approval, and ledger operations using synthetic data.

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Render only when provisioning an administrator. The backend seeds the public demo user on startup, so deploy only with synthetic demo data. Do not use real financial or personal information. If the database contains an old demo administrator, disable or remove that account and rotate its credentials before deployment. Never commit secrets or put them in `VITE_*` variables.

## Known limitations

- This is a demo, not a production-ready or real-money system. It has no banking integration.
- There is no automated backend integration/security test suite in the repository.
- Audit records are written for selected successful actions only. There is no audit-log viewing endpoint or UI, no failure/security-event logging, and the records are not protected against database-level modification.
- Login rate limiting, refresh-token rotation, and server-side token revocation are not implemented.
- The browser stores bearer tokens in `localStorage`; this has different risks from secure, HTTP-only cookies.
- Password validation currently has a six-character minimum for ordinary users; production use needs a stronger password policy and other account-protection controls.
- The data model uses floating-point balances and the audit write is separate from the balance/ledger transaction. Neither behavior is appropriate for production financial records.

## Hackathon documentation

The repository includes [`THREATS.md`](./THREATS.md), a brief initial list of threats and controls. It does not yet contain executed security-test results. The hackathon review also calls for a dated `PROMPTS.md` AI-development log; that file is not currently present. Add only prompts, decisions, and verification from actual work—do not backdate or invent entries.
