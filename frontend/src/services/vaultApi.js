/**
 * SecureVault user workspace API service.
 * Handles authenticated communication with the Spring Boot backend (/api/account/*).
 */

const DEVICE_KEY = 'securevault_device_fingerprint_v1';

export const clientDeviceId = () => {
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

const getStoredToken = () => {
  try {
    return (
      sessionStorage.getItem('securevault_jwt') ||
      sessionStorage.getItem('securevault_admin_jwt') ||
      localStorage.getItem('securevault_jwt') ||
      ''
    );
  } catch {
    return '';
  }
};

export async function vaultRequest(path, options = {}) {
  const token = options.token || getStoredToken();
  const normalizedPath = path.startsWith('/api')
    ? path
    : `/api/account${path.startsWith('/') ? path : `/${path}`}`;

  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const deviceId = clientDeviceId();
  if (deviceId) {
    headers['X-SecureVault-Device'] = deviceId;
  }

  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(normalizedPath, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = 'Request failed';
    try {
      const errorData = await res.json();
      message = errorData.message || errorData.error || message;
    } catch {
      // response was not JSON
    }
    throw new Error(message);
  }

  if (res.status === 204) {
    return null;
  }

  const text = await res.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const vaultApi = {
  overview: () => vaultRequest('/vault/overview'),

  list: ({ search = '', category = '', sort = 'NEWEST', favorites = false } = {}) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (sort) params.set('sort', sort);
    if (favorites) params.set('favorites', 'true');
    const qs = params.toString();
    return vaultRequest(`/vault/credentials${qs ? `?${qs}` : ''}`);
  },

  categories: () => vaultRequest('/vault/categories'),

  category: (name) =>
    vaultRequest('/vault/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  assess: (password, excludedId) =>
    vaultRequest('/vault/password-health', {
      method: 'POST',
      body: JSON.stringify({ password, excludedId: excludedId || null }),
    }),

  read: (id) => vaultRequest(`/vault/credentials/${id}`),

  save: (id, payload) => {
    if (id) {
      return vaultRequest(`/vault/credentials/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    }
    return vaultRequest('/vault/credentials', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  favorite: (id, favorite) =>
    vaultRequest(`/vault/credentials/${id}/favorite`, {
      method: 'PATCH',
      body: JSON.stringify({ favorite }),
    }),

  remove: (id) =>
    vaultRequest(`/vault/credentials/${id}`, {
      method: 'DELETE',
    }),

  checkBreach: (password) =>
    vaultRequest('/vault/check-breach', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
};
