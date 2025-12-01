import { useState, useEffect, useMemo } from "react";
import { fetchOmdbData, fine_tune_recommend } from "../lib/api";
import "../style/MovieSurvey.css";
import MovieCard from "./MovieCard";
import { useAuth } from "../auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp, writeBatch, doc } from "firebase/firestore";
export default function MovieSurvey() {
    const { user } = useAuth();
    const navigate = useNavigate();

    // -------------------- State --------------------
    const [allMovies, setAllMovies] = useState([]);
    const [details, setDetails] = useState({});
    const [expanded, setExpanded] = useState({});
    const [ratings, setRatings] = useState({});
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState("");
    const [genre, setGenre] = useState("All");
    const [year, setYear] = useState("All");
    const [genreList, setGenreList] = useState([]);

    const pageSize = 30;
    const [page, setPage] = useState(1);

    const [submitting, setSubmitting] = useState(false);

    // -------------------- Load Local Movies --------------------
    useEffect(() => {
        async function load() {
            const res = await fetch("/data/movies.json");
            const data = await res.json();
            setAllMovies(data);
            setLoading(false);
        }
        load();
    }, []);

    // -------------------- Build Genre List --------------------
    useEffect(() => {
        const setOfGenres = new Set();
        allMovies.forEach((m) =>
            m.genres?.forEach((g) => setOfGenres.add(g))
        );
        setGenreList(["All", ...Array.from(setOfGenres).sort()]);
    }, [allMovies]);

    // -------------------- Filter Movies --------------------
    const filteredMovies = useMemo(() => {
        return allMovies.filter((m) => {
            const title = m.title?.toLowerCase() ?? "";
            const matchSearch = title.includes(search.toLowerCase());
            const matchGenre =
                genre === "All" || m.genres?.includes(genre);

            const yearVal = m.year ? parseInt(m.year) : 0;
            const matchYear =
                year === "All" ||
                (year === "before2000" && yearVal < 2000) ||
                (year === "2000to2010" && yearVal >= 2000 && yearVal <= 2010) ||
                (year === "after2010" && yearVal > 2010);

            return matchSearch && matchGenre && matchYear;
        });
    }, [allMovies, search, genre, year]);

    // -------------------- Visible Movies (pagination) --------------------
    const visibleMovies = useMemo(() => {
        return filteredMovies.slice(0, page * pageSize);
    }, [filteredMovies, page]);

    // -------------------- Prefetch posters (only visible movies) --------------------
    useEffect(() => {
        async function prefetch() {
            for (const m of visibleMovies) {
                if (details[m.id]?.poster) continue;

                await new Promise(r => setTimeout(r, 300));

                const info = await fetchOmdbData(m.title);
                if (info?.poster) {
                    setDetails(prev => ({
                        ...prev,
                        [m.id]: {
                            ...(prev[m.id] || {}),
                            poster: info.poster
                        }
                    }));
                }
            }
        }
        prefetch();
    }, [visibleMovies]);


    // -------------------- Expand Card --------------------
    const toggleExpand = async (m) => {
        setExpanded((prev) => ({ ...prev, [m.id]: !prev[m.id] }));

        if (!details[m.id]?.plot) {
            const info = await fetchOmdbData(m.title);
            if (info) {
                setDetails((prev) => ({
                    ...prev,
                    [m.id]: { ...prev[m.id], ...info },
                }));
            }
        }
    };

    const onRate = (id, val) => {
        setRatings((r) => ({ ...r, [id]: val }));
    };

    async function handleSubmit() {
        if (submitting) return; // CHANGED: prevent double-submit
        const ratedMovies = visibleMovies
            .filter((m) => ratings[m.id])
            .map((m) => ({
                movieId: m.id,
                title: m.title,
                rating: ratings[m.id],
                genres: m.genres,
            }));
    
        if (!ratedMovies.length) {
            alert("Please rate at least one movie!");
            return;
        }
    
        setSubmitting(true);
    
        try {
            // CHANGED: BATCH WRITE instead of looped addDoc
            const batch = writeBatch(db);
    
            ratedMovies.forEach((r) => {
                const ref = doc(collection(db, "ratings"));
                batch.set(ref, {
                    userId: user.uid,
                    movieId: r.movieId,
                    rating: r.rating,
                    createdAt: serverTimestamp()
                });
            });
    
            await batch.commit(); // CHANGED: single network operation
    
            // CHANGED: send ratings directly to backend (NO Firestore re-read)
            const resp = await fine_tune_recommend({
                ratings: ratedMovies   // CHANGED: payload added
            });
    
            const explanations = resp?.recommendations || [];
    
            navigate("/recommend", { 
                state: { fromSurvey: true, explanations } 
            });
    
        } catch (err) {
            console.error(err);
            alert("Failed to generate recommendations.");
        } finally {
            setSubmitting(false);
        }
    }

    if (submitting) {
        return (
            <section className="survey-shell loading-screen">
                <h2>🧠 Generating Your Personalized Recommendations...</h2>
                <p>Please wait while our AI analyzes your preferences.</p>
                <div className="spinner"></div>
            </section>
        );
    }
    

    // -------------------- Render --------------------
    return (
        <section className="survey-shell">
            <h2 className="survey-title">🎬 Movie Survey</h2>

            {/* Filters */}
            <div className="controls-row">
                <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                    }}
                />

                <select
                    value={genre}
                    onChange={(e) => {
                        setGenre(e.target.value);
                        setPage(1);
                    }}
                >
                    {genreList.map((g) => (
                        <option key={g} value={g}>{g}</option>
                    ))}
                </select>

                <select
                    value={year}
                    onChange={(e) => {
                        setYear(e.target.value);
                        setPage(1);
                    }}
                >
                    <option value="All">All Years</option>
                    <option value="before2000">Before 2000</option>
                    <option value="2000to2010">2000–2010</option>
                    <option value="after2010">After 2010</option>
                </select>
            </div>

            {loading ? (
                <p>Loading...</p>
            ) : (
                <div className="grid-list">
                    {visibleMovies.map((m) => (
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
            )}

            {/* Load More */}
            {visibleMovies.length < filteredMovies.length && (
                <div className="load-more">
                    <button onClick={() => setPage(page + 1)}>Load Next Page →</button>
                </div>
            )}

            {/* ✅ ✅ ✅ SUBMIT BUTTON DISABLED DURING LOADING */}
            <div className="floating-submit">
                <button 
                    className="submit-btn" 
                    onClick={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? "Processing..." : "Submit Ratings"}
                </button>
            </div>
        </section>
    );
}
