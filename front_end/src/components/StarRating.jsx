// src/components/StarRating.jsx
export default function StarRating({ value = 0, onChange }) {
    return (
        <div className="rating-row" onClick={(e) => e.stopPropagation()}>
            {[1, 2, 3, 4, 5].map((n) => (
                <span
                    key={n}
                    className={`star ${value >= n ? "active" : ""}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onChange(n);
                    }}
                >
                    ★
                </span>
            ))}
        </div>
    );
}
