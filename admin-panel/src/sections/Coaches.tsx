import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { Profile } from '../types';

export default function Coaches() {
  const [coaches, setCoaches] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.rpc('admin_list_pending_coaches');
    setCoaches((data as Profile[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(profileId: string, status: string) {
    await supabase.rpc('admin_set_coach_status', { p_profile_id: profileId, p_status: status });
    load();
  }

  return (
    <div>
      <h2>Coach Applications</h2>
      <p className="subtitle">Review and approve/reject pending coaches.</p>
      {loading && <p className="empty">Loading…</p>}
      {!loading && coaches.length === 0 && <p className="empty">No pending coach applications.</p>}
      {coaches.map((c) => (
        <div className="card" key={c.id}>
          <strong>{c.full_name ?? 'Player'}</strong>
          {c.coach_bio && <p style={{ fontSize: 13, marginTop: 6 }}>{c.coach_bio}</p>}
          <p className="subtitle" style={{ marginTop: 4, marginBottom: 8 }}>
            {c.coach_hourly_rate != null ? `£${c.coach_hourly_rate}/hr` : ''} {c.coach_years_experience != null ? `· ${c.coach_years_experience} yrs exp` : ''}{' '}
            {c.coach_specialties ?? ''}
          </p>
          <div className="row">
            <button className="btn btn-accent" onClick={() => setStatus(c.id, 'approved')}>
              APPROVE
            </button>
            <button className="btn btn-danger" onClick={() => setStatus(c.id, 'rejected')}>
              REJECT
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
