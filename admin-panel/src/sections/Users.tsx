import { useState } from 'react';
import { supabase } from '../supabase';
import type { Profile } from '../types';

export default function Users() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  async function search(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase.rpc('admin_search_profiles', { p_query: q });
    setResults((data as Profile[]) ?? []);
    setLoading(false);
  }

  async function setBanned(profileId: string, banned: boolean) {
    if (banned && !confirm('Ban this player? They will be signed out and unable to use the app.')) return;
    await supabase.rpc('admin_set_banned', { p_profile_id: profileId, p_banned: banned, p_reason: null });
    search(query);
  }

  async function setPro(profileId: string, isPro: boolean) {
    await supabase.rpc('admin_set_pro', { p_profile_id: profileId, p_is_pro: isPro });
    search(query);
  }

  return (
    <div>
      <h2>Accounts</h2>
      <p className="subtitle">Search players, ban/unban, grant Pro.</p>
      <input
        className="full-width"
        placeholder="Search by name or zone…"
        value={query}
        onChange={(e) => search(e.target.value)}
        style={{ marginBottom: 16 }}
      />
      {loading && <p className="empty">Searching…</p>}
      {!loading && query.trim() && results.length === 0 && <p className="empty">No matches.</p>}
      {results.map((p) => (
        <div className="card row" key={p.id}>
          <div>
            <strong>
              {p.full_name ?? 'Player'} {p.is_banned ? '🚫' : ''} {p.is_pro ? '⭐' : ''}
            </strong>
            <p className="subtitle" style={{ margin: '4px 0 0' }}>
              {p.zone ?? 'No zone'} · ELO {p.elo} · {p.coach_status}
            </p>
            {p.is_banned && p.banned_reason && <p style={{ color: 'var(--danger)', fontSize: 11 }}>Reason: {p.banned_reason}</p>}
          </div>
          <div className="row">
            <button className={`btn ${p.is_pro ? 'btn-accent' : 'btn-muted'}`} onClick={() => setPro(p.id, !p.is_pro)}>
              {p.is_pro ? 'UNSET PRO' : 'SET PRO'}
            </button>
            <button className={`btn ${p.is_banned ? 'btn-muted' : 'btn-danger'}`} onClick={() => setBanned(p.id, !p.is_banned)}>
              {p.is_banned ? 'UNBAN' : 'BAN'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
