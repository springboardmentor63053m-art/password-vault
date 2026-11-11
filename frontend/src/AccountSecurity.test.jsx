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
