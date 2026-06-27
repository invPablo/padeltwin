import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { AdminLeague, AdminLeagueMember } from '../types';

export default function Leagues() {
  const [leagues, setLeagues] = useState<AdminLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminLeague | null>(null);
  const [members, setMembers] = useState<AdminLeagueMember[]>([]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.rpc('admin_list_leagues');
    setLeagues((data as AdminLeague[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function openLeague(l: AdminLeague) {
    setSelected(l);
    const { data } = await supabase.rpc('admin_league_members', { p_league_id: l.id });
    setMembers((data as AdminLeagueMember[]) ?? []);
  }

  async function remove(id: string) {
    if (!confirm('Delete this league?')) return;
    await supabase.rpc('admin_delete_league', { p_league_id: id });
    load();
  }

  return (
    <div>
      <h2>Leagues</h2>
      <p className="subtitle">Oversee private leagues created by users.</p>
      {loading && <p className="empty">Loading…</p>}
      {!loading && leagues.length === 0 && <p className="empty">No leagues yet.</p>}
      {leagues.map((l) => (
        <div className="card row" key={l.id}>
          <div style={{ cursor: 'pointer' }} onClick={() => openLeague(l)}>
            <strong>{l.name}</strong>
            <p className="subtitle" style={{ margin: '2px 0 0' }}>
              {l.member_count} members · created by {l.creator_name ?? 'someone'} · code {l.invite_code}
            </p>
          </div>
          <button className="btn btn-danger" onClick={() => remove(l.id)}>
            DELETE
          </button>
        </div>
      ))}

      {selected && (
        <div className="login-screen" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={() => setSelected(null)}>
          <div className="login-card" style={{ width: 360, maxHeight: '70vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h1>{selected.name.toUpperCase()}</h1>
            <table>
              <tbody>
                {members.map((m) => (
                  <tr key={m.profile_id}>
                    <td>{m.full_name ?? 'Player'}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 700 }}>{m.elo} ELO</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-outline full-width" style={{ marginTop: 16 }} onClick={() => setSelected(null)}>
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
