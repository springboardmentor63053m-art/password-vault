import React from 'react';
import {afterEach,expect,test,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import NotificationsPanel from './components/NotificationsPanel';
import {vaultRequest} from './services/vaultApi';
vi.mock('./services/vaultApi',()=>({vaultRequest:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
test('notification history renders API values and marking read is persisted through the backend',async()=>{
 const item={id:'fixture-notice',title:'Credential added',message:'Metadata only.',read:false,createdAt:'2026-11-03T00:00:00Z'};
 vaultRequest.mockImplementation(async(path,options)=>options?null:{items:[item],total:1,unread:1,page:0,size:20});
 const unread=vi.fn();render(<NotificationsPanel onUnreadChange={unread}/>);
 expect(await screen.findByText('Credential added')).toBeInTheDocument();expect(unread).toHaveBeenCalledWith(1);
 fireEvent.click(screen.getByRole('button',{name:'Mark as read'}));await waitFor(()=>expect(vaultRequest).toHaveBeenCalledWith('/notifications/fixture-notice/read',{method:'PUT'}));
});
test('empty history is explicit and pagination is bounded',async()=>{
 vaultRequest.mockResolvedValue({items:[],total:0,unread:0,page:0,size:20});render(<NotificationsPanel/>);
 expect(await screen.findByText('No matching notifications.')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Next notifications'})).toBeDisabled();expect(screen.getByRole('button',{name:'Previous notifications'})).toBeDisabled();
});
