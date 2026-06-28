import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { Profile, SetScore, Tournament, TournamentFormat, TournamentMatch, TournamentParticipant } from '../types';

function entrantName(participants: TournamentParticipant[], entrantId: string | null) {
  if (!entrantId) return 'TBD';
  const p = participants.find((x) => x.id === entrantId);
  if (!p) return 'TBD';
  const a = p.profile?.full_name ?? 'Player';
  return p.partner ? `${a} / ${p.partner.full_name ?? 'Partner'}` : a;
}

function NewTournamentForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [zone, setZone] = useState('');
  const [format, setFormat] = useState<TournamentFormat>('round_robin');
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.rpc('admin_create_tournament', { p_name: name.trim(), p_format: format, p_zone: zone.trim() || null, p_starts_at: null });
    setSaving(false);
    setOpen(false);
    setName('');
    setZone('');
    onCreated();
  }

  if (!open) {
    return (
      <button className="btn btn-accent full-width" style={{ marginBottom: 16, padding: 14 }} onClick={() => setOpen(true)}>
        + NEW TOURNAMENT
      </button>
    );
  }

  return (
    <div className="card">
      <label className="label">NAME</label>
      <input className="full-width" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Cup" />
      <label className="label">ZONE (optional)</label>
      <input className="full-width" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="e.g. London" />
      <label className="label">FORMAT</label>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
        <button className={`chip ${format === 'round_robin' ? 'active' : ''}`} onClick={() => setFormat('round_robin')}>
          Round robin
        </button>
        <button className={`chip ${format === 'bracket' ? 'active' : ''}`} onClick={() => setFormat('bracket')}>
          Bracket
        </button>
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-outline" onClick={() => setOpen(false)}>
          CANCEL
        </button>
        <button className="btn btn-accent" disabled={!name.trim() || saving} onClick={create}>
          CREATE
        </button>
      </div>
    </div>
  );
}

function TournamentDetail({ tournament, onBack, onChanged }: { tournament: Tournament; onBack: () => void; onChanged: () => void }) {
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [pairSelection, setPairSelection] = useState<string[]>([]);

  async function loadParticipants() {
    const { data } = await supabase
      .from('tournament_participants')
      .select('*, profile:profiles!tournament_participants_profile_id_fkey(*), partner:profiles!tournament_participants_partner_id_fkey(*)')
      .eq('tournament_id', tournament.id)
      .order('seed', { ascending: true, nullsFirst: false });
    setParticipants((data as unknown as TournamentParticipant[]) ?? []);
  }

  async function loadMatches() {
    const { data } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('round', { ascending: true })
      .order('position', { ascending: true });
    setMatches((data as TournamentMatch[]) ?? []);
  }

  useEffect(() => {
    loadParticipants();
    loadMatches();
  }, [tournament.id]);

  async function search(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    const { data } = await supabase.rpc('admin_search_profiles', { p_query: q });
    setSearchResults((data as Profile[]) ?? []);
  }

  async function addParticipant(profileId: string) {
    await supabase.rpc('admin_add_tournament_participant', { p_tournament_id: tournament.id, p_profile_id: profileId, p_partner_id: null, p_seed: null });
    setQuery('');
    setSearchResults([]);
    loadParticipants();
  }

  async function removeParticipant(id: string) {
    await supabase.rpc('admin_remove_tournament_participant', { p_participant_id: id });
    loadParticipants();
  }

  function toggleForPairing(id: string) {
    setPairSelection((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  async function pairSelected() {
    if (pairSelection.length !== 2) return;
    await supabase.rpc('admin_pair_tournament_participants', { p_participant_a: pairSelection[0], p_participant_b: pairSelection[1] });
    setPairSelection([]);
    loadParticipants();
  }

  async function generate() {
    const fn = tournament.format === 'bracket' ? 'admin_generate_bracket' : 'admin_generate_round_robin';
    await supabase.rpc(fn, { p_tournament_id: tournament.id });
    onChanged();
    loadMatches();
  }

  async function recordResult(matchId: string, sets: SetScore[], winnerEntrantId: string) {
    if (!confirm('Confirm this result?')) return;
    await supabase.rpc('admin_record_tournament_result', { p_match_id: matchId, p_sets: sets, p_winner_entrant_id: winnerEntrantId });
    loadMatches();
  }

  const rounds = Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b);

  return (
    <div>
      <button className="btn btn-outline" style={{ marginBottom: 16 }} onClick={onBack}>
        ← BACK
      </button>
      <h2>{tournament.name}</h2>
      <p className="subtitle">
        {tournament.format === 'bracket' ? 'Bracket' : 'Round robin'} · {tournament.status}
      </p>

      {tournament.status === 'open' && (
        <div className="card">
          <p className="label" style={{ marginTop: 0 }}>
            PARTICIPANTS ({participants.length})
          </p>
          <p className="subtitle" style={{ marginTop: 0 }}>
            Players register themselves from the app. Add anyone manually below, or select two solo entrants to pair
            them up together.
          </p>
          <input className="full-width" placeholder="Search player to add…" value={query} onChange={(e) => search(e.target.value)} />
          {searchResults.map((p) => (
            <div key={p.id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => addParticipant(p.id)}>
              <span style={{ fontSize: 13 }}>{p.full_name ?? 'Player'}</span>
              <span style={{ color: 'var(--accent)' }}>+ add</span>
            </div>
          ))}

          <div style={{ marginTop: 10 }}>
            {participants.map((p) => (
              <div key={p.id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span className="row" style={{ justifyContent: 'flex-start', gap: 8, fontSize: 13, fontWeight: 600 }}>
                  {!p.partner_id && (
                    <input type="checkbox" checked={pairSelection.includes(p.id)} onChange={() => toggleForPairing(p.id)} />
                  )}
                  {p.profile?.full_name ?? 'Player'}
                  {p.partner ? ` / ${p.partner.full_name ?? 'Partner'}` : ' (solo)'}
                </span>
                <button className="btn btn-outline" onClick={() => removeParticipant(p.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>

          {pairSelection.length === 2 && (
            <button className="btn btn-outline full-width" style={{ marginTop: 12 }} onClick={pairSelected}>
              PAIR SELECTED TWO TOGETHER
            </button>
          )}

          <button className="btn btn-accent full-width" style={{ marginTop: 16, padding: 14 }} disabled={participants.length < 2} onClick={generate}>
            CLOSE REGISTRATION & GENERATE MATCHES
          </button>
        </div>
      )}

      {tournament.status !== 'open' && tournament.status !== 'draft' &&
        rounds.map((round) => (
          <div className="card" key={round}>
            <p className="label" style={{ marginTop: 0 }}>
              ROUND {round}
            </p>
            {matches
              .filter((m) => m.round === round)
              .map((m) => (
                <MatchRow key={m.id} match={m} participants={participants} onRecord={recordResult} />
              ))}
          </div>
        ))}
    </div>
  );
}

function MatchRow({
  match,
  participants,
  onRecord,
}: {
  match: TournamentMatch;
  participants: TournamentParticipant[];
  onRecord: (matchId: string, sets: SetScore[], winnerEntrantId: string) => void;
}) {
  const [sets, setSets] = useState<SetScore[]>([{ a: 0, b: 0 }]);

  if (match.status === 'bye') {
    return <p style={{ fontSize: 13, padding: '8px 0' }}>{entrantName(participants, match.entrant_a_id)} advances (bye)</p>;
  }

  if (match.status === 'completed') {
    return (
      <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 13 }}>
          {entrantName(participants, match.entrant_a_id)} vs {entrantName(participants, match.entrant_b_id)}
        </p>
        <p style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>
          Winner: {entrantName(participants, match.winner_entrant_id)} ({(match.sets ?? []).map((s) => `${s.a}-${s.b}`).join(', ')})
        </p>
      </div>
    );
  }

  if (!match.entrant_a_id || !match.entrant_b_id) {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>Waiting for previous round…</p>;
  }

  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <p style={{ fontSize: 13, fontWeight: 700 }}>
        {entrantName(participants, match.entrant_a_id)} vs {entrantName(participants, match.entrant_b_id)}
      </p>
      {sets.map((s, i) => (
        <div key={i} className="row" style={{ justifyContent: 'flex-start', gap: 8, margin: '6px 0' }}>
          <input
            style={{ width: 50, textAlign: 'center' }}
            value={s.a}
            onChange={(e) => setSets((prev) => prev.map((p, idx) => (idx === i ? { ...p, a: Number(e.target.value) || 0 } : p)))}
          />
          <span>-</span>
          <input
            style={{ width: 50, textAlign: 'center' }}
            value={s.b}
            onChange={(e) => setSets((prev) => prev.map((p, idx) => (idx === i ? { ...p, b: Number(e.target.value) || 0 } : p)))}
          />
        </div>
      ))}
      <button className="btn btn-outline" onClick={() => setSets((prev) => [...prev, { a: 0, b: 0 }])}>
        + ADD SET
      </button>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn btn-outline" onClick={() => onRecord(match.id, sets, match.entrant_a_id!)}>
          {entrantName(participants, match.entrant_a_id)} WINS
        </button>
        <button className="btn btn-outline" onClick={() => onRecord(match.id, sets, match.entrant_b_id!)}>
          {entrantName(participants, match.entrant_b_id)} WINS
        </button>
      </div>
    </div>
  );
}

export default function Tournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<Tournament | null>(null);

  async function load() {
    const { data } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
    setTournaments((data as Tournament[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  if (selected) {
    return (
      <TournamentDetail
        tournament={selected}
        onBack={() => {
          setSelected(null);
          load();
        }}
        onChanged={load}
      />
    );
  }

  return (
    <div>
      <h2>Tournaments</h2>
      <p className="subtitle">Create and run tournaments.</p>
      <NewTournamentForm onCreated={load} />
      {tournaments.length === 0 && <p className="empty">No tournaments yet.</p>}
      {tournaments.map((t) => (
        <div className="card" key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(t)}>
          <strong>{t.name}</strong>
          <p className="subtitle" style={{ margin: '4px 0 0', textTransform: 'capitalize' }}>
            {t.format === 'bracket' ? 'Bracket' : 'Round robin'} · {t.status} {t.zone ? `· ${t.zone}` : ''}
          </p>
        </div>
      ))}
    </div>
  );
}
