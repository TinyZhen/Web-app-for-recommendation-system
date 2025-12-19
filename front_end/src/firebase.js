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
  apiKey: "AIzaSyDk-FpoY6SJ75ZiUccxcftOF4cTV2aqYiQ",
  authDomain: "recommender-system-7f868.firebaseapp.com",
  projectId: "recommender-system-7f868",
  storageBucket: "recommender-system-7f868.firebasestorage.app",
  messagingSenderId: "828854541761",
  appId: "1:828854541761:web:d4d25763442b3eb114e340",
  measurementId: "G-ME7LRJGMS8"
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