import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { AdminReport } from '../types';

export default function Reports() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.rpc('admin_list_reports', { p_status: 'open' });
    setReports((data as AdminReport[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function resolve(id: string, status: string) {
    await supabase.rpc('admin_resolve_report', { p_report_id: id, p_status: status });
    load();
  }

  return (
    <div>
      <h2>Reports</h2>
      <p className="subtitle">User-submitted reports awaiting review.</p>
      {loading && <p className="empty">Loading…</p>}
      {!loading && reports.length === 0 && <p className="empty">No open reports.</p>}
      {reports.map((r) => (
        <div className="card" key={r.id}>
          <p style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 11, letterSpacing: 0.5 }}>
            {r.target_type.toUpperCase()} · reported by {r.reporter_name ?? 'someone'}
          </p>
          <p style={{ fontWeight: 700, marginTop: 4 }}>{r.reason}</p>
          {r.details && <p className="subtitle">{r.details}</p>}
          <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>target: {r.target_id}</p>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn-muted" onClick={() => resolve(r.id, 'dismissed')}>
              DISMISS
            </button>
            <button className="btn btn-accent" onClick={() => resolve(r.id, 'reviewed')}>
              MARK REVIEWED
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
