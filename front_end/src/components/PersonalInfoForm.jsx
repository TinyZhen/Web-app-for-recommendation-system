// src/components/PersonalInfoForm.jsx
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useState } from "react";

export default function PersonalInfoForm({ user, onNext, error, setError }) {
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [occupation, setOccupation] = useState("");
  const [zipcode, setZipcode] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { gender, age: age ? Number(age) : null, occupation, zipcode, updatedAt: serverTimestamp() },
        { merge: true }
      );
      onNext();
    } catch (e) {
      setError("Failed to save personal info.");
    }
  }

  return (
    <section className="survey-shell">
      <h2>Step 1: Tell us about yourself</h2>
      <form onSubmit={handleSubmit} className="grid">
        <label>Gender</label>
        <select value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">— Select —</option>
          <option>Male</option>
          <option>Female</option>
          <option>Non-binary</option>
          <option>Prefer not to say</option>
        </select>
        <label>Age</label>
        <input type="number" value={age} onChange={(e) => setAge(e.target.value)} />
        <label>Occupation</label>
        <input value={occupation} onChange={(e) => setOccupation(e.target.value)} />
        <label>Zip Code</label>
        <input value={zipcode} onChange={(e) => setZipcode(e.target.value)} />
        <button className="submit-btn" type="submit">Next →</button>
      </form>
      {error && <p className="text-red-600">{error}</p>}
    </section>
  );
}
