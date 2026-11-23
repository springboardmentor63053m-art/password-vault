import React from 'react';
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import SecureShare from './components/SecureShare';
import {vaultApi,vaultRequest} from './services/vaultApi';
vi.mock('./services/vaultApi',()=>({vaultApi:{list:vi.fn()},vaultRequest:vi.fn()}));
let sent,received,history;
beforeEach(()=>{
 vi.clearAllMocks();sent=[];received=[];history=[];vaultApi.list.mockResolvedValue([{id:'owned-item',title:'Owned fixture'}]);
 vaultRequest.mockImplementation(async(path)=>{
  if(path==='/shares/sent')return sent;if(path==='/shares/received')return received;if(path==='/shares/history')return history;
  if(path.startsWith('/shares/recipients?'))return [{id:'recipient-id',username:'fixture-recipient'}];
  if(path.endsWith('/credential'))return {title:'Received fixture',username:'fixture-user',password:'synthetic-shared-value',notes:''};
  return null;
 });
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
test('a failed outgoing list does not render its empty state',async()=>{
 const request = vaultRequest.getMockImplementation();
 vaultRequest.mockImplementation(path => path === '/shares/sent' ? Promise.reject(new Error('Backend unavailable.')) : request(path));
 render(<SecureShare/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('Backend unavailable.');expect(screen.queryByText(/No outgoing shares/)).not.toBeInTheDocument();
});
test('sharing chooses a stored credential and exact registered recipient without sending a permission escalation',async()=>{
 render(<SecureShare/>);await screen.findByRole('option',{name:'Owned fixture'});
 fireEvent.change(screen.getByLabelText('Stored credential to share'),{target:{value:'owned-item'}});
 fireEvent.change(screen.getByLabelText('Exact recipient username or email'),{target:{value:'fixture-recipient'}});
 fireEvent.click(screen.getByRole('button',{name:'Search recipient'}));await screen.findByRole('option',{name:'fixture-recipient'});
 fireEvent.change(screen.getByLabelText('Registered recipient'),{target:{value:'recipient-id'}});
 fireEvent.submit(screen.getByRole('button',{name:'Share credential'}).closest('form'));
 await waitFor(()=>expect(vaultRequest).toHaveBeenCalledWith('/shares',{method:'POST',body:JSON.stringify({credentialId:'owned-item',recipientId:'recipient-id',expiresAt:null})}));
});
test('expired access has no read action and active shared values remain masked until reveal',async()=>{
 received=[{id:'active-share',owner:'Fixture owner',status:'ACTIVE'},{id:'expired-share',owner:'Other fixture',status:'EXPIRED'},{id:'revoked-share',owner:'Revoked fixture',status:'REVOKED'}];
 render(<SecureShare/>);fireEvent.click(screen.getByRole('tab',{name:'Shared with Me'}));await screen.findByText('From Fixture owner');
 expect(screen.getAllByRole('button',{name:'View shared credential'})).toHaveLength(1);
 fireEvent.click(screen.getByRole('button',{name:'View shared credential'}));await screen.findByRole('heading',{name:'Received fixture'});
 expect(screen.queryByText('synthetic-shared-value')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Reveal Password'}));expect(screen.getByText('synthetic-shared-value')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Close'}));expect(screen.queryByText('synthetic-shared-value')).not.toBeInTheDocument();
});
test('owner revocation calls the backend and retains history UI',async()=>{
 sent=[{id:'owned-share',credentialId:'owned-item',recipient:'Fixture recipient',status:'ACTIVE',expiresAt:null}];
 vi.spyOn(window,'confirm').mockReturnValue(true);render(<SecureShare/>);await screen.findByText('To Fixture recipient');
 fireEvent.click(screen.getByRole('button',{name:'Revoke access'}));
 await waitFor(()=>expect(vaultRequest).toHaveBeenCalledWith('/shares/owned-share',{method:'DELETE'}));
 fireEvent.click(screen.getByRole('tab',{name:'Sharing History'}));expect(screen.getByRole('heading',{name:'Sharing History'})).toBeInTheDocument();
});

test('expiry changes stay scoped to the selected share and can clear its expiry', async () => {
  sent = [
    { id: 'first-share', credentialId: 'owned-item', recipient: 'First recipient', status: 'ACTIVE' },
    { id: 'second-share', credentialId: 'owned-item', recipient: 'Second recipient', status: 'ACTIVE', expiresAt: '2030-01-02T09:00:00Z' },
  ];
  render(<SecureShare />);
  const expiry = await screen.findByLabelText('New expiry for Second recipient');
  fireEvent.change(expiry, { target: { value: '' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Update expiry' })[1]);
  await screen.findByText('Share expiry updated.');
  expect(vaultRequest).toHaveBeenCalledWith('/shares/second-share/expiry', {
    method: 'PATCH', body: JSON.stringify({ expiresAt: null }),
  });
});

test('clipboard writes require an explicit copy action while the password stays masked', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  received = [{ id: 'active-share', owner: 'Fixture owner', status: 'ACTIVE', permission: 'VIEW', credentialId: 'reference-only' }];
  render(<SecureShare />);
  fireEvent.click(screen.getByRole('tab', { name: 'Shared with Me' }));
  expect(await screen.findByText('reference-only')).toBeVisible();
  expect(vaultRequest.mock.calls.some(([path]) => path.endsWith('/credential'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'View shared credential' }));
  const copy = await screen.findByRole('button', { name: 'Copy Password' });
  expect(writeText).not.toHaveBeenCalled();
  fireEvent.click(copy);
  expect(await screen.findByText('Shared password copied.')).toBeVisible();
  expect(writeText).toHaveBeenCalledExactlyOnceWith('synthetic-shared-value');
  expect(screen.queryByText('synthetic-shared-value')).not.toBeInTheDocument();
});

test('a denied read does not expose password controls', async () => {
  received = [{ id: 'stale-share', owner: 'Fixture owner', status: 'ACTIVE' }];
  const fixture = vaultRequest.getMockImplementation();
  vaultRequest.mockImplementation(path => path === '/shares/stale-share/credential'
    ? Promise.reject(new Error('Shared credential unavailable or access expired.'))
    : fixture(path));
  render(<SecureShare />);
  fireEvent.click(screen.getByRole('tab', { name: 'Shared with Me' }));
  fireEvent.click(await screen.findByRole('button', { name: 'View shared credential' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Shared credential unavailable or access expired.');
  expect(screen.queryByRole('button', { name: 'Reveal Password' })).not.toBeInTheDocument();
});

test('sharing history displays authorized metadata and can recover from a load error', async () => {
  const timestamp = '2026-10-19T08:30:00Z';
  history = [
    { id: 'a', action: 'CREDENTIAL_SHARED', result: 'SUCCESS', timestamp, credentialRef: 'credential-reference' },
    { id: 'b', action: 'SHARE_REVOKED', result: 'SUCCESS', timestamp },
    { id: 'c', action: 'SHARE_EXPIRED', result: 'SUCCESS', timestamp },
    { id: 'd', action: 'CREDENTIAL_SHARE_DENIED', result: 'FAILURE', timestamp },
  ];
  const fixture = vaultRequest.getMockImplementation();
  let historyCalls = 0;
  vaultRequest.mockImplementation(path => path === '/shares/history' && ++historyCalls === 1
    ? Promise.reject(new Error('History temporarily unavailable.'))
    : fixture(path));
  render(<SecureShare />);
  fireEvent.click(screen.getByRole('tab', { name: 'Sharing History' }));
  expect(screen.getByRole('status')).toHaveTextContent('Loading sharing history');
  expect(await screen.findByRole('alert')).toHaveTextContent('History temporarily unavailable.');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Credential shared')).toBeVisible();
  expect(screen.getByText('Access revoked')).toBeVisible();
  expect(screen.getByText('Access expired')).toBeVisible();
  expect(screen.getByText('Failed')).toBeVisible();
  const event = screen.getByText('Credential shared').closest('li');
  expect(event).toHaveTextContent('credential-reference');
  expect(event.querySelector('time')).toHaveAttribute('datetime', timestamp);
  expect(screen.queryByText('Recipient reference')).not.toBeInTheDocument();
});
