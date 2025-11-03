// src/components/MovieSurvey.jsx
import { useState, useEffect, useMemo } from "react";
import { fetchOmdbData } from "../lib/api";
import "../style/MovieSurvey.css";
import { db } from "../firebase";
import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    startAfter,
} from "firebase/firestore";
import MovieCard from "./MovieCard";
import { useAuth } from "../auth/AuthProvider";
import { addDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function MovieSurvey() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [movies, setMovies] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [details, setDetails] = useState({});
    const [ratings, setRatings] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // ✅ Pagination states
    const [pageSize] = useState(30);
    const [lastDoc, setLastDoc] = useState(null);
    const [hasMore, setHasMore] = useState(true);

    // ✅ Filter states
    const [search, setSearch] = useState("");
    const [genre, setGenre] = useState("All");
    const [year, setYear] = useState("All");
    const [ratingFilter, setRatingFilter] = useState("All");

    // reset when filters change
    useEffect(() => {
        setMovies([]);
        setLastDoc(null);
        setHasMore(true);
        loadMovies(true);
    }, [search, genre, year, ratingFilter]);

    // 🔍 load movies (paged Firestore query)
    async function loadMovies(reset = false) {
        if (loading) return;
        if (!hasMore && !reset) return;

        setLoading(true);
        setError("");

        try {
            let q = query(collection(db, "movies"), orderBy("title"), limit(pageSize));

            if (lastDoc && !reset) {
                q = query(
                    collection(db, "movies"),
                    orderBy("title"),
                    startAfter(lastDoc),
                    limit(pageSize)
                );
            }

            const snap = await getDocs(q);
            if (snap.empty) {
                setHasMore(false);
                setLoading(false);
                return;
            }

            const newDocs = snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            }));

            // ✅ 前端过滤逻辑
            const filtered = newDocs.filter((m) => {
                const title = m.title?.toLowerCase() || "";
                const matchSearch = !search || title.includes(search.toLowerCase());
                const matchGenre =
                    genre === "All" ||
                    (Array.isArray(m.genres) && m.genres.includes(genre)) ||
                    (typeof m.genres === "string" && m.genres.includes(genre));
                const yearVal =
                    m.year ||
                    (m.title?.match(/\((\d{4})\)/)
                        ? parseInt(m.title.match(/\((\d{4})\)/)[1])
                        : 0);
                const matchYear =
                    year === "All" ||
                    (year === "before2000" && yearVal < 2000) ||
                    (year === "2000to2010" && yearVal >= 2000 && yearVal <= 2010) ||
                    (year === "after2010" && yearVal > 2010);
                const imdb = Number(m.imdbRating || m.rating || 0);
                const matchRating =
                    ratingFilter === "All" ||
                    (ratingFilter === "gt8" && imdb > 8) ||
                    (ratingFilter === "gt7" && imdb > 7) ||
                    (ratingFilter === "lt6" && imdb < 6);

                return matchSearch && matchGenre && matchYear && matchRating;
            });

            // ✅ enrich OMDb poster
            const enriched = await Promise.all(
                filtered.map(async (m) => {
                    if (m.poster) return m;
                    const info = await fetchOmdbData(m.title);
                    return info?.poster ? { ...m, poster: info.poster } : m;
                })
            );

            setMovies((prev) => (reset ? enriched : [...prev, ...enriched]));
            setLastDoc(snap.docs[snap.docs.length - 1]);
            setHasMore(snap.docs.length === pageSize);
        } catch (e) {
            console.error(e);
            setError("Failed to load movies.");
        } finally {
            setLoading(false);
        }
    }

    // Expand movie details
    const toggleExpand = (m) =>
        setExpanded((prev) => ({ ...prev, [m.id]: !prev[m.id] }));

    // ⭐ Rating change
    const onRate = (id, val) =>
        setRatings((r) => ({ ...r, [id]: val }));

    // 💾 Submit to Firestore
    // 💾 Submit to Firestore
    async function handleSubmit(e) {
        e.preventDefault();
        const uid = user?.uid || "anon";

        // 只提交用户评分过的电影
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
            // 🧾 写入 surveyResponses
            const surveyRef = await addDoc(collection(db, "surveyResponses"), {
                userId: uid,
                filters: { search, genre, year, ratingFilter },
                createdAt: serverTimestamp(),
            });

            // 🎬 同步写入 ratings 集合
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

            console.log("✅ All ratings saved!");
            navigate("/recommend", { state: { fromSurvey: true } });
        } catch (err) {
            console.error("❌ Firestore submit failed:", err);
            alert("Submit failed. Please try again.");
        }
        navigate("/recommend", { state: { fromSurvey: true } });
    }


    return (
        <section className="survey-shell">
            <h2 className="survey-title">🎬 Movie Survey</h2>
            <p className="survey-sub">Filter movies by genre, year, and rating — then rate them!</p>

            {/* 🔍 Filters */}
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

            {/* 🎬 Movie cards */}
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

            {/* 🔽 Pagination */}
            {hasMore && !loading && (
                <div className="load-more">
                    <button className="load-btn" onClick={() => loadMovies(false)}>
                        Load Next Page →
                    </button>
                </div>
            )}

            {/* 🧾 Submit */}
            <div className="floating-submit">
                <button className="submit-btn" onClick={handleSubmit}>
                    Submit Ratings
                </button>
            </div>
        </section>
    );
}
