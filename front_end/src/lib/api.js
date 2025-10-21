import { auth } from '../firebase.js';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

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

export async function fetchRecommendations() {
  return authFetch('/recommend');
}

// NEW: trigger the backend job that runs combined_biases
export async function runCombinedBiases(limit = 10) {
  // FastAPI endpoint expects query param (not JSON body)
  return authFetch(`/run-combined-biases?limit=${encodeURIComponent(limit)}`, {
    method: 'POST'
  });
}

export async function fetchFavorites(){
  return authFetch('/favorites', {method:'POST'});
}
