# SecureVault work tracker

**Project:** SecureVault — Integrated Password Vault and Secure Credential Sharing Management System
**Team:** Infosys Springboard Team 3
**Updated:** October 27, 2026
**Scope:** Current `TEAM-3` implementation and the contribution history being carried to `3-RABISHANKAR`.

## Status at a glance

| Area | Status | Notes |
| --- | --- | --- |
| PostgreSQL schema and local container setup | Implemented | Schema bootstrap provisions a restricted backend database account; Redis and pgAdmin are optional tools. |
| Registration, login, and session lifecycle | Implemented | BCrypt, opaque registration response, rate limiting, lockout, validation, session and device records. |
| IP and sign-in risk telemetry | Implemented | IP, successful/failed login, new device, repeated failures, and unusual-time signals feed audit/security data. |
| Admin dashboard and user/role management | Implemented | Role-protected API; password confirmation and audit trail for administrator role changes. |
| Threat analytics dashboard | Implemented with data-source limits | Date-filtered live summary, trends, alert search/filter/sort/pagination, supporting audit details, investigation notes/history, False Positive status, and rule-based access-denial/login signals. No plaintext password inspection. |
| TOTP authenticator MFA | Implemented | User and admin settings, locally generated QR, manual key, verification before enable, code required at each login once enabled. |
| Risk-based email MFA | Implemented; SMTP is deployment-configured | New device/IP or unusual-time sign-ins can require a six-digit email code. Delivery depends on valid SMTP settings. |
| Audit trail search and export | Implemented | Searchable/paginated records; CSV and `.xlsx` export of matching records, up to 50,000. |
| User-facing vault screen | Demo only | Sample records stay in browser memory and are not encrypted or synchronized. |
| Encrypted vault API and secure sharing | Planned | No live credential CRUD, key derivation, encryption/decryption, or sharing workflow yet. |

## Implemented modules

### Database and runtime

- PostgreSQL schema for users, roles, devices, sessions, audit logs, security events, password-health aggregates, vault metadata, and related project entities.
- Compose bootstrap applies the schema and provisions the least-privilege `securevault_app` database user.
- Backend container runs with a read-only root filesystem, dropped capabilities, and `no-new-privileges`.
- Redis 7 and pgAdmin 4 are optional Compose `tools` services; Redis is not currently the session or rate-limit store.

### Registration, login, and sessions

- Registration always assigns the normal user role; role requests from the client are not trusted.
- Login accepts username or email and uses BCrypt password verification.
- Failed login throttling/lockout, request-size limits, password-length validation, structured API errors, and dummy password verification for unknown users are implemented.
- Session tokens are validated against active session records; logout revokes the current session.
- Device identifiers and source IP observations are recorded. Reverse-proxy forwarding is honored only for explicitly trusted CIDRs.

### Administrator console

- Dashboard overview, account search/details, account state controls, role controls, connected-device/session review, and device revocation.
- Role changes require the signed-in administrator’s current password. The actor, target, prior role, and new role are recorded.
- Threat analysis includes security events, severity/status workflow, login monitoring, password-health metadata, suspicious-vault indicators, and a security score.
- Threat analytics is protected by Spring Security plus the existing active-session/admin-role authorization. Investigation status and notes are retained in `security_event_history` and mirrored to the audit trail.
- Vault overview returns metadata and aggregate counts only; credential values are excluded from administrator responses.
- The audit trail supports filtering and pagination. Export creates UTF-8 CSV or Excel `.xlsx` files locally in the browser. CSV formula-like cells are neutralized; the export is capped at 50,000 matching records.

### Multi-factor authentication

- All account types can enroll from the user dashboard’s security panel; administrators also have **Account security** in the admin console.
- Enrollment asks for the account password, provides an `otpauth://` link/manual key and local QR code, and requires a valid six-digit TOTP code before activation.
- Authenticator codes are required at every login for enrolled accounts. Accounts without TOTP can receive email codes for sign-ins that trigger device/IP/time risk checks.
- TOTP seeds are encrypted at rest. Set a dedicated `MFA_ENCRYPTION_KEY_BASE64` before enrollment and keep it stable. When omitted, current configuration falls back to the JWT signing key.
- Email code delivery is controlled by SMTP environment variables. Gmail app passwords belong in the local ignored `.env` only.

## Branch contribution record

The earlier `3-RABISHANKAR` commits added standalone registration and login services, their authentication/security filters and validation, service/container configuration, and tests. A branch README documenting those services was restored after a documentation revert. The implementation summary records the commit references and separates that earlier work from the consolidated features being pushed now.

The current `TEAM-3` changes consolidate authentication in `backend/`, build on the team’s React user/admin apps, add account security monitoring and MFA workflows, and add audit export. This tracker and the root README are being refreshed to reflect the current code rather than the older milestone-only status.

## Known limitations and follow-up work

1. **Vault persistence and encryption:** Build the key-derivation and AES-GCM service, credential/folder CRUD APIs, and encrypted client workflow. The existing vault screen is sample-only.
2. **Secure sharing:** Implement invitations, permission checks, expiry, revocation, and event auditing.
3. **Password-health producer:** Connect the current aggregate/reporting path to a real password-quality workflow. Reuse and breach counts are not automatically assessed by this build.
4. **MFA recovery:** Add recovery codes or a safe second-factor reset process before enforcing authenticator enrollment for every account.
5. **Operational email validation:** Verify SMTP credentials and monitor delivery in each deployment; do not assume local configuration alone proves delivery.
6. **Distributed throttling/session cache:** Integrate Redis if the application is deployed across multiple backend instances.
7. **Production deployment:** Add deployment-specific secrets management, TLS termination, backups, monitoring, and operational rotation procedures.
8. **Threat-data sources:** Connect the planned vault and sharing APIs to audit events; this build cannot detect credential access or sharing that is never emitted by those APIs. IP geolocation is intentionally not inferred from address changes.

## Validation notes

- The admin Vite production build passed after adding CSV and `.xlsx` export.
- Both frontends built successfully after adding the shared authenticator QR setup panel.
- Backend regression tests are available with `mvn test` from `backend/`; rerun after backend changes.
- See [README.md](../README.md) for setup and local run instructions.
