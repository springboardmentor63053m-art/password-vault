# SecureVault

SecureVault is an Infosys Springboard Team 3 project for account authentication, security monitoring, and password-vault workflows. The repository currently contains a Spring Boot API, a user-facing React app, and a separate administrator console.

## Current implementation

### User authentication

- Registration creates regular user accounts; a request cannot choose its own administrator role.
- Login accepts a username or email address and checks BCrypt password hashes.
- Authentication includes account lockout, request throttling, bounded request bodies, input validation, opaque registration responses, and consistent error handling.
- Successful sessions and device observations are recorded. Client IP resolution supports trusted proxy CIDRs configured by the operator.
- Logout revokes the active session.

### Multi-factor authentication

- Users and administrators can enroll in an authenticator from the user dashboard’s **Multi-factor authentication** panel or the admin console’s **Account security** page.
- Enrollment checks the current account password and requires a six-digit TOTP code before it is enabled.
- The setup view displays a locally generated QR code, an `otpauth://` link, and a manual setup key. The QR is generated in the browser; the seed is not sent to a QR service.
- TOTP seeds are encrypted before storage. `MFA_ENCRYPTION_KEY_BASE64` should be set to a dedicated random key and kept stable after enrollment. If it is omitted, the backend currently falls back to `JWT_SECRET_BASE64`.
- When an account has authenticator MFA enabled, it is required at each sign-in. Without authenticator MFA, a sign-in from a new device, a new IP, or an unusual time may require a six-digit email code.
- Email challenges use SMTP. For Gmail, configure the host, port, sender/user, and an app password in the ignored local `.env` file. No Google OAuth/API credentials are needed for TOTP.

### Administrator console

The root React/Vite application provides:

- Overview metrics and service status.
- User search, account details, role management, account enable/disable, device/session review, and device revocation.
- Administrator role changes require the acting administrator’s password and are recorded in the audit trail.
- Threat analytics with date-range summary cards, severity trends, searchable/filtered/sorted/paginated alerts, related activity details, reviewer notes, and audited Open/Investigating/Resolved/False Positive states.
- Rule-based detection for configurable repeated failed logins, repeated denied protected API access, new device/IP and unusual-hour sign-ins, suspicious vault-action bursts, and successful share/permission audit events.
- Paginated and searchable audit records.
- **CSV** and **Excel `.xlsx`** audit exports for the current search, up to 50,000 matching records. Export files include event ID, account, email, action, source IP, timestamp, result, and details. CSV fields are escaped and guarded against spreadsheet formula injection.
- Vault metadata totals. Credential contents are not returned to the admin API.

### User-facing vault screen

The user frontend includes registration, login, account MFA settings, a vault dashboard, a password generator, and sample credential rows. The current vault rows are demo data held in browser memory. Encrypted credential CRUD, synchronization, and secure sharing APIs are not implemented yet; do not store real credentials in the demo screen.

## Services and ports

| Service | Location | Local address | Purpose |
| --- | --- | --- | --- |
| PostgreSQL 16 | Docker Compose | `localhost:5432` | Persistent application database |
| Spring Boot API | `backend/` | `localhost:8080` | Authentication, MFA, admin APIs, and health check |
| User app | `frontend/` | `localhost:3000` | Registration, login, and demo vault |
| Admin console | repository root | `localhost:3001` | Admin dashboard and security tools |
| Redis 7 | Compose `tools` profile | `localhost:6379` | Optional development service; not required for the current API |
| pgAdmin 4 | Compose `tools` profile | `localhost:5050` | Optional database administration UI |

The user and admin Vite servers proxy `/api` to the backend. Compose binds the API and database ports to loopback for local development.

## Requirements

- Docker Desktop with Docker Compose.
- Java 17 and Maven to run backend checks outside Docker.
- Node.js and npm to run the Vite applications.

## Configure local secrets

Copy the example file, then replace the database and key placeholders with unique random values. `.env` is ignored by Git and must not be committed.

```powershell
Copy-Item .env.example .env
```

Generate base64 key material in PowerShell (run separately for each key):

```powershell
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
$rng.Dispose()
```

Use distinct values for `POSTGRES_PASSWORD`, `SECUREVAULT_DB_APP_PASSWORD`, `JWT_SECRET_BASE64`, and `MFA_ENCRYPTION_KEY_BASE64`. Keep JWT and MFA encryption keys stable: rotating them invalidates sessions or prevents existing authenticator seeds from decrypting.

For Gmail email challenges, enable 2-Step Verification and create a Gmail app password. Set `SPRING_MAIL_USERNAME` and `SECUREVAULT_MAIL_FROM` to the sender account, `SPRING_MAIL_PASSWORD` to the app password, and keep SMTP authentication and STARTTLS enabled. Never place a real password in documentation or commit it.

If SecureVault runs behind a reverse proxy, set `SECUREVAULT_TRUSTED_PROXY_CIDRS` only to the proxy address ranges that you control. Leave it empty for direct local access.

## Start the application

From the repository root, after configuring `.env`:

```powershell
docker compose up --build -d
docker compose ps
```

Compose starts PostgreSQL, runs the database bootstrap/schema service, then starts the backend. Check the API:

```powershell
Invoke-RestMethod http://localhost:8080/api/health
```

Start the user frontend in a separate terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`.

Start the administrator console from the repository root in another terminal:

```powershell
npm ci
npm run dev
```

Open `http://localhost:3001`.

### Create the first administrator

Registration always creates a regular user. For the initial administrator only, register an account in the user app and grant it `ROLE_ADMIN` using the database administrator connection:

```powershell
docker compose exec postgres psql -U postgres -d securevault_db
```

At the `psql` prompt, replace the email with the registered account:

```sql
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u CROSS JOIN roles r
WHERE lower(u.email) = lower('admin@example.com')
  AND r.role_name = 'ROLE_ADMIN'
ON CONFLICT DO NOTHING;
```

After this bootstrap, existing administrators can promote or demote other accounts from **Users & roles** by confirming their own password. Those changes are audited.

## API overview

- `POST /api/registration/register` — register a regular account.
- `POST /api/login` — password authentication; may return an MFA challenge.
- `POST /api/login/mfa` — complete a TOTP or email-code challenge.
- `POST /api/logout` — revoke the current session.
- `GET /api/health` — backend and database health.
- `/api/account/mfa` — authenticated MFA status, TOTP setup, confirmation, and disable endpoints.
- `/api/admin/*` — administrator identity, dashboard, users/roles, activities, analytics, vault overview, and system settings. Requests require an active administrator session.

## Database and infrastructure

- `database/schema.sql` defines the PostgreSQL application schema, including users/roles, sessions/devices, audit logs, security events, password-health aggregates, and vault metadata.
- `database/bootstrap-app-user.sql` provisions the restricted `securevault_app` role used by the Compose backend.
- `docker-compose.yml` uses a read-only backend container, dropped Linux capabilities, and `no-new-privileges`.
- Redis and pgAdmin are optional services under the Compose `tools` profile.
- See [docs/schema.md](docs/schema.md) for the ER diagram and schema notes.

## Threat analysis and known limits

Threat signals are generated from authentication and recorded security events. The admin endpoints are protected by Spring Security and the existing live-session/admin-role checks. Failed-login alerts default to four failures in five minutes and escalate at six; configure `SECUREVAULT_FAILED_LOGIN_THRESHOLD` and `SECUREVAULT_FAILED_LOGIN_WINDOW_MINUTES` to adjust those values. Repeated denied API access alerts default to five requests in five minutes. Audit records are insert-only for the backend database role.

Password-health reporting consumes metadata/aggregate rows; it does not inspect a user’s plaintext passwords, and no breach-check provider is connected. The current demo vault does not call vault APIs, so live credential-access events are not produced by that screen. The project has no sharing API yet, so sharing alerts will appear only when a successful share or permission change is written to the audit log. No IP geolocation provider is connected, so the system detects new IPs rather than making location-based judgments. Redis is provisioned as an optional service but is not the current session/rate-limit store.

Authenticator MFA is opt-in per account. There is no recovery-code workflow yet, so users should keep access to their authenticator device and email account. Configure and verify SMTP before relying on email challenges.

## Development checks

Run the backend tests:

```powershell
cd backend
mvn test
```

Build the admin console:

```powershell
npm ci
npm run build
```

Build the user app:

```powershell
cd frontend
npm ci
npm run build
```

## Project files

- `backend/` — Spring Boot controllers, auth/MFA/admin services, security filters, and tests.
- `database/` — PostgreSQL schema and least-privilege app-user bootstrap SQL.
- `frontend/` — user registration/login and demo vault app.
- `src/` — administrator console, MFA settings panel, API client, and audit export generator.
- `docs/schema.md` — database ERD and schema documentation.
- `docs/work_tracker.md` — implementation status and follow-up work.
- `docs/implementation_summary.md` — earlier `3-RABISHANKAR` contributions and the implementation included in this push.
