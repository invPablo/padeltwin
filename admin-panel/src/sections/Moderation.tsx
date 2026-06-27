import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { AdminAchievement } from '../types';

const ACHIEVEMENT_LABELS: Record<string, string> = {
  first_match: 'Played first match',
  matches_5: '5 matches played',
  matches_10: '10 matches played',
  matches_25: '25 matches played',
  first_win: 'First win',
  wins_5: '5 wins',
  wins_10: '10 wins',
  wins_25: '25 wins',
  elo_1300: 'Reached 1300 ELO',
  elo_1400: 'Reached 1400 ELO',
  elo_1500: 'Reached 1500 ELO',
};

export default function Moderation() {
  const [items, setItems] = useState<AdminAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.rpc('admin_recent_achievements', { p_limit: 50 });
    setItems((data as AdminAchievement[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    if (!confirm('Remove this post?')) return;
    await supabase.rpc('admin_delete_achievement', { p_achievement_id: id });
    load();
  }

  return (
    <div>
      <h2>Content Moderation</h2>
      <p className="subtitle">Recent posts/achievements feed.</p>
      {loading && <p className="empty">Loading…</p>}
      {!loading && items.length === 0 && <p className="empty">No recent posts.</p>}
      {items.map((a) => (
        <div className="card row" key={a.id}>
          <div>
            <strong>{a.full_name ?? 'Player'}</strong>
            <p className="subtitle" style={{ margin: '2px 0 0' }}>{ACHIEVEMENT_LABELS[a.type] ?? a.type}</p>
          </div>
          <button className="btn btn-danger" onClick={() => remove(a.id)}>
            REMOVE
          </button>
        </div>
      ))}
    </div>
  );
}
