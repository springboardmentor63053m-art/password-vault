import { afterEach, expect, test, vi } from "vitest";
import { completeLoginMfa, loginUser } from "../frontend/src/services/api";
import { completeAdminMfa, setUserRole, signInAdmin } from "./adminApi";

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

test("user login returns an email challenge without storing a token", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 202,
    json: async () => ({
      mfaRequired: true,
      challengeId: "challenge-123",
      method: "EMAIL",
      maskedEmail: "al***@example.com",
      expiresAt: "2026-10-26T12:00:00Z",
    }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const result = await loginUser({ identifier: "alice", password: "correct-password" });

  expect(result.challenge.method).toBe("EMAIL");
  expect(result.challenge.maskedEmail).toBe("al***@example.com");
  expect(sessionStorage.getItem("securevault_jwt")).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("stores a user session only after the MFA endpoint accepts the code", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ accessToken: "user-session-token", user: { username: "alice" } }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const result = await completeLoginMfa({ challengeId: "challenge-123", code: "004281" });

  expect(result.success).toBe(true);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ challengeId: "challenge-123", code: "004281" });
  expect(sessionStorage.getItem("securevault_jwt")).toBe("user-session-token");
});

test("admin challenge issues no session until verification and role updates include reauthentication", async () => {
  const fetchMock = vi.fn(async (path) => {
    if (path === "/api/login") {
      return { ok: true, status: 202, json: async () => ({ mfaRequired: true, challengeId: "admin-challenge", method: "TOTP" }) };
    }
    if (path === "/api/login/mfa") {
      return { ok: true, status: 200, json: async () => ({ accessToken: "admin-session-token" }) };
    }
    if (path === "/api/admin/me") {
      return { ok: true, status: 200, json: async () => ({ id: "admin-id", role: "ROLE_ADMIN" }) };
    }
    return { ok: true, status: 204, json: async () => null };
  });
  vi.stubGlobal("fetch", fetchMock);

  const firstStep = await signInAdmin({ identifier: "admin", password: "secret" });
  expect(firstStep.mfaChallenge.challengeId).toBe("admin-challenge");
  expect(sessionStorage.getItem("securevault_admin_jwt")).toBeNull();

  await completeAdminMfa({ challengeId: "admin-challenge", code: "123456" });
  expect(sessionStorage.getItem("securevault_admin_jwt")).toBe("admin-session-token");
  await setUserRole("target-id", "ROLE_ADMIN", "admin-password");
  const roleUpdate = fetchMock.mock.calls.find(([path]) => path.includes("/role"));
  expect(JSON.parse(roleUpdate[1].body)).toEqual({ role: "ROLE_ADMIN", currentPassword: "admin-password" });
});
