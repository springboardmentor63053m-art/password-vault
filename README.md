# 🛡️ SecureVault: Full-Stack Password Vault & Credential Management System

> **Infosys Springboard Java Project — Team 3**  
> An enterprise-grade, encrypted credential management platform providing secure credential storage, multi-factor authentication, team vault collaboration, audit logging, and security analytics.

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16--alpine-336791?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7--alpine-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![pgAdmin](https://img.shields.io/badge/pgAdmin-4-336791?logo=postgresql&logoColor=white)
![Status](https://img.shields.io/badge/Status-Auth%20APIs%20Added-brightgreen)

---

## 📌 Project Overview (Completed Work)

This repository implements **Milestone 1: Project Initialization, System Architecture & Database Foundation**, plus registration and login APIs for Milestone 2:

* **Normalized Relational Schema (`database/schema.sql`)**: 20 tables covering authentication, PBKDF2/AES cryptographic metadata, vaults, secure credential sharing, security event logging, notifications, and analytics.
* **Automated Containerized Infrastructure (`docker-compose.yml`)**: Preconfigured, one-command deployment of **PostgreSQL 16**, **Redis 7** (caching layer), and **pgAdmin 4** (web management GUI).
* **Automated Database Bootstrapping**: Mounts the schema script directly into PostgreSQL’s initialization hook for zero-config table generation.
* **Pre-populated Seed Data**: Initialized system roles and default credential categories aligned with project specifications.
* **Authentication Microservices**: Independent Java 17 / Spring Boot services for account registration and login, backed by the existing PostgreSQL schema.

---

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

The services are managed via `docker-compose.yml`:

| Service | Container Name | Image | Port | Credentials / Config |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL** | `securevault-postgres` | `postgres:16-alpine` | `5432:5432` | DB: `securevault_db`<br>User: `postgres`<br>Password: `postgrespassword` |
| **Redis** | `securevault-redis` | `redis:7-alpine` | `6379:6379` | Default Redis cache port |
| **pgAdmin** | `securevault-pgadmin` | `dpage/pgadmin4:latest` | `5050:80` | Web Login: `admin@securevault.com`<br>Password: `admin` |
| **Registration API** | `securevault-registration-service` | Built from `auth-services/registration-service` | `8081:8081` | `POST /api/registration/register` |
| **Login API** | `securevault-login-service` | Built from `auth-services/login-service` | `8082:8082` | `POST /api/login` |

---

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

### Step 2: Start Containers with Docker Compose
Set a fresh JWT signing key in your shell before starting. Missing keys and the former public development key are rejected. Generate a key in PowerShell:

```powershell
$keyBytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($keyBytes)
$rng.Dispose()
$env:JWT_SECRET_BASE64 = [Convert]::ToBase64String($keyBytes)
```

Keep the key stable across restarts using your deployment secret manager; changing it invalidates existing JWT signatures. Do not commit it. Ensure Docker Desktop is open and run:
```bash
docker compose up --build -d
```
> **Note:** On first startup, Docker will pull the base images, build both Java services, and execute `database/schema.sql` to create the tables and seed default data. The APIs wait for PostgreSQL to become healthy.

---

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

### Step 4: Test Registration and Login with Thunder Client

Use Thunder Client's **New Request** view and send JSON requests with `Content-Type: application/json`.

**Register a user**

- Method: `POST`
- URL: `http://localhost:8081/api/registration/register`
- Body:

```json
{
    "username": "vaultuser",
    "email": "vaultuser@example.com",
    "password": "Password123!"
}
```

Expected: `202 Accepted` with the same generic acknowledgement for new and duplicate accounts. No account identifiers are returned. Passwords are stored as BCrypt hashes.

**Log in**

- Method: `POST`
- URL: `http://localhost:8082/api/login`
- Body:

```json
{
    "identifier": "vaultuser@example.com",
    "password": "Password123!"
}
```

`identifier` accepts either the registered username or email. Expected: `200 OK` with a 15-minute JWT access token and user summary. A SHA-256 fingerprint of each login token is recorded in the `sessions` table, rather than the bearer token itself. Five consecutive failed passwords lock the account for 15 minutes; a successful login clears the counter.

Invalid registration input returns `400 Bad Request`. Invalid, inactive, locked, and MFA-enabled logins return the same `401 Unauthorized` response. Nonexistent accounts receive a dummy BCrypt check to reduce timing differences. Expired lockouts start a fresh failure count. MFA-enabled accounts cannot sign in until a second-factor verification flow is implemented; no password-only token is issued.

Both services return `Cache-Control: no-store`. Each process limits login to 30 requests per minute per caller address, registration to 10, with at most eight authentication requests in progress per service. There is no global per-minute quota that one client can exhaust for everyone. Excess requests return `429` with `Retry-After: 60`. Limits reset on process restart and are not shared across replicas. Behind a reverse proxy, callers share the proxy address limit; configure a shared gateway limiter for production rather than trusting arbitrary forwarding headers. Account lockout can still be deliberately triggered by attackers; throttling reduces this risk but does not eliminate distributed attacks.

Compose binds the auth ports to `127.0.0.1` for local testing. Remote access requires an HTTPS reverse proxy with direct HTTP ports blocked. Localhost binding does not itself provide TLS; do not expose these services directly over HTTP.

Database configuration and schema were intentionally left unchanged. Before remote deployment, rotate the committed PostgreSQL and pgAdmin credentials, restrict their published ports, and replace the auth services' PostgreSQL superuser access with least-privilege database roles. Redis also has a published unauthenticated port. The existing `mfa_enabled`, lockout, and session columns support these auth fixes without a schema migration. The query using `lower(username)` / `lower(email)` would benefit from matching functional indexes as the users table grows. Existing case-sensitive unique constraints do not prevent case-variant accounts inserted outside registration; consider case-insensitive uniqueness after checking existing data.

Passwords must fit within BCrypt's 72-byte UTF-8 limit, in addition to the character limits. Requests over 8 KiB return `413` even with chunked encoding; invalid JSON and validation errors receive generic `400` responses without rejected passwords. Slow body uploads receive `408`; the elapsed-time guard works alongside the connector read timeout. Credential request records and token responses redact diagnostic string output, and Spring web logging defaults to INFO to avoid rejected-value debug logs. Multipart uploads are disabled. JWT lifetimes must be between 1 and 3600 seconds (default 900).

Auth services use Spring Boot 4.0.8, Tomcat 11.0.27, and Java 17; login uses JJWT 0.12.7. These upgrades replace the original Tomcat version affected by resource-exhaustion advisories ([Tomcat advisories](https://tomcat.apache.org/security-10.html), [Boot 4 migration guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)). Containers run as UID/GID 10001 with a read-only filesystem, dropped capabilities, no privilege escalation, and writable temporary storage. Docker builds run regression tests. Direct Java launches bind to localhost by default; Compose sets the internal container bind address while keeping host ports on localhost.

`.gitignore` and service `.dockerignore` files exclude environment secrets, private keys, and build output. They do not remove secrets already committed in Git history; rotate exposed secrets rather than relying on ignore rules.

Run regression tests with `mvn test` from each auth service directory (Java 17 and Maven required). JWT issuance and the JSON endpoints are implemented here; protected vault APIs, JWT consumption/revocation enforcement, and complete MFA verification are future work, so they cannot be certified by this review.

The login service health endpoint is `GET http://localhost:8082/api/login/health`.

---

### Step 5: Access pgAdmin (Web GUI)
1. Open your browser and navigate to: **`http://localhost:5050`**
2. Sign in with:
   * **Email:** `admin@securevault.com`
   * **Password:** `admin`
3. Connect to the database:
   * Right-click **Servers** ➔ **Register** ➔ **Server...**
   * **General Tab:** Name: `SecureVault`
   * **Connection Tab:**
     * **Host name/address:** `postgres` *(internal Docker network service name)*
     * **Port:** `5432`
     * **Maintenance database:** `securevault_db`
     * **Username:** `postgres`
     * **Password:** `postgrespassword`
   * Click **Save**.
4. Browse to **Servers** ➔ **SecureVault** ➔ **Databases** ➔ **securevault_db** ➔ **Schemas** ➔ **public** ➔ **Tables** to view and query tables interactively.

---

## 📂 Project Structure

```text
Infosys-Springboard-Java-Team3/
├── database/
│   └── schema.sql        # PostgreSQL DDL with extensions, tables, indexes, and seed data
├── auth-services/
│   ├── registration-service/  # Registration API (port 8081)
│   └── login-service/         # Login/JWT API (port 8082)
├── docker-compose.yml     # Multi-container orchestration (PostgreSQL, Redis, pgAdmin)
├── schema.md              # Detailed schema design documentation & ER diagram
├── README.md              # Project setup, execution guide, and architecture
└── Java_Integrated Password Vault...pdf  # Project specifications and syllabus
```

---

## 📦 Database Tables Overview

| Module | Tables | Purpose |
| :--- | :--- | :--- |
| **Authentication & Access Control** | `users`, `roles`, `user_roles`, `sessions`, `devices` | User management, RBAC, session tokens, and trusted device tracking. |
| **Vault & Credential Storage** | `vaults`, `vault_members`, `folders`, `categories`, `credentials`, `tags`, `tag_mappings`, `attachments` | Hierarchical encrypted item storage, categories, and file attachments. |
| **Secure Sharing** | `sharing` | Granular item sharing with permission tiers and expiration dates. |
| **Security & Audit Monitoring** | `audit_logs`, `security_events`, `blocked_ips`, `notifications` | Immutable audit trails, anomaly risk scores, IP blocking, and user alerts. |
| **Analytics Dashboard** | `password_health`, `login_stats` | User security posture scoring and daily login telemetry. |

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

- [x] **Milestone 1:** Database Schema Design, Normalization & Docker Setup
- [x] **Milestone 2:** Spring Boot registration and login microservices (BCrypt + JWT + PostgreSQL)
- [ ] **Milestone 3:** Encryption Service (AES-256-GCM + PBKDF2 Key Derivation) & Credential CRUD APIs
- [ ] **Milestone 4:** Secure Sharing Service & Audit Logging Interceptors
- [ ] **Milestone 5:** React.js Frontend Integration & Dashboards
