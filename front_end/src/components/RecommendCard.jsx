// src/components/RecommendCard.jsx

export default function RecommendCard({ text, saved, onSave }) {
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
            marginBottom: '8px',
            fontSize: '0.95rem',
          }}
        >
          {text}
        </div>
        <button
          type="button"
          className="submit-btn"
          disabled={saved}
          onClick={onSave}
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    );
  }
  
  