import { db } from "../../database/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export async function createUserProfileIfNotExist(user) {
    const profileRef = doc(db, "users", user.uid, "profiles", "latest");
    const snap = await getDoc(profileRef);

    if (!snap.exists()) {
        await setDoc(profileRef, {
            email: user.email,
            createdAt: serverTimestamp(),
            displayName: user.displayName || "",
            avatar: user.photoURL || "",
            preferences: {},
            role: "user"
        });
        console.log(" Profile created for:", user.uid);
    } else {
        console.log("Profile already exists for:", user.uid);
    }
}
