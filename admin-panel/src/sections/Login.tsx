import { useState } from 'react';
import { supabase } from '../supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>🛠 GOD MODE</h1>
        <p className="subtitle">PadelTwin admin panel</p>
        <label className="label">EMAIL</label>
        <input
          className="full-width"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <label className="label">PASSWORD</label>
        <input
          className="full-width"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-accent full-width" style={{ marginTop: 16 }} disabled={loading}>
          {loading ? 'SIGNING IN…' : 'SIGN IN'}
        </button>
      </form>
    </div>
  );
}
