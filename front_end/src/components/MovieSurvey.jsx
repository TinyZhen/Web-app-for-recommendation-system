// src/components/MovieSurvey.jsx
import { useState, useEffect } from "react";
import { fetchOmdbData, runCombinedBiases } from "../lib/api";
import { fine_tune_recommend } from "../lib/api";
import "../style/MovieSurvey.css";
import { db } from "../firebase";
import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    startAfter,
    addDoc,
    doc,
    setDoc,
    serverTimestamp,
} from "firebase/firestore";
import MovieCard from "./MovieCard";
import { useAuth } from "../auth/AuthProvider";
import { useNavigate } from "react-router-dom";

export default function MovieSurvey() {
    const { user } = useAuth();
    const navigate = useNavigate();

    // -------------------- State --------------------
    const [movies, setMovies] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [details, setDetails] = useState({});
    const [ratings, setRatings] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Pagination
    const [pageSize] = useState(30);
    const [lastDoc, setLastDoc] = useState(null);
    const [hasMore, setHasMore] = useState(true);

    // Filters
    const [search, setSearch] = useState("");
    const [genre, setGenre] = useState("All");
    const [year, setYear] = useState("All");
    const [ratingFilter, setRatingFilter] = useState("All");

    // Reload data when filters change
    useEffect(() => {
        setMovies([]);
        setLastDoc(null);
        setHasMore(true);
        loadMovies(true);
    }, [search, genre, year, ratingFilter]);

    // -------------------- Fetch & Filter --------------------
    async function fetchMovieDetails(title) {
        try {
            const res = await fetch(
                `https://www.omdbapi.com/?apikey=你的KEY&t=${encodeURIComponent(title)}&plot=full`
            );
            const data = await res.json();

            return {
                plot: data.Plot !== "N/A" ? data.Plot : "",
                year: data.Year,
                director: data.Director,
                actors: data.Actors
            };
        } catch (e) {
            console.error("fetchMovieDetails failed:", e);
            return null;
        }
    }

    // -------------------- Load Movies from movies.dat --------------------
async function loadMovies(reset = false) {
    if (loading) return;
    if (!hasMore && !reset) return;

    setLoading(true);
    setError("");

    try {
        // Load full file once per refresh
        const resp = await fetch("/data/movies.dat");   // ← your local file in public/data/
        const text = await resp.text();

        // Parse MovieLens format
        const allMovies = text
            .split("\n")
            .filter((line) => line.trim().length > 0)
            .map((line) => {
                const [id, title, genres] = line.split("::");
                return {
                    id,
                    title,
                    genres: genres?.split("|") || [],
                    year: (() => {
                        const match = title.match(/\((\d{4})\)/);
                        return match ? parseInt(match[1]) : null;
                    })(),
                };
            });

        // ------------------------------------------------
        // Frontend filters (same as Firestore version)
        // ------------------------------------------------
        const filtered = allMovies.filter((m) => {
            const t = m.title.toLowerCase();
            const matchSearch = !search || t.includes(search.toLowerCase());

            const matchGenre =
                genre === "All" || (Array.isArray(m.genres) && m.genres.includes(genre));

            const matchYear =
                year === "All" ||
                (year === "before2000" && m.year < 2000) ||
                (year === "2000to2010" && m.year >= 2000 && m.year <= 2010) ||
                (year === "after2010" && m.year > 2010);

            // Note: MovieLens has no imdbRating → treat as 0
            const imdb = 0;
            const matchRating =
                ratingFilter === "All" ||
                (ratingFilter === "gt8" && imdb > 8) ||
                (ratingFilter === "gt7" && imdb > 7) ||
                (ratingFilter === "lt6" && imdb < 6);

            return matchSearch && matchGenre && matchYear && matchRating;
        });

        // ------------------------------------------------
        // Pagination: slice manually instead of Firestore
        // ------------------------------------------------
        const startIndex = reset ? 0 : movies.length;
        const page = filtered.slice(startIndex, startIndex + pageSize);

        if (page.length < pageSize) setHasMore(false);

        // ----------------------------------------
        // Enrich with OMDb posters if missing
        // ----------------------------------------
        const enriched = await Promise.all(
            page.map(async (m) => {
                const info = await fetchOmdbData(m.title);
                return info?.poster ? { ...m, poster: info.poster } : m;
            })
        );

        setMovies((prev) => (reset ? enriched : [...prev, ...enriched]));
    } catch (err) {
        console.error(err);
        setError("Failed to load movies from movies.dat");
    } finally {
        setLoading(false);
    }
}

    // async function loadMovies(reset = false) {
    //     if (loading) return;
    //     if (!hasMore && !reset) return;

    //     setLoading(true);
    //     setError("");

    //     try {
    //         // Base query sorted by title
    //         let q = query(collection(db, "movies"), orderBy("title"), limit(pageSize));

    //         // Continue from the last document if not reset
    //         if (lastDoc && !reset) {
    //             q = query(
    //                 collection(db, "movies"),
    //                 orderBy("title"),
    //                 startAfter(lastDoc),
    //                 limit(pageSize)
    //             );
    //         }

    //         const snap = await getDocs(q);
    //         if (snap.empty) {
    //             setHasMore(false);
    //             setLoading(false);
    //             return;
    //         }

    //         const newDocs = snap.docs.map((d) => ({
    //             id: d.id,
    //             ...d.data(),
    //         }));

    //         // Apply frontend filters
    //         const filtered = newDocs.filter((m) => {
    //             const title = m.title?.toLowerCase() || "";
    //             const matchSearch = !search || title.includes(search.toLowerCase());
    //             const matchGenre =
    //                 genre === "All" ||
    //                 (Array.isArray(m.genres) && m.genres.includes(genre)) ||
    //                 (typeof m.genres === "string" && m.genres.includes(genre));

    //             const yearVal =
    //                 m.year ||
    //                 (m.title?.match(/\((\d{4})\)/)
    //                     ? parseInt(m.title.match(/\((\d{4})\)/)[1])
    //                     : 0);
    //             const matchYear =
    //                 year === "All" ||
    //                 (year === "before2000" && yearVal < 2000) ||
    //                 (year === "2000to2010" && yearVal >= 2000 && yearVal <= 2010) ||
    //                 (year === "after2010" && yearVal > 2010);

    //             const imdb = Number(m.imdbRating || m.rating || 0);
    //             const matchRating =
    //                 ratingFilter === "All" ||
    //                 (ratingFilter === "gt8" && imdb > 8) ||
    //                 (ratingFilter === "gt7" && imdb > 7) ||
    //                 (ratingFilter === "lt6" && imdb < 6);

    //             return matchSearch && matchGenre && matchYear && matchRating;
    //         });

    //         // Enrich with OMDb poster data if missing
    //         const enriched = await Promise.all(
    //             filtered.map(async (m) => {
    //                 if (m.poster) return m;
    //                 const info = await fetchOmdbData(m.title);
    //                 return info?.poster ? { ...m, poster: info.poster } : m;
    //             })
    //         );

    //         // Update state
    //         setMovies((prev) => (reset ? enriched : [...prev, ...enriched]));
    //         setLastDoc(snap.docs[snap.docs.length - 1]);
    //         setHasMore(snap.docs.length === pageSize);
    //     } catch (e) {
    //         console.error(e);
    //         setError("Failed to load movies.");
    //     } finally {
    //         setLoading(false);
    //     }
    // }

    // -------------------- UI Handlers --------------------
    const toggleExpand = async (m) => {
        setExpanded((prev) => ({ ...prev, [m.id]: !prev[m.id] }));
        if (!details[m.id]) {
            // console.log("Fetching OMDB details for:", m.title);
            const info = await fetchOmdbData(m.title);

            // console.log("OMDB returned:", info);

            if (info) {
                setDetails((prev) => ({ ...prev, [m.id]: info }));
            }
        }
    };

    const onRate = (id, val) =>
        setRatings((r) => ({ ...r, [id]: val }));

    // -------------------- Submit Ratings --------------------
    async function handleSubmit(e) {
        e.preventDefault();
        const uid = user?.uid || "anon";

        // Only submit rated movies
        const ratedMovies = movies
            .filter((m) => ratings[m.id])
            .map((m) => ({
                movieId: m.id,
                title: m.title,
                genres: Array.isArray(m.genres)
                    ? m.genres
                    : typeof m.genres === "string"
                        ? m.genres.split("|")
                        : [],
                rating: ratings[m.id],
            }));

        if (!ratedMovies.length) {
            alert("Please rate at least one movie!");
            return;
        }

        try {
            // Save survey metadata
            const surveyRef = await addDoc(collection(db, "surveyResponses"), {
                userId: uid,
                filters: { search, genre, year, ratingFilter },
                createdAt: serverTimestamp(),
            });

            // Save individual ratings
            for (const r of ratedMovies) {
                await setDoc(
                    doc(db, "ratings", `${uid}_${r.movieId}`),
                    {
                        userId: uid,
                        movieId: r.movieId,
                        title: r.title,
                        genres: r.genres,
                        rating: r.rating,
                        timestamp: serverTimestamp(),
                        surveyRef: surveyRef.id,
                    },
                    { merge: true }
                );
            }

            console.log("✅ Ratings successfully saved.");

            // ⬇️ NEW: run the backend pipeline, then navigate with results
            let explanations = [];
            try {
                // const resp = await runCombinedBiases(10); // or 100 if you like
                // explanations = resp.explanations || [];
                const resp = await fine_tune_recommend();
                explanations = resp.recommendations || [];
            } catch (err2) {
                // console.warn("runCombinedBiases failed:", err2);
                console.warn("fine_tune_recommend failed:", err2);
            }

            // keep fromSurvey so existing behavior isn't broken, and also pass explanations like before
            navigate("/recommend", { state: { fromSurvey: true, explanations } });

        } catch (err) {
            console.error("❌ Firestore submission failed:", err);
            alert("Submit failed. Please try again.");
        }
    }

    // -------------------- Render --------------------
    return (
        <section className="survey-shell">
            <h2 className="survey-title">🎬 Movie Survey</h2>
            <p className="survey-sub">
                Filter movies by genre, year, and rating — then rate your favorites!
            </p>

            {/* Filter controls */}
            <div className="controls-row">
                <input
                    type="text"
                    placeholder="Search..."
                    className="search-input"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <select
                    value={genre}
                    className="genre-select"
                    onChange={(e) => setGenre(e.target.value)}
                >
                    <option>All</option>
                    <option>Action</option>
                    <option>Comedy</option>
                    <option>Drama</option>
                    <option>Horror</option>
                    <option>Romance</option>
                </select>
                <select
                    value={year}
                    className="year-select"
                    onChange={(e) => setYear(e.target.value)}
                >
                    <option value="All">All Years</option>
                    <option value="before2000">Before 2000</option>
                    <option value="2000to2010">2000–2010</option>
                    <option value="after2010">After 2010</option>
                </select>
                <select
                    value={ratingFilter}
                    className="rating-select"
                    onChange={(e) => setRatingFilter(e.target.value)}
                >
                    <option value="All">All Ratings</option>
                    <option value="gt8">&gt; 8.0</option>
                    <option value="gt7">&gt; 7.0</option>
                    <option value="lt6">&lt; 6.0</option>
                </select>
            </div>

            {error && <p className="text-red-500">{error}</p>}
            {loading && <p>Loading...</p>}

            {/* Movie grid */}
            <div className="grid-list">
                {movies.map((m) => (
                    <MovieCard
                        key={m.id}
                        movie={m}
                        info={details[m.id]}
                        expanded={expanded[m.id]}
                        rating={ratings[m.id]}
                        onToggle={() => toggleExpand(m)}
                        onRate={(v) => onRate(m.id, v)}
                    />
                ))}
            </div>

            {/* Pagination */}
            {hasMore && !loading && (
                <div className="load-more">
                    <button className="load-btn" onClick={() => loadMovies(false)}>
                        Load Next Page →
                    </button>
                </div>
            )}

            {/* Submit button */}
            <div className="floating-submit">
                <button className="submit-btn" onClick={handleSubmit}>
                    Submit Ratings
                </button>
            </div>
        </section>
    );
}
