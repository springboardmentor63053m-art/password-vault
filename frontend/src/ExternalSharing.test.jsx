import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ExternalShareForm from './components/ExternalShareForm';
import { vaultRequest } from './services/vaultApi';

vi.mock('./services/vaultApi', () => ({ vaultRequest: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

test.each([true, false])('invitation reports SMTP outcome (accepted=%s)', async accepted => {
  const saved = vi.fn();
  if (accepted) vaultRequest.mockResolvedValue({});
  else vaultRequest.mockRejectedValue(new Error('Email submission failed.'));
  render(<ExternalShareForm items={[{ id: 'fixture', title: 'Synthetic item' }]} refreshHistory={vi.fn()} onSaved={saved} />);
  fireEvent.change(screen.getByLabelText('Stored credential'), { target: { value: 'fixture' } });
  fireEvent.change(screen.getByLabelText('Recipient email'), { target: { value: 'recipient@example.test' } });
  fireEvent.click(screen.getByLabelText('One-time credential retrieval'));
  fireEvent.click(screen.getByRole('button', { name: 'Send Secure Access Link' }));
  expect(await screen.findByRole(accepted ? 'status' : 'alert')).toHaveTextContent(
    accepted ? 'The SMTP server accepted the message' : 'Email submission failed.'
  );
  const [path, request] = vaultRequest.mock.calls[0];
  expect(path).toBe('/shares/external');
  expect(JSON.parse(request.body)).toEqual({
    credentialId: 'fixture', email: 'recipient@example.test', minutes: 15, oneTime: true, message: '',
  });
});
