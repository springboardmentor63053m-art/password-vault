/**
 * SecureVault API Client Service
 * Interacts with Spring Boot Microservices:
 * - Registration Service (Port 8081 / /api/registration)
 * - Login Service (Port 8082 / /api/login)
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
  } catch (err) {
    console.warn('Backend API connection warning (running local demo fallback):', err);
    // Offline / Demo fallback
    return {
      success: true,
      isDemo: true,
      message: 'Demo Mode: Registration simulated successfully! You can proceed to Login.',
    };
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
    const jwtToken = data.accessToken || data.token;
    if (jwtToken) {
      sessionStorage.setItem('securevault_jwt', jwtToken);
      sessionStorage.setItem('securevault_user', JSON.stringify(data.user || { identifier }));
    }

    return {
      success: true,
      data,
    };
  } catch (err) {
    console.warn('Backend API connection warning (running local demo fallback):', err);
    // Offline / Demo fallback
    const mockUser = {
      username: identifier.split('@')[0] || 'vaultuser',
      email: identifier.includes('@') ? identifier : `${identifier}@example.com`,
      id: 'demo-uuid-' + Math.random().toString(36).substring(2, 9),
    };
    sessionStorage.setItem('securevault_jwt', 'demo_jwt_token_sample');
    sessionStorage.setItem('securevault_user', JSON.stringify(mockUser));
    return {
      success: true,
      isDemo: true,
      data: {
        token: 'demo_jwt_token_sample',
        tokenType: 'Bearer',
        user: mockUser,
      },
    };
  }
};

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
