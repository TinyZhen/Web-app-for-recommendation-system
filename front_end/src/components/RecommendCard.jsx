// src/components/RecommendCard.jsx

import fallbackPoster from "../assets/logo.png";
import "./RecommendationCard.css";

/**
 * RecommendationCard
 *
 * Displays a single recommended item including poster, title, genres,
 * a human-readable explanation, and a save button.
 *
 * Props:
 * @param {string} props.title - Movie title.
 * @param {string[]} props.genres - Array of genre strings.
 * @param {string|null} props.poster - URL for poster image (fallback used if missing).
 * @param {string} props.explanation - Text explanation for why this item was recommended.
 * @param {Function} props.onSave - Callback invoked when the user clicks Save.
 */
export default function RecommendationCard({ title, genres, poster, explanation, onSave }) {
  return (
    <div className="rec-card">

      {/* Left side = Poster */}
      <div className="rec-left">
        <img
          src={poster || fallbackPoster}
          alt={title}
          className="rec-poster"
          onError={(e) => (e.currentTarget.src = fallbackPoster)}
        />
      </div>

      {/* Right side = Text */}
      <div className="rec-right">
        <h3 className="rec-title">{title}</h3>
        <div className="rec-genres">{genres?.join(" · ")}</div>

        <div className="rec-explanation">
          {explanation}
        </div>

        <button className="submit-btn" onClick={onSave}>
          ❤️ Save Recommendation
        </button>
      </div>

    </div>
  );
}

