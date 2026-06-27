import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './types';
import Login from './sections/Login';
import Dashboard from './sections/Dashboard';
import Coaches from './sections/Coaches';
import Reports from './sections/Reports';
import Users from './sections/Users';
import Moderation from './sections/Moderation';
import Chats from './sections/Chats';
import Tournaments from './sections/Tournaments';
import Leagues from './sections/Leagues';
import Collusion from './sections/Collusion';
import Broadcast from './sections/Broadcast';

const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'coaches', label: 'Coach Applications' },
  { key: 'reports', label: 'Reports' },
  { key: 'users', label: 'Accounts' },
  { key: 'moderation', label: 'Content Moderation' },
  { key: 'chats', label: 'Chat Moderation' },
  { key: 'tournaments', label: 'Tournaments' },
  { key: 'leagues', label: 'Leagues' },
  { key: 'collusion', label: 'Collusion Watch' },
  { key: 'broadcast', label: 'Broadcast' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<SectionKey>('dashboard');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setProfile(data as Profile);
        setLoading(false);
      });
  }, [session]);

  if (loading) return null;

  if (!session) return <Login />;

  if (!profile?.is_admin) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1>Not authorized</h1>
          <p className="subtitle">This account doesn't have God Mode access.</p>
          <button className="btn btn-outline full-width" onClick={() => supabase.auth.signOut()}>
            SIGN OUT
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      <div className="sidebar">
        <h1>🛠 GOD MODE</h1>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            className={`nav-item ${section === s.key ? 'active' : ''}`}
            onClick={() => setSection(s.key)}
          >
            {s.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="nav-item" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
      <div className="main">
        {section === 'dashboard' && <Dashboard />}
        {section === 'coaches' && <Coaches />}
        {section === 'reports' && <Reports />}
        {section === 'users' && <Users />}
        {section === 'moderation' && <Moderation />}
        {section === 'chats' && <Chats />}
        {section === 'tournaments' && <Tournaments />}
        {section === 'leagues' && <Leagues />}
        {section === 'collusion' && <Collusion />}
        {section === 'broadcast' && <Broadcast />}
      </div>
    </div>
  );
}
