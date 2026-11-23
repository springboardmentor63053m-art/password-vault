import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import App from './App';

const bothRoles = { id: 'fixture-id', username: 'dual-role-user', roles: ['ROLE_USER', 'ROLE_ADMIN'] };
const page = { items: [], total: 0, page: 0, size: 10 };
const response = (status, data = null) => ({ status, ok: status < 400, json: async () => data });

function mockApi({ role = 'ROLE_ADMIN', method = 'EMAIL' } = {}) {
  const fetchMock = vi.fn(async (path, options) => {
    const route = path.split('?')[0];
    if (route === '/api/login') return response(202, { mfaRequired: true, challengeId: 'fixture', method, maskedEmail: 'fi***@example.test' });
    if (route === '/api/login/mfa') return response(200, { accessToken: 'fixture-session', user: bothRoles });
    if (route === '/api/admin/me') return role === 'ROLE_ADMIN'
      ? response(200, { ...bothRoles, role })
      : response(401, { code: 'UNAUTHENTICATED', message: 'Sign in with an administrator account to continue.' });
    if (route === '/api/logout') return response(204);
    if (route === '/api/admin/settings') return response(200, { serviceStatus: 'Operational' });
    if (route === '/api/admin/users' || route === '/api/admin/activities' || route === '/api/admin/shares') return response(200, page);
    if (route === '/api/admin/analytics') return response(200, { events: [], recentAuthentication: [] });
    if (route === '/api/account/vault/overview') return response(200, {
      health: { total: 0, warnings: [] }, sharedByMe: 0, sharedWithMe: 0, recentActivities: [], suggestions: [],
    });
    if (route === '/api/account/notifications/unread') return response(200, { unread: 0 });
    if (route === '/api/account/notifications') return response(200, page);
    if (route === '/api/account/security') return response(200, { sessions: [], devices: [], activities: [], recommendations: [] });
    if (route.startsWith('/api/account/shares/') || route.startsWith('/api/account/vault/')) return response(200, []);
    return response(200, {});
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function submitPassword(admin = false) {
  fireEvent.change(screen.getByLabelText(/username or email/i), { target: { value: bothRoles.username } });
  fireEvent.change(screen.getByLabelText(admin ? 'Password' : 'Account Password', { exact: true }),
    { target: { value: 'synthetic-test-password' } });
  fireEvent.click(screen.getByRole('button', { name: admin ? /continue securely/i : /unlock vault/i }));
}

async function submitMfa() {
  fireEvent.change(await screen.findByLabelText(/six-digit verification code/i), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: /verify and continue/i }));
}

test('public entry points keep registration in the User Login flow', async () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'User Login' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
  expect(screen.getByRole('heading', { name: 'Create an Account' })).toBeVisible();
  expect(screen.queryByLabelText('System Role (RBAC)')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Admin Login' }));
  expect(await screen.findByRole('heading', { name: 'Admin Login' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Create an account' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back to User Login' }));
  expect(screen.getByRole('heading', { name: 'User Login' })).toBeVisible();
});

test('User Login with email MFA keeps a dual-role account in the User Workspace', async () => {
  const fetchMock = mockApi();
  render(<App />);
  submitPassword();
  await submitMfa();
  const sidebar = await screen.findByRole('navigation', { name: 'User workspace' });
  const header = document.querySelector('.admin-topbar');
  expect(within(header).getByText(bothRoles.username)).toBeVisible();
  expect(within(header).getByText('USER')).toBeVisible();
  expect(within(sidebar.closest('aside')).getByRole('button', { name: 'Sign out' })).toBeVisible();
  expect(screen.queryByRole('button', { name: /admin (console|login)/i })).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([path]) => path.startsWith('/api/admin/'))).toBe(false);
  for (const label of ['My Vault', 'Secure Share', 'Notifications', 'Account Security', 'Help & Support', 'Profile / Settings', 'Dashboard']) {
    const entry = within(sidebar).getByRole('button', { name: label });
    fireEvent.click(entry);
    expect(entry).toHaveAttribute('aria-current', 'page');
    expect(within(document.querySelector('.topbar-breadcrumb')).getByText(label)).toBeVisible();
  }
  const [logout] = screen.getAllByRole('button', { name: 'Sign out' });
  expect(screen.getAllByRole('button', { name: 'Sign out' })).toHaveLength(1);
  fireEvent.click(logout);
  expect(screen.getByRole('heading', { name: 'User Login' })).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith('/api/logout', expect.objectContaining({ method: 'POST' }));
  submitPassword();
  await submitMfa();
  expect(await screen.findByRole('navigation', { name: 'User workspace' })).toBeVisible();
});

test('Admin Login with authenticator MFA restores the Admin Workspace and keeps one sign-out action', async () => {
  mockApi({ method: 'TOTP' });
  const { unmount } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Admin Login' }));
  await screen.findByRole('heading', { name: 'Admin Login' });
  submitPassword(true);
  await submitMfa();
  await screen.findByText('API connected');
  const adminHeader = document.querySelector('.admin-topbar');
  expect(within(adminHeader).getByText(bothRoles.username)).toBeVisible();
  expect(within(adminHeader).getByText('ADMIN')).toBeVisible();
  const sidebar = screen.getByRole('navigation', { name: 'Administrator navigation' });
  expect(within(sidebar.closest('aside')).getByRole('button', { name: 'Sign out' })).toBeVisible();
  expect(document.querySelector('.public-navbar')).toBeNull();
  expect(screen.getAllByRole('button', { name: 'Sign out' })).toHaveLength(1);
  for (const label of ['Users & roles', 'Threat analysis', 'Audit trail', 'Sharing Activity', 'Vaults', 'Account security', 'System health', 'Overview']) {
    const entry = within(sidebar).getByRole('button', { name: label });
    fireEvent.click(entry);
    expect(entry).toHaveAttribute('aria-current', 'page');
    expect(within(document.querySelector('.topbar-breadcrumb')).getByText(label)).toBeVisible();
  }
  unmount();
  render(<App />);
  await screen.findByText('API connected');
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('heading', { name: 'Admin Login' })).toBeVisible();
  expect(sessionStorage.getItem('securevault_admin_jwt')).toBeNull();
});

test('a regular user completing MFA through Admin Login receives a clear denial', async () => {
  const fetchMock = mockApi({ role: 'ROLE_USER' });
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Admin Login' }));
  await screen.findByRole('heading', { name: 'Admin Login' });
  submitPassword(true);
  await submitMfa();
  expect(await screen.findByRole('alert')).toHaveTextContent('This account does not have administrator access. Use User Login instead.');
  expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  expect(sessionStorage.getItem('securevault_admin_jwt')).toBeNull();
  expect(fetchMock.mock.calls.some(([path]) => path === '/api/admin/dashboard')).toBe(false);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/logout', expect.objectContaining({ method: 'POST' })));
});
