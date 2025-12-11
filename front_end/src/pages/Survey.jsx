
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDoc, getDocs, query, doc } from "firebase/firestore";
import { useAuth } from "../auth/AuthProvider";
import PersonalInfoForm from "../components/PersonalInfoForm";
import MovieSurvey from "../components/MovieSurvey";
import "../style/Survey.css";

export default function Survey() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [allMovies, setAllMovies] = useState([]);

  // Step 1: check profile
  useEffect(() => {
    if (!user?.uid) return;

    (async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d = snap.data();
        if (d.gender || d.age || d.occupation || d.zipcode) setStep(2);
      }
      setChecking(false);
    })();
  }, [user]);

  // Step 2: load movies from local JSON (0 Firestore reads)
  useEffect(() => {
    if (step !== 2) return;
    if (allMovies.length > 0) return;

    (async () => {
      try {
        const res = await fetch("/data/movies.json");
        const data = await res.json();

        // Normalize structure (your MovieSurvey.jsx expects id/title/genres/poster)
        const rows = data.map((m) => ({
          id: m.id,
          title: m.title,
          genres: m.genres || [],
          poster: m.poster || null,
        }));

        setAllMovies(rows);
      } catch (e) {
        console.error(e);
        setError("Failed to load local movies.json");
      }
    })();
  }, [step, allMovies.length]);


  if (checking) return <p>Checking profile...</p>;
  if (step === 1)
    return (
      <PersonalInfoForm
        user={user}
        onNext={() => setStep(2)}
        error={error}
        setError={setError}
      />
    );

  return <MovieSurvey allMovies={allMovies} setAllMovies={setAllMovies} />;
}
