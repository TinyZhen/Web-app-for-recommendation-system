// src/pages/Favorites.jsx
// import { useEffect, useState } from 'react';
// import { fetchFavorites } from '../lib/api.js';
// import { useAuth } from '../auth/AuthProvider';

// export default function Favourites() {
//   const { user, loading: authLoading } = useAuth();
//   const [items, setItems] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState('');

//   useEffect(() => {
//     if (authLoading || !user) return;

//     let active = true;
//     (async () => {
//       try {
//         const data = await fetchFavorites();
//         if (active) setItems(data.items || []);
//       } catch (e) {
//         setError(e.message || 'Failed to load recs');
//       } finally {
//         if (active) setLoading(false);
//       }
//     })();
//     return () => {
//       active = false;
//     };
//   }, [authLoading, user]);

//   return (
//     <div>
//       <main className="container">
//         <div className="rec-card">
//           <h2>Favorites</h2>

//           {user && (
//             <p style={{ fontSize: '0.9rem', color: '#666' }}>
//               Current user UID: <strong>{user.uid}</strong>
//             </p>
//           )}

//           {loading && <p className="muted">Loading Favorites…</p>}
//           {error && <p className="error">{error}</p>}

//           {!loading && !error && (
//             <ul>
//               {items.map((m) => (
//                 <li key={m.movie_id} style={{ marginBottom: 8 }}>
//                   <strong>{m.title}</strong>{' '}
//                 </li>
//               ))}
//             </ul>
//           )}
//         </div>
//       </main>
//     </div>
//   );
// }

// src/pages/Favorites.jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import SavedRecommendCard from '../components/SavedRecommendCard.jsx';

import { db } from '../firebase';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

export default function Favourites() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user) return;

    let active = true;
    (async () => {
      try {
        const q = query(
          collection(db, 'savedRecommendations'),
          where('userId', '==', user.uid)
        );
        const snap = await getDocs(q);

        // Sort newest → oldest by createdAt (if present)
        const data = snap.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .sort((a, b) => {
            const aTs = a.createdAt?.seconds || 0;
            const bTs = b.createdAt?.seconds || 0;
            return bTs - aTs;
          });

        if (active) setItems(data);
      } catch (e) {
        if (active) setError(e.message || 'Failed to load favorites');
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
          <h2>Favorites</h2>

          {user && (
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              Current user UID: <strong>{user.uid}</strong>
            </p>
          )}

          {loading && <p className="muted">Loading Favorites…</p>}
          {error && <p className="error">{error}</p>}

          {!loading && !error && (
            items.length === 0 ? (
              <p className="muted">No saved recommendations yet.</p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {items.map((rec) => (
                  <SavedRecommendCard
                    key={rec.id}
                    text={rec.explanation}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
