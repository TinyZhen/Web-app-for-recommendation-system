// // src/components/SavedRecommendCard.jsx

// export default function SavedRecommendCard({ text }) {
//     return (
//       <div
//         style={{
//           padding: '12px 14px',
//           borderRadius: '10px',
//           backgroundColor: '#111',
//           border: '1px solid #333',
//         }}
//       >
//         <div
//           style={{
//             whiteSpace: 'pre-wrap',
//             fontSize: '0.95rem',
//           }}
//         >
//           {text}
//         </div>
//       </div>
//     );
//   }
 
// src/components/SavedRecommendCard.jsx

export default function SavedRecommendCard({ id, text, onDelete }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      
      {/* Black Recommendation Box */}
      <div
        style={{
          padding: "12px 14px",
          borderRadius: "10px",
          backgroundColor: "#111",
          border: "1px solid #333",
          whiteSpace: "pre-wrap",
          fontSize: "0.95rem",
        }}
      >
        {text}
      </div>

      {/* Delete button under the card */}
      <button
        onClick={() => onDelete(id)}
        style={{
          alignSelf: "flex-end",
          background: "#ff4b4b",
          border: "none",
          color: "white",
          fontSize: "0.85rem",
          padding: "6px 12px",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Delete
      </button>
    </div>
  );
}

