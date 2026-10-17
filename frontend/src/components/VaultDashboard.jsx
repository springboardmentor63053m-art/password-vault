import React, { useState } from 'react';

const INITIAL_VAULT_ITEMS = [
  {
    id: '1',
    title: 'GitHub Enterprise',
    category: 'API Keys',
    username: 'octocat_dev',
    website: 'https://github.com',
    secret: 'ghp_984j10aKlmnOP901ZqX',
    strength: 'Strong',
    lastUpdated: '2 hours ago',
  },
  {
    id: '2',
    title: 'AWS Production Console',
    category: 'Website Login',
    username: 'cloudadmin@securevault.io',
    website: 'https://aws.amazon.com',
    secret: 'K9#vL2$pQ8*wE5!m',
    strength: 'Very Strong',
    lastUpdated: 'Yesterday',
  },
  {
    id: '3',
    title: 'Chase Business Banking',
    category: 'Banking Credentials',
    username: 'corp_treasury',
    website: 'https://chase.com',
    secret: 'Tr3@sury!2026#Vault',
    strength: 'Very Strong',
    lastUpdated: '3 days ago',
  },
  {
    id: '4',
    title: 'PostgreSQL Database Master',
    category: 'Application Accounts',
    username: 'postgres',
    website: 'localhost:5432',
    secret: 'postgrespassword',
    strength: 'Medium',
    lastUpdated: 'Just now',
  },
  {
    id: '5',
    title: 'Slack Workspace Token',
    category: 'API Keys',
    username: 'bot_integration',
    website: 'https://slack.com',
    secret: 'xoxb-89104-129031-v9aL0',
    strength: 'Strong',
    lastUpdated: '1 week ago',
  },
];

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
  const [items, setItems] = useState(INITIAL_VAULT_ITEMS);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedIds, setRevealedIds] = useState({});
  const [copiedField, setCopiedField] = useState(null);

  // Password Generator State
  const [genLength, setGenLength] = useState(16);
  const [includeUpper, setIncludeUpper] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState('v8#Kq2$L9@pM5!zR');

  // New Item Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    title: '',
    category: 'Website Login',
    username: '',
    website: '',
    secret: '',
  });

  const toggleReveal = (id) => {
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const generatePassword = () => {
    const lowers = 'abcdefghijklmnopqrstuvwxyz';
    const uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';
    const syms = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let chars = lowers;
    if (includeUpper) chars += uppers;
    if (includeNumbers) chars += nums;
    if (includeSymbols) chars += syms;

    let res = '';
    const array = new Uint32Array(genLength);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < genLength; i++) {
      res += chars[array[i] % chars.length];
    }
    setGeneratedPassword(res);
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItem.title || !newItem.secret) return;

    const item = {
      id: Date.now().toString(),
      ...newItem,
      strength: 'Strong',
      lastUpdated: 'Just now',
    };
    setItems([item, ...items]);
    setIsModalOpen(false);
    setNewItem({ title: '', category: 'Website Login', username: '', website: '', secret: '' });
  };

  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.website.toLowerCase().includes(searchQuery.toLowerCase());
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

      {/* Top Banner Stats */}
      <section className="stats-row">
        <div className="stat-card">
          <div className="stat-icon health-icon">
            <i className="fa-solid fa-heart-pulse"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Security Health Score</span>
            <div className="stat-value-group">
              <span className="stat-value">94%</span>
              <span className="stat-badge badge-good">Optimal</span>
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
              <span className="stat-value">1</span>
              <span className="stat-badge badge-warn">Attention</span>
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
              <span className="stat-value">0</span>
              <span className="stat-badge badge-clean">Protected</span>
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
            <button className="primary-add-btn" onClick={() => setIsModalOpen(true)}>
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
            {filteredItems.length === 0 ? (
              <div className="empty-vault-placeholder">
                <i className="fa-solid fa-box-open"></i>
                <p>No credentials found matching your query.</p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isRevealed = !!revealedIds[item.id];
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
                        {isRevealed ? item.secret : '••••••••••••••••'}
                      </span>
                      <button
                        className="icon-action-btn"
                        onClick={() => toggleReveal(item.id)}
                        title={isRevealed ? 'Mask' : 'Reveal'}
                      >
                        <i className={`fa-regular ${isRevealed ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                      <button
                        className="icon-action-btn"
                        onClick={() => copyToClipboard(item.secret, `${item.title} password`)}
                        title="Copy password"
                      >
                        <i className="fa-regular fa-copy"></i>
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
                    setGenLength(Number(e.target.value));
                    generatePassword();
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
                      setIncludeUpper(e.target.checked);
                      generatePassword();
                    }}
                  />
                  <span>Uppercase Letters (A-Z)</span>
                </label>
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={includeNumbers}
                    onChange={(e) => {
                      setIncludeNumbers(e.target.checked);
                      generatePassword();
                    }}
                  />
                  <span>Numbers (0-9)</span>
                </label>
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={includeSymbols}
                    onChange={(e) => {
                      setIncludeSymbols(e.target.checked);
                      generatePassword();
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
              <span className="spec-val">JJWT HMAC-SHA384</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Database:</span>
              <span className="spec-val">PostgreSQL 16 pgcrypto</span>
            </div>
          </div>
        </aside>
      </div>

      {/* New Credential Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Vault Item</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleAddItem} className="modal-form">
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
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-action-btn">
                  Encrypt & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
