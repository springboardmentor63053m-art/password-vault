import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import App from './App';
import AdminDashboard from './admin/AdminDashboard';

afterEach(cleanup);

test('renders the user login screen by default', async () => {
  render(<App />);
  expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /admin console/i }).length).toBeGreaterThan(0);
});

test('renders the administrator sign-in screen in admin dashboard when unauthenticated', async () => {
  render(<AdminDashboard />);
  expect(await screen.findByRole('heading', { name: 'Sign in to your console' })).toBeInTheDocument();
});
