import { useState } from 'react';
import { supabase } from '../supabase';

const SEGMENTS: { value: 'all' | 'coaches' | 'pro'; label: string }[] = [
  { value: 'all', label: 'All players' },
  { value: 'coaches', label: 'Approved coaches' },
  { value: 'pro', label: 'Pro players' },
];

export default function Broadcast() {
  const [segment, setSegment] = useState<'all' | 'coaches' | 'pro'>('all');
  const [zone, setZone] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!title.trim() || !body.trim()) return;
    if (!confirm(`Send to segment "${segment}"${zone ? ` (zone: ${zone})` : ''}?`)) return;
    setSending(true);
    const { data, error } = await supabase.rpc('admin_broadcast_push', {
      p_segment: segment,
      p_title: title.trim(),
      p_body: body.trim(),
      p_zone: zone.trim() || null,
    });
    setSending(false);
    if (error) {
      alert(error.message);
      return;
    }
    alert(`Delivered to ${data} device(s).`);
    setTitle('');
    setBody('');
  }

  return (
    <div>
      <h2>Broadcast</h2>
      <p className="subtitle">Send a push notification to a segment of players.</p>

      <label className="label">SEGMENT</label>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
        {SEGMENTS.map((s) => (
          <button key={s.value} className={`chip ${segment === s.value ? 'active' : ''}`} onClick={() => setSegment(s.value)}>
            {s.label}
          </button>
        ))}
      </div>

      <label className="label">ZONE FILTER (optional)</label>
      <input className="full-width" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="e.g. London" />

      <label className="label">TITLE</label>
      <input className="full-width" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notification title" />

      <label className="label">MESSAGE</label>
      <textarea
        className="full-width"
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Notification message"
      />

      <button
        className="btn btn-accent full-width"
        style={{ marginTop: 20, padding: '14px' }}
        disabled={!title.trim() || !body.trim() || sending}
        onClick={handleSend}
      >
        {sending ? 'SENDING…' : 'SEND BROADCAST'}
      </button>
    </div>
  );
}
