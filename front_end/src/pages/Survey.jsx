// src/pages/Survey.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthProvider";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  where,
  serverTimestamp,
  setDoc,
  doc,
} from "firebase/firestore";

// ⬇️ NEW: call the backend pipeline
import { runCombinedBiases } from "../lib/api";

const NUM_QUESTIONS = 20;

function sampleOne(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function sampleMany(arr, k, excludeIds = new Set()) {
  const pool = arr.filter((x) => !excludeIds.has(x.id));
  const out = [];
  const used = new Set();
  while (out.length < k && pool.length > 0) {
    const m = sampleOne(pool);
    if (m && !used.has(m.id)) {
      out.push(m);
      used.add(m.id);
    }
  }
  return out;
}

const normalize = (g) => String(g || "").trim();

export default function Survey() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [movies, setMovies] = useState([]);
  const [ratings, setRatings] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState(null);

  const allAnswered = useMemo(
    () => movies.length === NUM_QUESTIONS && movies.every((m) => ratings[m.id] >= 1),
    [movies, ratings]
  );

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const someMoviesSnap = await getDocs(query(collection(db, "movies"), limit(500)));
        const gset = new Set();
        someMoviesSnap.forEach((doc) => {
          const data = doc.data();
          (data.genres || []).forEach((g) => gset.add(normalize(g)));
        });
        const genres = Array.from(gset);

        const targetGenres = genres.slice(0, Math.min(genres.length, NUM_QUESTIONS));
        const picked = [];
        const pickedIds = new Set();

        for (const g of targetGenres) {
          const poolSnap = await getDocs(
            query(collection(db, "movies"), where("genres", "array-contains", g), limit(50))
          );
          const pool = poolSnap.docs.map((d) => ({ id: d.id, ...d.data(), _genreHit: g }));
          const one = sampleOne(pool);
          if (one && !pickedIds.has(one.id)) {
            picked.push(one);
            pickedIds.add(one.id);
          }
        }

        if (picked.length < NUM_QUESTIONS) {
          const fillerSnap = await getDocs(query(collection(db, "movies"), limit(500)));
          const fillerPool = fillerSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const needed = NUM_QUESTIONS - picked.length;
          const fillers = sampleMany(fillerPool, needed, pickedIds);
          picked.push(...fillers);
        }

        const shuffled = [...picked].sort(() => Math.random() - 0.5).slice(0, NUM_QUESTIONS);
        setMovies(shuffled);
      } catch (e) {
        console.error(e);
        setError("Failed to load survey movies. Check your Firestore structure.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const onRate = (movieId, value) => {
    setRatings((r) => ({ ...r, [movieId]: Number(value) }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!allAnswered) return;
    setSubmitting(true);
    setError("");

    try {
      const uid = user?.uid || "anonymous";
      const payload = {
        userId: uid,
        createdAt: serverTimestamp(),
        answers: movies.map((m) => ({
          movieId: m.movieId || m.id,
          title: m.title || m.name || "",
          genres: m.genres || [],
          rating: ratings[m.id],
        })),
      };

      const docRef = await addDoc(collection(db, "surveyResponses"), payload);
      setSubmittedId(docRef.id);

      await Promise.all(
        movies.map((m) => {
          const mid = String(m.movieId || m.id);
          const rid = `${uid}_${mid}`;
          return setDoc(
            doc(db, "ratings", rid),
            {
              userId: uid,
              movieId: mid,
              rating: Number(ratings[m.id]),
              timestamp: serverTimestamp(),
              title: m.title || m.name || "",
              genres: m.genres || [],
              surveyRef: docRef.id,
            },
            { merge: true }
          );
        })
      );

      // ⬇️ NEW: run the backend pipeline, then navigate with results
      let explanations = [];
      try {
        const resp = await runCombinedBiases(10); // or 100 if you like
        explanations = resp.explanations || [];
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

  if (loading) return <section className="p-6">Loading movies…</section>;
  if (error) return <section className="p-6 text-red-600">{error}</section>;
  if (submittedId) return <section className="p-6">Thank you! Your survey ID: {submittedId}</section>;

  return (
    <section className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-2">Survey</h2>
      <form onSubmit={onSubmit} className="space-y-6">
        {movies.map((m, idx) => (
          <div key={m.id} className="border p-4 rounded-lg">
            <h3 className="font-semibold">{idx + 1}. {m.title}</h3>
            <div className="flex gap-4 mt-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <label key={v}>
                  <input
                    type="radio"
                    name={`rating-${m.id}`}
                    value={v}
                    checked={ratings[m.id] === v}
                    onChange={(e) => onRate(m.id, e.target.value)}
                    required
                  /> {v}
                </label>
              ))}
            </div>
          </div>
        ))}
        <button type="submit" disabled={!allAnswered || submitting} className="bg-black text-white px-4 py-2 rounded">
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </form>
    </section>
  );
}
