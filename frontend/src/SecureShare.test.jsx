import React from 'react';
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import SecureShare from './components/SecureShare';
import {vaultApi,vaultRequest} from './services/vaultApi';
vi.mock('./services/vaultApi',()=>({vaultApi:{list:vi.fn()},vaultRequest:vi.fn()}));
let sent,received;
beforeEach(()=>{
 vi.clearAllMocks();sent=[];received=[];vaultApi.list.mockResolvedValue([{id:'owned-item',title:'Owned fixture'}]);
 vaultRequest.mockImplementation(async(path)=>{
  if(path==='/shares/sent')return sent;if(path==='/shares/received')return received;if(path==='/shares/history')return [];
  if(path.startsWith('/shares/recipients?'))return [{id:'recipient-id',username:'fixture-recipient'}];
  if(path.endsWith('/credential'))return {title:'Received fixture',username:'fixture-user',password:'synthetic-shared-value',notes:''};
  return null;
 });
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
test('failed sharing requests do not report a successful empty history',async()=>{
 vaultRequest.mockRejectedValueOnce(new Error('Backend unavailable.'));render(<SecureShare/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('Backend unavailable.');expect(screen.queryByText('No received shares.')).not.toBeInTheDocument();expect(screen.queryByText('No sharing activity yet.')).not.toBeInTheDocument();
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
 received=[{id:'active-share',owner:'Fixture owner',status:'ACTIVE'},{id:'expired-share',owner:'Other fixture',status:'EXPIRED'}];
 render(<SecureShare/>);fireEvent.click(screen.getByRole('tab',{name:'Shared with Me'}));await screen.findByText('From Fixture owner');
 expect(screen.getAllByRole('button',{name:'View shared credential'})).toHaveLength(1);
 fireEvent.click(screen.getByRole('button',{name:'View shared credential'}));await screen.findByRole('heading',{name:'Received fixture'});
 expect(screen.queryByText('synthetic-shared-value')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Show shared password'}));expect(screen.getByText('synthetic-shared-value')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Close shared credential'}));expect(screen.queryByText('synthetic-shared-value')).not.toBeInTheDocument();
});
test('owner revocation calls the backend and retains history UI',async()=>{
 sent=[{id:'owned-share',credentialId:'owned-item',recipient:'Fixture recipient',status:'ACTIVE',expiresAt:null}];
 vi.spyOn(window,'confirm').mockReturnValue(true);render(<SecureShare/>);await screen.findByText('To Fixture recipient');
 fireEvent.click(screen.getByRole('button',{name:'Revoke access'}));
 await waitFor(()=>expect(vaultRequest).toHaveBeenCalledWith('/shares/owned-share',{method:'DELETE'}));
 fireEvent.click(screen.getByRole('tab',{name:'Sharing History'}));expect(screen.getByRole('heading',{name:'Sharing History'})).toBeInTheDocument();
});
