# 📋 SecureVault — Project Work & Progress Tracker

> **Infosys Springboard Java Project — Team 3**  
> **Project Name:** SecureVault: Integrated Password Vault & Secure Credential Sharing Management System  
> **Status:** Active Development &bull; Milestones 1, 2, and 5 Completed & Consolidated  
> **Last Updated:** October 17, 2026

---

## 📌 Executive Milestone Roadmap

| Milestone | Module / Objective | Status | Completion Date | Key Deliverables |
| :--- | :--- | :---: | :---: | :--- |
| **Milestone 1** | Project Initialization, Database Architecture & Container Setup | ✅ **Completed** | Oct 10, 2026 | Normalized 20-table PostgreSQL schema, Redis cache, pgAdmin, Docker Compose. |
| **Milestone 2** | User Authentication, Access Control & Security Hardening | ✅ **Completed** | Oct 15, 2026 | BCrypt hashing, per-user salt, JJWT issuance, account lockout (5 failed attempts), brute-force rate limiter, timing attack mitigation. |
| **Milestone 3** | Encryption Engine (AES-256-GCM + PBKDF2) & Vault CRUD APIs | ⏳ **Next Up** | In Progress | Key derivation service, zero-knowledge credential vault CRUD, folder and category management. |
| **Milestone 4** | Secure Sharing Service, Permissions & Audit Logging | 📅 **Scheduled** | Planned | Time-bound sharing, permission tiers (READ/WRITE/ADMIN), audit logs, anomaly detection, security events. |
| **Milestone 5** | Consolidated Frontend Application & Interactive Dashboards | ✅ **Completed** | Oct 17, 2026 | Modern React 18 + Vite UI, unified Navbar, Login, Register (with real-time password strength meter), Vault Dashboard preview & Password Generator. |

---

## 🏗️ Repository Architecture & Consolidation Log

### 1. Frontend Consolidation (`frontend/`)
* **Previous State:** Fragmented across root-level Create React App (`src/`, `public/`, `package.json` for Login) and a separate Vite project in `registration/`.
* **Consolidated State:** Centralized into [`frontend/`](file:///c:/Users/hiima/Desktop/Infosys%20Springboard%20Project/frontend) using **React 18 + Vite**:
  * Unified navigation via [`Navbar.jsx`](file:///c:/Users/hiima/Desktop/Infosys%20Springboard%20Project/frontend/src/components/Navbar.jsx)
  * Seamless state routing between [`Login.jsx`](file:///c:/Users/hiima/Desktop/Infosys%20Springboard%20Project/frontend/src/components/Login.jsx), [`Register.jsx`](file:///c:/Users/hiima/Desktop/Infosys%20Springboard%20Project/frontend/src/components/Register.jsx), and [`VaultDashboard.jsx`](file:///c:/Users/hiima/Desktop/Infosys%20Springboard%20Project/frontend/src/components/VaultDashboard.jsx)
  * Dynamic password strength scoring & live password generator
  * Vite proxy forwarding `/api/*` requests to port `8080`

### 2. Backend Consolidation (`backend/`)
* **Previous State:** Two independent Spring Boot microservices (`login-service` on port 8082 and `registration-service` on port 8081) with duplicate filters, validators, and properties.
* **Consolidated State:** Centralized into [`backend/`](file:///c:/Users/hiima/Desktop/Infosys%20Springboard%20Project/backend) running on port `8080`:
  * Single Spring Boot 4 / Java 17 service with unified controller [`AuthController.java`](file:///c:/Users/hiima/Desktop/Infosys%20Springboard%20Project/backend/src/main/java/com/securevault/auth/AuthController.java)
  * Combined security filters in [`common/`](file:///c:/Users/hiima/Desktop/Infosys%20Springboard%20Project/backend/src/main/java/com/securevault/common) (`AuthRateLimitFilter`, `GlobalExceptionHandler`, `BcryptPasswordLength`)
  * Container orchestration simplified to one `securevault-backend` container in [`docker-compose.yml`](file:///c:/Users/hiima/Desktop/Infosys%20Springboard%20Project/docker-compose.yml)

### 3. Documentation Consolidation (`docs/`)
* Organized project reference assets into [`docs/`](file:///c:/Users/hiima/Desktop/Infosys%20Springboard%20Project/docs):
  * [`docs/schema.md`](file:///c:/Users/hiima/Desktop/Infosys%20Springboard%20Project/docs/schema.md): 20-table ERD and schema specification
  * [`docs/Java_Integrated Password Vault and Secure Credential Sharing Management System.pdf`](file:///c:/Users/hiima/Desktop/Infosys%20Springboard%20Project/docs/Java_Integrated%20Password%20Vault%20and%20Secure%20Credential%20Sharing%20Management%20System.pdf): Official project syllabus & specs
  * [`docs/work_tracker.md`](file:///c:/Users/hiima/Desktop/Infosys%20Springboard%20Project/docs/work_tracker.md): This progress and activity tracking document

---

## 🔍 Feature Checklist & Implementation Status

### Module 1: Database & Infrastructure
- [x] PostgreSQL 16 schema with `pgcrypto` extension for UUIDs (`gen_random_uuid()`)
- [x] Relational integrity with cascading foreign keys across 20 tables
- [x] Initial seed data for system roles (`ROLE_USER`, `ROLE_TEAM_MEMBER`, `ROLE_ADMIN`)
- [x] Initial seed data for 7 credential categories
- [x] Redis 7 container for future session caching and distributed rate limiting
- [x] pgAdmin 4 container for database web administration
- [x] Performance indexes on email, username, tokens, and foreign keys

### Module 2: Authentication & Security
- [x] User registration with BCrypt hashing and unique per-user salt generation
- [x] Opaque registration acknowledgement (202 Accepted) preventing user enumeration
- [x] Login authentication supporting username or email identifier
- [x] Dummy BCrypt check for nonexistent accounts to mitigate timing attacks
- [x] 5-consecutive failed attempt account lockout for 15 minutes
- [x] JJWT HMAC-SHA signing with 15-minute token expiry
- [x] Session fingerprinting (SHA-256 hash of token stored in `sessions` table)
- [x] In-memory rate limiting filter (30/min for login, 15/min for register)
- [x] Request payload size bounding (8 KiB max) and slow-body timeout protection
- [x] Container security hardening (read-only rootfs, dropped capabilities, non-root user `10001`)

### Module 3: Encryption Engine & Vault (Upcoming)
- [ ] PBKDF2 key derivation using master password + user salt
- [ ] AES-256-GCM symmetric encryption/decryption service
- [ ] Credential CRUD endpoints (`POST`, `GET`, `PUT`, `DELETE /api/vault/credentials`)
- [ ] Folder hierarchy and organization APIs
- [ ] Tagging and category classification endpoints

### Module 4: Secure Sharing & Auditing (Planned)
- [ ] Credential sharing invitation flow with expiry timestamps
- [ ] Role-based access control (RBAC) permissions check (READ, WRITE, ADMIN)
- [ ] Comprehensive immutable audit logging (`audit_logs` table)
- [ ] Anomaly risk scoring and IP blocking (`security_events`, `blocked_ips`)
- [ ] Real-time user security notifications (`notifications` table)

### Module 5: Frontend Interface
- [x] Unified React 18 + Vite single-page application
- [x] Cohesive enterprise dark theme with Plus Jakarta Sans and JetBrains Mono typography
- [x] Navigation bar with real-time active view switching and session badge
- [x] Modern Login view with remember-me, show/hide password, and OAuth mock buttons
- [x] Modern Registration view with live dynamic **Password Strength Meter**
- [x] Interactive Vault Dashboard preview with Security Health score (94%)
- [x] Built-in Password Generator widget (custom length, uppercase, numbers, symbols, copy-to-clipboard)
- [x] API service layer with dev proxy and offline demo fallbacks

---

## 📝 Activity & Changelog

| Timestamp | Contributor / Agent | Action Description | Impacted Components |
| :--- | :--- | :--- | :--- |
| **Oct 17, 2026** | Pair Programming | Moved documentation and syllabus to `docs/` and initialized `work_tracker.md`. | `docs/`, `README.md` |
| **Oct 17, 2026** | Pair Programming | Consolidated `registration-service` and `login-service` into unified `backend/` service on port 8080. | `backend/`, `docker-compose.yml`, `auth-services/` |
| **Oct 17, 2026** | Pair Programming | Consolidated fragmented root CRA and `registration/` into unified `frontend/` (React + Vite). | `frontend/`, root `src/`, `registration/`, `dist/` |
| **Oct 16, 2026** | Team Contributor | Implemented initial Login Page React UI components. | `src/App.js`, `src/App.css` |
| **Oct 16, 2026** | Team Contributor | Implemented initial Registration Page React Vite components. | `registration/src/App.jsx` |
| **Oct 15, 2026** | Team Contributor | Integrated hardened Spring Boot auth microservices (BCrypt + JWT + Lockout). | `auth-services/`, `docker-compose.yml` |
| **Oct 10, 2026** | Team Contributor | Designed and initialized normalized PostgreSQL 16 database schema & Docker Compose. | `database/schema.sql`, `schema.md` |

---

## 🎯 Next Priority Action Items
1. **Milestone 3 Core:** Implement the cryptographic service class (`EncryptionService.java`) using `AES/GCM/NoPadding` (256-bit) and PBKDF2WithHmacSHA256.
2. **Credential APIs:** Implement `CredentialController.java` and `CredentialService.java` for encrypted record storage and retrieval.
3. **Database Performance:** Add functional lower indexes on `users(lower(email))` and `users(lower(username))` in `database/schema.sql`.
4. **Redis Integration:** Bind Redis caching in `backend` for distributed session tokens and rate limits.
