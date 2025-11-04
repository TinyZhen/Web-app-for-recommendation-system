// import { useEffect, useState } from 'react';
// import { fetchRecommendations } from '../lib/api.js';
// import { useAuth } from '../auth/AuthProvider';
// import { useLocation } from 'react-router-dom'; // ⬅️ NEW
// import '../style/Recommend.css';

// export default function Recommend() {
//   const { user, loading: authLoading } = useAuth();
//   const location = useLocation(); // ⬅️ NEW
//   const explanations = location.state?.explanations || []; // ⬅️ NEW

//   const [items, setItems] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState('');

//   useEffect(() => {
//     if (authLoading || !user) return;

//     let active = true;
//     (async () => {
//       try {
//         const data = await fetchRecommendations();
//         if (active) setItems(data.items || []);
//       } catch (e) {
//         setError(e.message || 'Failed to load recs');
//       } finally {
//         if (active) setLoading(false);
//       }
//     })();
//     return () => { active = false; };
//   }, [authLoading, user]);

//   return (
//     <div>
//       <main className="container">
//         <div className="rec-card">
//           <h2>Recommend</h2>

//           {user && (
//             <p style={{ fontSize: '0.9rem', color: '#666' }}>
//               Current user UID: <strong>{user.uid}</strong>
//             </p>
//           )}

//           {/* ⬇️ NEW: show explanations (if passed from Survey) */}
//           {explanations.length > 0 && (
//             <div style={{ margin: '16px 0' }}>
//               <h3 style={{ marginBottom: 8 }}>Why these picks (experiment):</h3>
//               <ol style={{ paddingLeft: 18 }}>
//                 {explanations.map((line, idx) => (
//                   <li key={idx} style={{ marginBottom: 6, whiteSpace: 'pre-wrap' }}>
//                     {line}
//                   </li>
//                 ))}
//               </ol>
//               <hr style={{ margin: '16px 0' }} />
//             </div>
//           )}

//           {loading && <p className="muted">Loading recommendations…</p>}
//           {error && <p className="error">{error}</p>}

//           {!loading && !error && (
//             <ul>
//               {items.map((m) => (
//                 <li key={m.movie_id} style={{ marginBottom: 8 }}>
//                   <strong>{m.title}</strong>{' '}
//                   <span className="muted">(score {m.score.toFixed(2)})</span>
//                   {m.reason && <div className="muted">{m.reason}</div>}
//                 </li>
//               ))}
//             </ul>
//           )}
//         </div>
//       </main>
//     </div>
//   );
// }

// src/pages/Recommend.jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useLocation } from 'react-router-dom';
import '../style/Recommend.css';
import RecommendCard from '../components/RecommendCard.jsx';
import SavedRecommendCard from '../components/SavedRecommendCard.jsx';

import { db } from '../firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

export default function Recommend() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  // Are we coming from the Survey submit?
  const fromSurvey = location.state?.fromSurvey || false;

  // Explanations passed from MovieSurvey (may start with "1 : ", "2 : ", etc.)
  const rawExplanations = location.state?.explanations || [];

  // Strip leading "1 :", "2 :", etc.
  const explanations = rawExplanations.map((line) =>
    typeof line === 'string' ? line.replace(/^\s*\d+\s*:\s*/, '') : ''
  );

  // Saved recommendations for this user
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Track which explanation cards are saved (for the Save button state)
  const [savedExplanationIndexes, setSavedExplanationIndexes] = useState([]);

  // Load SAVED recommendations when opening Recommend from navbar
  useEffect(() => {
    if (authLoading || !user) return;
    if (fromSurvey) {
      // When coming from survey, we only care about explanation cards
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        const q = query(
          collection(db, 'savedRecommendations'),
          where('userId', '==', user.uid)
        );
        const snap = await getDocs(q);

        // Sort client-side newest → oldest
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
        if (active) setError(e.message || 'Failed to load saved recommendations');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authLoading, user, fromSurvey]);

  // Save an explanation to Firestore when "Save" on a card is clicked
  const handleSaveExplanation = async (idx, text) => {
    if (!user?.uid) {
      console.warn('No user, cannot save explanation');
      return;
    }

    try {
      await addDoc(collection(db, 'savedRecommendations'), {
        userId: user.uid,
        explanation: text,
        createdAt: serverTimestamp(),
      });

      // Mark this explanation card as saved in the UI
      setSavedExplanationIndexes((prev) =>
        prev.includes(idx) ? prev : [...prev, idx]
      );
      console.log('Saved explanation to Firestore for user', user.uid);
    } catch (e) {
      console.error('Failed to save explanation', e);
    }
  };

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

          {/* Explanation cards (from bias pipeline, when coming from Survey) */}
          {explanations.length > 0 && (
            <div style={{ margin: '16px 0' }}>
              <h3 style={{ marginBottom: 8 }}>Why these picks (experiment):</h3>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {explanations.map((line, idx) => (
                  <RecommendCard
                    key={idx}
                    text={line}
                    saved={savedExplanationIndexes.includes(idx)}
                    onSave={() => handleSaveExplanation(idx, line)}
                  />
                ))}
              </div>

              <hr style={{ margin: '16px 0' }} />
            </div>
          )}

          {/* SAVED RECOMMENDATIONS AS CARDS (when clicking Recommend in navbar) */}
          {!fromSurvey && loading && (
            <p className="muted">Loading saved recommendations…</p>
          )}
          {!fromSurvey && error && <p className="error">{error}</p>}

          {!fromSurvey && !loading && !error && (
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
