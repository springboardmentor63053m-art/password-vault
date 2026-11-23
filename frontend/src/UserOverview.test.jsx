import React from 'react';
import {afterEach,expect,test,vi} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import VaultOverview from './components/VaultOverview';
import {vaultApi} from './services/vaultApi';
vi.mock('./services/vaultApi',()=>({vaultApi:{overview:vi.fn()}}));
afterEach(cleanup);
test('overview displays server statistics and does not invent an empty-vault score',async()=>{
 vaultApi.overview.mockResolvedValue({health:{total:0,strong:0,moderate:0,weak:0,reused:0,score:null,warnings:[]},sharedByMe:0,sharedWithMe:0,recentActivities:[],suggestions:['Add a credential to calculate health.']});
 render(<VaultOverview/>);expect(await screen.findByText('Not assessed')).toBeInTheDocument();expect(screen.getByText('No vault activity recorded yet.')).toBeInTheDocument();expect(screen.queryByText('100/100')).not.toBeInTheDocument();
});
test('overview renders actual counts and improvement suggestions',async()=>{
 vaultApi.overview.mockResolvedValue({health:{total:7,strong:4,moderate:2,weak:1,reused:2,score:64,warnings:[]},sharedByMe:3,sharedWithMe:1,recentActivities:[],suggestions:['Replace reused passwords.']});
 render(<VaultOverview/>);expect(await screen.findByText('64/100')).toBeInTheDocument();expect(screen.getByText('Replace reused passwords.')).toBeInTheDocument();expect(screen.getByText('7')).toBeInTheDocument();
});
