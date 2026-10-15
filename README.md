# SecureVault Authentication Services

Authentication contribution for the **SecureVault Password Vault and Secure Credential Sharing Management System**.

- **Team:** TEAM-3
- **Contribution branch:** `3-RABISHANKAR`
- **Scope:** user registration, password-based login, JWT access-token issuance, and authentication security checks.

## Implemented work

- Independent registration and login services backed by PostgreSQL.
- BCrypt password hashing and a random per-user vault-key salt.
- Default `ROLE_USER` assignment during registration.
- Login using either a username or an email address.
- Signed JWT access tokens with a configurable lifetime, defaulting to 15 minutes.
- Session records containing a SHA-256 token fingerprint rather than the bearer token.
- Account lockout after five failed passwords, with a 15-minute lockout and a fresh failure count after expiry.
- Input validation, request limits, safe error responses, and regression tests.

The vault-key salt is metadata for future vault encryption; this branch does not implement vault encryption or credential storage APIs.

## Technology

| Component | Version or purpose |
| --- | --- |
| Java | 17 |
| Spring Boot | 4.0.8 |
| Embedded Tomcat | 11.0.27 |
| Spring JDBC | Parameterized database queries and transactions |
| Spring Security Crypto | BCrypt password hashing |
| JJWT | 0.12.7 |
| PostgreSQL | Shared application database |
| Maven | Build, tests, and executable JAR packaging |
| Docker | Separate multi-stage builds for each service |

## Branch contents

```text
auth-services/
  registration-service/
    Dockerfile
    pom.xml
    src/main/java/com/securevault/registration/
    src/main/resources/application.properties
    src/test/java/com/securevault/registration/
  login-service/
    Dockerfile
    pom.xml
    src/main/java/com/securevault/login/
    src/main/resources/application.properties
    src/test/java/com/securevault/login/
.gitignore
README.md
```

The shared database schema and Docker Compose configuration are maintained on [TEAM-3](https://github.com/springboardmentor63053m-art/password-vault/tree/TEAM-3). They are not included in this contribution branch. Database configuration and schema were left unchanged by this auth-service contribution.

## Local setup

### 1. Prerequisites

- Java 17 and Maven available in the terminal.
- A running PostgreSQL instance initialized with the [TEAM-3 schema](https://github.com/springboardmentor63053m-art/password-vault/blob/TEAM-3/database/schema.sql).
- The schema's `users`, `roles`, `user_roles`, and `sessions` tables, including the seeded `ROLE_USER` role.

SQL initialization is disabled in both services; starting them does not create tables. Use the shared TEAM-3 database setup before testing registration or login.

```powershell
git clone --branch 3-RABISHANKAR --single-branch https://github.com/springboardmentor63053m-art/password-vault.git
cd password-vault
```

### 2. Configure the database connection

Open two PowerShell terminals at the repository root. Set these variables in **each terminal**, replacing the placeholders with the credentials of your existing database:

```powershell
$env:SPRING_DATASOURCE_URL = "jdbc:postgresql://localhost:5432/securevault_db"
$env:SPRING_DATASOURCE_USERNAME = "<database-user>"
$env:SPRING_DATASOURCE_PASSWORD = "<database-password>"
```

### 3. Run registration

In the first terminal:

```powershell
mvn -f auth-services/registration-service/pom.xml spring-boot:run
```

Registration listens at `http://localhost:8081`.

### 4. Configure and run login

In the second terminal, generate a signing key for local testing and start login:

```powershell
$keyBytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($keyBytes)
$rng.Dispose()
$env:JWT_SECRET_BASE64 = [Convert]::ToBase64String($keyBytes)
$env:JWT_EXPIRATION_SECONDS = "900"

mvn -f auth-services/login-service/pom.xml spring-boot:run
```

Login listens at `http://localhost:8082`. A signing key is required; missing, invalid, too-short, or the former public development key prevents login-service startup. Keep your own random key stable across restarts through your deployment's secret configuration. Generating a new key invalidates verification of existing tokens against that key. Do not commit signing keys or real database credentials.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `SPRING_DATASOURCE_URL` | JDBC URL for the existing database |
| `SPRING_DATASOURCE_USERNAME` | Database username |
| `SPRING_DATASOURCE_PASSWORD` | Database password |
| `JWT_SECRET_BASE64` | Required login-service signing key; Base64-encoded random bytes, at least 32 bytes before encoding |
| `JWT_EXPIRATION_SECONDS` | Login token lifetime: 1–3600 seconds; default `900` |
| `SERVER_ADDRESS` | Bind address; default `127.0.0.1` |

For the integrated Docker environment, use [TEAM-3's Compose setup](https://github.com/springboardmentor63053m-art/password-vault/blob/TEAM-3/docker-compose.yml) and its README. Each service's Dockerfile runs tests during the image build and runs the application as a non-root user.

## API examples

Use Thunder Client, Postman, or another HTTP client with `Content-Type: application/json`.

### Register a user

`POST http://localhost:8081/api/registration/register`

```json
{
  "username": "vaultuser",
  "email": "vaultuser@example.com",
  "password": "VaultPassword123!"
}
```

Username: 3–50 characters, using letters, numbers, dots, underscores, or hyphens. Email: valid format, up to 255 characters. Password: 12–72 Java characters and at most **72 UTF-8 bytes**; non-ASCII characters can consume more than one byte each. Usernames and emails are stored in lowercase.

New and duplicate accounts receive the same `202 Accepted` acknowledgement to reduce account enumeration:

```json
{
  "code": "REQUEST_RECEIVED",
  "message": "If these details are available, your account has been created."
}
```

### Log in

`POST http://localhost:8082/api/login`

```json
{
  "identifier": "vaultuser@example.com",
  "password": "VaultPassword123!"
}
```

`identifier` accepts the registered username or email. A successful `200 OK` response contains:

- `accessToken`: signed JWT.
- `tokenType`: `Bearer`.
- `expiresAt`: UTC expiration timestamp.
- `user`: ID, username, and email.

Invalid, inactive, locked, and MFA-enabled accounts receive a generic `401 Unauthorized` response. This branch does not yet implement second-factor verification, so MFA-enabled accounts cannot receive password-only access tokens.

### Health check

`GET http://localhost:8082/api/login/health`

```json
{
  "status": "UP",
  "service": "login-service"
}
```

This checks that the login application responds; it does not verify database connectivity.

### Response status reference

| Status | Meaning |
| --- | --- |
| `200` | Login succeeded, or health endpoint responded |
| `202` | Registration acknowledged; account existence is not disclosed |
| `400` | Invalid fields or malformed JSON |
| `401` | Login denied with a generic credential error |
| `408` | Request body took too long to read |
| `413` | Request body exceeds 8 KiB |
| `429` | Caller rate limit or concurrent-work limit reached; includes `Retry-After` |

## Security measures and limits

- Parameterized SQL queries and transactional account/session updates.
- Dummy BCrypt checks for unknown, inactive, and locked accounts to reduce timing differences.
- Per-process caller limits: 30 login POSTs/minute and 10 registration POSTs/minute, with at most eight POST requests in progress per service. Limits apply to POST requests handled by each service, including invalid routes.
- Bounded 8 KiB POST bodies, including chunked requests, and elapsed-time checks during body reads alongside a connector read timeout.
- No multipart uploads; forwarded client-address headers are not trusted.
- `Cache-Control: no-store`, frame protection, and content-type sniffing protection.
- Redacted credential/token diagnostic strings and generic validation errors. Web logging defaults to INFO to avoid exposing rejected values through DEBUG/TRACE output.
- Localhost binding by default, non-root Docker users, and ignore rules for local secrets and build artifacts.

Limits are local to each running process and reset on restart. A reverse proxy shares its address across callers unless a trusted gateway enforces client-aware limits. Distributed attackers can still trigger account lockouts. Remote deployment requires HTTPS and deployment-level access controls; localhost HTTP examples are for local testing.

## Build and test

From the repository root:

```powershell
mvn -f auth-services/registration-service/pom.xml package
mvn -f auth-services/login-service/pom.xml package
```

`package` compiles the services, runs tests, and creates executable JARs under each service's `target/` directory. For tests only, replace `package` with `test`.

**Verified on the contributed auth-service code:** 34 tests passed: 14 registration tests and 20 login tests. Both executable JARs packaged successfully. Tests cover application-context startup, JSON endpoints, password byte boundaries, generic duplicate responses, safe error output, MFA blocking, lockout expiry, JWT key/lifetime validation, and request limits. Database access is mocked in these tests; this is not a live database integration test. Docker container runtime verification was not performed.

## Remaining work

- Second-factor challenge and verification for MFA-enabled accounts.
- Protected-resource JWT verification and session revocation enforcement; this branch currently issues tokens only.
- Vault encryption, credential CRUD, sharing, and the frontend.
- Shared gateway throttling and HTTPS configuration for deployed environments.

The shared database and infrastructure security findings remain outside this branch's changes. See the TEAM-3 documentation for the integrated project configuration.
