// src/pages/Favorites.jsx

/**
 * @file Favorites.jsx
 * @brief Displays and manages the user's saved movie recommendations.
 *
 * This page renders a list of movie recommendations that the user
 * has explicitly saved. It supports:
 * - Loading saved recommendations from local cache or Firestore
 * - Displaying movie posters, genres, and explanations
 * - Removing saved recommendations from both Firestore and localStorage
 *
 * The component prioritizes cached data to reduce Firestore reads
 * and gracefully falls back to server queries when necessary.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import SavedRecommendCard from '../components/SavedRecommendCard.jsx';
import fallbackPoster from '../assets/logo.png';

import { db } from '../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,          
  doc                 
} from 'firebase/firestore';

/**
 * @brief Favorites page component.
 *
 * Displays the authenticated user's saved movie recommendations.
 * Recommendations are loaded from localStorage when available,
 * otherwise fetched from Firestore. Users can remove saved items,
 * which updates both the database and local cache.
 *
 * @returns {JSX.Element} Favorites page UI.
 */

export default function Favourites() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /**
   * @brief Remove a saved recommendation.
   *
   * Deletes the selected recommendation from Firestore and synchronizes
   * the local UI state and cached localStorage data to reflect the change.
   *
   * @param {string} id - Firestore document ID of the saved recommendation.
   */
  async function handleDelete(id) {
    try {
      await deleteDoc(doc(db, "savedRecommendations", id));
      setItems((prev) => prev.filter((item) => item.id !== id));

      const cacheKey = `savedRecs_${user.uid}`;
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "[]");
      const updated = cached.filter((item) => item.id !== id);
      localStorage.setItem(cacheKey, JSON.stringify(updated));

    } catch (e) {
      setError("Failed to delete item");
    }
  }

  /**
   * @brief Load saved recommendations for the authenticated user.
   *
   * Attempts to restore recommendations from localStorage first to
   * minimize Firestore reads. If no cache is found, queries Firestore
   * and caches the result locally. Handles both cache and server sources.
   */
  useEffect(() => {
    if (authLoading || !user) return;

    const cacheKey = `savedRecs_${user.uid}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      setItems(JSON.parse(cached));
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        const q = query(
          collection(db, "savedRecommendations"),
          where("userId", "==", user.uid)
        );

        let snap;
        try {
          snap = await getDocs(q, { source: "cache" });
        } catch {
          snap = await getDocs(q, { source: "server" });
        }

        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        if (active) {
          setItems(data);
          localStorage.setItem(cacheKey, JSON.stringify(data));
        }

      } catch (e) {
        if (active) setError("Failed to load favorites");
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
              {/* Current user UID: <strong>{user.uid}</strong> */}
            </p>
          )}

          {loading && <p className="muted">Loading Favorites…</p>}
          {error && <p className="error">{error}</p>}

          {!loading && !error && (
            items.length === 0 ? (
              <p className="muted">No saved recommendations yet.</p>
            ) : (
              <div className="survey-grid">
                {items.map((rec, idx) => (
                  <div key={rec.id} className="survey-card">

                    <div className="card-left">
                      <div className="poster-frame">
                        <img
                          src={rec.poster || fallbackPoster}
                          alt={rec.title}
                          className="poster-img"
                        />
                      </div>
                    </div>

                    <div className="card-right">
                      <h3 className="card-title">{rec.title}</h3>

                      <div className="card-meta">{(rec.genres || []).join(", ")}</div>

                      <div className="recommend-reason">
                        <h4 style={{ marginTop: "10px", marginBottom: "6px" }}>
                          Saved recommendation
                        </h4>
                        <div className="rec-explanation-scroll">{rec.explanation}</div>
                      </div>

                      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                        <button
                          className="submit-btn"
                          onClick={() => window.open(rec.poster || '#')}
                        >
                          View Poster
                        </button>

                        <button
                          className="save-btn"
                          onClick={() => handleDelete(rec.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
