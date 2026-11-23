const groups = { lowercase: 'abcdefghijklmnopqrstuvwxyz', uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', numbers: '0123456789', symbols: '!@#$%^&*()_+-=[]{}:,.?' };
function randomIndex(size) {
  const cutoff = 256 - (256 % size), bytes = new Uint8Array(1);
  do { globalThis.crypto.getRandomValues(bytes); } while (bytes[0] >= cutoff);
  return bytes[0] % size;
}
export function generatePassword(length = 20, options = { lowercase: true, uppercase: true, numbers: true, symbols: true }) {
  if (!Number.isInteger(length) || length < 12 || length > 128) throw new Error('Choose a length from 12 to 128.');
  const selected = Object.entries(groups).filter(([key]) => options[key]).map(([, value]) => value);
  if (!selected.length) throw new Error('Select at least one character group.');
  const alphabet = selected.join('');
  const result = selected.map(group => group[randomIndex(group.length)]);
  while (result.length < length) result.push(alphabet[randomIndex(alphabet.length)]);
  for (let i = result.length - 1; i > 0; i--) { const j = randomIndex(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result.join('');
}
export function assessPassword(value = '') {
  const count = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(pattern => pattern.test(value)).length;
  const guessed = !value || /^(.)\1{3,}$/.test(value) || ['password', '123456', 'qwerty', 'letmein', 'iloveyou', 'welcome', 'admin'].some(word => value.toLowerCase().includes(word));
  const score = guessed ? Math.min(15, value.length) : Math.min(100, Math.min(60, value.length * 3) + count * 10);
  const suggestions = [];
  if (value.length < 16) suggestions.push('Use at least 16 characters; longer unique passwords are preferable.');
  if (guessed) suggestions.push('Avoid common passwords, sequences and repeated characters.');
  if (count < 3) suggestions.push('Consider a longer random password or varied character groups.');
  suggestions.push('Use a unique password for each account. This is not a breach check.');
  return { score, strength: score < 20 ? 'Very Weak' : score < 40 ? 'Weak' : score < 70 ? 'Moderate' : score < 90 ? 'Strong' : 'Very Strong', suggestions };
}

/**
 * Checks if a password has appeared in known data breaches using the
 * Have I Been Pwned (HIBP) k-Anonymity API.
 * Uses Web Crypto API to compute SHA-1; sends only the first 5 characters over the wire.
 */
export async function checkPasswordBreach(password) {
  if (!password) {
    return { breached: false, count: 0, message: 'No password provided.' };
  }
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'Add-Padding': 'true',
      },
    });

    if (!res.ok) {
      return { breached: false, count: 0, message: 'Breach database service unavailable.' };
    }

    const text = await res.text();
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const [hashPart, countStr] = line.split(':');
      if (hashPart && hashPart.trim().toUpperCase() === suffix.toUpperCase()) {
        const count = parseInt(countStr.trim(), 10) || 0;
        return {
          breached: true,
          count,
          message: `Compromised! This password was found in ${count.toLocaleString()} known data breaches.`,
        };
      }
    }
    return {
      breached: false,
      count: 0,
      message: 'Good news: this password was not found in any known public data breaches.',
    };
  } catch (err) {
    return {
      breached: false,
      count: 0,
      message: 'Breach check could not be completed (network or provider offline).',
      error: err.message,
    };
  }
}
