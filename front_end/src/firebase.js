/**
 * @file src/firebase.js
 * @description Firebase initialization and exports used across the frontend app.
 */

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";


const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID,
};


const app = initializeApp(firebaseConfig);

/**
 * Firestore instance. Uses the persistent local cache for better offline behavior.
 * @type {import('firebase/firestore').Firestore}
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

/**
 * Firebase Auth instance.
 * @type {import('firebase/auth').Auth}
 */
export const auth = getAuth(app);

// Persist auth in browser local storage so the user stays signed in across reloads
setPersistence(auth, browserLocalPersistence);