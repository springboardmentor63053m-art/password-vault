/**
 * SecureVault API client for the unified Spring Boot service.
 */

const clientDeviceId = () => {
  try {
    const storageKey = 'securevault_device_fingerprint_v1';
    let value = localStorage.getItem(storageKey);
    if (!value) {
      value = crypto.randomUUID();
      localStorage.setItem(storageKey, value);
    }
    return value;
  } catch {
    return '';
  }
};

export const registerUser = async ({ username, email, password }) => {
  try {
    const response = await fetch('/api/registration/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage = data.message || data.error || (response.status === 429 ? 'Rate limit exceeded. Please wait 60s.' : 'Registration failed. Please check your details.');
      return { success: false, status: response.status, error: errorMessage };
    }

    return {
      success: true,
      status: response.status,
      message: data.message || 'Registration request accepted. You can now log in.',
    };
  } catch {
    return {
      success: false,
      error: 'Cannot connect to SecureVault. Make sure the backend is running, then try again.',
    };
  }
};

export const loginUser = async ({ identifier, password }) => {
  try {
    sessionStorage.removeItem('securevault_jwt');
    sessionStorage.removeItem('securevault_user');

    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SecureVault-Device': clientDeviceId(),
      },
      body: JSON.stringify({
        identifier: identifier.trim(),
        password,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage =
        data.message ||
        data.error ||
        (response.status === 401
          ? 'Invalid username/email or password.'
          : response.status === 429
          ? 'Rate limit exceeded. Try again in 60 seconds.'
          : 'Login failed. Please try again.');
      return { success: false, status: response.status, error: errorMessage };
    }

    if (data?.mfaRequired && data?.challengeId) {
      return { success: true, challenge: data };
    }

    const jwtToken = data.accessToken || data.token;
    if (typeof jwtToken !== 'string' || !jwtToken) {
      return { success: false, error: 'The backend returned an invalid login response. Please try again.' };
    }

    sessionStorage.setItem('securevault_jwt', jwtToken);
    sessionStorage.setItem('securevault_user', JSON.stringify(data.user || { identifier }));

    return {
      success: true,
      data,
    };
  } catch {
    try {
      sessionStorage.removeItem('securevault_jwt');
      sessionStorage.removeItem('securevault_user');
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }
    return {
      success: false,
      error: 'Cannot connect to SecureVault. Make sure the backend is running, then try again.',
    };
  }
};

export const completeLoginMfa = async ({ challengeId, code }) => {
  try {
    const response = await fetch('/api/login/mfa', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SecureVault-Device': clientDeviceId(),
      },
      body: JSON.stringify({ challengeId, code }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, status: response.status,
        error: data.message || data.error || 'The verification code is invalid or expired.' };
    }
    const jwtToken = data.accessToken || data.token;
    if (typeof jwtToken !== 'string' || !jwtToken) {
      return { success: false, error: 'The backend returned an invalid verification response.' };
    }
    sessionStorage.setItem('securevault_jwt', jwtToken);
    sessionStorage.setItem('securevault_user', JSON.stringify(data.user || {}));
    return { success: true, data };
  } catch {
    return { success: false, error: 'Cannot connect to SecureVault. Check that the backend is running.' };
  }
};

export const getMfaStatus = async () => accountMfaRequest('/api/account/mfa');
export const startTotpSetup = async (currentPassword) => accountMfaRequest('/api/account/mfa/totp/setup', {
  method: 'POST', body: JSON.stringify({ currentPassword }),
});
export const confirmTotpSetup = async (code) => accountMfaRequest('/api/account/mfa/totp/confirm', {
  method: 'POST', body: JSON.stringify({ code }),
});
export const disableTotp = async (currentPassword, code) => accountMfaRequest('/api/account/mfa/totp', {
  method: 'DELETE', body: JSON.stringify({ currentPassword, code }),
});

async function accountMfaRequest(path, options = {}) {
  const token = getStoredAuth()?.token;
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body != null) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...options, headers, cache: 'no-store' });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.error || 'Security settings could not be loaded.');
  return data;
}

export const getStoredAuth = () => {
  try {
    const token = sessionStorage.getItem('securevault_jwt');
    const userStr = sessionStorage.getItem('securevault_user');
    const user = userStr ? JSON.parse(userStr) : null;
    if (token === 'demo_jwt_token_sample') {
      sessionStorage.removeItem('securevault_jwt');
      sessionStorage.removeItem('securevault_user');
      return null;
    }
    return token ? { token, user } : null;
  } catch {
    try {
      sessionStorage.removeItem('securevault_jwt');
      sessionStorage.removeItem('securevault_user');
    } catch {
      // Ignore storage cleanup failures in restricted browser contexts.
    }
    return null;
  }
};

export const logoutUser = () => {
  sessionStorage.removeItem('securevault_jwt');
  sessionStorage.removeItem('securevault_user');
};
