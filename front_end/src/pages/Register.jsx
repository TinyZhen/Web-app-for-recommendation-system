import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import '../style/Register.css';

export default function Register() {
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName) await updateProfile(cred.user, { displayName });

      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: displayName || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      nav("/survey", { replace: true });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <div className="card">
        <h1>Create Account</h1>
        <form onSubmit={onSubmit} className="grid">
          <label>Display name (optional)</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Register"}
          </button>
        </form>
        {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
        <p className="muted" style={{ marginTop: 12 }}>
          Have an account? <Link to="/signin">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
