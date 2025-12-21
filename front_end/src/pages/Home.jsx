// src/pages/Home.jsx

/**
 * @file Home.jsx
 * @brief Landing page for the MovieFlix application.
 *
 * This component renders the public-facing home page that introduces
 * the application and its core value proposition. It serves as the
 * primary entry point for users and highlights the benefits of using
 * the platform.
 *
 * The page includes:
 * - A hero section with branding and call-to-action buttons
 * - Navigation links to the survey and favorites pages
 * - A feature overview section explaining why users should choose
 *   the platform
 */

import React from "react";
import { Link } from "react-router-dom";
import "../style/Home.css"; // We'll create this CSS next

/**
 * @brief Home page component.
 *
 * Displays a marketing-focused landing page with a hero banner,
 * calls to action, and a brief overview of the platform’s key
 * features. Designed to guide users toward taking the survey
 * or exploring saved favorites.
 *
 * @returns {JSX.Element} Home page UI.
 */

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