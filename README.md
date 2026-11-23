# SecureVault password manager

Complete SecureVault application integrated into the shared TEAM-3 source tree. The backend is Spring Boot, the database is PostgreSQL, and the unified User/Admin frontend is React + Vite.

## Features

- Regular-user registration, BCrypt login, sessions/devices, logout, account lockout and throttling.
- Authenticator MFA with locally generated QR enrollment and encrypted seeds. Risk-based email login challenges for accounts without TOTP.
- Encrypted vault CRUD, categories, favorites, password generation and health, notifications and account security.
- Internal credential sharing with expiry, revocation and sharing history.
- External email invitations, recipient OTP verification, optional one-time retrieval and owner revocation.
- HTML invitations with plain-text fallback, and selectable Mailpit or Gmail SMTP.
- Admin overview, Users & roles, Threat analysis, Audit trail and exports, read-only Sharing Activity, Vault metadata, Account security and System health.

Encryption is server-side. Operators with the database and encryption keys can decrypt stored data. Monitoring APIs return metadata. A lost authenticator has no recovery-code workflow. External shares enforce expiry on access but do not currently emit a separate external-expiry audit event.

## Prerequisites

Docker Desktop with Linux containers and Compose 2.24.4+ for the local override's `!override` tag. Java 17+ and Maven 3.9+ for backend tests. Node.js 22.12+ or 24 LTS and npm for Vite 8.

The following commands use a separate Compose project, `securevaultpersonal`, and a new database volume. Default ports are PostgreSQL **25432**, backend **28080**, frontend **4300**, and Mailpit **28025**. All published services bind to loopback.

## Configure new local secrets

From the repository root:

```powershell
Copy-Item .env.example .env
notepad .env
```

Fill POSTGRES_PASSWORD and SECUREVAULT_DB_APP_PASSWORD with different random passwords. Set JWT_SECRET_BASE64, MFA_ENCRYPTION_KEY_BASE64 and VAULT_ENCRYPTION_KEY_BASE64 to three distinct base64 values, each encoding 48 random bytes. The example contains blank secret fields. Generate a value into your clipboard without displaying it in the terminal, then paste it privately into .env:

```powershell
$bytes = New-Object byte[] 48
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
Set-Clipboard ([Convert]::ToBase64String($bytes))
$rng.Dispose()
# Paste into one field, then clear the clipboard.
# Set-Clipboard ''
```

Generate a fresh value for each field. Keep keys stable once data exists. Changing JWT signing keys invalidates tokens. Changing the MFA key makes enrolled seeds unreadable. Changing the vault key makes credentials unreadable unless handled through a deliberate decrypt/re-encrypt migration. No deployed accounts, private keys, passwords or database contents are included.

SECUREVAULT_EXTERNAL_BASE_URL must match the frontend origin. The default is http://127.0.0.1:4300. Leave trusted proxy CIDRs empty for direct local use. Configure only proxies you control when deploying behind a proxy.

## Start with Mailpit

Use a fresh PowerShell terminal:

```powershell
$base = @('-p', 'securevaultpersonal', '-f', 'docker-compose.yml', '-f', 'compose.local.yml')
docker compose --env-file .env @base -f compose.mailpit.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Complete the local configuration.' }
docker compose --env-file .env @base -f compose.mailpit.yml up -d --build
docker compose --env-file .env @base -f compose.mailpit.yml ps
Invoke-RestMethod http://127.0.0.1:28080/api/health
```

Mailpit is at http://127.0.0.1:28025. Its SMTP port is reachable inside Docker only, as mail-test:1025. Use fictional @example.test recipients. Mailpit does not deliver to the public internet.

The bootstrap provisions the restricted database role, applies database/schema.sql, then reapplies privileges with audit and security-history records protected from modification. The schema includes all additive migrations. No user accounts or user vault content are seeded.

### Frontend

In another terminal:

```powershell
Set-Location frontend
npm.cmd ci
$env:VITE_API_TARGET = 'http://127.0.0.1:28080'
npm.cmd run dev -- --port 4300
```

Open http://127.0.0.1:4300. Both User Login and Admin Login use this frontend. Accounts with both roles enter the selected workspace. Registration creates ROLE_USER.

The browser proxies /api to the configured backend. A localhost invitation works only on the same machine. Remote sharing requires a reachable HTTPS origin and a same-origin /api proxy. The external.html recipient entry point loads no third-party fonts, icons or analytics. Passwords are masked until explicitly revealed or copied.

## Gmail mode

Enable Google 2-Step Verification and generate an App Password. Copy gmail.env.example to a private directory outside the checkout and cloud-synced folders, for example %LOCALAPPDATA%/SecureVault-Personal-SMTP/gmail.env. Restrict that file and its directory to your Windows user. Enter SPRING_MAIL_USERNAME and SPRING_MAIL_PASSWORD privately, with the App Password's spaces removed.

In a fresh PowerShell terminal without SMTP environment variables already set:

```powershell
$gmail = Join-Path $env:LOCALAPPDATA 'SecureVault-Personal-SMTP/gmail.env'
$base = @('-p', 'securevaultpersonal', '-f', 'docker-compose.yml', '-f', 'compose.local.yml')
docker compose --env-file .env --env-file $gmail @base -f compose.gmail.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Complete the private Gmail configuration.' }
docker compose --env-file .env --env-file $gmail @base -f compose.gmail.yml up -d --build --no-deps backend
```

Start the database/bootstrap in Mailpit mode first on a fresh installation. Use exactly one SMTP override. Gmail uses smtp.gmail.com:587 with authentication, required STARTTLS, and certificate/hostname validation. The sender equals the authenticated Gmail address. Avoid displaying expanded Compose configuration because it contains secrets.

All mail flows share this transport, including login codes, failure alerts, invitations and recipient codes. SMTP success means server acceptance, not confirmed inbox delivery. Automated tests use mocked SMTP. Obtain recipient approval before manual real-email tests.

Return to Mailpit with:

```powershell
docker compose --env-file .env @base -f compose.mailpit.yml up -d --no-deps mail-test
docker compose --env-file .env @base -f compose.mailpit.yml up -d --no-deps backend
```

## First local Admin

Register a separate demo account normally. Confirm its exact username and active status before provisioning the first local administrator:

```powershell
docker compose --env-file .env @base -f compose.mailpit.yml exec postgres psql -U postgres -d securevault_db
```

At the psql prompt replace demo-admin with the confirmed username:

```sql
BEGIN;
SELECT username, is_active FROM users WHERE username='demo-admin';
INSERT INTO user_roles(user_id, role_id)
SELECT u.id, r.id FROM users u CROSS JOIN roles r
WHERE u.username='demo-admin' AND u.is_active AND r.role_name='ROLE_ADMIN'
ON CONFLICT DO NOTHING;
COMMIT;
```

This retains ROLE_USER. Perform a fresh Admin Login with MFA. Existing Admins can manage roles with password confirmation in Users & roles.

## Schema and migrations

For a fresh installation use the bootstrap above. For an existing database, take a secure backup outside the repository, review the desired incremental migration and apply it with ON_ERROR_STOP. Example:

```powershell
Get-Content -Raw database/migrations/20261116_external_shares.sql |
  docker compose --env-file .env @base -f compose.mailpit.yml exec -T postgres psql -X -1 -U postgres -d securevault_db -v ON_ERROR_STOP=1
```

Do not import another installation's data without its original keys and a reviewed migration procedure.

## Tests

```powershell
mvn.cmd -f backend/pom.xml test
Set-Location frontend
npm.cmd ci
npm.cmd test -- --maxWorkers=2 --testTimeout=20000
npm.cmd run build
```

The frontend build emits both index.html and external.html. Unit tests mock mail delivery and use synthetic fixtures. PostgreSQL integration tests are opt-in and reject databases without the disposable test name and marker. Follow [tests/README.md](tests/README.md) for a separate throwaway PostgreSQL test container. Never point tests at your application database.

## External-sharing demo

1. Sign in as a test User and add a synthetic credential in My Vault.
2. Open Secure Share, choose External Recipient, recipient@example.test, expiry and optional one-time retrieval.
3. Find the invitation in Mailpit and open it in a private browser window.
4. Request the code, read it from Mailpit, verify and explicitly retrieve the credential.
5. Check masking, reveal, copy and close. A consumed one-time invitation must reject retrieval.
6. Check Shared by Me, Sharing History and Admin Sharing Activity.
7. Create another share, revoke it and verify future access is blocked.

## Stop safely

Stop Vite with Ctrl+C in its terminal, then stop the snapshot services:

```powershell
docker compose --env-file .env @base -f compose.mailpit.yml stop
```

Use the Gmail override if Gmail is active. Stopping preserves the database volume.

## Source map

backend/src contains the API, authentication/MFA, vault, threat monitoring and backend tests. frontend/src contains all User/Admin screens, the shared layout, services and frontend tests. database contains schema, role bootstrap and migrations. docs contains older design notes that may describe earlier milestones. This README and the executable source define the current setup.

The TEAM-3 repository retains its existing teammate commits; the integration adds a normal descendant commit. Installed dependencies, compiled artifacts, private configurations, archives, database exports, real users and enrolled account data are excluded.

## Postman testing

Import `testing/postman/SecureVault.postman_collection.json` and the matching local environment. Follow `testing/postman/POSTMAN_TEST_GUIDE.md`; individual folders are also available in `testing/postman/split-collections`. The pack targets backend 18080, frontend 3300 and Mailpit 18025 for the existing local demo. Those ports differ from the isolated setup above. To use the pack with a fresh installation, choose those ports only when free, set SECUREVAULT_API_PORT=18080, SECUREVAULT_MAILPIT_PORT=18025 and SECUREVAULT_EXTERNAL_BASE_URL=http://127.0.0.1:3300 in your private configuration, and start Vite with VITE_API_TARGET=http://127.0.0.1:18080 and --port 3300. Never start a second stack on occupied ports. The collection guards intentionally restrict the target origin.

The Postman pack has not been executed during integration. MFA and OTP entry are manual; synthetic-only write operations require explicit per-request arming. Never export environments after filling secrets or include credentials in screenshots.

See [integration verification](docs/TEAM3_INTEGRATION_VERIFICATION.md) for the automated checks and remaining limitations.
