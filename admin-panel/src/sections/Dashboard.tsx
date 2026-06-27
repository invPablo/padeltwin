import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { AdminDashboardStats } from '../types';

export default function Dashboard() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);

  useEffect(() => {
    supabase.rpc('admin_dashboard_stats').then(({ data }) => {
      setStats((data as AdminDashboardStats[])?.[0] ?? null);
    });
  }, []);

  return (
    <div>
      <h2>Dashboard</h2>
      <p className="subtitle">Overview of the app.</p>
      <div className="stats-grid">
        <Stat label="PLAYERS" value={stats?.total_players} />
        <Stat label="CONFIRMED MATCHES" value={stats?.total_confirmed_matches} />
        <Stat label="AVG ELO" value={stats?.average_elo} />
        <Stat label="SIGNUPS (7D)" value={stats?.signups_last_7_days} />
        <Stat label="PENDING COACHES" value={stats?.pending_coach_applications} />
        <Stat label="OPEN REPORTS" value={stats?.open_reports} />
        <Stat label="ACTIVE TOURNAMENTS" value={stats?.active_tournaments} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
