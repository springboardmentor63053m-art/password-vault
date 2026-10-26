const TOKEN_KEY = 'securevault_admin_jwt';
const USER_KEY = 'securevault_admin_user';
const DEVICE_KEY = 'securevault_device_fingerprint_v1';

const clientDeviceId = () => {
  try {
    let value = localStorage.getItem(DEVICE_KEY);
    if (!value) {
      value = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, value);
    }
    return value;
  } catch {
    return '';
  }
};

export class AdminApiError extends Error {
  constructor(message, status = 0, code = 'API_ERROR') {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
  }
}

const readStoredToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const storeAdminSession = (token, user) => {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAdminSession = () => {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch {
    // Storage may be disabled in restricted browser contexts.
  }
};

const request = async (path, { token = readStoredToken(), ...options } = {}) => {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response;
  try {
    response = await fetch(path, { ...options, headers, cache: 'no-store' });
  } catch {
    throw new AdminApiError('Cannot reach SecureVault. Check that the backend and database are running.');
  }

  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new AdminApiError(
      data?.message || data?.error || `Request failed (${response.status}).`,
      response.status,
      data?.code || 'API_ERROR',
    );
  }
  return data;
};

export const signInAdmin = async ({ identifier, password }) => {
  clearAdminSession();
  const result = await request('/api/login', {
    token: null,
    method: 'POST',
    headers: { 'X-SecureVault-Device': clientDeviceId() },
    body: JSON.stringify({ identifier: identifier.trim(), password }),
  });
  if (result?.mfaRequired && result?.challengeId) return { mfaChallenge: result };
  const token = result?.accessToken || result?.token;
  if (typeof token !== 'string' || token.length === 0) {
    throw new AdminApiError('The sign-in response did not include a valid session token.');
  }

  try {
    const admin = await request('/api/admin/me', { token });
    if (admin?.role !== 'ROLE_ADMIN') {
      throw new AdminApiError('This account does not have the administrator role.', 403, 'ADMIN_REQUIRED');
    }
    storeAdminSession(token, admin);
    return admin;
  } catch (error) {
    await request('/api/logout', { token, method: 'POST' }).catch(() => {});
    clearAdminSession();
    throw error;
  }
};

export const completeAdminMfa = async ({ challengeId, code }) => {
  const result = await request('/api/login/mfa', {
    token: null,
    method: 'POST',
    headers: { 'X-SecureVault-Device': clientDeviceId() },
    body: JSON.stringify({ challengeId, code }),
  });
  const token = result?.accessToken || result?.token;
  if (typeof token !== 'string' || token.length === 0) {
    throw new AdminApiError('The verification response did not include a valid session token.');
  }
  try {
    const admin = await request('/api/admin/me', { token });
    if (admin?.role !== 'ROLE_ADMIN') {
      throw new AdminApiError('This account does not have the administrator role.', 403, 'ADMIN_REQUIRED');
    }
    storeAdminSession(token, admin);
    return admin;
  } catch (error) {
    await request('/api/logout', { token, method: 'POST' }).catch(() => {});
    clearAdminSession();
    throw error;
  }
};

export const getAdminIdentity = () => request('/api/admin/me');
export const getDashboardOverview = () => request('/api/admin/dashboard');
export const getUserStats = () => request('/api/admin/users/stats');

export const getUsers = ({ search = '', risk = 'ALL', page = 0, size = 50 } = {}) => {
  const query = new URLSearchParams({ search, risk, page: String(page), size: String(size) });
  return request(`/api/admin/users?${query}`);
};

export const getUserDetails = (userId) => request(`/api/admin/users/${encodeURIComponent(userId)}`);

export const setUserActive = (userId, active) => request(
  `/api/admin/users/${encodeURIComponent(userId)}/status`,
  { method: 'PATCH', body: JSON.stringify({ active }) },
);

export const setUserRole = (userId, role, currentPassword) => request(
  `/api/admin/users/${encodeURIComponent(userId)}/role`,
  { method: 'PATCH', body: JSON.stringify({ role, currentPassword }) },
);

export const getMfaStatus = () => request('/api/account/mfa');
export const startTotpSetup = (currentPassword) => request('/api/account/mfa/totp/setup', {
  method: 'POST', body: JSON.stringify({ currentPassword }),
});
export const confirmTotpSetup = (code) => request('/api/account/mfa/totp/confirm', {
  method: 'POST', body: JSON.stringify({ code }),
});
export const disableTotp = (currentPassword, code) => request('/api/account/mfa/totp', {
  method: 'DELETE', body: JSON.stringify({ currentPassword, code }),
});

export const revokeDevice = (userId, deviceId) => request(
  `/api/admin/users/${encodeURIComponent(userId)}/devices/${encodeURIComponent(deviceId)}/revoke`,
  { method: 'POST' },
);

export const getActivities = ({ search = '', page = 0, size = 50 } = {}) => {
  const query = new URLSearchParams({ search, page: String(page), size: String(size) });
  return request(`/api/admin/activities?${query}`);
};

export const getVaultOverview = () => request('/api/admin/vaults/overview');
export const getAnalytics = () => request('/api/admin/analytics');

export const resolveSecurityEvent = (eventId) => request(
  `/api/admin/analytics/events/${encodeURIComponent(eventId)}/resolve`,
  { method: 'PATCH' },
);

export const updateSecurityEventStatus = (eventId, status) => request(
  `/api/admin/analytics/events/${encodeURIComponent(eventId)}/status`,
  { method: 'PATCH', body: JSON.stringify({ status }) },
);

export const getSystemOverview = () => request('/api/admin/settings');

export const signOutAdmin = async () => {
  const token = readStoredToken();
  try {
    if (token) await request('/api/logout', { token, method: 'POST' });
  } finally {
    clearAdminSession();
  }
};
