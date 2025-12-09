// src/components/RecommendCard.jsx

import fallbackPoster from "../assets/logo.png";
import "./RecommendationCard.css";

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

