// src/components/Navbar.jsx

/**
 * @file Navbar.jsx
 * @brief Top-level navigation bar for the application.
 *
 * This component renders the primary navigation interface displayed
 * across the application. It provides:
 * - Branding (logo and application title)
 * - Navigation links to core pages (Home, Survey, Recommend, Favorites)
 * - Authentication-aware actions (profile access and logout)
 *
 * The navbar dynamically adapts its content based on the user's
 * authentication state using the global AuthProvider context.
 */
import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import '../style/Navbar.css';
import logo from '../assets/logo.png'; // replace with your logo path

/**
 * @brief Navbar component.
 *
 * Displays a responsive navigation bar with conditional rendering
 * based on authentication state:
 * - Shows user name and logout option when authenticated
 * - Shows sign-in/register link when unauthenticated
 * - Displays a loading indicator while auth state is resolving
 *
 * Also enables quick navigation to the user's profile page.
 *
 * @returns {JSX.Element} Application navigation bar UI.
 */
export default function Navbar() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <img src={logo} alt="Logo" className="navbar-logo" />
        <span className="navbar-title">MovieFlix</span>
      </div>

      <div className="navbar-center">
        <NavLink to="/" className="nav-link">Home</NavLink>
        <NavLink to="/survey" className="nav-link">Survey</NavLink>
        <NavLink to="/recommend" className="nav-link">Recommend</NavLink>
        <NavLink to="/favorites" className="nav-link">Favorites</NavLink>
      </div>

      <div className="navbar-right">
        {loading ? (
          <span className="nav-loading">Loading...</span>
        ) : user ? (
          <div className="user-info">
            <span
              className="user-name"
              onClick={() => navigate("/profile")}
              style={{ cursor: "pointer", textDecoration: "underline" }}
            >
              👋 {user.displayName || "User"}
            </span>
            <button className="btn-logout" onClick={() => signOut(auth)}>
              Logout
            </button>
          </div>
        ) : (
          <NavLink to="/signin" className="nav-link nav-register">
            Sign In/Register
          </NavLink>
        )}
      </div>
    </nav>
  );
}
