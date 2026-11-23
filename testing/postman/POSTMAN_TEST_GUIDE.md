# SecureVault Postman API testing and screenshot guide

## Scope and verification status

These files target only the existing 3-mangal backend at http://127.0.0.1:18080. The frontend is http://127.0.0.1:3300 and Mailpit is http://127.0.0.1:18025. They do not target the separate TEAM-3 port 8080 or the clean personal snapshot.

The collection contains **116 request cases** across eight folders. Paths, JSON fields, expected HTTP statuses and response assertions were derived from the backend source. This is a prepared manual test pack. No Postman requests or API tests have been executed merely by creating/importing these files. A skipped request has no result and must never be reported as Passed.

## Import and private setup

1. Open a current Postman Desktop version supporting `pm.execution.skipRequest()`.
2. Import SecureVault.postman_collection.json and SecureVault-Local.postman_environment.json.
3. Select the environment **SecureVault Local — Private Test Values**. Keep that exact name because the safety checks use it.
4. Use a local/private workspace. Keep credentials and tokens in local values, never shared/synced/exported values. Secret variable types mask the UI but do not make an export safe.
5. Send TC001 first. Pre-request scripts create unique svpm_ account names, @example.test email addresses, a stable device ID, and random synthetic passwords in the local environment. They never access your real passwords or keys.
6. All writes, SMTP requests, secret-returning reads and destructive actions require `armed_request` to contain the exact test ID, for example TC010. The switch clears itself before that one request is sent. Requests lacking prerequisites are skipped. Set the ID again only when you intentionally retry.
7. Keep `allow_sensitive_account_changes`, `allow_admin_changes`, and `allow_breach_lookup` false unless deliberately executing those optional test cases.
8. Do not use a whole-collection run to generate screenshots. Select requests individually in the execution order below. Do not supply Runner iteration data or override the environment's generated IDs. Default guards intentionally prevent unattended modifications.

Postman's documented pre-request skip behavior applies in the API client and Collection Runner. If the client does not support it, upgrade before using the pack. A pre-request error or a skipped request is not a passed API test. [Postman execution reference](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-execution/)

## Email safety — use Mailpit

The collection will skip mail-producing operations until you verify the backend is using Mailpit and set `smtp_mode_verified=MAILPIT` locally. This value is your manual acknowledgement, not an API-based detection mechanism. Leave it blank in Gmail mode. All generated recipient addresses end in @example.test.

If you need to select Mailpit, run in the existing 3-mangal checkout:

```powershell
Set-Location 'C:\Users\domaa\OneDrive\Desktop\SecureVault-3-Mangal'
$base = @('-p', 'securevault3mangal', '-f', 'docker-compose.yml', '-f', '.tools/compose.local.yml')
docker compose --env-file .env @base -f .tools/compose.mail-test.yml up -d --no-deps mail-test
docker compose --env-file .env @base -f .tools/compose.mail-test.yml up -d --no-deps backend
docker exec securevault-3-mangal-backend sh -c 'test "$SPRING_MAIL_HOST" = mail-test && test "$SPRING_MAIL_PORT" = 1025 && echo Mailpit-SMTP-selected'
```

The last command reveals only a confirmation, not environment values. If it fails, do not set the acknowledgement. Open Mailpit at http://127.0.0.1:18025. Do not import Gmail credentials into Postman. No script automatically changes SMTP mode, queries inbox contents, generates OTPs, promotes an account or bypasses MFA.

## Authentication and HTTP contract

- Authentication is `Authorization: Bearer <accessToken>`, not cookies. The token must also match an active database session.
- Requests carry `Accept: application/json`, the fixed User-Agent `SecureVault-Postman-Lab/1.0` and `X-SecureVault-Device: {{device_id}}`. Keep the same device ID, User-Agent and network path between password login and MFA verification.
- Requests with JSON also carry `Content-Type: application/json`. Do not add a browser Origin header in Postman.
- Every body is serialized from the documented JSON template by a pre-request script into local `sv_request_body`. The Body editor therefore shows `{{sv_request_body}}`. This safely escapes quotes in private values. The exact templates appear in each request's description and in the catalog below.
- No passwords or OTPs are sent in URLs. External invitation tokens are pasted from the email fragment after # and sent only in POST bodies.
- Registration returns **202 REQUEST_RECEIVED** for both a new and duplicate account. It supplies no account ID and does not prove creation. Verify by successful login and GET /api/account/me.
- Password login returns **200** with accessToken/tokenType/expiresAt/user, or **202** with mfaRequired/challengeId/method/maskedEmail/expiresAt. A 503 SMTP failure is a failed prerequisite, not a valid login result.
- Current Admin filtering gives **401** for an authenticated regular user because it does not establish an Admin context. The collection deliberately tests the implementation's 401, rather than guessing 403.
- Invalid DTO input normally returns **400 INVALID_REQUEST**. Expected service errors use their documented HTTP status with an error code/message. Do not use the generic code ADMIN_OPERATION_REJECTED to infer that an error came from an Admin route.
- Successful create/update operations generally return **200**, not an invented 201. Delete/revoke/mark-read actions return **204**.
- Metadata responses may include null password/notes fields. Assertions permit null fields and reject nonempty secret values.
- Session tokens and grants are captured only into runtime environment variables. No saved response examples or hardcoded authentication data are exported with this pack.

## MFA and recipient verification

For an EMAIL login challenge, locate the sign-in email addressed to the generated account's exact test_email or recipient_email in Mailpit. Privately put its six digits in user_otp or recipient_otp and arm the corresponding completion request. For Admin login use admin_otp. For TOTP, use the entry genuinely enrolled for that exact account on this installation. Scripts do not derive or read TOTP seeds.

Login challenges last five minutes and allow five failed attempts. TOTP uses SHA1, six digits, 30-second steps, a +/- one-step window and replay protection. Wait for a new code after an enrollment confirmation or another successful TOTP action. Do not repeatedly submit codes to the existing demo accounts.

TC022 is limited to one bad-password attempt on the synthetic owner per run. TC023 tests malformed MFA input; TC024 tests an unknown challenge. These cases do not establish that a valid account's six-digit MFA comparison was executed.

For the external invitation, copy only its fragment after # into external_share_token. TC073 sends to the share's stored email address. It does not accept a different recipient email in its body. Paste the received code privately into otp. Choose a different six-digit wrong_otp for TC074. Run once. TC075 captures the grant; TC086 tests OTP replay before TC076 consumes the one-time share. After consumption the share returns 410 instead of 401.

External codes/grants last five minutes. Code resends have a 60-second cooldown, with five attempts per issued code and twelve sends per share. The sender quota is ten invitations per hour. Do not stress these limits or brute force any live account.

## Execution order

### Prepare and authenticate

TC001 → TC010 → TC011 → TC012 → TC013 → TC014 → TC015 if 202 → TC016 → TC017 → TC018 if 202 → TC019.

### Vault fixtures

TC030 → optional TC031 → TC033 → TC032 → TC034 → optional armed TC035 → TC036 → TC037 → TC038 → TC040 → TC041.

### Internal sharing

TC050 → TC051 → TC052 → TC053 → optional armed TC054 → TC055 → TC056 → TC059 → TC060 → TC061 → TC057 → TC058.

### One-time external workflow

TC070 → TC071 → paste invitation fragment into external_share_token → TC072 (repeat safely) → TC073 → TC088 within 60 seconds → read the code privately into otp and a different wrong_otp → TC074 once → TC075 → TC086 BEFORE retrieval → TC087 → TC076 → TC077. Then TC089 and TC090.

### External revocation

TC079 → TC080 → paste that second invitation fragment into external_revoked_token → TC156 BEFORE revoking → TC081 → TC082.

### Natural expiry

TC083 → TC084 → paste the third invitation fragment into external_expired_token → wait until external_expires_at (at least 15 minutes) → TC085.

### Account metadata

TC100 → TC101 → TC102 → TC109 → TC110 → optional TC111/TC112 → TC113. Use TC160 only after TC101 and before revoking any owner session.

### Admin read-only screens

Privately fill admin_username/admin_password → TC020 → TC021 if 202 → TC120 → TC121 through TC136. TC126 requires an event captured by TC125; if there are no synthetic events it is Not Applicable.

### Optional synthetic MFA/security changes

Enable allow_sensitive_account_changes only for the verified synthetic owner. TC103 → privately enroll the returned synthetic setup key → fresh totp_code → TC104 → TC102 → TC028 → fresh user_otp → TC015 → TC016. TC105/TC106/TC107/TC108 are optional and can invalidate test sessions. Keep them out of the screenshot sequence unless explicitly required.

### Final cleanup

After all sharing/expiry checks, TC042 → TC043 → TC025 → TC026. Logout recipient/Admin through their UI or a separately selected logout request if needed. Do not use account deletion or database cleanup; no such request is included.

Sessions normally expire after 15 minutes. After the natural-expiry wait, repeat TC014/TC015 as needed and TC016, plus the recipient/Admin login and identity checks if their sessions expired. An unexpected 401 on a successful request is a failed session prerequisite, not a passed test. Keep the generated fixture passwords unchanged so you can sign in again.

## Environment values

Sensitive exported fields are blank. Pre-request scripts generate only synthetic fixture values. Runtime tokens are private and must be cleared before export. If you need a new run, re-import a fresh copy of the blank environment or duplicate it locally with cleared runtime values.

| Variable | Purpose |
|---|---|
| base_url | Fixed to http://127.0.0.1:18080 to avoid another installation |
| armed_request | Exact TC ID allowing one manual write/email/secret read |
| smtp_mode_verified | Set MAILPIT only after confirming the server's SMTP mode |
| test_username, test_email, test_password | Generated synthetic owner |
| test_recipient, recipient_email, recipient_password | Generated distinct recipient |
| admin_username, admin_password | Fill privately with an authorized Admin only for successful login/read-only checks |
| user_token, recipient_token, admin_token | Captured accessToken values |
| mfa_challenge, recipient_mfa_challenge, admin_mfa_challenge | Captured challenge IDs |
| user_otp, recipient_otp, admin_otp | Manually entered login code, cleared after success |
| credential_id, share_id | IDs captured from the fixture's create responses |
| external_share_token | Fragment from the one-time invitation email |
| otp, wrong_otp | Manually entered external verification code and a deliberately different test code |
| external_grant | Captured restricted grant; retained locally to test replay |
| external_revoked_token | Fragment from the separate revocation invitation |
| external_expired_token | Fragment from the separate expiry invitation |
| external_expires_at | Captured expiry timestamp; TC085 skips until it has passed |
| totp_code | Fresh code entered privately for optional synthetic-account MFA/security changes |
| session_id, device_id_to_revoke | Owned synthetic IDs captured from Account Security |
| notification_id | First notification from the verified synthetic account |
| event_id | First synthetic-owner event captured from Threat Analytics |

Do not paste tokens from the frontend or alter captured ownership markers to make a request run. First complete the synthetic identity checks TC016/TC019. An Admin account is not created or promoted by this pack. Use a legitimately provisioned Admin and complete its normal password/MFA flow privately. Optional Admin mutation cases target only the verified synthetic recipient or its captured synthetic-owner event.

## What to submit — 25 suggested screenshots

Use the **Test Results** tab, with the request name, method/path, HTTP status and assertions visible. Crop the Authorization tab, request Body and raw response. This is especially important for login/MFA, credential reads, OTP verification grants, profile data and Admin results. Do not show variable values or the Postman Console. Use local redaction before sharing any screenshot.

| Test | Request | Screenshot filename |
|---|---|---|
| TC001 | Backend and database health | TC001_backend_and_database_health.png |
| TC010 | Register synthetic owner | TC010_register_synthetic_owner.png |
| TC011 | Reject invalid registration | TC011_reject_invalid_registration.png |
| TC012 | Duplicate registration remains opaque | TC012_duplicate_registration_remains_opaque.png |
| TC014 | Valid user login | TC014_valid_user_login.png |
| TC015 | Complete user MFA | TC015_complete_user_mfa.png |
| TC016 | Verify user synthetic identity | TC016_verify_user_synthetic_identity.png |
| TC033 | Create synthetic vault credential | TC033_create_synthetic_vault_credential.png |
| TC034 | List credentials without passwords | TC034_list_credentials_without_passwords.png |
| TC038 | Assess password health | TC038_assess_password_health.png |
| TC040 | Recipient cannot read owner's private vault item | TC040_recipient_cannot_read_owner_s_private_vault_item.png |
| TC051 | Share fixture with registered recipient | TC051_share_fixture_with_registered_recipient.png |
| TC053 | Shared with Me — recipient | TC053_shared_with_me_recipient.png |
| TC055 | Sharing history | TC055_sharing_history.png |
| TC058 | Revoked internal share cannot be read | TC058_revoked_internal_share_cannot_be_read.png |
| TC070 | Send one-time invitation — Mailpit only | TC070_send_one_time_invitation_mailpit_only.png |
| TC071 | List and capture one-time share ID | TC071_list_and_capture_one_time_share_id.png |
| TC072 | Inspect invitation without consuming access | TC072_inspect_invitation_without_consuming_access.png |
| TC075 | Verify recipient mailbox | TC075_verify_recipient_mailbox.png |
| TC077 | Reject repeated one-time retrieval | TC077_reject_repeated_one_time_retrieval.png |
| TC082 | Reject revoked invitation | TC082_reject_revoked_invitation.png |
| TC121 | Admin dashboard overview | TC121_admin_dashboard_overview.png |
| TC125 | Threat Analytics — test account events | TC125_threat_analytics_test_account_events.png |
| TC130 | External sharing filter | TC130_external_sharing_filter.png |
| TC153 | Reject regular user from Admin Sharing Activity | TC153_reject_regular_user_from_admin_sharing_activity.png |

For TC014, capture the actual 200 or 202 returned. For TC015, the Test Results tab is sufficient evidence without revealing its token. For TC075, show only assertions, not the grant. For TC033, use the metadata response only if every sensitive request field has been cropped. If a case is skipped, unavailable or fails, record that actual result. Never create a screenshot labeled Passed from a skipped case.

## Unsupported or constrained cases

| Feature/scenario | Status |
|---|---|
| Password reset, forgotten-authenticator recovery and recovery-code APIs | Not Implemented |
| Cookie login or a separate Admin password endpoint | Not Applicable — shared Bearer session workflow |
| Choosing Admin privileges during registration | Not Implemented by design |
| Arbitrary external expiry such as one minute | Not Applicable — supported durations are 15, 60, 1440 and 10080 minutes |
| Instant expired-link test by changing SQL rows | Excluded — use a separate invitation and wait for natural expiry |
| Confirmed public-email inbox delivery | Not Applicable to this Mailpit pack — SMTP acceptance and Mailpit arrival are separate evidence |
| Automatic recipient-email substitution during verification | Not Applicable — server uses the stored share recipient |
| Backend CSV/XLSX audit-export endpoints | Not Implemented — the frontend creates exports from authorized activity responses |
| Full brute-force/lockout and threshold stress tests on existing accounts | Excluded from manual pack — use the isolated automated tests |
| No synthetic alert for TC126 | Not Applicable until TC125 returns a synthetic event |
| Breach lookup success when provider unavailable | Unknown — the service can return 200 with an unavailable message |

## Source and existing-test inspection

The request catalog maps to AuthController, AccountIdentityController, AccountMfaController, VaultController, SharingController, ExternalSharingController, AccountSecurityController, NotificationController, AdminController and AdminSharingController.

Inspected services include LoginService, RegistrationService, AccountMfaService, MfaCryptoService, VaultService, PasswordHealth, BreachService, SharingService, ExternalSharingService, AccountSecurityService, NotificationService and AdminService. Authorization is enforced by AccountWebConfig/AccountAuthenticationInterceptor plus AdminSecurityConfiguration, AdminSessionAuthenticationFilter, AdminWebConfig and AdminAuthenticationInterceptor. AuthRateLimitFilter applies bounded bodies, request-rate limits and no-store headers.

Existing test infrastructure includes backend Maven/JUnit tests for authentication/input validation/rate limiting/MFA/mail/Admin roles and vault logic, plus the guarded VaultPostgresIT PostgreSQL integration suite. Frontend Vitest covers login MFA, vault CRUD, sharing, external forms, Account Security, notifications, dashboard routing and Admin sharing. No existing Postman collection or PowerShell/shell API test pack was found in the inspected tracked application tree. Database migrations and the schema are application setup, not scripts to reset a test database. No existing test script was executed for generating this manual pack.

## Validation and limits

The generated JSON is checked for syntax, v2.1 collection structure, matching variable references, unique test IDs, JavaScript syntax and request coverage against the inspected controllers. This does not execute a real Postman sandbox or establish live API results. The assertions are expected checks until you send each request in Postman. Network/SMTP/database errors or expired sessions must be recorded as failures or blocked prerequisites rather than silently accepted alternate statuses.

## Complete request catalog

Every request below includes the exact path, authentication, JSON template, prerequisite notes, execution/arming instructions, expected structure and status. Header rules and safe JSON serialization apply to every request. GET/DELETE requests without a listed JSON template have no body.

### 01 - Backend Health Check

#### TC001 — Backend and database health

- Method and endpoint: `GET {{base_url}}/api/health`
- Authentication: None.
- Expected HTTP: **200**. Expected response shape: **health**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Prerequisite/result interpretation: Backend SELECT checks users table. 503/DOWN indicates an environment failure, not a pass.
- Screenshot: TC001_backend_and_database_health.png. Capture only Test Results and safe status/path information.

No request body.

#### TC002 — Login health alias

- Method and endpoint: `GET {{base_url}}/api/login/health`
- Authentication: None.
- Expected HTTP: **200**. Expected response shape: **health**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC002_test_results.png. Capture only Test Results and safe status/path information.

No request body.

### 02 - Authentication and Registration

#### TC010 — Register synthetic owner

- Method and endpoint: `POST {{base_url}}/api/registration/register`
- Authentication: None.
- Expected HTTP: **202**. Expected response shape: **ack**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC010` immediately before Send.
- Prerequisite/result interpretation: Opaque acknowledgement does not prove insertion. Complete login and identity checks.
- Screenshot: TC010_register_synthetic_owner.png. Capture only Test Results and safe status/path information.

```json
{
  "username": "{{test_username}}",
  "email": "{{test_email}}",
  "password": "{{test_password}}"
}
```

#### TC011 — Reject invalid registration

- Method and endpoint: `POST {{base_url}}/api/registration/register`
- Authentication: None.
- Expected HTTP: **400**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC011` immediately before Send.
- Screenshot: TC011_reject_invalid_registration.png. Capture only Test Results and safe status/path information.

```json
{
  "username": "x",
  "email": "not-an-email",
  "password": "short"
}
```

#### TC012 — Duplicate registration remains opaque

- Method and endpoint: `POST {{base_url}}/api/registration/register`
- Authentication: None.
- Expected HTTP: **202**. Expected response shape: **ack**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC012` immediately before Send.
- Screenshot: TC012_duplicate_registration_remains_opaque.png. Capture only Test Results and safe status/path information.

```json
{
  "username": "{{test_username}}",
  "email": "{{test_email}}",
  "password": "{{test_password}}"
}
```

#### TC013 — Register synthetic recipient

- Method and endpoint: `POST {{base_url}}/api/registration/register`
- Authentication: None.
- Expected HTTP: **202**. Expected response shape: **ack**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC013` immediately before Send.
- Screenshot: Optional TC013_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "username": "{{test_recipient}}",
  "email": "{{recipient_email}}",
  "password": "{{recipient_password}}"
}
```

#### TC014 — Valid user login

- Method and endpoint: `POST {{base_url}}/api/login`
- Authentication: None.
- Expected HTTP: **200 or 202**. Expected response shape: **login**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC014` immediately before Send. Required runtime variables: `test_username`, `test_password`.
- Email gate: verified Mailpit mode is required. No real external SMTP test is authorized by this collection.
- Prerequisite/result interpretation: 200 means a session was issued. 202 means finish this same login's MFA. SMTP unavailable (503) is a failed prerequisite.
- Screenshot: TC014_valid_user_login.png. Capture only Test Results and safe status/path information.

```json
{
  "identifier": "{{test_username}}",
  "password": "{{test_password}}"
}
```

#### TC015 — Complete user MFA

- Method and endpoint: `POST {{base_url}}/api/login/mfa`
- Authentication: None.
- Expected HTTP: **200**. Expected response shape: **session**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC015` immediately before Send. Required runtime variables: `mfa_challenge`, `user_otp`.
- Prerequisite/result interpretation: Use the method returned by login. Enter an EMAIL code from Mailpit or a fresh TOTP privately. Never screenshot this body/response.
- Screenshot: TC015_complete_user_mfa.png. Capture only Test Results and safe status/path information.

```json
{
  "challengeId": "{{mfa_challenge}}",
  "code": "{{user_otp}}"
}
```

#### TC016 — Verify user synthetic identity

- Method and endpoint: `GET {{base_url}}/api/account/me`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **identity**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Prerequisite/result interpretation: Verifies the token belongs to the expected svpm_ test account before any user-data mutation.
- Screenshot: TC016_verify_user_synthetic_identity.png. Capture only Test Results and safe status/path information.

No request body.

#### TC017 — Valid recipient login

- Method and endpoint: `POST {{base_url}}/api/login`
- Authentication: None.
- Expected HTTP: **200 or 202**. Expected response shape: **login**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC017` immediately before Send. Required runtime variables: `test_recipient`, `recipient_password`.
- Email gate: verified Mailpit mode is required. No real external SMTP test is authorized by this collection.
- Prerequisite/result interpretation: 200 means a session was issued. 202 means finish this same login's MFA. SMTP unavailable (503) is a failed prerequisite.
- Screenshot: Optional TC017_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "identifier": "{{test_recipient}}",
  "password": "{{recipient_password}}"
}
```

#### TC018 — Complete recipient MFA

- Method and endpoint: `POST {{base_url}}/api/login/mfa`
- Authentication: None.
- Expected HTTP: **200**. Expected response shape: **session**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC018` immediately before Send. Required runtime variables: `recipient_mfa_challenge`, `recipient_otp`.
- Prerequisite/result interpretation: Use the method returned by login. Enter an EMAIL code from Mailpit or a fresh TOTP privately. Never screenshot this body/response.
- Screenshot: Optional TC018_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "challengeId": "{{recipient_mfa_challenge}}",
  "code": "{{recipient_otp}}"
}
```

#### TC019 — Verify recipient synthetic identity

- Method and endpoint: `GET {{base_url}}/api/account/me`
- Authentication: Bearer {{recipient_token}} — verified synthetic recipient.
- Expected HTTP: **200**. Expected response shape: **identity**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Prerequisite/result interpretation: Verifies the token belongs to the expected svpm_ test account before any user-data mutation.
- Screenshot: Optional TC019_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC020 — Valid admin login

- Method and endpoint: `POST {{base_url}}/api/login`
- Authentication: None.
- Expected HTTP: **200 or 202**. Expected response shape: **login**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC020` immediately before Send. Required runtime variables: `admin_username`, `admin_password`.
- Email gate: verified Mailpit mode is required. No real external SMTP test is authorized by this collection.
- Prerequisite/result interpretation: 200 means a session was issued. 202 means finish this same login's MFA. SMTP unavailable (503) is a failed prerequisite.
- Screenshot: Optional TC020_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "identifier": "{{admin_username}}",
  "password": "{{admin_password}}"
}
```

#### TC021 — Complete admin MFA

- Method and endpoint: `POST {{base_url}}/api/login/mfa`
- Authentication: None.
- Expected HTTP: **200**. Expected response shape: **session**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC021` immediately before Send. Required runtime variables: `admin_mfa_challenge`, `admin_otp`.
- Prerequisite/result interpretation: Use the method returned by login. Enter an EMAIL code from Mailpit or a fresh TOTP privately. Never screenshot this body/response.
- Screenshot: Optional TC021_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "challengeId": "{{admin_mfa_challenge}}",
  "code": "{{admin_otp}}"
}
```

#### TC022 — Incorrect password once on synthetic owner

- Method and endpoint: `POST {{base_url}}/api/login`
- Authentication: None.
- Expected HTTP: **401**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC022` immediately before Send.
- Prerequisite/result interpretation: One attempt per test run only. Do not repeat against any existing real/demo account.
- Screenshot: Optional TC022_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "identifier": "{{test_username}}",
  "password": "{{wrong_password}}"
}
```

#### TC023 — Reject malformed MFA code

- Method and endpoint: `POST {{base_url}}/api/login/mfa`
- Authentication: None.
- Expected HTTP: **400**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC023` immediately before Send.
- Prerequisite/result interpretation: Validation-only rejection. Does not prove six-digit code comparison.
- Screenshot: Optional TC023_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "challengeId": "{{unknown_uuid}}",
  "code": "12345x"
}
```

#### TC024 — Reject unknown MFA challenge

- Method and endpoint: `POST {{base_url}}/api/login/mfa`
- Authentication: None.
- Expected HTTP: **401**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC024` immediately before Send.
- Prerequisite/result interpretation: Fictional code and nonexistent challenge, not a brute-force attempt on a real challenge.
- Screenshot: Optional TC024_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "challengeId": "{{unknown_uuid}}",
  "code": "000000"
}
```

#### TC025 — Logout owner — run last

- Method and endpoint: `POST {{base_url}}/api/logout`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **204**. Expected response shape: **empty**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC025` immediately before Send.
- Prerequisite/result interpretation: Revokes this synthetic owner's current session. Finish all other owner requests first.
- Screenshot: Optional TC025_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC026 — Reject logged-out session

- Method and endpoint: `GET {{base_url}}/api/account/me`
- Authentication: Bearer {{logged_out_token}} — deliberately revoked session.
- Expected HTTP: **401**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required. Required runtime variables: `logged_out_token`.
- Screenshot: Optional TC026_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC027 — Unknown username stays generic

- Method and endpoint: `POST {{base_url}}/api/login`
- Authentication: None.
- Expected HTTP: **401**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC027` immediately before Send.
- Prerequisite/result interpretation: Generated nonexistent synthetic identifier. No owner lookup or account-targeted mail.
- Screenshot: Optional TC027_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "identifier": "{{unknown_username}}",
  "password": "{{wrong_password}}"
}
```

#### TC028 — Require enrolled authenticator challenge

- Method and endpoint: `POST {{base_url}}/api/login`
- Authentication: None.
- Expected HTTP: **202**. Expected response shape: **totpChallenge**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC028` immediately before Send.
- Email gate: verified Mailpit mode is required. No real external SMTP test is authorized by this collection.
- Prerequisite/result interpretation: Run only after enrolling TOTP on this synthetic account. Otherwise Not Applicable, not Passed.
- Screenshot: Optional TC028_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "identifier": "{{test_username}}",
  "password": "{{test_password}}"
}
```

### 03 - Vault Management

#### TC030 — List vault categories

- Method and endpoint: `GET {{base_url}}/api/account/vault/categories`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **array**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC030_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC031 — Create custom test category

- Method and endpoint: `POST {{base_url}}/api/account/vault/categories`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **category**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC031` immediately before Send.
- Screenshot: Optional TC031_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "name": "Postman {{run_id}}"
}
```

#### TC032 — Vault overview and health widgets

- Method and endpoint: `GET {{base_url}}/api/account/vault/overview`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **overview**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC032_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC033 — Create synthetic vault credential

- Method and endpoint: `POST {{base_url}}/api/account/vault/credentials`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **credentialMetadata**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC033` immediately before Send. Required runtime variables: `category_id`.
- Screenshot: TC033_create_synthetic_vault_credential.png. Capture only Test Results and safe status/path information.

```json
{
  "title": "Postman fixture {{run_id}}",
  "url": "https://example.test",
  "username": "synthetic-user",
  "password": "{{vault_password}}",
  "categoryId": "{{category_id}}",
  "notes": "Synthetic Postman fixture only.",
  "favorite": false
}
```

#### TC034 — List credentials without passwords

- Method and endpoint: `GET {{base_url}}/api/account/vault/credentials?search=Postman&sort=NEWEST&favorites=false`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **array**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: TC034_list_credentials_without_passwords.png. Capture only Test Results and safe status/path information.

No request body.

#### TC035 — Read selected owned credential

- Method and endpoint: `GET {{base_url}}/api/account/vault/credentials/{{credential_id}}`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **credential**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC035` immediately before Send. Required runtime variables: `credential_id`.
- Screenshot: Optional TC035_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC036 — Update synthetic vault credential

- Method and endpoint: `PUT {{base_url}}/api/account/vault/credentials/{{credential_id}}`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **credentialMetadata**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC036` immediately before Send. Required runtime variables: `credential_id`, `category_id`.
- Screenshot: Optional TC036_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "title": "Postman updated {{run_id}}",
  "url": "https://example.test",
  "username": "synthetic-user",
  "password": "{{vault_password}}",
  "categoryId": "{{category_id}}",
  "notes": "Synthetic Postman fixture only.",
  "favorite": false
}
```

#### TC037 — Favorite synthetic credential

- Method and endpoint: `PATCH {{base_url}}/api/account/vault/credentials/{{credential_id}}/favorite`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **204**. Expected response shape: **empty**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC037` immediately before Send. Required runtime variables: `credential_id`.
- Screenshot: Optional TC037_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "favorite": true
}
```

#### TC038 — Assess password health

- Method and endpoint: `POST {{base_url}}/api/account/vault/password-health`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **assessment**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC038` immediately before Send. Required runtime variables: `credential_id`.
- Screenshot: TC038_assess_password_health.png. Capture only Test Results and safe status/path information.

```json
{
  "password": "{{vault_password}}",
  "excludedId": "{{credential_id}}"
}
```

#### TC039 — Optional public breach lookup

- Method and endpoint: `POST {{base_url}}/api/account/vault/check-breach`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **breach**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC039` immediately before Send.
- Prerequisite/result interpretation: Contacts HIBP using a SHA-1 prefix. 200 may report provider unavailability and is not evidence of a completed breach check.
- Screenshot: Optional TC039_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "password": "{{vault_password}}",
  "excludedId": null
}
```

#### TC040 — Recipient cannot read owner's private vault item

- Method and endpoint: `GET {{base_url}}/api/account/vault/credentials/{{credential_id}}`
- Authentication: Bearer {{recipient_token}} — verified synthetic recipient.
- Expected HTTP: **404**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required. Required runtime variables: `credential_id`.
- Screenshot: TC040_recipient_cannot_read_owner_s_private_vault_item.png. Capture only Test Results and safe status/path information.

No request body.

#### TC041 — Reject invalid vault body

- Method and endpoint: `POST {{base_url}}/api/account/vault/credentials`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **400**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC041` immediately before Send.
- Screenshot: Optional TC041_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "title": "",
  "password": "",
  "categoryId": ""
}
```

#### TC042 — Delete synthetic credential — cleanup last

- Method and endpoint: `DELETE {{base_url}}/api/account/vault/credentials/{{credential_id}}`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **204**. Expected response shape: **empty**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC042` immediately before Send. Required runtime variables: `credential_id`.
- Prerequisite/result interpretation: Soft-deletes the fixture and invalidates its shares. Execute only after sharing tests.
- Screenshot: Optional TC042_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC043 — Deleted credential is unavailable

- Method and endpoint: `GET {{base_url}}/api/account/vault/credentials/{{credential_id}}`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **404**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required. Required runtime variables: `credential_id`.
- Screenshot: Optional TC043_test_results.png. Capture only Test Results and safe status/path information.

No request body.

### 04 - Internal Credential Sharing

#### TC050 — Look up exact synthetic recipient

- Method and endpoint: `GET {{base_url}}/api/account/shares/recipients?search={{test_recipient}}`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **array**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required. Required runtime variables: `test_recipient`.
- Screenshot: Optional TC050_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC051 — Share fixture with registered recipient

- Method and endpoint: `POST {{base_url}}/api/account/shares`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **internalShare**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC051` immediately before Send. Required runtime variables: `credential_id`, `recipient_id`.
- Screenshot: TC051_share_fixture_with_registered_recipient.png. Capture only Test Results and safe status/path information.

```json
{
  "credentialId": "{{credential_id}}",
  "recipientId": "{{recipient_id}}",
  "expiresAt": "{{future_expiry}}"
}
```

#### TC052 — Shared by Me — internal

- Method and endpoint: `GET {{base_url}}/api/account/shares/sent`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **array**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC052_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC053 — Shared with Me — recipient

- Method and endpoint: `GET {{base_url}}/api/account/shares/received`
- Authentication: Bearer {{recipient_token}} — verified synthetic recipient.
- Expected HTTP: **200**. Expected response shape: **array**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: TC053_shared_with_me_recipient.png. Capture only Test Results and safe status/path information.

No request body.

#### TC054 — Recipient reads authorized shared item

- Method and endpoint: `GET {{base_url}}/api/account/shares/{{share_id}}/credential`
- Authentication: Bearer {{recipient_token}} — verified synthetic recipient.
- Expected HTTP: **200**. Expected response shape: **credential**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC054` immediately before Send. Required runtime variables: `share_id`.
- Screenshot: Optional TC054_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC055 — Sharing history

- Method and endpoint: `GET {{base_url}}/api/account/shares/history`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **array**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: TC055_sharing_history.png. Capture only Test Results and safe status/path information.

No request body.

#### TC056 — Update internal share expiry

- Method and endpoint: `PATCH {{base_url}}/api/account/shares/{{share_id}}/expiry`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **204**. Expected response shape: **empty**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC056` immediately before Send. Required runtime variables: `share_id`.
- Screenshot: Optional TC056_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "expiresAt": "{{future_expiry}}"
}
```

#### TC057 — Revoke internal fixture share

- Method and endpoint: `DELETE {{base_url}}/api/account/shares/{{share_id}}`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **204**. Expected response shape: **empty**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC057` immediately before Send. Required runtime variables: `share_id`.
- Screenshot: Optional TC057_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC058 — Revoked internal share cannot be read

- Method and endpoint: `GET {{base_url}}/api/account/shares/{{share_id}}/credential`
- Authentication: Bearer {{recipient_token}} — verified synthetic recipient.
- Expected HTTP: **404**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required. Required runtime variables: `share_id`.
- Screenshot: TC058_revoked_internal_share_cannot_be_read.png. Capture only Test Results and safe status/path information.

No request body.

#### TC059 — Reject nonexistent registered recipient

- Method and endpoint: `POST {{base_url}}/api/account/shares`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **400**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC059` immediately before Send. Required runtime variables: `credential_id`.
- Screenshot: Optional TC059_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "credentialId": "{{credential_id}}",
  "recipientId": "{{unknown_uuid}}",
  "expiresAt": null
}
```

#### TC060 — Reject unauthenticated internal share

- Method and endpoint: `POST {{base_url}}/api/account/shares`
- Authentication: None.
- Expected HTTP: **401**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC060` immediately before Send.
- Screenshot: Optional TC060_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "credentialId": "{{unknown_uuid}}",
  "recipientId": "{{unknown_uuid}}",
  "expiresAt": null
}
```

#### TC061 — Recipient cannot share owner's item

- Method and endpoint: `POST {{base_url}}/api/account/shares`
- Authentication: Bearer {{recipient_token}} — verified synthetic recipient.
- Expected HTTP: **404**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC061` immediately before Send. Required runtime variables: `credential_id`, `user_id`.
- Screenshot: Optional TC061_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "credentialId": "{{credential_id}}",
  "recipientId": "{{user_id}}",
  "expiresAt": null
}
```

### 05 - External Credential Sharing

#### TC070 — Send one-time invitation — Mailpit only

- Method and endpoint: `POST {{base_url}}/api/account/shares/external`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **submitted**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC070` immediately before Send. Required runtime variables: `credential_id`.
- Email gate: verified Mailpit mode is required. No real external SMTP test is authorized by this collection.
- Screenshot: TC070_send_one_time_invitation_mailpit_only.png. Capture only Test Results and safe status/path information.

```json
{
  "credentialId": "{{credential_id}}",
  "email": "{{external_recipient}}",
  "minutes": 15,
  "oneTime": true,
  "message": "Synthetic Postman sharing demonstration."
}
```

#### TC071 — List and capture one-time share ID

- Method and endpoint: `GET {{base_url}}/api/account/shares/external`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **array**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: TC071_list_and_capture_one_time_share_id.png. Capture only Test Results and safe status/path information.

No request body.

#### TC072 — Inspect invitation without consuming access

- Method and endpoint: `POST {{base_url}}/api/external-shares/inspect`
- Authentication: None.
- Expected HTTP: **200**. Expected response shape: **link**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC072` immediately before Send. Required runtime variables: `external_share_token`.
- Prerequisite/result interpretation: Copy only the fragment after # from the matching Mailpit invitation into the local environment. Repeat inspect to verify no consumption.
- Screenshot: TC072_inspect_invitation_without_consuming_access.png. Capture only Test Results and safe status/path information.

```json
{
  "token": "{{external_share_token}}"
}
```

#### TC073 — Send recipient email code — Mailpit only

- Method and endpoint: `POST {{base_url}}/api/external-shares/code`
- Authentication: None.
- Expected HTTP: **200**. Expected response shape: **submitted**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC073` immediately before Send. Required runtime variables: `external_share_token`.
- Email gate: verified Mailpit mode is required. No real external SMTP test is authorized by this collection.
- Prerequisite/result interpretation: Backend sends to the stored recipient. No email field is accepted by this DTO. Cooldown is 60 seconds.
- Screenshot: Optional TC073_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "token": "{{external_share_token}}"
}
```

#### TC074 — Reject known-incorrect recipient code once

- Method and endpoint: `POST {{base_url}}/api/external-shares/verify`
- Authentication: None.
- Expected HTTP: **401**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC074` immediately before Send. Required runtime variables: `external_share_token`, `wrong_otp`, `otp`.
- Prerequisite/result interpretation: Enter the received code in otp, choose a different six-digit wrong_otp, and run once before successful verification.
- Screenshot: Optional TC074_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "token": "{{external_share_token}}",
  "code": "{{wrong_otp}}"
}
```

#### TC075 — Verify recipient mailbox

- Method and endpoint: `POST {{base_url}}/api/external-shares/verify`
- Authentication: None.
- Expected HTTP: **200**. Expected response shape: **grant**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC075` immediately before Send. Required runtime variables: `external_share_token`, `otp`.
- Prerequisite/result interpretation: Code expires after five minutes and is invalidated after success. Grant is captured privately for one retrieval.
- Screenshot: TC075_verify_recipient_mailbox.png. Capture only Test Results and safe status/path information.

```json
{
  "token": "{{external_share_token}}",
  "code": "{{otp}}"
}
```

#### TC076 — Explicitly retrieve one-time credential

- Method and endpoint: `POST {{base_url}}/api/external-shares/retrieve`
- Authentication: None.
- Expected HTTP: **200**. Expected response shape: **externalCredential**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC076` immediately before Send. Required runtime variables: `external_share_token`, `external_grant`.
- Screenshot: Optional TC076_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "token": "{{external_share_token}}",
  "grant": "{{external_grant}}"
}
```

#### TC077 — Reject repeated one-time retrieval

- Method and endpoint: `POST {{base_url}}/api/external-shares/retrieve`
- Authentication: None.
- Expected HTTP: **410**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC077` immediately before Send. Required runtime variables: `external_share_token`, `external_grant`.
- Screenshot: TC077_reject_repeated_one_time_retrieval.png. Capture only Test Results and safe status/path information.

```json
{
  "token": "{{external_share_token}}",
  "grant": "{{external_grant}}"
}
```

#### TC078 — Reject manipulated valid-format token

- Method and endpoint: `POST {{base_url}}/api/external-shares/inspect`
- Authentication: None.
- Expected HTTP: **404**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC078` immediately before Send.
- Screenshot: Optional TC078_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "token": "{{invalid_external_token}}"
}
```

#### TC079 — Send separate revocation invitation

- Method and endpoint: `POST {{base_url}}/api/account/shares/external`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **submitted**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC079` immediately before Send. Required runtime variables: `credential_id`.
- Email gate: verified Mailpit mode is required. No real external SMTP test is authorized by this collection.
- Screenshot: Optional TC079_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "credentialId": "{{credential_id}}",
  "email": "{{external_revoke_recipient}}",
  "minutes": 15,
  "oneTime": false,
  "message": "Synthetic Postman sharing demonstration."
}
```

#### TC080 — Capture revocable external share ID

- Method and endpoint: `GET {{base_url}}/api/account/shares/external`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **array**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC080_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC081 — Revoke external fixture

- Method and endpoint: `DELETE {{base_url}}/api/account/shares/external/{{external_revoke_id}}`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **204**. Expected response shape: **empty**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC081` immediately before Send. Required runtime variables: `external_revoke_id`.
- Screenshot: Optional TC081_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC082 — Reject revoked invitation

- Method and endpoint: `POST {{base_url}}/api/external-shares/inspect`
- Authentication: None.
- Expected HTTP: **410**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC082` immediately before Send. Required runtime variables: `external_revoked_token`.
- Prerequisite/result interpretation: Use the fragment from the separate revocation invitation, not the consumed one-time invitation.
- Screenshot: TC082_reject_revoked_invitation.png. Capture only Test Results and safe status/path information.

```json
{
  "token": "{{external_revoked_token}}"
}
```

#### TC083 — Send separate 15-minute expiry invitation

- Method and endpoint: `POST {{base_url}}/api/account/shares/external`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **submitted**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC083` immediately before Send. Required runtime variables: `credential_id`.
- Email gate: verified Mailpit mode is required. No real external SMTP test is authorized by this collection.
- Screenshot: Optional TC083_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "credentialId": "{{credential_id}}",
  "email": "{{external_expiry_recipient}}",
  "minutes": 15,
  "oneTime": false,
  "message": "Synthetic Postman sharing demonstration."
}
```

#### TC084 — Capture expiry time and fixture ID

- Method and endpoint: `GET {{base_url}}/api/account/shares/external`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **array**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC084_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC085 — Reject naturally expired invitation

- Method and endpoint: `POST {{base_url}}/api/external-shares/inspect`
- Authentication: None.
- Expected HTTP: **410**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC085` immediately before Send. Required runtime variables: `external_expired_token`, `external_expires_at`.
- Prerequisite/result interpretation: Wait until external_expires_at. Minimum supported duration is 15 minutes. No SQL expiry edit or short-duration API exists.
- Screenshot: Optional TC085_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "token": "{{external_expired_token}}"
}
```

#### TC086 — Reject replayed OTP before retrieval

- Method and endpoint: `POST {{base_url}}/api/external-shares/verify`
- Authentication: None.
- Expected HTTP: **401**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC086` immediately before Send. Required runtime variables: `external_share_token`, `otp`.
- Prerequisite/result interpretation: Run immediately after TC075 and BEFORE TC076. After retrieval the same share returns 410 instead.
- Screenshot: Optional TC086_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "token": "{{external_share_token}}",
  "code": "{{otp}}"
}
```

#### TC087 — Reject wrong retrieval grant

- Method and endpoint: `POST {{base_url}}/api/external-shares/retrieve`
- Authentication: None.
- Expected HTTP: **401**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC087` immediately before Send. Required runtime variables: `external_share_token`.
- Prerequisite/result interpretation: Run before TC076 while the share remains available.
- Screenshot: Optional TC087_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "token": "{{external_share_token}}",
  "grant": "{{invalid_external_token}}"
}
```

#### TC088 — Recipient code resend cooldown

- Method and endpoint: `POST {{base_url}}/api/external-shares/code`
- Authentication: None.
- Expected HTTP: **429**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC088` immediately before Send. Required runtime variables: `external_share_token`.
- Email gate: verified Mailpit mode is required. No real external SMTP test is authorized by this collection.
- Prerequisite/result interpretation: Run within 60 seconds of TC073. Do not retry in a loop.
- Screenshot: Optional TC088_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "token": "{{external_share_token}}"
}
```

#### TC089 — Reject invalid external recipient email

- Method and endpoint: `POST {{base_url}}/api/account/shares/external`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **400**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC089` immediately before Send. Required runtime variables: `credential_id`.
- Screenshot: Optional TC089_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "credentialId": "{{credential_id}}",
  "email": "not-an-email",
  "minutes": 15,
  "oneTime": true,
  "message": "Synthetic Postman sharing demonstration."
}
```

#### TC090 — Reject unsupported expiry duration

- Method and endpoint: `POST {{base_url}}/api/account/shares/external`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **400**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC090` immediately before Send. Required runtime variables: `credential_id`.
- Screenshot: Optional TC090_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "credentialId": "{{credential_id}}",
  "email": "{{external_recipient}}",
  "minutes": 1,
  "oneTime": true,
  "message": "Synthetic Postman sharing demonstration."
}
```

### 06 - Account Security and Notifications

#### TC100 — Current account profile

- Method and endpoint: `GET {{base_url}}/api/account/me`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **identity**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC100_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC101 — Sessions devices and account security

- Method and endpoint: `GET {{base_url}}/api/account/security`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **security**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC101_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC102 — MFA configuration status

- Method and endpoint: `GET {{base_url}}/api/account/mfa`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **mfaStatus**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC102_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC103 — Begin synthetic authenticator enrollment

- Method and endpoint: `POST {{base_url}}/api/account/mfa/totp/setup`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **totpSetup**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC103` immediately before Send.
- Sensitive gate: set allow_sensitive_account_changes=true only for the verified synthetic owner, and reset it afterward.
- Prerequisite/result interpretation: Synthetic owner only. Response contains a seed/otpauth URI. Enroll privately, do not capture or export the seed, and never screenshot this response.
- Screenshot: Optional TC103_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "currentPassword": "{{test_password}}"
}
```

#### TC104 — Confirm synthetic authenticator enrollment

- Method and endpoint: `POST {{base_url}}/api/account/mfa/totp/confirm`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **204**. Expected response shape: **empty**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC104` immediately before Send. Required runtime variables: `totp_code`.
- Sensitive gate: set allow_sensitive_account_changes=true only for the verified synthetic owner, and reset it afterward.
- Screenshot: Optional TC104_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "code": "{{totp_code}}"
}
```

#### TC105 — Disable authenticator on synthetic fixture only

- Method and endpoint: `DELETE {{base_url}}/api/account/mfa/totp`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **204**. Expected response shape: **empty**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC105` immediately before Send. Required runtime variables: `totp_code`.
- Sensitive gate: set allow_sensitive_account_changes=true only for the verified synthetic owner, and reset it afterward.
- Prerequisite/result interpretation: Optional supported API. Changes only the verified synthetic owner. Never use with either existing demo account.
- Screenshot: Optional TC105_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "currentPassword": "{{test_password}}",
  "code": "{{totp_code}}"
}
```

#### TC106 — Change synthetic password — revokes its sessions

- Method and endpoint: `POST {{base_url}}/api/account/security/password`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **204**. Expected response shape: **empty**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC106` immediately before Send.
- Sensitive gate: set allow_sensitive_account_changes=true only for the verified synthetic owner, and reset it afterward.
- Prerequisite/result interpretation: Execute after all sharing checks. If TOTP is enabled, enter a fresh unused totp_code. If disabled leave code blank. New password must satisfy the backend strength heuristic and differ from old password.
- Screenshot: Optional TC106_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "currentPassword": "{{test_password}}",
  "newPassword": "{{new_test_password}}",
  "code": "{{totp_code}}"
}
```

#### TC107 — Revoke an old synthetic session

- Method and endpoint: `DELETE {{base_url}}/api/account/security/sessions/{{session_id}}`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **204**. Expected response shape: **empty**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC107` immediately before Send. Required runtime variables: `session_id`.
- Sensitive gate: set allow_sensitive_account_changes=true only for the verified synthetic owner, and reset it afterward.
- Prerequisite/result interpretation: TC101 captures only a non-current session of the synthetic owner. If none exists, sign in twice first. Do not substitute real account session IDs.
- Screenshot: Optional TC107_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC108 — Revoke synthetic device sessions

- Method and endpoint: `DELETE {{base_url}}/api/account/security/devices/{{device_id_to_revoke}}`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **204**. Expected response shape: **empty**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC108` immediately before Send. Required runtime variables: `device_id_to_revoke`.
- Sensitive gate: set allow_sensitive_account_changes=true only for the verified synthetic owner, and reset it afterward.
- Prerequisite/result interpretation: May revoke the current test session. Run near the end and sign in again afterward.
- Screenshot: Optional TC108_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC109 — List own notifications

- Method and endpoint: `GET {{base_url}}/api/account/notifications?page=0&size=20&unread=false`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **notifications**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC109_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC110 — Unread notification count

- Method and endpoint: `GET {{base_url}}/api/account/notifications/unread`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **200**. Expected response shape: **unread**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC110_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC111 — Mark one synthetic notification read

- Method and endpoint: `PUT {{base_url}}/api/account/notifications/{{notification_id}}/read`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **204**. Expected response shape: **empty**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC111` immediately before Send. Required runtime variables: `notification_id`.
- Screenshot: Optional TC111_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC112 — Mark synthetic owner's notifications read

- Method and endpoint: `PUT {{base_url}}/api/account/notifications/read`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **204**. Expected response shape: **empty**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC112` immediately before Send.
- Screenshot: Optional TC112_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC113 — Recipient security details for fixture IDs

- Method and endpoint: `GET {{base_url}}/api/account/security`
- Authentication: Bearer {{recipient_token}} — verified synthetic recipient.
- Expected HTTP: **200**. Expected response shape: **security**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC113_test_results.png. Capture only Test Results and safe status/path information.

No request body.

### 07 - Admin Dashboard

#### TC120 — Admin identity

- Method and endpoint: `GET {{base_url}}/api/admin/me`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **adminIdentity**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC120_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC121 — Admin dashboard overview

- Method and endpoint: `GET {{base_url}}/api/admin/dashboard`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **dashboard**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: TC121_admin_dashboard_overview.png. Capture only Test Results and safe status/path information.

No request body.

#### TC122 — Users and roles — search test account

- Method and endpoint: `GET {{base_url}}/api/admin/users?search={{test_username}}&risk=ALL&page=0&size=10`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **page**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC122_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC123 — Admin user statistics

- Method and endpoint: `GET {{base_url}}/api/admin/users/stats`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **userStats**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC123_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC124 — Synthetic recipient account details

- Method and endpoint: `GET {{base_url}}/api/admin/users/{{recipient_id}}`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **userDetails**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required. Required runtime variables: `recipient_id`.
- Screenshot: Optional TC124_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC125 — Threat Analytics — test account events

- Method and endpoint: `GET {{base_url}}/api/admin/analytics?search={{test_username}}&severity=ALL&status=ALL&page=0&size=10&sort=NEWEST`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **analytics**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: TC125_threat_analytics_test_account_events.png. Capture only Test Results and safe status/path information.

No request body.

#### TC126 — Security alert details

- Method and endpoint: `GET {{base_url}}/api/admin/analytics/events/{{event_id}}`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **eventDetails**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required. Required runtime variables: `event_id`.
- Screenshot: Optional TC126_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC127 — Audit Trail — test account

- Method and endpoint: `GET {{base_url}}/api/admin/activities?search={{test_username}}&page=0&size=20`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **page**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC127_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC128 — All sharing metadata

- Method and endpoint: `GET {{base_url}}/api/admin/shares?type=ALL&status=ALL&page=0&size=10`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **page**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC128_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC129 — Internal sharing filter

- Method and endpoint: `GET {{base_url}}/api/admin/shares?type=INTERNAL&status=ALL&page=0&size=10`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **page**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC129_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC130 — External sharing filter

- Method and endpoint: `GET {{base_url}}/api/admin/shares?type=EXTERNAL&status=ALL&page=0&size=10`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **page**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: TC130_external_sharing_filter.png. Capture only Test Results and safe status/path information.

No request body.

#### TC131 — Active shares

- Method and endpoint: `GET {{base_url}}/api/admin/shares?type=ALL&status=ACTIVE&page=0&size=10`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **page**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC131_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC132 — Expired shares

- Method and endpoint: `GET {{base_url}}/api/admin/shares?type=ALL&status=EXPIRED&page=0&size=10`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **page**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC132_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC133 — Revoked shares

- Method and endpoint: `GET {{base_url}}/api/admin/shares?type=ALL&status=REVOKED&page=0&size=10`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **page**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC133_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC134 — Consumed external shares

- Method and endpoint: `GET {{base_url}}/api/admin/shares?type=EXTERNAL&status=CONSUMED&page=0&size=10`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **page**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC134_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC135 — Vault metadata monitoring

- Method and endpoint: `GET {{base_url}}/api/admin/vaults/overview`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **vaultMonitoring**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC135_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC136 — System Health settings overview

- Method and endpoint: `GET {{base_url}}/api/admin/settings`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **system**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC136_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC137 — Optional keep synthetic recipient active

- Method and endpoint: `PATCH {{base_url}}/api/admin/users/{{recipient_id}}/status`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **204**. Expected response shape: **empty**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC137` immediately before Send. Required runtime variables: `recipient_id`.
- Admin mutation gate: set allow_admin_changes=true only for the captured synthetic target. These optional cases are outside the recommended read-only Admin screenshot sequence.
- Prerequisite/result interpretation: Optional mutation on verified synthetic recipient only. Never substitute real demo account IDs.
- Screenshot: Optional TC137_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "active": true
}
```

#### TC138 — Optional set synthetic recipient regular role

- Method and endpoint: `PATCH {{base_url}}/api/admin/users/{{recipient_id}}/role`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **200**. Expected response shape: **userSummary**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC138` immediately before Send. Required runtime variables: `recipient_id`, `admin_password`.
- Admin mutation gate: set allow_admin_changes=true only for the captured synthetic target. These optional cases are outside the recommended read-only Admin screenshot sequence.
- Prerequisite/result interpretation: Does not create an Admin. Role API requires the acting Admin's current password. Keep disabled unless explicitly testing on the verified synthetic recipient.
- Screenshot: Optional TC138_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "role": "ROLE_USER",
  "currentPassword": "{{admin_password}}"
}
```

#### TC139 — Optional revoke synthetic recipient device

- Method and endpoint: `POST {{base_url}}/api/admin/users/{{recipient_id}}/devices/{{recipient_device_id}}/revoke`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **204**. Expected response shape: **empty**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC139` immediately before Send. Required runtime variables: `recipient_id`, `recipient_device_id`.
- Admin mutation gate: set allow_admin_changes=true only for the captured synthetic target. These optional cases are outside the recommended read-only Admin screenshot sequence.
- Screenshot: Optional TC139_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC140 — Optional investigate synthetic event

- Method and endpoint: `PATCH {{base_url}}/api/admin/analytics/events/{{event_id}}/status`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **204**. Expected response shape: **empty**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC140` immediately before Send. Required runtime variables: `event_id`.
- Admin mutation gate: set allow_admin_changes=true only for the captured synthetic target. These optional cases are outside the recommended read-only Admin screenshot sequence.
- Screenshot: Optional TC140_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "status": "INVESTIGATING",
  "notes": "Synthetic Postman investigation fixture."
}
```

#### TC141 — Optional resolve synthetic event

- Method and endpoint: `PATCH {{base_url}}/api/admin/analytics/events/{{event_id}}/resolve`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **204**. Expected response shape: **empty**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC141` immediately before Send. Required runtime variables: `event_id`.
- Admin mutation gate: set allow_admin_changes=true only for the captured synthetic target. These optional cases are outside the recommended read-only Admin screenshot sequence.
- Screenshot: Optional TC141_test_results.png. Capture only Test Results and safe status/path information.

No request body.

### 08 - Security and Authorization Testing

#### TC150 — Reject missing account authentication

- Method and endpoint: `GET {{base_url}}/api/account/me`
- Authentication: None.
- Expected HTTP: **401**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC150_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC151 — Reject invalid account Bearer token

- Method and endpoint: `GET {{base_url}}/api/account/me`
- Authentication: Deliberately invalid Bearer token.
- Expected HTTP: **401**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC151_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC152 — Reject missing Admin authentication

- Method and endpoint: `GET {{base_url}}/api/admin/dashboard`
- Authentication: None.
- Expected HTTP: **401**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC152_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC153 — Reject regular user from Admin Sharing Activity

- Method and endpoint: `GET {{base_url}}/api/admin/shares?status=ALL&type=ALL&page=0&size=10`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **401**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Prerequisite/result interpretation: Current Admin filter yields 401 because a non-Admin receives no Admin authentication context. A future intentional change to 403 requires updating this assertion.
- Screenshot: TC153_reject_regular_user_from_admin_sharing_activity.png. Capture only Test Results and safe status/path information.

No request body.

#### TC154 — Reject invalid Admin share pagination

- Method and endpoint: `GET {{base_url}}/api/admin/shares?page=-1&size=101&status=ALL`
- Authentication: Bearer {{admin_token}} — active ROLE_ADMIN session.
- Expected HTTP: **400**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC154_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC155 — Reject retrieval body without grant

- Method and endpoint: `POST {{base_url}}/api/external-shares/retrieve`
- Authentication: None.
- Expected HTTP: **400**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC155` immediately before Send.
- Screenshot: Optional TC155_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "token": "{{invalid_external_token}}"
}
```

#### TC156 — Unverified recipient cannot retrieve

- Method and endpoint: `POST {{base_url}}/api/external-shares/retrieve`
- Authentication: None.
- Expected HTTP: **401**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC156` immediately before Send. Required runtime variables: `external_revoked_token`.
- Prerequisite/result interpretation: Run after TC079/TC080 and BEFORE TC081 using that still-active invitation token. After revocation expect 410 instead.
- Screenshot: Optional TC156_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "token": "{{external_revoked_token}}",
  "grant": "{{invalid_external_token}}"
}
```

#### TC157 — Reject malformed external token

- Method and endpoint: `POST {{base_url}}/api/external-shares/inspect`
- Authentication: None.
- Expected HTTP: **400**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC157` immediately before Send.
- Screenshot: Optional TC157_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "token": "not-a-valid-token"
}
```

#### TC158 — Reject invalid Admin Bearer token

- Method and endpoint: `GET {{base_url}}/api/admin/shares`
- Authentication: Deliberately invalid Bearer token.
- Expected HTTP: **401**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: read-only request; no arming required.
- Screenshot: Optional TC158_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC159 — Reject unauthenticated external create

- Method and endpoint: `POST {{base_url}}/api/account/shares/external`
- Authentication: None.
- Expected HTTP: **401**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC159` immediately before Send.
- Screenshot: Optional TC159_test_results.png. Capture only Test Results and safe status/path information.

```json
{
  "credentialId": "{{unknown_uuid}}",
  "email": "recipient@example.test",
  "minutes": 15,
  "oneTime": true,
  "message": "Synthetic unauthorized test."
}
```

#### TC160 — Recipient cannot revoke owner's session

- Method and endpoint: `DELETE {{base_url}}/api/account/security/sessions/{{owner_current_session_id}}`
- Authentication: Bearer {{recipient_token}} — verified synthetic recipient.
- Expected HTTP: **404**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC160` immediately before Send. Required runtime variables: `owner_current_session_id`.
- Screenshot: Optional TC160_test_results.png. Capture only Test Results and safe status/path information.

No request body.

#### TC161 — Reject missing TOTP setup password

- Method and endpoint: `POST {{base_url}}/api/account/mfa/totp/setup`
- Authentication: Bearer {{user_token}} — verified synthetic owner.
- Expected HTTP: **400**. Expected response shape: **error**. Structure assertions are listed in the request's Tests script.
- Execution: manually set `armed_request=TC161` immediately before Send.
- Screenshot: Optional TC161_test_results.png. Capture only Test Results and safe status/path information.

```json
{}
```
