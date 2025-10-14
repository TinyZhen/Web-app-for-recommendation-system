import { useEffect, useState } from 'react';
import { fetchRecommendations } from '../lib/api.js';

export default function Recommend() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
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
  }, []);

  return (
    <div>
      <main className="container">
        <div className="rec-card">
          <h2>Recommend</h2>

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
