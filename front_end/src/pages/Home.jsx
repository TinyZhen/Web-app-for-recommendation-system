// src/pages/Home.jsx
// import { Link } from "react-router-dom";
// export default function Home() {
//     return (
//         <section>
//             <h1>Welcome</h1>
//             <p>Start with a quick survey, then explore recommendations.</p>
//             <Link to="/survey">Start Survey</Link>
//         </section>
//     );
// }

// src/pages/Home.jsx
import React from "react";
import { Link } from "react-router-dom";
import "../style/Home.css"; // We'll create this CSS next

export default function Home() {
  return (
    <div className="home-container">
      {/* Hero Section */}
      <div className="hero">
        <div className="overlay"></div>
        <div className="hero-content">
          <h1 className="hero-title">Your Movie Taste, Reimagined</h1>
          <p className="hero-subtitle">
            Discover movies you'll actually love. AI-powered, personalized, and cinematic.
          </p>
          <div className="hero-buttons">
            <Link to="/survey" className="btn btn-primary">Take the Survey</Link>
            <Link to="/favorites" className="btn btn-secondary">Favourites</Link>
          </div>
        </div>
      </div>

      {/* Why Us Section */}
      <section className="why-us">
        <h2>Why Choose Us?</h2>
        <div className="cards">
          <div className="card">
            <h3>✅ Personalized AI Recommendations</h3>
            <p>Movies picked just for your taste.</p>
          </div>
          <div className="card">
            <h3>🎯 Smart Survey</h3>
            <p>Quick survey, precise results.</p>
          </div>
          <div className="card">
            <h3>⚡ Hidden Gems</h3>
            <p>Discover movies you’d never find on your own.</p>
          </div>
        </div>
      </section>
    </div>
  );
}