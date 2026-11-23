import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { generatePassword, assessPassword, checkPasswordBreach } from './services/passwords';
import PasswordGenerator, { PasswordAssessment } from './components/PasswordGenerator';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
test('generation is cryptographic, length-bounded and includes each selected group',()=>{
 vi.spyOn(Math,'random').mockImplementation(()=>{throw new Error('Unsafe random source');});
 for(let i=0;i<50;i++){
  const value=generatePassword(20);expect(value.length===20).toBe(true);
  for(const pattern of [/[a-z]/,/[A-Z]/,/[0-9]/,/[^a-zA-Z0-9]/])expect(pattern.test(value)).toBe(true);
 }
 expect(/^[a-z]{16}$/.test(generatePassword(16,{lowercase:true}))).toBe(true);
 expect(()=>generatePassword(11)).toThrow();expect(()=>generatePassword(129)).toThrow();expect(()=>generatePassword(20,{})).toThrow();
});
test('strength and advice match the documented backend heuristic',()=>{
 expect(assessPassword('password123').strength).toBe('Very Weak');
 expect(assessPassword('aaaaaaaaaaaaaaaaaaaa').strength).toBe('Very Weak');
 expect(assessPassword('aB4!xY7#qR2$mN8@').score>=70).toBe(true);
 render(<PasswordAssessment password="short"/>);expect(screen.getByText(/Use at least 16 characters/)).toBeInTheDocument();expect(screen.getByText(/not a breach check/)).toBeInTheDocument();
});
test('generator updates the form through its callback without logging or storing a password',()=>{
 const callback=vi.fn();render(<PasswordGenerator onGenerate={callback}/>);
 fireEvent.click(screen.getByRole('button',{name:'Generate password'}));expect(callback).toHaveBeenCalledTimes(1);expect(callback.mock.calls[0][0].length).toBe(20);
});
test('checkPasswordBreach detects compromised passwords via k-Anonymity API',async()=>{
 globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  text: async () => "0018A45C4D1DEF:2\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:45210\r\nFFFFFFFFFFFF:1"
 });
 const result = await checkPasswordBreach('password');
 expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/api\.pwnedpasswords\.com\/range\/[0-9A-F]{5}$/), expect.any(Object));
 expect(result.breached).toBe(true);
 expect(result.count).toBe(45210);
});
test('PasswordAssessment allows user to trigger breach check interactively',async()=>{
 globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  text: async () => "1E4C9B93F3F0682250B6CF8331B7EE68FD8:45210"
 });
 render(<PasswordAssessment password="password"/>);
 const breachBtn = screen.getByRole('button', { name: /check data breaches/i });
 expect(breachBtn).toBeInTheDocument();
 fireEvent.click(breachBtn);
 await waitFor(() => expect(screen.getByText(/BREACH WARNING:/i)).toBeInTheDocument());
});
