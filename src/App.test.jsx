import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import App from './App';

afterEach(cleanup);

test('renders the administrator sign-in screen', async () => {
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Sign in to your console' })).toBeInTheDocument();
});
