// src/pages/Survey.jsx
// import { useEffect, useMemo, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { db } from "../firebase";
// import { useAuth } from "../auth/AuthProvider";
// import fallbackPoster from "../assets/logo.png";

// import {
//   addDoc,
//   collection,
//   getDocs,
//   limit,
//   query,
//   where,
//   serverTimestamp,
//   setDoc,
//   doc,
// } from "firebase/firestore";

// // ⬇️ NEW: call the backend pipeline
// import { runCombinedBiases } from "../lib/api";
// import './Survey.css'
// const NUM_QUESTIONS = 20;

// function sampleOne(arr) {
//   if (!arr || arr.length === 0) return null;
//   return arr[Math.floor(Math.random() * arr.length)];
// }

// function sampleMany(arr, k, excludeIds = new Set()) {
//   const pool = arr.filter((x) => !excludeIds.has(x.id));
//   const out = [];
//   const used = new Set();
//   while (out.length < k && pool.length > 0) {
//     const m = sampleOne(pool);
//     if (m && !used.has(m.id)) {
//       out.push(m);
//       used.add(m.id);
//     }
//   }
//   return out;
// }

// const normalize = (g) => String(g || "").trim();

// export default function Survey() {
//   const { user } = useAuth();
//   const navigate = useNavigate();
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");
//   const [movies, setMovies] = useState([]);
//   const [ratings, setRatings] = useState({});
//   const [submitting, setSubmitting] = useState(false);
//   const [submittedId, setSubmittedId] = useState(null);

//   const allAnswered = useMemo(
//     () => movies.length === NUM_QUESTIONS && movies.every((m) => ratings[m.id] >= 1),
//     [movies, ratings]
//   );

//   useEffect(() => {
//     const run = async () => {
//       setLoading(true);
//       setError("");
//       try {
//         const someMoviesSnap = await getDocs(query(collection(db, "movies"), limit(500)));
//         const gset = new Set();
//         someMoviesSnap.forEach((doc) => {
//           const data = doc.data();
//           (data.genres || []).forEach((g) => gset.add(normalize(g)));
//         });
//         const genres = Array.from(gset);

//         const targetGenres = genres.slice(0, Math.min(genres.length, NUM_QUESTIONS));
//         const picked = [];
//         const pickedIds = new Set();

//         for (const g of targetGenres) {
//           const poolSnap = await getDocs(
//             query(collection(db, "movies"), where("genres", "array-contains", g), limit(50))
//           );
//           const pool = poolSnap.docs.map((d) => ({ id: d.id, ...d.data(), _genreHit: g }));
//           const one = sampleOne(pool);
//           if (one && !pickedIds.has(one.id)) {
//             picked.push(one);
//             pickedIds.add(one.id);
//           }
//         }

//         if (picked.length < NUM_QUESTIONS) {
//           const fillerSnap = await getDocs(query(collection(db, "movies"), limit(500)));
//           const fillerPool = fillerSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
//           const needed = NUM_QUESTIONS - picked.length;
//           const fillers = sampleMany(fillerPool, needed, pickedIds);
//           picked.push(...fillers);
//         }

//         const shuffled = [...picked].sort(() => Math.random() - 0.5).slice(0, NUM_QUESTIONS);
//         setMovies(shuffled);
//       } catch (e) {
//         console.error(e);
//         setError("Failed to load survey movies. Check your Firestore structure.");
//       } finally {
//         setLoading(false);
//       }
//     };

//     run();
//   }, []);

//   const onRate = (movieId, value) => {
//     setRatings((r) => ({ ...r, [movieId]: Number(value) }));
//   };

//   const onSubmit = async (e) => {
//     e.preventDefault();
//     if (!allAnswered) return;
//     setSubmitting(true);
//     setError("");

//     try {
//       const uid = user?.uid || "anonymous";
//       const payload = {
//         userId: uid,
//         createdAt: serverTimestamp(),
//         answers: movies.map((m) => ({
//           movieId: m.movieId || m.id,
//           title: m.title || m.name || "",
//           genres: m.genres || [],
//           rating: ratings[m.id],
//         })),
//       };

//       const docRef = await addDoc(collection(db, "surveyResponses"), payload);
//       setSubmittedId(docRef.id);

//       await Promise.all(
//         movies.map((m) => {
//           const mid = String(m.movieId || m.id);
//           const rid = `${uid}_${mid}`;
//           return setDoc(
//             doc(db, "ratings", rid),
//             {
//               userId: uid,
//               movieId: mid,
//               rating: Number(ratings[m.id]),
//               timestamp: serverTimestamp(),
//               title: m.title || m.name || "",
//               genres: m.genres || [],
//               surveyRef: docRef.id,
//             },
//             { merge: true }
//           );
//         })
//       );

//       // ⬇️ NEW: run the backend pipeline, then navigate with results
//       let explanations = [];
//       try {
//         const resp = await runCombinedBiases(10); // or 100 if you like
//         explanations = resp.explanations || [];
//       } catch (err) {
//         console.warn("runCombinedBiases failed:", err);
//       }

//       navigate("/recommend", { state: { explanations } });
//     } catch (e) {
//       console.error(e);
//       setError("Failed to submit responses. Please try again.");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   if (loading) return <section className="p-6">Loading movies…</section>;
//   if (error) return <section className="p-6 text-red-600">{error}</section>;
//   if (submittedId) return <section className="p-6">Thank you! Your survey ID: {submittedId}</section>;

//   return (
//     <section className="survey-shell">
//       <h2 className="survey-title">Movie Survey</h2>
//       <p className="survey-sub">Rate your favorite movies to get personalized recommendations!</p>

//       <form onSubmit={onSubmit}>
//         <div className="survey-grid">
//           {movies.length === 0 ? (
//             <p>No movies found.</p>
//           ) : (
//             movies.map((m, idx) => (
//               <div key={m.id} className="survey-card">
//                 <div className="card-left">
//                   <div className="poster-frame">
//                     <img
//                       src={m.poster || fallbackPoster}
//                       alt={m.title}
//                       className="poster-img"
//                     />
//                   </div>
//                 </div>
//                 <div className="card-right">
//                   <h3 className="card-title">{idx + 1}. {m.title || m.name}</h3>
//                   <div className="card-meta">{(m.genres || []).join(", ")}</div>
//                   <div className="rating-row">
//                     {[1, 2, 3, 4, 5].map((v) => (
//                       <div
//                         key={v}
//                         className={`rate-pill ${ratings[m.id] === v ? "active" : ""}`}
//                         onClick={() => onRate(m.id, v)}
//                       >
//                         <span className="pill-text">{v}</span>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//             ))
//           )}
//         </div>

//         <div className="floating-submit">
//           <button type="submit" className="submit-btn" disabled={!allAnswered || submitting}>
//             {submitting ? "Submitting…" : "Submit"}
//           </button>
//         </div>
//       </form>
//     </section>
//   );
// }


// src/pages/Survey.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthProvider";
import fallbackPoster from "../assets/logo.png";

import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  doc,
} from "firebase/firestore";

import { runCombinedBiases } from "../lib/api";
import "./Survey.css";

// ---- helpers ------------------------------------------------------
const parseGenres = (gArr, gStr) => {
  if (Array.isArray(gArr) && gArr.length) return gArr.map((x) => String(x).trim());
  if (typeof gStr === "string" && gStr.length) {
    return gStr
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const uniq = (arr) => Array.from(new Set(arr));
const ratingKey = (movieId) => `rating:${movieId}`;
const getLocalRating = (movieId) => Number(localStorage.getItem(ratingKey(movieId))) || 0;
const setLocalRating = (movieId, rating) => localStorage.setItem(ratingKey(movieId), String(rating));

function StarRating({ value, onChange, size = 20 }) {
  return (
    <div className="stars" role="radiogroup" aria-label="Rate">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="star"
          aria-checked={value === n}
          role="radio"
          onClick={() => onChange(n)}
          title={`${n} star${n > 1 ? "s" : ""}`}
          style={{ fontSize: size }}
        >
          {n <= value ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}

// ---- component ----------------------------------------------------
export default function Survey() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // raw movie docs (we’ll keep enough for filtering on the client)
  const [allMovies, setAllMovies] = useState([]);

  // UI state
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");

  // ratings map: movieId -> 1..5
  const [ratings, setRatings] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState(null);

  // ------- load movies (one time) ---------------------------------
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        // Pull a chunk of movies; adjust limit if you need more
        const snap = await getDocs(query(collection(db, "movies"), limit(1000)));
        const rows = snap.docs.map((d) => {
          const data = d.data() || {};
          const genres = parseGenres(data.genres, data.genresStr);
          const movieId = String(data.movieId || d.id);

          // seed ratings from localStorage for a nicer UX
          const seed = getLocalRating(movieId);

          return {
            id: d.id, // firestore doc id
            movieId,
            title: data.title || data.name || "Untitled",
            genres,
            poster: data.poster || data.image || null,
            _seedRating: seed,
          };
        });

        setAllMovies(rows);
        // prime state ratings from localStorage
        if (rows.length) {
          const seeded = {};
          rows.forEach((m) => {
            if (m._seedRating > 0) seeded[m.movieId] = m._seedRating;
          });
          if (Object.keys(seeded).length) setRatings((r) => ({ ...seeded, ...r }));
        }
      } catch (e) {
        console.error(e);
        setError("Failed to load movies. Please verify your Firestore collection.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ------- derived data -------------------------------------------
  const allGenres = useMemo(() => {
    const g = allMovies.flatMap((m) => m.genres);
    return ["All", ...uniq(g).sort((a, b) => a.localeCompare(b))];
  }, [allMovies]);

  const lcQuery = search.trim().toLowerCase();
  const matchesSearch = (m) => !lcQuery || m.title.toLowerCase().includes(lcQuery);
  const matchesGenre = (m) =>
    selectedGenre === "All" ? true : Array.isArray(m.genres) && m.genres.includes(selectedGenre);

  // group shown at the top (must match both filters)
  const selectedGroup = useMemo(
    () => allMovies.filter((m) => matchesSearch(m) && matchesGenre(m)),
    [allMovies, search, selectedGenre]
  );

  // full list (affected by search only)
  const allList = useMemo(() => allMovies.filter(matchesSearch), [allMovies, search]);

  // ------- interactions -------------------------------------------
  const setRating = (movie, n) => {
    setRatings((r) => {
      const next = { ...r, [movie.movieId]: n };
      setLocalRating(movie.movieId, n); // persist locally, too
      return next;
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const uid = user?.uid || "anonymous";

      // collect only rated movies
      const rated = allMovies
        .filter((m) => Number(ratings[m.movieId]) > 0)
        .map((m) => ({
          movieId: m.movieId,
          title: m.title,
          genres: m.genres,
          rating: Number(ratings[m.movieId]),
        }));

      if (rated.length === 0) {
        setError("Please rate at least one movie before submitting.");
        setSubmitting(false);
        return;
      }

      // surveyResponses
      const payload = {
        userId: uid,
        createdAt: serverTimestamp(),
        filters: {
          search: lcQuery || null,
          selectedGenre: selectedGenre === "All" ? null : selectedGenre,
        },
        answers: rated,
      };

      const docRef = await addDoc(collection(db, "surveyResponses"), payload);
      setSubmittedId(docRef.id);

      // ratings (one per movie)
      await Promise.all(
        rated.map((r) => {
          const rid = `${uid}_${r.movieId}`;
          return setDoc(
            doc(db, "ratings", rid),
            {
              userId: uid,
              movieId: r.movieId,
              rating: r.rating,
              timestamp: serverTimestamp(),
              title: r.title,
              genres: r.genres,
              surveyRef: docRef.id,
            },
            { merge: true }
          );
        })
      );

      // optional backend pipeline
      let explanations = [];
      try {
        const resp = await runCombinedBiases(10);
        explanations = resp?.explanations || [];
      } catch (err) {
        console.warn("runCombinedBiases failed:", err);
      }

      navigate("/recommend", { state: { explanations } });
    } catch (e) {
      console.error(e);
      setError("Failed to submit responses. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ------- render --------------------------------------------------
  if (loading) return <section className="p-6">Loading movies…</section>;
  if (error) return <section className="p-6 text-red-600">{error}</section>;
  if (submittedId) return <section className="p-6">Thank you! Your survey ID: {submittedId}</section>;

  return (
    <section className="survey-shell">
      <h2 className="survey-title">Rate Movies</h2>
      <p className="survey-sub">
        Search, filter by genre, and rate movies with the ⭐ bar. Your selections are saved locally
        and submitted to improve recommendations.
      </p>

      {/* Controls */}
      <div className="controls-row">
        <input
          className="search-input"
          placeholder="Search movie title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="genre-select"
          value={selectedGenre}
          onChange={(e) => setSelectedGenre(e.target.value)}
        >
          {allGenres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-reset"
          onClick={() => {
            setSearch("");
            setSelectedGenre("All");
          }}
        >
          Reset
        </button>
      </div>

      {/* Chips / stats */}
      <div className="chips">
        <span className="chip">Total: {allMovies.length}</span>
        <span className="chip">Genres: {Math.max(0, allGenres.length - 1)}</span>
        {search ? <span className="chip">Search: “{search}”</span> : null}
        {selectedGenre !== "All" ? <span className="chip">Genre: {selectedGenre}</span> : null}
      </div>

      {/* Selected Genre Group */}
      <section className="group">
        <h3 className="group-title">
          Selected Genre <span className="badge">{selectedGenre}</span>
        </h3>
        <div className="legend">Movies that match both the search and chosen genre.</div>
        <div className="grid-list">
          {selectedGroup.length === 0 ? (
            <div className="muted">No movies match the current filters.</div>
          ) : (
            selectedGroup.map((m) => (
              <article key={m.id} className="movie-card">
                <div className="poster-frame">
                  <img src={m.poster || fallbackPoster} alt={m.title} className="poster-img" />
                </div>
                <div className="movie-body">
                  <div className="movie-title">{m.title}</div>
                  <div className="movie-sub">{m.genres.join(" · ")}</div>
                  <StarRating
                    value={Number(ratings[m.movieId]) || 0}
                    onChange={(n) => setRating(m, n)}
                  />
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {/* All Movies (search only) */}
      <section className="group">
        <h3 className="group-title">All Movies</h3>
        <div className="legend">Full catalog (affected by search only).</div>
        <div className="grid-list">
          {allList.map((m) => (
            <article key={m.id} className="movie-card">
              <div className="poster-frame">
                <img src={m.poster || fallbackPoster} alt={m.title} className="poster-img" />
              </div>
              <div className="movie-body">
                <div className="movie-title">{m.title}</div>
                <div className="movie-sub">{m.genres.join(" · ")}</div>
                <StarRating
                  value={Number(ratings[m.movieId]) || 0}
                  onChange={(n) => setRating(m, n)}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <form onSubmit={onSubmit}>
        <div className="floating-submit">
          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </section>
  );
}
