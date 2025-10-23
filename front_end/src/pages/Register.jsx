import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import './Register.css';

export default function Register() {
  const nav = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // NEW fields
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [occupation, setOccupation] = useState("");
  const [zipcode, setZipcode] = useState("");

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      // 1) Create auth user
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      // 2) Optional: set displayName in Auth profile
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }

      // 3) Create/merge Firestore user doc ONCE (with all fields)
      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          uid: cred.user.uid,
          email: cred.user.email,
          displayName: displayName || null,
          photoURL: cred.user.photoURL || null,
          gender: gender || null,
          age: age === "" ? null : Number(age),
          occupation: occupation || null,
          zipcode: zipcode || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 4) Go to recommendations after successful writes
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
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />

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
            minLength={6}
          />

          {/* NEW fields */}
          <label>Gender</label>
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">— Select —</option>
            <option>Male</option>
            <option>Female</option>
            <option>Non-binary</option>
            <option>Prefer not to say</option>
          </select>

          <label>Age</label>
          <input
            type="number"
            inputMode="numeric"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            min={0}
            max={120}
          />

          <label>Occupation</label>
          <input
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
          />

          <label>Zip-code</label>
          <input
            value={zipcode}
            onChange={(e) => setZipcode(e.target.value)}
            placeholder="02125 or 02125-1234"
          />

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