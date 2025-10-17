import { useEffect, useState } from 'react';
import { fetchRecommendations } from '../lib/api.js';
import { useAuth } from '../auth/AuthProvider';

export default function Recommend() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user) return;

    let active = true;
    (async () => {
      try {
        const data = await fetchRecommendations();
        if (active) setItems(data.items || []);
      } catch (e) {
        setError(e.message || 'Failed to load recs');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  return (
    <div>
      <main className="container">
        <div className="rec-card">
          <h2>Recommend</h2>

          {user && (
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              Current user UID: <strong>{user.uid}</strong>
            </p>
          )}

          {loading && <p className="muted">Loading recommendations…</p>}
          {error && <p className="error">{error}</p>}

          {!loading && !error && (
            <ul>
              {items.map((m) => (
                <li key={m.movie_id} style={{ marginBottom: 8 }}>
                  <strong>{m.title}</strong>{' '}
                  <span className="muted">(score {m.score.toFixed(2)})</span>
                  {m.reason && <div className="muted">{m.reason}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
