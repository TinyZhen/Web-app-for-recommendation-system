import { useEffect, useState } from 'react';
import { fetchRecommendations } from '../lib/api.js';
import { useAuth } from '../auth/AuthProvider';
import { useLocation } from 'react-router-dom'; // ⬅️ NEW
import '../style/Recommend.css';

export default function Recommend() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation(); // ⬅️ NEW
  const explanations = location.state?.explanations || []; // ⬅️ NEW

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
    return () => { active = false; };
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

          {/* ⬇️ NEW: show explanations (if passed from Survey) */}
          {explanations.length > 0 && (
            <div style={{ margin: '16px 0' }}>
              <h3 style={{ marginBottom: 8 }}>Why these picks (experiment):</h3>
              <ol style={{ paddingLeft: 18 }}>
                {explanations.map((line, idx) => (
                  <li key={idx} style={{ marginBottom: 6, whiteSpace: 'pre-wrap' }}>
                    {line}
                  </li>
                ))}
              </ol>
              <hr style={{ margin: '16px 0' }} />
            </div>
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
