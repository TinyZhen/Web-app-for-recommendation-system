// src/components/Navbar.jsx
import { NavLink } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import '../style/Navbar.css';
import logo from '../assets/logo.png'; // replace with your logo path

export default function Navbar() {
  const { user, loading } = useAuth();

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
            <span className="user-name">👋 {user.displayName}</span>
            <button className="btn-logout" onClick={() => signOut(auth)}>
              Logout
            </button>
          </div>
        ) : (
          <>
            <NavLink to="/signin" className="nav-link nav-register">Sign In/Register</NavLink>

          </>
        )}
      </div>
    </nav>
  );
}