import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { AdminCollusionCandidate } from '../types';

export default function Collusion() {
  const [candidates, setCandidates] = useState<AdminCollusionCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .rpc('admin_collusion_candidates', { p_repeat_ratio_threshold: 0.6, p_min_matches: 5 })
      .then(({ data }) => {
        setCandidates((data as AdminCollusionCandidate[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <h2>Collusion Watch</h2>
      <p className="subtitle">
        Players whose confirmed matches are heavily concentrated against one opponent, combined with fast recent ELO
        gain. Not auto-enforced — review and decide manually.
      </p>
      {loading && <p className="empty">Loading…</p>}
      {!loading && candidates.length === 0 && <p className="empty">No flagged players right now.</p>}
      {candidates.map((c) => (
        <div className="card" key={c.profile_id}>
          <strong>{c.full_name ?? 'Player'}</strong>
          <p className="subtitle" style={{ margin: '4px 0' }}>
            {c.total_matches} matches · {c.distinct_opponents} distinct opponents
          </p>
          <p style={{ fontSize: 12, fontWeight: 700 }}>
            {Math.round(c.repeat_ratio * 100)}% of matches vs {c.top_opponent_name ?? 'one player'} ({c.top_opponent_matches} games)
          </p>
          <p style={{ fontSize: 12, fontWeight: 700, color: c.elo_gain_last_10 > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
            ELO gain (last 10): {c.elo_gain_last_10 > 0 ? '+' : ''}
            {c.elo_gain_last_10}
          </p>
        </div>
      ))}
    </div>
  );
}
