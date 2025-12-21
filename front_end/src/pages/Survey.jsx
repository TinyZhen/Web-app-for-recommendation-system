/**
 * @file Survey.jsx
 * @brief Multi-step onboarding survey controller.
 *
 * This page coordinates the user onboarding flow by:
 * 1. Checking whether the authenticated user has completed their
 *    personal profile information stored in Firestore.
 * 2. Loading a local movie catalog and launching the movie survey
 *    once profile requirements are satisfied.
 *
 * The component minimizes Firestore usage by:
 * - Performing a single document read to check profile completion
 * - Loading movie data exclusively from a local JSON file
 */
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDoc, getDocs, query, doc } from "firebase/firestore";
import { useAuth } from "../auth/AuthProvider";
import PersonalInfoForm from "../components/PersonalInfoForm";
import MovieSurvey from "../components/MovieSurvey";
import "../style/Survey.css";

/**
 * @brief Survey page component.
 *
 * Acts as a step-based controller that conditionally renders:
 * - A personal information form for new users
 * - The movie survey interface for users with completed profiles
 *
 * The component tracks the current step and handles asynchronous
 * checks against Firestore to determine profile completion.
 *
 * @returns {JSX.Element} Survey flow UI.
 */
export default function Survey() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [allMovies, setAllMovies] = useState([]);

  /**
   * @brief Step 1: Check whether the user's profile is complete.
   *
   * Fetches the authenticated user's document from Firestore and
   * determines whether required personal information fields exist.
   * Automatically advances the survey flow if profile data is found.
   */
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

  /**
   * @brief Step 2: Load local movie catalog.
   *
   * Loads movie data from a local JSON file and normalizes it into
   * the structure expected by the MovieSurvey component. This avoids
   * unnecessary Firestore reads and improves performance.
   */
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
