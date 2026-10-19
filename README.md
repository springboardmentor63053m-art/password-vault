# 🛡️ SecureVault: Full-Stack Password Vault & Credential Management System

> **Infosys Springboard Java Project — Team 3**  
> An encrypted credential management platform for secure credential storage, with authentication and admin reporting implemented; multi-factor authentication, team vault collaboration, and broader audit logging remain future work.

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16--alpine-336791?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7--alpine-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![pgAdmin](https://img.shields.io/badge/pgAdmin-4-336791?logo=postgresql&logoColor=white)
![Status](https://img.shields.io/badge/Status-Admin%20Dashboard%20%26%20Vault%20APIs-brightgreen)

---

## 📌 Project Overview (Completed Work)

SecureVault is a full-stack password vault with a React 18/Vite frontend and a Java 17/Spring Boot backend backed by PostgreSQL. The repository includes the following implemented functionality:

* **Authentication and role-based authorization:** registration and login use BCrypt password hashing and signed JWT access tokens. Admin routes require a valid JWT and an active `ROLE_ADMIN` account; user vault routes validate the JWT against the active, non-revoked database session.
* **Admin Dashboard:** the existing dashboard provides database-backed user, credential, active-session, and unresolved-alert counts; user/role management; aggregate-only vault counts; security-event analytics; sign-in activity; and persistent admin settings.
* **User credential vault:** authenticated users can list, create, view, update, and delete credentials in their own vault. Secret fields use AES-256-GCM encryption with a server-configured key. The API derives the owner from the authenticated session and does not return secret contents in list or admin aggregate responses.
* **PostgreSQL schema and migrations:** `database/schema.sql` initializes a new database; Flyway applies the versioned migration in `backend/src/main/resources/db/migration/` to the configured database.
* **Local services:** Docker Compose defines PostgreSQL 16, Redis 7, pgAdmin 4, and the Spring Boot API. The Redis service is provisioned but is not currently used by application code.

Security analytics currently reads `security_events`, but this application has no event-writing path. Activity Logs currently report successful sign-ins recorded in `sessions`; they do not show failed sign-ins or general audit events. Admin monitoring settings are saved in PostgreSQL but do not enable or disable event collection. MFA verification, credential sharing, and audit interceptors are not implemented.

## 📊 Database Schema & Entity-Relationship Diagram

```mermaid
erDiagram
    %% ==========================================
    %% 1. USER AUTHENTICATION & ACCESS CONTROL
    %% ==========================================
    USERS ||--o{ USER_ROLES : has
    ROLES ||--o{ USER_ROLES : assigned_to
    USERS ||--o{ SESSIONS : manages
    USERS ||--o{ DEVICES : registers
    USERS ||--o{ NOTIFICATIONS : receives

    USERS {
        UUID id PK
        string username "NOT NULL UNIQUE"
        string email "NOT NULL UNIQUE"
        string password_hash "NOT NULL"
        string vault_key_salt "NOT NULL"
        boolean mfa_enabled "NOT NULL DEFAULT false"
        string mfa_secret "ENCRYPTED NULLABLE"
        string oauth2_provider "NULLABLE"
        string reset_password_token "NULLABLE"
        datetime reset_token_expires_at "NULLABLE"
        int failed_login_attempts "NOT NULL DEFAULT 0"
        datetime locked_until "NULLABLE"
        boolean is_active "NOT NULL DEFAULT true"
        datetime created_at "NOT NULL"
        datetime updated_at "NOT NULL"
    }

    ROLES {
        int id PK
        string role_name "NOT NULL UNIQUE"
    }

    USER_ROLES {
        UUID user_id PK, FK
        int role_id PK, FK
    }

    SESSIONS {
        UUID id PK
        UUID user_id FK "NOT NULL"
        string session_token "NOT NULL UNIQUE"
        string ip_address "NOT NULL"
        string user_agent "NULLABLE"
        boolean is_revoked "NOT NULL DEFAULT false"
        datetime expires_at "NOT NULL"
        datetime created_at "NOT NULL"
    }

    DEVICES {
        UUID id PK
        UUID user_id FK "NOT NULL"
        string device_name "NOT NULL"
        string device_fingerprint "NOT NULL"
        boolean is_trusted "NOT NULL DEFAULT false"
        datetime last_active "NOT NULL"
        datetime created_at "NOT NULL"
    }

    %% ==========================================
    %% 2. PASSWORD VAULT & CREDENTIAL MODULE
    %% ==========================================
    USERS ||--o{ VAULTS : owns
    VAULTS ||--o{ VAULT_MEMBERS : grants_membership
    USERS ||--o{ VAULT_MEMBERS : participates_in
    VAULTS ||--o{ FOLDERS : contains
    VAULTS ||--o{ CREDENTIALS : stores
    FOLDERS ||--o{ CREDENTIALS : organizes
    CATEGORIES ||--o{ CREDENTIALS : classifies
    CREDENTIALS ||--o{ TAG_MAPPINGS : tagged_with
    TAGS ||--o{ TAG_MAPPINGS : applies_to
    CREDENTIALS ||--o{ ATTACHMENTS : includes

    VAULTS {
        UUID id PK
        UUID owner_id FK "NOT NULL"
        string vault_name "NOT NULL"
        string vault_type "NOT NULL DEFAULT PERSONAL"
        datetime created_at "NOT NULL"
        datetime updated_at "NOT NULL"
    }

    VAULT_MEMBERS {
        UUID vault_id PK, FK
        UUID user_id PK, FK
        string role "NOT NULL DEFAULT MEMBER"
        datetime joined_at "NOT NULL"
    }

    FOLDERS {
        UUID id PK
        UUID vault_id FK "NOT NULL"
        string folder_name "NOT NULL"
        datetime created_at "NOT NULL"
    }

    CATEGORIES {
        int id PK
        string category_name "NOT NULL UNIQUE"
    }

    TAGS {
        int id PK
        string tag_name "NOT NULL UNIQUE"
    }

    TAG_MAPPINGS {
        UUID credential_id PK, FK
        int tag_id PK, FK
    }

    CREDENTIALS {
        UUID id PK
        UUID vault_id FK "NOT NULL"
        UUID folder_id FK "NULLABLE"
        int category_id FK "NOT NULL"
        string credential_type "NOT NULL"
        string title "NOT NULL"
        string website_url "NULLABLE"
        text encrypted_data "NOT NULL"
        string encryption_iv "NOT NULL"
        int key_version "NOT NULL DEFAULT 1"
        int strength_score "NULLABLE"
        boolean is_favorite "NOT NULL DEFAULT false"
        datetime last_used_at "NULLABLE"
        datetime created_at "NOT NULL"
        datetime updated_at "NOT NULL"
    }

    ATTACHMENTS {
        UUID id PK
        UUID credential_id FK "NOT NULL"
        string file_name "NOT NULL"
        int file_size_bytes "NOT NULL"
        string mime_type "NOT NULL"
        string s3_file_path "NOT NULL"
        string encryption_iv "NOT NULL"
        datetime uploaded_at "NOT NULL"
    }

    %% ==========================================
    %% 3. SECURE SHARING MODULE
    %% ==========================================
    USERS ||--o{ SHARING : initiates
    USERS ||--o{ SHARING : receives
    CREDENTIALS ||--o{ SHARING : shared_via

    SHARING {
        UUID id PK
        UUID credential_id FK "NOT NULL"
        UUID shared_by_user_id FK "NOT NULL"
        UUID shared_with_user_id FK "NOT NULL"
        string permission_level "NOT NULL"
        string status "NOT NULL DEFAULT ACTIVE"
        datetime expires_at "NULLABLE"
        datetime created_at "NOT NULL"
    }

    %% ==========================================
    %% 4. SECURITY MONITORING & AUDIT LOGGING
    %% ==========================================
    USERS ||--o{ AUDIT_LOGS : performs
    USERS ||--o{ SECURITY_EVENTS : triggers

    AUDIT_LOGS {
        UUID id PK
        UUID user_id FK "NULLABLE"
        string action_type "NOT NULL"
        string status "NOT NULL"
        string ip_address "NOT NULL"
        text details "NULLABLE"
        datetime timestamp "NOT NULL"
    }

    SECURITY_EVENTS {
        UUID id PK
        UUID user_id FK "NULLABLE"
        string event_type "NOT NULL"
        string severity "NOT NULL DEFAULT MEDIUM"
        int risk_score "NOT NULL"
        boolean anomaly_detected "NOT NULL"
        boolean is_resolved "NOT NULL DEFAULT false"
        string ip_address "NULLABLE"
        datetime timestamp "NOT NULL"
    }

    BLOCKED_IPS {
        string ip_address PK
        string reason "NOT NULL"
        datetime blocked_until "NOT NULL"
        datetime created_at "NOT NULL"
    }

    NOTIFICATIONS {
        UUID id PK
        UUID user_id FK "NOT NULL"
        string title "NOT NULL"
        text message "NOT NULL"
        string notification_type "NOT NULL"
        boolean is_read "NOT NULL DEFAULT false"
        datetime created_at "NOT NULL"
    }

    %% ==========================================
    %% 5. ANALYTICS DASHBOARD MODULE
    %% ==========================================
    USERS ||--|| PASSWORD_HEALTH : tracked_by

    PASSWORD_HEALTH {
        UUID user_id PK, FK
        int overall_health_score "NOT NULL"
        int weak_passwords_count "NOT NULL DEFAULT 0"
        int reused_passwords_count "NOT NULL DEFAULT 0"
        int compromised_count "NOT NULL DEFAULT 0"
        datetime last_calculated "NOT NULL"
    }

    LOGIN_STATS {
        date stat_date PK
        int total_logins "NOT NULL DEFAULT 0"
        int failed_logins "NOT NULL DEFAULT 0"
        int mfa_successes "NOT NULL DEFAULT 0"
    }
```

---

## 🛠️ Infrastructure & Service Architecture

`docker-compose.yml` defines these local development services and host ports:

| Service | Container | Host port | Development configuration |
| :--- | :--- | :--- | :--- |
| PostgreSQL 16 | `securevault-postgres` | `5432` | Database `securevault_db`; Compose currently supplies user `postgres` and password `postgrespassword`. Development only. |
| Redis 7 | `securevault-redis` | `6379` | Provisioned without application authentication; currently not used by the backend. |
| pgAdmin 4 | `securevault-pgadmin` | `5050` | Development login `admin@securevault.com` / `admin`. Development only. |
| Spring Boot API | `securevault-backend` | `127.0.0.1:8080` | Java 17 application; Compose supplies datasource and JWT environment variables. |
| Vite frontend | local process | `3000` | Run from `frontend/`; proxies `/api` to `http://localhost:8080`. |

The PostgreSQL initialization script runs only when the database volume is first created. It installs the schema and seed data from `database/schema.sql`; the backend also runs the Flyway migration under `backend/src/main/resources/db/migration/` against its configured datasource. The schema script drops and recreates tables, so do not rerun it against a database containing data you need to keep.

The checked-in Compose database and pgAdmin credentials and fallback JWT key are for local development only. Compose does not override the static JWT fallback unless `JWT_SECRET_BASE64` is set, so always provide your own key. Do not use these defaults in a deployment. Configure fresh secrets, database least-privilege credentials, authenticated/private database and Redis access, and TLS at a reverse proxy before deploying. Compose currently publishes PostgreSQL, Redis, and pgAdmin on host interfaces; restrict those ports with firewall/network configuration for any non-local environment.

## 🚀 How to Run the Project

### Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
* [Git](https://git-scm.com/) installed.

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/livingmangal/Infosys-Springboard-Java-Team3.git
cd Infosys-Springboard-Java-Team3
```

---

### Step 2: Configure Development Keys and Start Containers

Compose contains a checked-in fallback JWT signing key for development. Override it with a fresh private key, and configure a separate 32-byte key for vault encryption before starting the backend. Keep both stable and private; changing the JWT key invalidates existing tokens, and losing/changing the vault key makes stored secrets unreadable. Never commit either value.

PowerShell example (values remain in this shell session):

```powershell
$jwtBytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($jwtBytes)
$rng.Dispose()
$env:JWT_SECRET_BASE64 = [Convert]::ToBase64String($jwtBytes)

$vaultBytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($vaultBytes)
$rng.Dispose()
$env:VAULT_ENCRYPTION_KEY_BASE64 = [Convert]::ToBase64String($vaultBytes)
```

Set these environment variables again in each new shell (or load them securely from a local ignored environment file/secret manager). Then start Docker Desktop and run:

```bash
docker compose up --build -d
```

On first startup with a new database volume, PostgreSQL initializes from `database/schema.sql`. The backend waits for PostgreSQL health and applies its Flyway migration to the configured datasource. Subsequent starts reuse the existing volume.

### Step 3: Verify Running Services
Check that the containers are running:
```bash
docker compose ps
```

To verify the tables directly inside PostgreSQL:
```bash
docker exec -it securevault-postgres psql -U postgres -d securevault_db -c "\dt"
```

---

### Step 4: Configure Secrets and Test Authentication

Step 2 exports both keys for the current shell. For non-Compose backend runs, provide the same variables directly to the backend process or its secret manager.

`VAULT_ENCRYPTION_KEY_BASE64` is required for credential encryption and decryption. The application rejects a missing or invalid vault key when a secret operation is attempted. Supply it through a deployment secret manager in hosted environments. `JWT_SECRET_BASE64` must also be replaced with a private key for any deployment. Compose and `application.properties` include development defaults; do not treat those defaults as secure production configuration.

With the services running, use their API as described below. To run the backend outside Compose, use Java 17 and Maven from `backend/`; `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `JWT_SECRET_BASE64`, `JWT_EXPIRATION_SECONDS`, and `VAULT_ENCRYPTION_KEY_BASE64` configure it. Defaults are declared in `backend/src/main/resources/application.properties` and are for local development only. The JWT lifetime defaults to 900 seconds and is limited to 1–3600 seconds.

Registration and login can be exercised with Thunder Client or curl using JSON and `Content-Type: application/json`:

**Register** — `POST http://localhost:8080/api/registration/register`

```json
{
  "username": "vaultuser",
  "email": "vaultuser@example.com",
  "password": "Password123!"
}
```

The endpoint returns `202 Accepted` with a generic acknowledgement; passwords are stored as BCrypt hashes.

**Log in** — `POST http://localhost:8080/api/login`

```json
{
  "identifier": "vaultuser@example.com",
  "password": "Password123!"
}
```

`identifier` accepts the username or email. A successful response contains a JWT access token and user summary. The database stores a SHA-256 token fingerprint in `sessions`, not the bearer token. Registration validation errors return `400`; invalid, inactive, locked, and MFA-enabled logins return `401`. Five consecutive failed password attempts lock an account for 15 minutes. MFA-enabled accounts cannot complete sign-in because second-factor verification is not implemented. The health endpoints are `GET /api/health` and `GET /api/login/health`.

### API Endpoints

All paths below use `http://localhost:8080` in the local setup. The Vite development server proxies these paths from port 3000.

| Method | Endpoint | Access and behavior |
| :--- | :--- | :--- |
| `POST` | `/api/registration/register` | Public registration. |
| `POST` | `/api/login` | Public login; issues JWT and records a session fingerprint. |
| `GET` | `/api/health` or `/api/login/health` | Public health response. |
| `GET` | `/api/vault/credentials` | Valid JWT plus active session; list the current user's credential metadata, without secrets. |
| `POST` | `/api/vault/credentials` | Valid JWT plus active session; create an owned credential. |
| `GET` | `/api/vault/credentials/{credentialId}` | Valid JWT plus active session and ownership; retrieve one credential including decrypted secret. |
| `PUT` | `/api/vault/credentials/{credentialId}` | Valid JWT plus active session and ownership; update an owned credential. |
| `DELETE` | `/api/vault/credentials/{credentialId}` | Valid JWT plus active session and ownership; delete an owned credential. |
| `GET` | `/api/admin/dashboard/statistics` | Valid JWT and active administrator; aggregate dashboard counts. |
| `GET` | `/api/admin/users` | Valid JWT and active administrator; user summaries and roles. |
| `GET` | `/api/admin/roles` | Valid JWT and active administrator; roles available for assignment. |
| `POST` | `/api/admin/users/{userId}/role` | Valid JWT and active administrator; assign an allowed elevated role. |
| `GET` | `/api/admin/vault/statistics` | Valid JWT and active administrator; aggregate counts only, no credential contents. |
| `GET` | `/api/admin/analytics/security-events` | Valid JWT and active administrator; daily event counts from `security_events`. No event writer currently populates this table through the app. |
| `GET` | `/api/admin/activity-logs` | Valid JWT and active administrator; recent successful sign-ins from `sessions`. |
| `GET`, `PUT` | `/api/admin/settings` | Valid JWT and active administrator; read and persist monitoring preference flags. The flags do not currently control collection. |

The admin authorization filter validates JWT signatures/expiry and checks that the account is active and currently has `ROLE_ADMIN`. Vault requests additionally require a matching active, non-revoked session. Do not send credential secrets to admin endpoints; aggregate endpoints do not select or return them.

Authentication endpoints apply in-memory per-address rate limits. Those limits reset on process restart and are not shared across replicas. Behind a proxy, configure rate limiting at a trusted gateway; the app does not trust arbitrary forwarding headers. Account lockout can still be deliberately triggered. Requests are bounded to 8 KiB; multipart uploads are disabled. Do not expose the Compose-published HTTP services directly to the internet. Use an HTTPS reverse proxy, block direct service ports, replace development credentials, and use least-privilege database users in deployment.

Run backend tests with `mvn -q test` from `backend/` (Java 17 and Maven required). The Dockerfile builds the application package with tests skipped; run the test command separately for regression coverage.

### Step 5: Access pgAdmin (Development Only)

1. Open `http://localhost:5050`.
2. The Compose development credentials are `admin@securevault.com` / `admin`. Change them before any shared or deployed use.
3. Register a server with host `postgres`, port `5432`, database `securevault_db`, username `postgres`, and the Compose development password `postgrespassword`.

These example credentials are committed in `docker-compose.yml` for local development and are not deployment secrets. For deployment, configure a unique pgAdmin login and a least-privilege database account through protected environment/secret configuration; do not expose pgAdmin publicly.

### Step 6: Run the Frontend (React + Vite)

The supported Vite frontend is in `frontend/`. It renders the login, registration, user vault, and existing Admin Dashboard. Run:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Vite proxies `/api/*` to the Spring Boot service at port `8080`. Keep the backend running and use a JWT from login; admin pages require an active administrator account. The vault credential API requires `VAULT_ENCRYPTION_KEY_BASE64` to be configured in the backend environment.

## 📂 Project Structure

```text
password-vault/
├── frontend/                         # React 18 + Vite app (port 3000)
│   ├── src/components/               # Login, Register, Navbar, VaultDashboard
│   ├── src/services/api.js           # Stored authentication helpers
│   ├── src/App.jsx                   # App shell and route/view selection
│   ├── src/main.jsx                  # Vite entry point
│   └── vite.config.js                # /api proxy to localhost:8080
├── src/                              # Existing Admin Dashboard implementation
│   └── App.js                        # Dashboard, users, vault stats, analytics, logs, settings
├── backend/
│   ├── src/main/java/com/securevault/
│   │   ├── admin/                    # AdminDashboardController and database service
│   │   ├── auth/                     # Registration, login, JWT/session creation
│   │   ├── vault/                    # Credential CRUD service/controller and AES-GCM encryption
│   │   ├── common/                   # Admin/session authorization filters, errors, rate limits
│   │   └── SecureVaultApplication.java
│   ├── src/main/resources/
│   │   ├── application.properties    # Port and environment-backed configuration
│   │   └── db/migration/             # Flyway migrations (including admin settings)
│   ├── src/test/java/com/securevault/ # Auth, authorization, admin, vault, encryption tests
│   ├── Dockerfile
│   └── pom.xml
├── database/schema.sql               # PostgreSQL schema and seed data for fresh volumes
├── docker-compose.yml                # PostgreSQL, Redis, pgAdmin, backend services
└── README.md
```

## 📦 Database Tables Overview

| Module | Tables | Purpose |
| :--- | :--- | :--- |
| **Authentication & Access Control** | `users`, `roles`, `user_roles`, `sessions`, `devices` | User management, RBAC, session tokens, and trusted device tracking. |
| **Vault & Credential Storage** | `vaults`, `vault_members`, `folders`, `categories`, `credentials`, `tags`, `tag_mappings`, `attachments` | Hierarchical encrypted item storage, categories, and file attachments. |
| **Secure Sharing** | `sharing` | Granular item sharing with permission tiers and expiration dates. |
| **Security & Audit Monitoring** | `audit_logs`, `security_events`, `blocked_ips`, `notifications` | Schema support for audit/event records, IP blocking, and alerts; app event-writing/collection paths remain incomplete. |
| **Analytics Dashboard** | `password_health`, `login_stats`, `admin_settings` | Admin monitoring preferences persist in `admin_settings`; password health and login-stat tables are schema foundations. |

### Pre-seeded Data
* **User Roles:** `ROLE_USER`, `ROLE_TEAM_MEMBER`, `ROLE_ADMIN`
* **Credential Categories:** `Website Login`, `Email Accounts`, `Banking Credentials`, `Social Media Accounts`, `Application Accounts`, `API Keys`, `Secure Notes`

---

## 🛑 Stopping the Containers

To stop the containers without losing any database data:
```bash
docker compose down
```
*(Your data is preserved in the Docker persistent volumes `postgres_data` and `redis_data`)*.

---

## 🗺️ Roadmap & Next Steps

- [x] **Milestone 1:** PostgreSQL schema foundation and Docker Compose setup
- [x] **Milestone 2:** Registration and login APIs with BCrypt, JWT, and PostgreSQL sessions
- [x] **Milestone 3 (implemented scope):** AES-256-GCM server-side credential encryption and per-user credential CRUD APIs. PBKDF2 key derivation is not implemented; the encryption key is supplied through `VAULT_ENCRYPTION_KEY_BASE64`.
- [x] **Admin Dashboard implementation:** role-protected dashboard statistics, user management/role assignment, aggregate vault statistics, security analytics endpoint, successful-sign-in activity logs, and persistent settings.
- [x] **Milestone 5:** React + Vite login, registration, user vault, and Admin Dashboard UI.
- [ ] **Future work:** MFA verification; secure sharing; audit/event-writing and monitoring behavior; make persisted monitoring preferences control collection; expand activity logs to include failed sign-ins and other audit events; password health and login telemetry; production secret/credential management and deployment hardening.

