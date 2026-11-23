import React, { useEffect, useState } from 'react';
import { getSharingActivity } from './adminApi';

const statuses = [['ALL', 'All'], ['ACTIVE', 'Active'], ['EXPIRED', 'Expired'], ['REVOKED', 'Revoked'], ['CONSUMED', 'Consumed'], ['PENDING_VERIFICATION', 'Pending verification'], ['DELIVERY_FAILED', 'Delivery failed']];
const statusLabels = Object.fromEntries(statuses);
const statusStyles = { ACTIVE: 'good', EXPIRED: 'review', REVOKED: 'sharing-revoked' };
const permissions = { VIEW: 'View only', EDIT: 'Edit', FULL_MANAGEMENT: 'Full management' };
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const formatDate = value => value ? dateFormat.format(new Date(value)) : 'No expiration';

export default function SharingActivity({ onAuditTrail, onAuthError, Pagination }) {
  const [type, setType] = useState('ALL');
  const [filter, setFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [requestVersion, setRequestVersion] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getSharingActivity({ status: filter, page, ...(type !== 'ALL' ? { type } : {}) }).then(data => {
      if (!active) return;
      const lastPage = Math.max(0, Math.ceil(data.total / data.size) - 1);
      if (page > lastPage) setPage(lastPage);
      else setResult(data);
    }).catch(requestError => {
      if (!active) return;
      if (requestError.status === 401 || requestError.status === 403) onAuthError?.(requestError);
      setError(requestError.message || 'Sharing activity could not be loaded.');
    });
    return () => { active = false; };
  }, [filter, type, page, requestVersion, onAuthError]);

  function selectPage(nextPage) {
    setResult(null);
    setError('');
    setPage(nextPage);
  }

  function selectFilter(nextFilter) {
    if (nextFilter === filter) return;
    selectPage(0);
    setFilter(nextFilter);
  }

  const loading = !result && !error;

  return (
    <section className="panel sharing-activity-panel" aria-label="Sharing records" aria-busy={loading}>
      <div className="table-toolbar">
        <div><h2>Credential shares</h2><p>Review sharing metadata, including expired and revoked access.</p></div>
        <button type="button" className="panel-link" onClick={onAuditTrail}>View audit trail <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
      </div>
      <div className="filter-row sharing-activity-filters" role="group" aria-label="Share status">
        {statuses.map(([value, label]) => (
          <button key={value} type="button" className={`filter-chip ${filter === value ? 'selected' : ''}`}
            aria-pressed={filter === value} onClick={() => selectFilter(value)}>{label}</button>
        ))}
      </div>
      <div className="filter-row sharing-activity-filters">
        <label>Sharing type <select value={type} onChange={event => { selectPage(0); setType(event.target.value); }}>
          <option value="ALL">All shares</option><option value="INTERNAL">Internal</option><option value="EXTERNAL">External</option>
        </select></label>
      </div>
      {loading && <div className="empty-state" role="status">Loading sharing activity…</div>}
      {error && <div className="empty-state">
        <strong role="alert">{error}</strong>
        <button type="button" className="panel-link" onClick={() => {
          setError('');
          setRequestVersion(version => version + 1);
        }}>Try again</button>
      </div>}
      {result && !result.items.length && <div className="empty-state" role="status">
        <strong>No shares found</strong>
        <p>{filter === 'ALL' ? 'Shared credentials will appear here.' : 'Try another status to see more shares.'}</p>
      </div>}
      {result?.items.length > 0 && <>
        <div className="audit-table-wrap sharing-activity-scroll" role="region" aria-label="Credential sharing table" tabIndex={0}>
          <table className="data-table audit-table sharing-activity-table">
            <thead><tr>{['Shared by', 'Shared with', 'Credential reference', 'Shared date and time', 'Permission', 'Expiration date', 'Status', 'Type', 'Last accessed'].map(label =>
              <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{result.items.map(share => (
              <tr key={share.id}>
                <td><strong>{share.sender}</strong></td>
                <td>{share.recipient}</td>
                <td><code className="mono-text">{share.credentialRef}</code></td>
                <td><time dateTime={share.createdAt}>{formatDate(share.createdAt)}</time></td>
                <td>{permissions[share.permission] || share.permission}</td>
                <td>{share.expiresAt ? <time dateTime={share.expiresAt}>{formatDate(share.expiresAt)}</time> : 'No expiration'}</td>
                <td><span className={`activity-status ${statusStyles[share.status] || 'review'}`}><i aria-hidden="true" />{statusLabels[share.status] || share.status}</span></td>
                <td>{share.type === 'EXTERNAL' ? 'External' : 'Internal'}</td>
                <td>{share.accessedAt ? <time dateTime={share.accessedAt}>{formatDate(share.accessedAt)}</time> : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <Pagination pageData={result} onChange={selectPage} />
      </>}
    </section>
  );
}
