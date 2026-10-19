/**
 * SecureVault API Client Service
 * Interacts with the Spring Boot API through the Vite /api proxy.
 */

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
    return { success: false, error: 'Cannot reach SecureVault. Check that the backend is running and try again.' };
  }
};

export const loginUser = async ({ identifier, password }) => {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

    // Store JWT securely in sessionStorage
    if (!data.accessToken || !data.user || !data.user.role) {
      return { success: false, error: 'The server returned an incomplete authentication response.' };
    }
    sessionStorage.setItem('securevault_jwt', data.accessToken);
    sessionStorage.setItem('securevault_user', JSON.stringify(data.user));

    return {
      success: true,
      data,
    };
  } catch {
    return { success: false, error: 'Cannot reach SecureVault. Check that the backend is running and try again.' };
  }
};

export const getStoredToken = () => sessionStorage.getItem('securevault_jwt');

export const getStoredAuth = () => {
  try {
    const token = sessionStorage.getItem('securevault_jwt');
    const userStr = sessionStorage.getItem('securevault_user');
    const user = userStr ? JSON.parse(userStr) : null;
    return token ? { token, user } : null;
  } catch {
    return null;
  }
};

export const logoutUser = () => {
  sessionStorage.removeItem('securevault_jwt');
  sessionStorage.removeItem('securevault_user');
};
