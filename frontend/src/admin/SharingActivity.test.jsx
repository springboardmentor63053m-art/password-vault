import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import SharingActivity from './SharingActivity';
import { getSharingActivity } from './adminApi';

vi.mock('./adminApi', () => ({ getSharingActivity: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const row = {
  id: 'share-1', sender: 'fixture-sender', recipient: 'fixture-recipient',
  credentialRef: '3fc97691-af6b-401f-9810-2b022ec15ac8',
  permission: 'VIEW', createdAt: '2026-11-12T09:00:00Z', expiresAt: null,
};

test('defaults to all shares, paginates, and resets the page when filtering', async () => {
  getSharingActivity
    .mockResolvedValueOnce({ items: [{ ...row, status: 'REVOKED' }], total: 51, page: 0, size: 50 })
    .mockResolvedValueOnce({ items: [{ ...row, status: 'ACTIVE' }], total: 51, page: 1, size: 50 })
    .mockResolvedValueOnce({ items: [], total: 0, page: 0, size: 50 });
  const onAuditTrail = vi.fn();
  render(<SharingActivity onAuditTrail={onAuditTrail} Pagination={({ onChange }) =>
    <button onClick={() => onChange(1)}>Next page</button>} />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading sharing activity');
  const table = await screen.findByRole('table');
  expect(within(table).getByText('Revoked')).toBeVisible();
  expect(within(table).getByText(row.credentialRef)).toBeVisible();
  expect(within(table).getByText('View only')).toBeVisible();
  expect(getSharingActivity).toHaveBeenNthCalledWith(1, { status: 'ALL', page: 0 });
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(await within(await screen.findByRole('table')).findByText('Active')).toBeVisible();
  expect(getSharingActivity).toHaveBeenNthCalledWith(2, { status: 'ALL', page: 1 });
  fireEvent.click(screen.getByRole('button', { name: 'Expired' }));
  expect(await screen.findByText('No shares found')).toBeVisible();
  expect(getSharingActivity).toHaveBeenNthCalledWith(3, { status: 'EXPIRED', page: 0 });
  fireEvent.click(screen.getByRole('button', { name: 'View audit trail' }));
  expect(onAuditTrail).toHaveBeenCalledOnce();
});

test('offers retry on failure and notifies the admin console when authorization fails', async () => {
  getSharingActivity.mockRejectedValueOnce(new Error('Sharing is temporarily unavailable.'))
    .mockRejectedValueOnce(Object.assign(new Error('Access denied'), { status: 403 }));
  const onAuthError = vi.fn();
  render(<SharingActivity onAuthError={onAuthError} Pagination={() => null} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Sharing is temporarily unavailable.');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Access denied');
  expect(onAuthError).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
});
