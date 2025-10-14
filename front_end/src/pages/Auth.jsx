// src/pages/Auth.jsx
import { useState } from "react";
import { auth } from "../../../database/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { createUserProfileIfNotExist } from "../api";

export default function Auth() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    async function handleSignUp() {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await createUserProfileIfNotExist(res.user);
        alert("Sign Up successful");
    }

    async function handleSignIn() {
        const res = await signInWithEmailAndPassword(auth, email, password);
        await createUserProfileIfNotExist(res.user);
        alert("Sign in successful");
    }

    return (
        <form style={{ display: "grid", gap: 8, maxWidth: 300 }}>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
            <button type="button" onClick={handleSignIn}>Sign In</button>
            <button type="button" onClick={handleSignUp}>Sign Up</button>
        </form>
    );
}
