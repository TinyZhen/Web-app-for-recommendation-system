import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../auth/AuthProvider";
import "../style/Profile.css";

export default function Profile() {
    const { user } = useAuth();
    const [profile, setProfile] = useState({
        displayName: "",
        age: "",
        gender: "",
        occupation: "",
        zipcode: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState("");

    // 🔹 Load user profile from Firestore
    useEffect(() => {
        if (!user?.uid) return;
        const loadProfile = async () => {
            setLoading(true);
            try {
                const ref = doc(db, "users", user.uid);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    setProfile((prev) => ({ ...prev, ...snap.data() }));
                }
            } catch (err) {
                console.error("Error loading profile:", err);
            } finally {
                setLoading(false);
            }
        };
        loadProfile();
    }, [user]);

    // 🔹 Update field handler
    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfile((p) => ({ ...p, [name]: value }));
    };

    // 🔹 Save profile to Firestore
    const handleSave = async (e) => {
        e.preventDefault();
        if (!user?.uid) return;

        setSaving(true);
        setStatus("");
        try {
            const ref = doc(db, "users", user.uid);
            await updateDoc(ref, {
                ...profile,
                updatedAt: serverTimestamp(),
            });
            setStatus("✅ Profile updated successfully!");
        } catch (err) {
            console.error("Update failed:", err);
            setStatus("❌ Failed to save profile.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p>Loading profile...</p>;

    return (
        <section className="profile-shell">
            <h2 className="profile-title">👤 My Profile</h2>
            <p className="profile-sub">View or update your personal information</p>

            <form onSubmit={handleSave} className="profile-form">
                <label>
                    Name:
                    <input
                        type="text"
                        name="displayName"
                        value={profile.displayName}
                        onChange={handleChange}
                    />
                </label>

                <label>
                    Age:
                    <input
                        type="number"
                        name="age"
                        value={profile.age}
                        onChange={handleChange}
                    />
                </label>

                <label>
                    Gender:
                    <select
                        name="gender"
                        value={profile.gender}
                        onChange={handleChange}
                    >
                        <option value="">Select</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                    </select>
                </label>

                <label>
                    Occupation:
                    <input
                        type="text"
                        name="occupation"
                        value={profile.occupation}
                        onChange={handleChange}
                    />
                </label>

                <label>
                    Zipcode:
                    <input
                        type="text"
                        name="zipcode"
                        value={profile.zipcode}
                        onChange={handleChange}
                    />
                </label>

                <button type="submit" disabled={saving} className="save-btn">
                    {saving ? "Saving..." : "Save Changes"}
                </button>
                {status && <p className="save-status">{status}</p>}
            </form>
        </section>
    );
}
