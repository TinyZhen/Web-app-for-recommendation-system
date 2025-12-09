// // src/components/PersonalInfoForm.jsx
// import { doc, setDoc, serverTimestamp } from "firebase/firestore";
// import { db } from "../firebase";
// import { useState } from "react";

// export default function PersonalInfoForm({ user, onNext, error, setError }) {
//   const [gender, setGender] = useState("");
//   const [age, setAge] = useState("");
//   const [occupation, setOccupation] = useState("");
//   const [zipcode, setZipcode] = useState("");

//   async function handleSubmit(e) {
//     e.preventDefault();
//     try {
//       await setDoc(
//         doc(db, "users", user.uid),
//         { gender, age: age ? Number(age) : null, occupation, zipcode, updatedAt: serverTimestamp() },
//         { merge: true }
//       );
//       onNext();
//     } catch (e) {
//       setError("Failed to save personal info.");
//     }
//   }

//   return (
//     <section className="survey-shell">
//       <h2>Step 1: Tell us about yourself</h2>
//       <form onSubmit={handleSubmit} className="grid">
//         <label>Gender</label>
//         <select value={gender} onChange={(e) => setGender(e.target.value)}>
//           <option value="">— Select —</option>
//           <option>Male</option>
//           <option>Female</option>
//           <option>Non-binary</option>
//           <option>Prefer not to say</option>
//         </select>
//         <label>Age</label>
//         <input type="number" value={age} onChange={(e) => setAge(e.target.value)} />
//         <label>Occupation</label>
//         <input value={occupation} onChange={(e) => setOccupation(e.target.value)} />
//         <label>Zip Code</label>
//         <input value={zipcode} onChange={(e) => setZipcode(e.target.value)} />
//         <button className="submit-btn" type="submit">Next →</button>
//       </form>
//       {error && <p className="text-red-600">{error}</p>}
//     </section>
//   );
// }

// src/components/PersonalInfoForm.jsx
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useState } from "react";
import "../style/PersonalInfoForm.css";

export default function PersonalInfoForm({ user, onNext, error, setError }) {
  const [gender, setGender] = useState("");
  const [age, setAge] = useState(null);
  const [occupation, setOccupation] = useState(null);
  const [zipcode, setZipcode] = useState("");

  // ✅✅✅ CHANGED: Store actual theta_u value directly
  const [thetaU, setThetaU] = useState(null);   // will store 0.2, 0.5, or 0.9

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          gender,
          age: age ?? null,
          occupation: occupation ?? null,
          zipcode,

          // ✅✅✅ CHANGED: Store numeric theta_u directly
          theta_u: thetaU,

          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      onNext();
    } catch (e) {
      setError("Failed to save personal info.");
    }
  }

  return (
    <section className="personal-info-shell">
      <h2>Step 1: Tell us about yourself</h2>
      <p className="form-desc">We use this to personalize your recommendations.</p>

      <form onSubmit={handleSubmit} className="personal-info-form">

        <div className="form-row">
          <label htmlFor="gender">Gender</label>
          <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">— Select —</option>
            <option>Male</option>
            <option>Female</option>
            <option>Non-binary</option>
            <option>Prefer not to say</option>
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="age">Age Range</label>
          <select id="age" value={age ?? ""} onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">Select Age Range</option>
            <option value="1">Under 18</option>
            <option value="18">18–24</option>
            <option value="25">25–34</option>
            <option value="35">35–44</option>
            <option value="45">45–49</option>
            <option value="50">50–55</option>
            <option value="56">56+</option>
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="occupation">Occupation</label>
          <select id="occupation" value={occupation ?? ""} onChange={(e) => setOccupation(e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">Select Occupation</option>
            <option value="0">Other / Not specified</option>
            <option value="1">Academic / Educator</option>
            <option value="2">Artist</option>
            <option value="3">Clerical / Admin</option>
            <option value="4">College / Grad Student</option>
            <option value="5">Customer Service</option>
            <option value="6">Doctor / Health Care</option>
            <option value="7">Executive / Managerial</option>
            <option value="8">Farmer</option>
            <option value="9">Homemaker</option>
            <option value="10">K-12 Student</option>
            <option value="11">Lawyer</option>
            <option value="12">Programmer</option>
            <option value="13">Retired</option>
            <option value="14">Sales / Marketing</option>
            <option value="15">Scientist</option>
            <option value="16">Self-Employed</option>
            <option value="17">Technician / Engineer</option>
            <option value="18">Tradesman / Craftsman</option>
            <option value="19">Unemployed</option>
            <option value="20">Writer</option>
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="zipcode">Zip Code</label>
          <input id="zipcode" type="text" value={zipcode} onChange={(e) => setZipcode(e.target.value)} />
        </div>

        <div className="form-row">
          <label htmlFor="theta">Explanation Style</label>
          <select id="theta" value={thetaU ?? ""} onChange={(e) => setThetaU(e.target.value ? parseFloat(e.target.value) : null)} required>
            <option value="">— Select Explanation Style —</option>
            <option value="0.2">Quick Insight (1-line)</option>
            <option value="0.5">Concise Reasoning (short)</option>
            <option value="0.9">Fairness-Aware & Detailed</option>
          </select>
        </div>

        <div className="form-actions">
          <button className="submit-btn" type="submit">Next →</button>
        </div>

      </form>

      {error && <p className="error-message">{error}</p>}
    </section>
  );
}
