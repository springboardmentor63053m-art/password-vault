import React, { useCallback, useEffect, useState } from 'react';
import { getStoredToken } from '../services/api';

const createGeneratedPassword = (length, includeUpper, includeNumbers, includeSymbols) => {
  const lowers = 'abcdefghijklmnopqrstuvwxyz';
  const uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nums = '0123456789';
  const syms = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  let chars = lowers;
  if (includeUpper) chars += uppers;
  if (includeNumbers) chars += nums;
  if (includeSymbols) chars += syms;
  let result = '';
  const values = new Uint32Array(length);
  window.crypto.getRandomValues(values);
  for (let index = 0; index < length; index += 1) result += chars[values[index] % chars.length];
  return result;
};

const makeVaultRequest = async (path, options = {}, onLogout) => {
  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${getStoredToken() || ''}`,
      ...(options.headers || {}),
    },
  });
  if (response.status === 401 || response.status === 403) {
    onLogout?.();
    throw new Error('Your session has expired. Please sign in again.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'The vault request could not be completed.');
  }
  return response;
};

const CATEGORIES = [
  'All',
  'Website Login',
  'Email Accounts',
  'Banking Credentials',
  'API Keys',
  'Application Accounts',
  'Secure Notes',
];

export default function VaultDashboard({ currentUser, onLogout }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedSecrets, setRevealedSecrets] = useState({});
  const [copiedField, setCopiedField] = useState(null);

  // Password Generator State
  const [genLength, setGenLength] = useState(16);
  const [includeUpper, setIncludeUpper] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState('');

  // New Item Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newItem, setNewItem] = useState({
    title: '',
    category: 'Website Login',
    username: '',
    website: '',
    secret: '',
  });
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setNewItem({ title: '', category: 'Website Login', username: '', website: '', secret: '' });
  };

  const refreshItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await makeVaultRequest('/api/vault/credentials', {}, onLogout);
      setItems(await response.json());
    } catch (requestError) {
      setError(requestError.message || 'Could not load your vault. Try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    refreshItems();
  }, [refreshItems]);

  useEffect(() => {
    setGeneratedPassword(createGeneratedPassword(16, true, true, true));
  }, []);

  const toggleReveal = async (item) => {
    if (revealedSecrets[item.id] !== undefined) {
      setRevealedSecrets((previous) => {
        const next = { ...previous };
        delete next[item.id];
        return next;
      });
      return;
    }
    try {
      const response = await makeVaultRequest(`/api/vault/credentials/${encodeURIComponent(item.id)}`, {}, onLogout);
      const detail = await response.json();
      setRevealedSecrets((previous) => ({ ...previous, [item.id]: detail.secret }));
    } catch (requestError) {
      setError(requestError.message || 'Could not reveal this credential.');
    }
  };

  const copyToClipboard = async (text, fieldName) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const generatePassword = (length = genLength, upper = includeUpper, numbers = includeNumbers, symbols = includeSymbols) => {
    setGeneratedPassword(createGeneratedPassword(length, upper, numbers, symbols));
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!newItem.title || !newItem.secret) return;
    setSaving(true);
    setError('');
    try {
      const response = await makeVaultRequest(
        editingId ? `/api/vault/credentials/${encodeURIComponent(editingId)}` : '/api/vault/credentials',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem),
        },
        onLogout,
      );
      await response.json();
      setIsModalOpen(false);
      setEditingId(null);
      setNewItem({ title: '', category: 'Website Login', username: '', website: '', secret: '' });
      await refreshItems();
    } catch (requestError) {
      setError(requestError.message || 'Could not save this credential.');
    } finally {
      setSaving(false);
    }
  };

  const editItem = async (item) => {
    setError('');
    try {
      const response = await makeVaultRequest(`/api/vault/credentials/${encodeURIComponent(item.id)}`, {}, onLogout);
      const detail = await response.json();
      setEditingId(item.id);
      setNewItem({
        title: detail.title,
        category: detail.category,
        username: detail.username,
        website: detail.website || '',
        secret: detail.secret,
      });
      setIsModalOpen(true);
    } catch (requestError) {
      setError(requestError.message || 'Could not open this credential.');
    }
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete ${item.title}?`)) return;
    setError('');
    try {
      await makeVaultRequest(`/api/vault/credentials/${encodeURIComponent(item.id)}`, { method: 'DELETE' }, onLogout);
      setRevealedSecrets((previous) => {
        const next = { ...previous };
        delete next[item.id];
        return next;
      });
      await refreshItems();
    } catch (requestError) {
      setError(requestError.message || 'Could not delete this credential.');
    }
  };

  const copySecret = async (item) => {
    try {
      const response = await makeVaultRequest(`/api/vault/credentials/${encodeURIComponent(item.id)}`, {}, onLogout);
      const detail = await response.json();
      await copyToClipboard(detail.secret, `${item.title} secret`);
    } catch (requestError) {
      setError(requestError.message || 'Could not copy this credential.');
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.website || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="vault-dashboard">
      {/* Toast notification */}
      {copiedField && (
        <div className="copy-toast">
          <i className="fa-solid fa-check-circle"></i> Copied {copiedField} to clipboard!
        </div>
      )}
      {error && <p className="vault-request-error" role="alert">
        {error} <button type="button" className="refresh-button" onClick={refreshItems} disabled={loading}>Retry</button>
      </p>}

      {/* Top Banner Stats */}
      <section className="stats-row">
        <div className="stat-card">
          <div className="stat-icon health-icon">
            <i className="fa-solid fa-heart-pulse"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Security Health Score</span>
            <div className="stat-value-group">
              <span className="stat-value">—</span>
              <span className="stat-badge badge-good">Not assessed</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon vault-icon">
            <i className="fa-solid fa-key"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Stored Credentials</span>
            <span className="stat-value">{items.length}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon reused-icon">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Reused Passwords</span>
            <div className="stat-value-group">
              <span className="stat-value">—</span>
              <span className="stat-badge badge-warn">Not assessed</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon breach-icon">
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Compromised / Leaked</span>
            <div className="stat-value-group">
              <span className="stat-value">—</span>
              <span className="stat-badge badge-clean">Not assessed</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid: Vault Items + Password Generator */}
      <div className="dashboard-grid">
        {/* Left: Credential Vault */}
        <section className="vault-main-card">
          <div className="vault-header-row">
            <div>
              <h2 className="section-title">Encrypted Items</h2>
              <p className="section-sub">AES-256-GCM encrypted records in personal vault</p>
            </div>
            <button className="primary-add-btn" onClick={() => {
              setEditingId(null);
              setNewItem({ title: '', category: 'Website Login', username: '', website: '', secret: '' });
              setIsModalOpen(true);
            }}>
              <i className="fa-solid fa-plus"></i> New Credential
            </button>
          </div>

          {/* Controls: Search + Category Filter */}
          <div className="vault-controls-bar">
            <div className="search-box">
              <i className="fa-solid fa-magnifying-glass"></i>
              <input
                type="text"
                placeholder="Search vault items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="category-scroll">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Items Table / List */}
          <div className="vault-items-container">
            {loading ? (
              <div className="empty-vault-placeholder" role="status">Loading your encrypted credentials…</div>
            ) : filteredItems.length === 0 ? (
              <div className="empty-vault-placeholder">
                <i className="fa-solid fa-box-open"></i>
                <p>{error ? 'Your credentials could not be loaded.' : 'No credentials found matching your query.'}</p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isRevealed = revealedSecrets[item.id] !== undefined;
                return (
                  <div key={item.id} className="vault-item-row">
                    <div className="item-icon-box">
                      <i
                        className={`fa-solid ${
                          item.category === 'Banking Credentials'
                            ? 'fa-building-columns'
                            : item.category === 'API Keys'
                            ? 'fa-code'
                            : 'fa-globe'
                        }`}
                      ></i>
                    </div>

                    <div className="item-details">
                      <div className="item-title-row">
                        <span className="item-title">{item.title}</span>
                        <span className="item-category-tag">{item.category}</span>
                      </div>
                      <div className="item-meta-row">
                        <span className="item-user">{item.username}</span>
                        {item.website && <span className="item-web">&bull; {item.website}</span>}
                      </div>
                    </div>

                    <div className="item-secret-area">
                      <span className="secret-display mono">
                        {isRevealed ? revealedSecrets[item.id] : '••••••••••••••••'}
                      </span>
                      <button
                        className="icon-action-btn"
                        onClick={() => toggleReveal(item)}
                        title={isRevealed ? 'Mask' : 'Reveal'}
                      >
                        <i className={`fa-regular ${isRevealed ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                      <button
                        className="icon-action-btn"
                        onClick={() => copySecret(item)}
                        title="Copy secret"
                      >
                        <i className="fa-regular fa-copy"></i>
                      </button>
                      <button className="icon-action-btn" onClick={() => editItem(item)} title="Edit credential">
                        <i className="fa-regular fa-pen-to-square"></i>
                      </button>
                      <button className="icon-action-btn" onClick={() => deleteItem(item)} title="Delete credential">
                        <i className="fa-regular fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right Sidebar: Password Generator & Security Info */}
        <aside className="vault-sidebar">
          {/* Generator Widget */}
          <div className="sidebar-card generator-widget">
            <h3 className="widget-title">
              <i className="fa-solid fa-wand-magic-sparkles"></i> Password Generator
            </h3>

            <div className="generated-output-box">
              <span className="generated-pwd mono">{generatedPassword}</span>
              <button
                className="copy-gen-btn"
                onClick={() => copyToClipboard(generatedPassword, 'generated password')}
                title="Copy generated password"
              >
                <i className="fa-regular fa-copy"></i>
              </button>
            </div>

            <div className="generator-controls">
              <div className="slider-group">
                <div className="slider-header">
                  <span>Length</span>
                  <span className="length-num mono">{genLength}</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="32"
                  value={genLength}
                  onChange={(e) => {
                    const length = Number(e.target.value);
                    setGenLength(length);
                    generatePassword(length);
                  }}
                  className="length-slider"
                />
              </div>

              <div className="toggle-list">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={includeUpper}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIncludeUpper(checked);
                      generatePassword(genLength, checked, includeNumbers, includeSymbols);
                    }}
                  />
                  <span>Uppercase Letters (A-Z)</span>
                </label>
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={includeNumbers}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIncludeNumbers(checked);
                      generatePassword(genLength, includeUpper, checked, includeSymbols);
                    }}
                  />
                  <span>Numbers (0-9)</span>
                </label>
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={includeSymbols}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIncludeSymbols(checked);
                      generatePassword(genLength, includeUpper, includeNumbers, checked);
                    }}
                  />
                  <span>Special Symbols (!@#$)</span>
                </label>
              </div>

              <button className="regenerate-btn" onClick={generatePassword}>
                <i className="fa-solid fa-rotate"></i> Regenerate
              </button>
            </div>
          </div>

          {/* Session & Architecture Badge */}
          <div className="sidebar-card security-spec-card">
            <h4 className="card-subhead">
              <i className="fa-solid fa-circle-check"></i> Active Session
            </h4>
            <div className="spec-item">
              <span className="spec-label">User:</span>
              <span className="spec-val mono">{currentUser?.username || 'vaultuser'}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Token Format:</span>
              <span className="spec-val">JWT Bearer</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Database:</span>
              <span className="spec-val">PostgreSQL 16</span>
            </div>
          </div>
        </aside>
      </div>

      {/* New Credential Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Vault Item' : 'Add New Vault Item'}</h3>
            <button className="modal-close" type="button" onClick={closeModal}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveItem} className="modal-form">
              <div className="input-field-group">
                <label>Title / Service Name</label>
                <input
                  type="text"
                  placeholder="e.g. Netflix, Work VPN"
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  required
                />
              </div>

              <div className="input-field-group">
                <label>Category</label>
                <select
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-field-group">
                <label>Username / Email</label>
                <input
                  type="text"
                  placeholder="e.g. user@example.com"
                  value={newItem.username}
                  onChange={(e) => setNewItem({ ...newItem, username: e.target.value })}
                  required
                />
              </div>

              <div className="input-field-group">
                <label>Website URL (optional)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={newItem.website}
                  onChange={(e) => setNewItem({ ...newItem, website: e.target.value })}
                />
              </div>

              <div className="input-field-group">
                <div className="label-row">
                    <label>Password / Secret</label>
                  <button
                    type="button"
                    className="forgot-link"
                    onClick={() => setNewItem({ ...newItem, secret: generatedPassword })}
                  >
                    Paste Generated
                  </button>
                </div>
                <input
                  type="password"
                  placeholder="Enter secret"
                  value={newItem.secret}
                  onChange={(e) => setNewItem({ ...newItem, secret: e.target.value })}
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-action-btn" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Encrypt & Update' : 'Encrypt & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
