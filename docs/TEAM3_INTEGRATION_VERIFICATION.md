# TEAM-3 integration verification — 2026-11-23

Base: `2563ccbb5c0bbe3fac70632bd3c9a2329bd13be0` from the mentor repository TEAM-3 branch. Source: reviewed 2026-11-19 clean snapshot plus the later Postman testing pack. The working 3-mangal source was compared against the snapshot; differences were sanitized configuration, documentation, role-bootstrap hardening and fictional demo placeholders. No later application implementation was omitted. No unrelated Git histories are merged.

## Preserved and replaced files

All prior commits and unrelated source modules are retained, including the existing design PDF. Authentication, User/Admin entry points and navigation were integrated from the tested snapshot. README and configuration templates replace installation-specific examples with private environment references and separate local ports. Exactly 28 previously tracked backend target artifacts are removed from tracking; future builds remain ignored. No original checkout or live database is modified.

## Executed verification

- Maven compile and 33 backend unit tests: passed, zero failures/errors/skips. Covers input validation, login, throttling, MFA, role changes, crypto and mocked mail.
- Opt-in PostgreSQL integration suite: 13 passed, zero failures/errors/skips. Covers ownership, encrypted vault CRUD, password-change/MFA invariants, internal share expiry/revocation, metadata-only monitoring, external invitation/OTP/replay/one-time access, denied sharing alerts and notifications. Only a new disposable PostgreSQL container/database was used and then removed.
- Fresh bootstrap, complete schema and all five migrations in filename order: passed against isolated PostgreSQL 16. Initialized 25 public tables. App-role audit UPDATE and security-event-history DELETE privileges both false.
- Frontend: npm ci, 44 tests across 10 files and Vite production build passed. Both main and external entry points built. Tests cover login/navigation, account security, sharing and Admin Sharing Activity.
- Mailpit and Gmail Compose configurations: docker compose config --quiet passed using generated ephemeral fictional credentials. No real email sent.
- Postman: source routes and JSON/scripts checked during preparation; runtime Postman tests and screenshots are manual, not claimed as passed.

## Security and limits

Private configurations, dumps, credentials, dependencies and build outputs are excluded. Recognizable token/private-key/hash signatures and SMTP/database/key assignments were inspected with values suppressed; synthetic unit-test vectors and fictional fixtures are intentional. Automated mail uses mocks. No real-user login attempts were generated.

Historical credential candidates already in upstream TEAM-3 occur in `.env.example`, `README.md`, `docker-compose.yml`, `backend/src/main/resources/application.properties` and `backend/target/classes/application.properties`. Existing history is preserved; removing artifacts or changing current templates does not erase earlier values. Repository owners should review whether any historical value was deployed. Rotate exposed passwords or JWT signing secrets through a planned procedure; do not rotate vault/MFA keys without a deliberate data re-encryption migration. No keys or credentials were rotated by this integration.

No browser-based live-account verification, real Gmail delivery, full Docker backend-image build or public deployment is claimed. Dockerfile source and Compose configuration were inspected; Maven packaging and the frontend production build are separate checks. Mockito reports a non-failing future-JDK dynamic-agent warning.
