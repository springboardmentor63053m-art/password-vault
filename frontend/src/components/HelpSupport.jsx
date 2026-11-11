import React from 'react';
export default function HelpSupport(){return <section className="user-vault-panel"><h2>Help &amp; Support</h2>{[
 ['How do I save a credential?','Open My Vault, add a credential, choose a category, and save. Reveal and copy are explicit actions.'],
 ['How are credentials protected?','Credential contents are encrypted on the server. This is not a zero-knowledge vault. Use HTTPS outside local development.'],
 ['How should I choose a password?','Use the random generator and a unique password of at least 16 characters. Strength and reuse checks are local heuristics, not a breach lookup.'],
 ['How does sharing work?','Find the exact registered username or email, select the recipient, and grant View-only access. Access starts immediately without acceptance and includes credential contents and notes.'],
 ['Can I revoke a share?','The owner can revoke access or change expiry. Expiry is enforced when the recipient reads. Revocation cannot erase copies already made.'],
 ['How do I enable MFA?','Open Account Security, enter your current password in the existing authenticator setup, scan the QR privately, and confirm with the current authenticator code. Never share the QR or seed.'],
 ['What if I lose my authenticator?','Recovery codes are not currently available. Keep access to your authenticator and follow your project administrator’s recovery procedure. Never send anyone your seed or verification code.'],
 ['What does password health measure?','It measures the strength and reuse of your own live vault passwords. It does not prove that a password is safe or uncompromised.'],
 ['What can administrators see?','Administrative monitoring shows activity and security metadata. Vault passwords and notes are not included in monitoring.'],
 ['How do I report a problem?','Use your team’s established support channel. No support address is configured here. Describe the issue without passwords, tokens, MFA codes, QR images, or vault contents.']
 ].map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>;}
