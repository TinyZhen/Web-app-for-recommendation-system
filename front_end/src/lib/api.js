/**
 * @file src/lib/api.js
 * @description Frontend API helper functions for communicating with backend services
 *              and external APIs (OMDb). Functions assume Firebase `auth` is exported
 *              from `src/firebase.js` and will attach the current user's ID token.
 */

// import { auth } from '../firebase.js';

// const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
// const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY;


// async function authFetch(path, options = {}) {
//   const user = auth.currentUser;
//   if (!user) throw new Error('Not signed in');

//   const token = await user.getIdToken();

//   const res = await fetch(`${API_BASE}${path}`, {
//     ...options,
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${token}`,
//       ...(options.headers || {}),
//     },
//   });

//   if (!res.ok) {
//     const errText = await res.text();
//     throw new Error(`${res.status} ${res.statusText}: ${errText}`);
//   }

//   return res.json();
// }

// export async function fetchRecommendations() {
//   return authFetch('/recommend');
// }

// // NEW: trigger the backend job that runs combined_biases
// export async function runCombinedBiases(limit = 10) {
//   // FastAPI endpoint expects query param (not JSON body)
//   return authFetch(`/run-combined-biases?limit=${encodeURIComponent(limit)}`, {
//     method: 'POST'
//   });
// }

// export async function fine_tune_recommend() {
//   const auth = getAuth();
//   const token = await auth.currentUser.getIdToken();

//   const response = await fetch(`${import.meta.env.VITE_API_URL}/fine_tune_recommend`, {
//     method: "POST",
//     headers: {
//       "Authorization": `Bearer ${token}`,
//       "Content-Type": "application/json",
//     },
//   });

//   if (!response.ok) {
//     throw new Error("Failed to run fine-tuning pipeline");
//   }

//   return await response.json();
// }

// export async function fetchFavorites() {
//   return authFetch('/favorites', { method: 'POST' });
// }

// export async function fetchOmdbData(title) {
//   if (!title) return null;

//   let cleanTitle = title
//     .replace(/\s*\(\d{4}\)\s*$/, "")
//     .trim();

//   const match = cleanTitle.match(/(.+),\s*(The|A|An)$/i);
//   if (match) {
//     cleanTitle = `${match[2]} ${match[1]}`;
//   }

//   const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(cleanTitle)}`;
//   console.log("Fetching OMDb for:", cleanTitle, "→", url);

//   try {
//     const res = await fetch(url);
//     const data = await res.json();
//     if (data.Response === "False") return null;
//     return {
//       poster: data.Poster !== "N/A" ? data.Poster : null,
//       plot: data.Plot || "",
//       year: data.Year,
//       director: data.Director,
//       actors: data.Actors,
//       genre: data.Genre,
//     };
//   } catch (e) {
//     console.warn("OMDb fetch error:", e);
//     return null;
//   }
// }

import { auth } from '../firebase.js';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY;

/**
 * Perform an authenticated fetch to the backend using the current Firebase user.
 *
 * @param {string} path - Relative path on the API server (e.g. '/recommend')
 * @param {Object} [options={}] - Fetch options (method, body, headers, etc.)
 * @returns {Promise<any>} - Parsed JSON response from the backend
 * @throws {Error} - If user not signed in or if response is not ok
 */
async function authFetch(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  const token = await user.getIdToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${errText}`);
  }

  return res.json();
}

/**
 * Fetch mock or real recommendations for the logged-in user.
 * @returns {Promise<any>} API response json (recommendations array)
 */
export async function fetchRecommendations() {
  return authFetch('/recommend');
}

// OLD pipeline (still usable)
/**
 * Trigger the backend job that runs the combined_biases pipeline.
 * @param {number} [limit=10] - Maximum number of explanations to request
 * @returns {Promise<any>} API response json
 */
export async function runCombinedBiases(limit = 10) {
  return authFetch(`/run-combined-biases?limit=${encodeURIComponent(limit)}`, {
    method: 'POST'
  });
}

// CHANGED: now accepts ratings payload
/**
 * Call backend fine-tune + recommend endpoint with a ratings payload.
 * @param {Object} payload - Request payload, e.g. { ratings: [{ movieId, rating }], top_k: 6 }
 * @returns {Promise<any>} API response json containing recommendations and explanations
 */
export async function fine_tune_recommend(payload) {
  return authFetch('/fine_tune_recommend', {
    method: 'POST',
    body: JSON.stringify(payload) // CHANGED
  });
}

/**
 * Fetch the logged-in user's favorite movies.
 * @returns {Promise<any>} API response json (favorites array)
 */
export async function fetchFavorites() {
  return authFetch('/favorites', { method: 'POST' });
}

/**
 * Fetch supplemental movie metadata from OMDb by title.
 * Normalizes common title formatting (trailing year, trailing comma forms).
 *
 * @param {string} title - Movie title (may include year in parentheses)
 * @returns {Promise<Object|null>} - Object with poster, plot, year, director, actors, genre or null
 */

const OMDB_TTL = 12 * 60 * 60 * 1000; // 12 hours
const omdbMemoryCache = {};

export async function fetchOmdbData(title) {
  if (!title) return null;

  // Normalize title
  let cleanTitle = title.replace(/\s*\(\d{4}\)\s*$/, "").trim();
  const match = cleanTitle.match(/(.+),\s*(The|A|An)$/i);
  if (match) cleanTitle = `${match[2]} ${match[1]}`;

  const key = `omdb_${cleanTitle.toLowerCase()}`;

  // -----------------------------
  // 1. Memory Cache (fastest)
  // -----------------------------
  const mem = omdbMemoryCache[key];
  if (mem && mem.expire > Date.now()) {
    // console.log("🔥 OMDb from memory:", cleanTitle);
    return mem.data;
  }

  // -----------------------------
  // 2. LocalStorage Cache
  // -----------------------------
  const stored = localStorage.getItem(key);
  if (stored) {
    const obj = JSON.parse(stored);
    if (obj.expire > Date.now()) {
      // console.log("🔥 OMDb from localStorage:", cleanTitle);
      omdbMemoryCache[key] = obj; // sync into memory cache
      return obj.data;
    } else {
      localStorage.removeItem(key);
    }
  }

  // -----------------------------
  // 3. Real fetch (only once per 12h)
  // -----------------------------
  const apiKey = import.meta.env.VITE_OMDB_API_KEY;
  const url = `https://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(cleanTitle)}&plot=full`;

  try {
    // console.log("🌐 OMDb API request:", cleanTitle);
    const res = await fetch(url);
    const data = await res.json();

    if (data.Response === "False") return null;

    const normalized = {
      poster: data.Poster !== "N/A" ? data.Poster : null,
      plot: data.Plot || "",
      year: data.Year,
      director: data.Director,
      actors: data.Actors,
      genre: data.Genre,
    };

    const cacheObj = {
      data: normalized,
      expire: Date.now() + OMDB_TTL,
    };

    // store in both memory + localStorage
    omdbMemoryCache[key] = cacheObj;
    localStorage.setItem(key, JSON.stringify(cacheObj));

    return normalized;
  } catch (e) {
    console.warn("OMDb fetch error:", e);
    return null;
  }
}
