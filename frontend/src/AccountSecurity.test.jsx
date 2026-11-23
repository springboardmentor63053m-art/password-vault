import React from 'react';
import {afterEach,expect,test,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import AccountSecurityPanel from './components/AccountSecurityPanel';
import HelpSupport from './components/HelpSupport';
import {vaultRequest} from './services/vaultApi';
vi.mock('./services/vaultApi',()=>({vaultRequest:vi.fn()}));
vi.mock('./components/MfaSettingsPanel',()=>({default:()=> <div>MFA settings</div>}));
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.clearAllMocks();});
test('account security uses owned API data and requires current password before changing',async()=>{
 vaultRequest.mockResolvedValue({sessions:[],devices:[],activities:[],recommendations:[],mfaEnabled:true});const logout=vi.fn();
 render(<AccountSecurityPanel onLogout={logout}/>);expect(await screen.findByLabelText('Authenticator code')).toBeRequired();
 fireEvent.change(screen.getByLabelText('Current password'),{target:{value:'synthetic-current'}});
 fireEvent.change(screen.getByLabelText('New password'),{target:{value:'Synthetic-replacement-42'}});
 fireEvent.change(screen.getByLabelText('Authenticator code'),{target:{value:'123456'}});
 fireEvent.submit(screen.getByRole('button',{name:'Change password and sign out'}).closest('form'));
 await waitFor(()=>expect(logout).toHaveBeenCalledOnce());
 expect(vaultRequest).toHaveBeenCalledWith('/security/password',expect.objectContaining({method:'POST'}));
});
test('support describes actual limitations without inventing a recovery or support channel',()=>{
 render(<HelpSupport/>);expect(screen.getByText(/Recovery codes are not currently available/)).toBeInTheDocument();expect(screen.getByText(/No support address is configured/)).toBeInTheDocument();
});

test('security rows identify session states and revoke the selected session or device', async () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 60_000).toISOString();
  vaultRequest.mockResolvedValue({
    mfaEnabled: false, activities: [], recommendations: [],
    sessions: [
      { id: 'active-session', ip: '192.0.2.1', createdAt: past, expiresAt: future },
      { id: 'expired-session', ip: '192.0.2.2', createdAt: past, expiresAt: past },
      { id: 'revoked-session', ip: '192.0.2.3', createdAt: past, expiresAt: future, revoked: true },
    ],
    devices: [{ id: 'other-device', category: 'Desktop', os: 'Windows', browser: 'Chrome', activeSessions: 1 }],
  });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<AccountSecurityPanel />);
  expect(await screen.findByText('Active')).toBeVisible();
  expect(screen.getByText('Expired')).toBeVisible();
  expect(screen.getByText('Revoked')).toBeVisible();
  const sessionButtons = screen.getAllByRole('button', { name: 'Revoke session', exact: true });
  expect(sessionButtons).toHaveLength(2);
  fireEvent.click(sessionButtons[0]);
  await waitFor(() => expect(sessionButtons[0]).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Revoke device sessions' }));
  await waitFor(() => expect(vaultRequest).toHaveBeenCalledWith('/security/devices/other-device', { method: 'DELETE' }));
  expect(vaultRequest).toHaveBeenCalledWith('/security/sessions/active-session', { method: 'DELETE' });
});

test('authenticator controls still enroll, confirm and disable through their existing callbacks', async () => {
  const { default: Settings } = await vi.importActual('./components/MfaSettingsPanel');
  const status = vi.fn().mockResolvedValueOnce({ totpEnabled: false })
    .mockResolvedValueOnce({ totpEnabled: true }).mockResolvedValueOnce({ totpEnabled: false });
  const setup = vi.fn().mockResolvedValue({
    secret: 'SYNTHETIC', otpauthUri: 'otpauth://totp/Fixture?secret=SYNTHETIC',
  });
  const confirm = vi.fn().mockResolvedValue(undefined);
  const disable = vi.fn().mockResolvedValue(undefined);
  render(<Settings getStatus={status} startSetup={setup} confirmSetup={confirm} disable={disable} />);
  fireEvent.change(await screen.findByLabelText('Confirm your current password'), { target: { value: 'fixture-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Set up authenticator' }));
  fireEvent.change(await screen.findByLabelText('Authenticator code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify and enable' }));
  await screen.findByText('Authenticator on');
  expect(setup).toHaveBeenCalledWith('fixture-password');
  expect(confirm).toHaveBeenCalledWith('123456');
  fireEvent.change(screen.getByLabelText('Current password', { exact: true }), { target: { value: 'fixture-password' } });
  fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '654321' } });
  fireEvent.click(screen.getByRole('button', { name: 'Disable authenticator' }));
  await screen.findByText('Authenticator off');
  expect(disable).toHaveBeenCalledWith('fixture-password', '654321');
});
