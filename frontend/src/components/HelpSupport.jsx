import React from 'react';
import './SecurityWorkspace.css';

const topics = [
  { title: 'Vault Management', icon: 'fa-vault', questions: [
    ['How do I save a credential?', 'Open My Vault, add a credential, choose a category, and save. Reveal and copy are explicit actions.'],
    ['How are credentials protected?', 'Credential contents are encrypted on the server. This is not a zero-knowledge vault. Use HTTPS outside local development.'],
    ['How should I choose a password?', 'Use the random generator and a unique password of at least 16 characters. Strength and reuse checks are local heuristics, not a breach lookup.'],
    ['What does password health measure?', 'It measures the strength and reuse of your own live vault passwords. It does not prove that a password is safe or uncompromised.'],
  ] },
  { title: 'Security & MFA', icon: 'fa-shield-halved', questions: [
    ['How do I enable MFA?', 'Open Account Security, enter your current password in the existing authenticator setup, scan the QR privately, and confirm with the current authenticator code. Never share the QR or seed.'],
    ['What if I lose my authenticator?', 'Recovery codes are not currently available. Keep access to your authenticator and follow your project administrator’s recovery procedure. Never send anyone your seed or verification code.'],
    ['What can administrators see?', 'Administrative monitoring shows activity and security metadata. Vault passwords and notes are not included in monitoring.'],
  ] },
  { title: 'Sharing', icon: 'fa-share-nodes', questions: [
    ['How does sharing work?', 'Find the exact registered username or email, select the recipient, and grant View-only access. Access starts immediately without acceptance and includes credential contents and notes.'],
    ['Can I revoke a share?', 'The owner can revoke access or change expiry. Expiry is enforced when the recipient reads. Revocation cannot erase copies already made.'],
  ] },
  { title: 'Troubleshooting', icon: 'fa-circle-question', questions: [
    ['How do I report a problem?', 'Use your team’s established support channel. No support address is configured here. Describe the issue without passwords, tokens, MFA codes, QR images, or vault contents.'],
  ] },
];

export default function HelpSupport() {
  return (
    <section className="sv-settings sv-support" aria-label="Frequently asked questions">
      {topics.map(({ title, icon, questions }) => (
        <section className="sv-card" key={title}>
          <header className="sv-heading">
            <span className="sv-icon" aria-hidden="true"><i className={'fa-solid ' + icon} /></span>
            <h2>{title}</h2>
          </header>
          <div className="sv-list">
            {questions.map(([question, answer]) => (
              <details className="sv-faq" key={question}>
                <summary>
                  <span>{question}</span>
                  <i className="fa-solid fa-chevron-down" aria-hidden="true" />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
