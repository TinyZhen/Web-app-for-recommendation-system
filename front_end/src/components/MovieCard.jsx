// src/components/MovieCard.jsx
import fallbackPoster from "../assets/logo.png";
import StarRating from "./StarRating";

/**
 * MovieCard component
 *
 * @param {Object} props
 * @param {Object} props.movie - Minimal movie object (title, genres, poster)
 * @param {Object} [props.info] - Optional enriched info (poster, plot, director, actors, year)
 * @param {boolean} [props.expanded=false] - Whether the card is expanded to show details
 * @param {boolean} [props.loading=false] - Whether detail info is currently loading
 * @param {number} [props.rating] - User rating value (0-5)
 * @param {Function} [props.onToggle] - Click handler to toggle expand state
 * @param {Function} [props.onRate] - Callback when rating changes
 * @returns {JSX.Element}
 */
export default function MovieCard({ movie, info, expanded, loading, rating, onToggle, onRate }) {
    return (
        <article
            className={`movie-card ${expanded ? "open" : ""}`}
            onClick={onToggle}
        >
            <div className="poster-frame">
                <img
                    src={info?.poster || movie.poster || fallbackPoster}
                    alt={movie.title}
                />
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
                                <p className="movie-plot scroll-plot">{info?.plot || "No description available."}</p>
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

                <StarRating value={rating || 0} onChange={onRate} />
            </div>
        </article>
    );
}
