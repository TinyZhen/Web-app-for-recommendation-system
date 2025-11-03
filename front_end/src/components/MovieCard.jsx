// src/components/MovieCard.jsx
import fallbackPoster from "../assets/logo.png";
import StarRating from "./StarRating";

export default function MovieCard({ movie, info, expanded, loading, rating, onToggle, onRate }) {
    return (
        <article
            className={`movie-card ${expanded ? "open" : ""}`}
            onClick={onToggle}
        >
            <div className="poster-frame">
                <img src={movie.poster || fallbackPoster} alt={movie.title} />
            </div>

            <div className="movie-body">
                <div className="movie-title">
                    {movie.title}
                    {info?.year && <span className="movie-year"> ({info.year})</span>}
                </div>
                <div className="movie-sub">
                    {Array.isArray(movie.genres) ? movie.genres.join(" · ") : ""}
                </div>

                {expanded && (
                    <div className="movie-detail">
                        {loading ? (
                            <p className="loading-text">Loading details…</p>
                        ) : (
                            <>
                                <p className="movie-plot">{info?.plot || "No description available."}</p>
                                {info?.director && (
                                    <p>
                                        <strong>Director:</strong> {info.director}
                                    </p>
                                )}
                                {info?.actors && (
                                    <p>
                                        <strong>Actors:</strong> {info.actors}
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                )}

                <div onClick={(e) => e.stopPropagation()}>
                    <StarRating value={rating || 0} onChange={onRate} />
                </div>
            </div>
        </article>
    );
}
