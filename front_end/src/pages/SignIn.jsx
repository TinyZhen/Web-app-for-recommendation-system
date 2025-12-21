/**
 * @file SignIn.jsx
 * @brief Authentication page for existing users.
 *
 * This page renders a sign-in form that allows users to authenticate
 * using email and password via Firebase Authentication. Upon successful
 * login, users are redirected to the survey onboarding flow.
 *
 * Responsibilities:
 * - Collect user credentials via a controlled form
 * - Authenticate users using Firebase Auth
 * - Display loading and error states during authentication
 * - Redirect authenticated users to the survey page
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import '../style/SignIn.css';

/**
 * @brief SignIn page component.
 *
 * Provides a user-friendly login interface for returning users.
 * Handles authentication state, prevents duplicate submissions,
 * and navigates the user to the survey after a successful sign-in.
 *
 * @returns {JSX.Element} Sign-in page UI.
 */
export default function SignIn() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  /**
   * @brief Handle sign-in form submission.
   *
   * Prevents default form behavior, authenticates the user using
   * Firebase email/password credentials, and redirects to the
   * survey page on success. Displays an error message on failure.
   *
   * @param {Event} e - Form submission event.
   */
  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      nav('/survey', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Sign In</h1>
        <p className="muted">Welcome back. Use your email and password.</p>

        <form onSubmit={onSubmit} className="grid">
          <label>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />

          <label>Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />

          <button className="btn primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        <p className="muted" style={{ marginTop: 12 }}>
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}