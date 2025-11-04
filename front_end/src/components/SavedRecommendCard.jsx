// src/components/SavedRecommendCard.jsx

export default function SavedRecommendCard({ text }) {
    return (
      <div
        style={{
          padding: '12px 14px',
          borderRadius: '10px',
          backgroundColor: '#111',
          border: '1px solid #333',
        }}
      >
        <div
          style={{
            whiteSpace: 'pre-wrap',
            fontSize: '0.95rem',
          }}
        >
          {text}
        </div>
      </div>
    );
  }
  