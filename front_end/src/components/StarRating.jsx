// src/components/StarRating.jsx
/**
 * StarRating
 *
 * Simple 5-star rating control used in survey and movie cards.
 *
 * Props:
 * @param {number} [props.value=0] - Current rating value (1-5). 0 = unset.
 * @param {Function} props.onChange - Callback called with new numeric rating.
 *
 * The component stops propagation of click events to avoid triggering
 * parent card toggles when the user selects a star.
 */
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
