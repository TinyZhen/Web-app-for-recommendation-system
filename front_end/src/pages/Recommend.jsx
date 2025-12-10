import { useEffect, useState } from "react";
import { db } from "../firebase";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import fallbackPoster from "../assets/logo.png";
import "../style/Recommend.css";

/**
 * Recommend page
 *
 * Shows recommendations (from survey or cache), fetches posters from OMDb when needed,
 * and allows saving recommendations to Firestore.
 *
 * @returns {JSX.Element}
 */
export default function Recommend() {
  const { user } = useAuth();
  const location = useLocation();

  const surveyExplanations = location.state?.explanations || [];

  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);

  const displayName = user?.displayName || "User";


  // -----------------------------
  // Poster Fetch
  // -----------------------------
  async function fetchPosterFromOMDB(title) {
    if (!title) return null;

    const apiKey = import.meta.env.VITE_OMDB_API_KEY;
    if (!apiKey) return null;

    const cleanTitle = title.replace(/\s*\(\d{4}\)\s*$/, "").trim();
    const url = `https://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(cleanTitle)}&type=movie`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data?.Response === "True" && data.Poster && data.Poster !== "N/A") {
        return data.Poster;
      }
    } catch (err) {
      console.error("OMDB fetch error", err);
    }

    return null;
  }

  // -----------------------------
  // Load recommendations (NO FIREBASE)
  // -----------------------------
  useEffect(() => {
    const load = async () => {
      const cacheKey = `lastSurveyRecs_${user?.uid || displayName}`;

      let items = [];

      if (surveyExplanations.length > 0) {
        // Loaded from Survey
        items = surveyExplanations.map((rec) => ({
          title: rec.title,
          genres: Array.isArray(rec.genres) ? rec.genres : (rec.genres ? [rec.genres] : []),
          explanation: rec.explanation,
          poster: null,
          movie_id: rec.movie_id || null,
        }));

        // Save to localStorage (for recovery after refresh)
        localStorage.setItem(cacheKey, JSON.stringify(items));
      } else {
        // No Survey → Read from localStorage
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          items = JSON.parse(cached);
        }
      }

      // Fetch posters and sanitize explanations
      for (const rec of items) {
        if (!rec.poster || rec.poster === "N/A") {
          const poster = await fetchPosterFromOMDB(rec.title);
          rec.poster = poster || fallbackPoster;
        }
      }

      setRecs(items);
      setLoading(false);
    };

    load();
  }, [surveyExplanations, displayName, user?.uid]);

  // -----------------------------
  // Save → ONLY write to Firestor
  // -----------------------------
  async function handleSave(rec) {
    try {
      const docRef = await addDoc(collection(db, "savedRecommendations"), {
        userId: user.uid,
        title: rec.title,
        genres: rec.genres || [],
        explanation: rec.explanation,
        poster: rec.poster || null,
        movieId: rec.movie_id || null,
        createdAt: serverTimestamp(),
      });

      // Update Favourite cache (does not affect Recommend)
      const favKey = `savedRecs_${user.uid}`;
      const favCached = JSON.parse(localStorage.getItem(favKey) || "[]");

      favCached.unshift({
        id: docRef.id,
        title: rec.title,
        genres: rec.genres || [],
        explanation: rec.explanation,
        poster: rec.poster,
        movieId: rec.movie_id,
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
      });

      localStorage.setItem(favKey, JSON.stringify(favCached));

      alert("Saved!");
    } catch (err) {
      console.error(err);
      alert("Failed to save recommendation");
    }
  }

  // -----------------------------
  // UI
  // -----------------------------

  return (
    <section className="survey-shell">
      <h2 className="survey-title">🎬 Recommendations for {displayName}</h2>
      <p className="survey-sub">
        Here are your personalized recommendations based on your movie taste.
      </p>

      <div className="survey-grid">
        {recs.map((rec, idx) => (
          <div key={idx} className="survey-card">

            {/* Poster */}
            <div className="card-left">
              <div className="poster-frame">
                <img
                  src={rec.poster || fallbackPoster}
                  alt={rec.title}
                  className="poster-img"
                />
              </div>
            </div>

            {/* Info */}
            <div className="card-right">
              <h3 className="card-title">{rec.title}</h3>

              <div className="card-meta">
                {(rec.genres || []).join(", ")}
              </div>

              <div className="recommend-reason">
                <h4 style={{ marginTop: "10px", marginBottom: "6px" }}>
                  Why we recommend this:
                </h4>
                <div className="rec-explanation-scroll">
                  {rec.explanation}
                </div>
              </div>

              <button
                className={rec.saved ? "submit-btn saved-btn" : "submit-btn"}
                style={{ marginTop: "12px" }}
                onClick={() => handleSave(rec)}
                disabled={rec.saved}
              >
                {rec.saved ? "✓ Saved" : "❤️ Save Recommendation"}
              </button>
            </div>

          </div>
        ))}
      </div>
    </section>
  );
}
