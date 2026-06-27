import { useState } from 'react';
import { supabase } from '../supabase';
import type { AdminMessage } from '../types';

export default function Chats() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(false);

  async function search(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase.rpc('admin_search_messages', { p_query: q });
    setResults((data as AdminMessage[]) ?? []);
    setLoading(false);
  }

  async function remove(id: string) {
    if (!confirm('Delete this message?')) return;
    await supabase.rpc('admin_delete_message', { p_message_id: id });
    search(query);
  }

  return (
    <div>
      <h2>Chat Moderation</h2>
      <p className="subtitle">Search and remove messages.</p>
      <input
        className="full-width"
        placeholder="Search message content…"
        value={query}
        onChange={(e) => search(e.target.value)}
        style={{ marginBottom: 16 }}
      />
      {loading && <p className="empty">Searching…</p>}
      {!loading && query.trim() && results.length === 0 && <p className="empty">No matches.</p>}
      {results.map((m) => (
        <div className="card row" key={m.id}>
          <div>
            <strong style={{ fontSize: 12 }}>{m.sender_name ?? 'Player'}</strong>
            <p className="subtitle" style={{ margin: '2px 0 0' }}>{m.body}</p>
          </div>
          <button className="btn btn-danger" onClick={() => remove(m.id)}>
            DELETE
          </button>
        </div>
      ))}
    </div>
  );
}
