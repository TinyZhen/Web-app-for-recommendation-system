/**
 * @file Profile.jsx
 * @brief User profile management and preference overview page.
 *
 * This page allows authenticated users to view and update their
 * personal profile information stored in Firestore. In addition,
 * it provides a summary of recently rated movies from past survey
 * sessions and enables exploration of detailed movie metadata.
 *
 * Key responsibilities:
 * - Load and persist user profile data (demographics + preferences)
 * - Manage explanation preference (`theta_u`) for recommendation depth
 * - Display recent survey history using cached localStorage data
 * - Lazily fetch movie posters and metadata from OMDb
 * - Provide an interactive modal for viewing detailed movie information
 */

import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../auth/AuthProvider";
import { fetchOmdbData } from "../lib/api";
import "../style/Profile.css";

/**
 * @brief Profile page component.
 *
 * Renders the authenticated user's profile form and survey history.
 * Users can update personal attributes (age, gender, occupation,
 * location) as well as their preferred recommendation explanation
 * style. Changes are persisted to Firestore.
 *
 * The page also visualizes recent movie ratings and supports
 * on-demand loading of detailed movie metadata using OMDb.
 *
 * @returns {JSX.Element} Profile page UI.
 */
export default function Profile() {
  const { user } = useAuth();
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [movieDetails, setMovieDetails] = useState(null);

  /**
   * @brief Local profile state.
   *
   * Mirrors the Firestore user document and includes demographic
   * attributes along with the explanation preference parameter
   * (`theta_u`), which controls recommendation explanation depth.
   */
  const [profile, setProfile] = useState({
    displayName: "",
    age: "",
    gender: "",
    occupation: "",
    zipcode: "",
    theta_u: null, 
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [surveyHistory, setSurveyHistory] = useState([]);

  /**
   * @brief Load user profile and survey history.
   *
   * Fetches the authenticated user's profile document from Firestore
   * and initializes local state. Also restores recent survey history
   * from browser localStorage to avoid unnecessary database reads.
   */
  useEffect(() => {
    if (!user?.uid) return;

    const loadProfile = async () => {
      setLoading(true);
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();

          setProfile((prev) => ({
            ...prev,
            ...data,
            
            theta_u: data.theta_u !== undefined ? Number(data.theta_u) : 0.5,
          }));
        }

        // Load survey history from localStorage
        const history = localStorage.getItem(`surveyHistory_${user.uid}`);
        if (history) {
          setSurveyHistory(JSON.parse(history));
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  /**
   * @brief Lazily fetch missing posters for the most recent survey.
   *
   * Iterates over the latest survey session and retrieves missing
   * movie posters from OMDb. Updates both component state and
   * localStorage to keep cached data in sync.
   */
  useEffect(() => {
    if (!surveyHistory || surveyHistory.length === 0) return;
    const latest = surveyHistory[0];
    if (!latest?.movies || latest.movies.length === 0) return;

    let cancelled = false;

    (async () => {
      const updated = { ...latest, movies: [...latest.movies] };
      let changed = false;

      for (let i = 0; i < updated.movies.length; i++) {
        const m = updated.movies[i];
        if (!m.poster) {
          try {
            const info = await fetchOmdbData(m.title);
            if (cancelled) return;
            if (info?.poster) {
              updated.movies[i] = { ...m, poster: info.poster };
              changed = true;
            }
            // small delay to be polite
            await new Promise((r) => setTimeout(r, 200));
          } catch (e) {
            console.warn('Failed to fetch poster for', m.title, e);
          }
        }
      }

      if (changed && !cancelled) {
        // write back to surveyHistory state and localStorage
        setSurveyHistory((prev) => {
          const rest = prev.slice(1);
          const newArr = [updated, ...rest];
          try {
            localStorage.setItem(`surveyHistory_${user.uid}`, JSON.stringify(newArr));
          } catch (e) {
            console.warn('Failed to save updated survey history', e);
          }
          return newArr;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [surveyHistory, user]);

  /**
   * @brief Handle profile form field updates.
   *
   * Normalizes numeric and floating-point fields before updating
   * local profile state to ensure Firestore-compatible values.
   *
   * @param {Event} e - Input change event.
   */
  const handleChange = (e) => {
    const { name, value } = e.target;

    let processedValue = value;

    if (name === "age" || name === "occupation") {
      processedValue = value === "" ? "" : Number(value);
    }

    
    if (name === "theta_u") {
      processedValue = value === "" ? null : parseFloat(value);
    }

    setProfile((p) => ({ ...p, [name]: processedValue }));
  };

  /**
   * @brief Persist profile updates to Firestore.
   *
   * Saves the updated profile fields to the user's Firestore
   * document and records an update timestamp.
   *
   * @param {Event} e - Form submission event.
   */
  const handleSave = async (e) => {
    e.preventDefault();
    if (!user?.uid) return;

    setSaving(true);
    setStatus("");

    try {
      const ref = doc(db, "users", user.uid);

      await updateDoc(ref, {
        ...profile,
        updatedAt: serverTimestamp(),
      });

      setStatus("✅ Profile updated successfully!");
    } catch (err) {
      console.error("Update failed:", err);
      setStatus("❌ Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading profile...</p>;

  return (
    <section className="profile-shell">
      <h2 className="profile-title">👤 My Profile</h2>
      <p className="profile-sub">View or update your personal information</p>

      <form onSubmit={handleSave} className="profile-form">

        <label>
          Name:
          <input
            type="text"
            name="displayName"
            value={profile.displayName}
            onChange={handleChange}
          />
        </label>

        {/*  Age Dropdown */}
        <label>
          Age:
          <select name="age" value={profile.age} onChange={handleChange}>
            <option value="">Select Age Range</option>
            <option value={1}>Under 18</option>
            <option value={18}>18–24</option>
            <option value={25}>25–34</option>
            <option value={35}>35–44</option>
            <option value={45}>45–49</option>
            <option value={50}>50–55</option>
            <option value={56}>56+</option>
          </select>
        </label>

        {/*  Gender */}
        <label>
          Gender:
          <select name="gender" value={profile.gender} onChange={handleChange}>
            <option value="">Select</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </label>

        {/*  Occupation Dropdown */}
        <label>
          Occupation:
          <select name="occupation" value={profile.occupation} onChange={handleChange}>
            <option value="">Select Occupation</option>
            <option value={0}>Other / Not specified</option>
            <option value={1}>Academic / Educator</option>
            <option value={2}>Artist</option>
            <option value={3}>Clerical / Admin</option>
            <option value={4}>College / Grad Student</option>
            <option value={5}>Customer Service</option>
            <option value={6}>Doctor / Health Care</option>
            <option value={7}>Executive / Managerial</option>
            <option value={8}>Farmer</option>
            <option value={9}>Homemaker</option>
            <option value={10}>K-12 Student</option>
            <option value={11}>Lawyer</option>
            <option value={12}>Programmer</option>
            <option value={13}>Retired</option>
            <option value={14}>Sales / Marketing</option>
            <option value={15}>Scientist</option>
            <option value={16}>Self-Employed</option>
            <option value={17}>Technician / Engineer</option>
            <option value={18}>Tradesman / Craftsman</option>
            <option value={19}>Unemployed</option>
            <option value={20}>Writer</option>
          </select>
        </label>

        <label>
          Zipcode:
          <input
            type="text"
            name="zipcode"
            value={profile.zipcode}
            onChange={handleChange}
          />
        </label>

        
        <label>
          Recommendation Explanation Style:
          <select
            name="theta_u"
            value={profile.theta_u ?? ""}
            onChange={handleChange}
            required
          >
            <option value="">— Select Explanation Style —</option>

            {/* theta_u ≤ 0.3 */}
            <option value="0.2">
              Quick Insight (1-line explanation)
            </option>

            {/* 0.3 < theta_u ≤ 0.7 */}
            <option value="0.5">
              Concise Reasoning (short multi-factor explanation)
            </option>

            {/* theta_u > 0.7 */}
            <option value="0.9">
              Fairness-Aware & Transparent (detailed & ethical)
            </option>
          </select>
        </label>

        <button type="submit" disabled={saving} className="save-btn">
          {saving ? "Saving..." : "Save Changes"}
        </button>

        {status && <p className="save-status">{status}</p>}
      </form>

      {/* Survey Flyer (latest session) */}
      {surveyHistory.length > 0 && (() => {
        // Flatten all survey sessions into one list
        let movies = surveyHistory.flatMap(s => s.movies);

        // Deduplicate by movieId
        const seen = new Set();
        movies = movies.filter(m => {
          const id = m.movieId ?? m.title;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });

        // Limit to 50 recent ratings
        movies = movies.slice(0, 50);

        return (
          <div className="survey-flyer">
            <h3 className="history-title">📽️ Recently Rated</h3>
            <div className="flyer-scroll">
              {movies.map((movie) => (
                <div
                  key={movie.movieId || movie.title}
                  className="flyer-card"
                  onClick={async () => {
                    setSelectedMovie(movie);
                    const info = await fetchOmdbData(movie.title);
                    setMovieDetails(info);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {movie.poster && (
                    <img src={movie.poster} alt={movie.title} className="flyer-thumb" />
                  )}
                  <div className="flyer-title">{movie.title}</div>
                  <div className="flyer-genres">
                    {Array.isArray(movie.genres) ? movie.genres.join(" · ") : ""}
                  </div>
                  <div className="flyer-rating">
                    {"⭐".repeat(movie.rating)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}


      {selectedMovie && (
        <div className="movie-modal-overlay" onClick={() => setSelectedMovie(null)}>
          <div className="movie-modal" onClick={(e) => e.stopPropagation()}>

            <img
              src={movieDetails?.poster || selectedMovie.poster}
              alt={selectedMovie.title}
              className="movie-modal-poster"
            />

            <div className="movie-modal-content">
              <h2>{selectedMovie.title}</h2>
              <p><strong>Genres:</strong> {selectedMovie.genres?.join(" · ")}</p>
              <p><strong>Your Rating:</strong> {"⭐".repeat(selectedMovie.rating)}</p>

              {movieDetails ? (
                <>
                  <p><strong>Plot:</strong> {movieDetails.plot}</p>
                  <p><strong>Director:</strong> {movieDetails.director}</p>
                  <p><strong>Actors:</strong> {movieDetails.actors}</p>
                  <p><strong>Year:</strong> {movieDetails.year}</p>
                </>
              ) : (
                <p>Loading details…</p>
              )}

              <button className="close-btn" onClick={() => setSelectedMovie(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
