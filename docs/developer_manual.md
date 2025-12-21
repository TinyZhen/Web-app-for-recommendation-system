# Developer / Code Manual {#developer_manual}

## Overview

This project is a **full-stack, AI-powered movie recommendation system** built using:

- **Frontend:** React (Vite), React Router
- **Backend:** FastAPI (Python)
- **Authentication & Storage:** Firebase Authentication + Firestore
- **AI / LLM Services:** Groq (via backend)
- **External Data:** OMDb API
- **Documentation:** Doxygen (for frontend & backend code)

The system collects user preferences through a survey, generates explainable recommendations, and allows users to save, review, and share results.

---
## Backend Architecture

### `main.py`
- FastAPI entry point
- Defines REST API routes
- Handles request validation and response formatting
- Communicates with Groq for recommendation generation
- Interfaces with Firebase Admin SDK when needed

### `fine_tune.py`
- Implements recommendation generation and explanation logic
- Accepts user ratings and preference parameters (e.g., `theta_u`)
- Produces ranked movie recommendations with explanations
- Designed to support fairness-aware and explainable outputs

### `models.py`
- Defines Pydantic models for:
  - Request payloads
  - Response schemas
  - Recommendation objects
- Ensures consistent API contracts between frontend and backend

### `firebase_admin_init.py`
- Initializes Firebase Admin SDK
- Enables secure server-side access to Firestore
- Used for backend-side operations when required

---

## Frontend Architecture

### `src/auth/`
Authentication and global auth state management.

#### `AuthProvider.jsx`
- Wraps the application with authentication context
- Tracks `user` and `loading` state via Firebase Auth
- Exposes `useAuth()` hook for components and pages
- Centralizes auth state and avoids prop drilling

---

### `src/components/`
Reusable, presentation-focused UI components.

#### `MovieCard.jsx`
- Displays movie poster, title, genres
- Expands to show detailed info (plot, director, actors)
- Integrates rating via `StarRating`
- Fetches additional OMDb data on demand

#### `StarRating.jsx`
- Interactive star-based rating input
- Used across survey and profile views

#### `ShareButtonCard.jsx`
- Provides social sharing actions:
  - Copy to clipboard
  - Email
  - WhatsApp
  - Twitter
- Accepts a custom share message

#### `SavedRecommendCard.jsx`
- Displays saved recommendations
- Used within Favorites page (optional abstraction)

---

### `src/pages/`
Page-level views controlling user flow and data orchestration.

#### `Home.jsx`
- Public landing page
- Highlights application value proposition
- Entry point to survey and favorites

#### `SignIn.jsx`
- Email/password authentication via Firebase Auth
- Handles loading and error states
- Redirects authenticated users to onboarding survey

#### `Register.jsx`
- User registration page
- Creates Firebase Auth account
- Initializes Firestore user document
- Redirects new users to survey flow

#### `Survey.jsx`
- Multi-step onboarding controller
- Step 1: Checks profile completeness in Firestore
- Step 2: Loads local movie catalog (`movies.json`)
- Launches `MovieSurvey` after prerequisites are met
- Minimizes Firestore reads

#### `MovieSurvey.jsx`
- Core survey experience
- Supports:
  - Search, genre, and year filtering
  - Pagination
  - Rating movies
- Prefetches posters from OMDb
- Submits ratings in a single Firestore batch
- Calls backend API for recommendations
- Stores survey history in `localStorage`

#### `Recommend.jsx`
- Displays personalized recommendations
- Supports:
  - Fresh survey-based recommendations
  - Cached recommendations from previous sessions
- Fetches missing posters from OMDb
- Allows saving recommendations to Firestore
- Enables sharing via `ShareButtonCard`
- Avoids Firestore reads when possible

#### `Favorites.jsx`
- Displays user’s saved recommendations
- Loads from localStorage first, Firestore as fallback
- Supports removal of saved items
- Keeps Firestore and local cache synchronized

#### `Profile.jsx`
- User profile management page
- Editable fields:
  - Name, age, gender, occupation, zipcode
  - Explanation preference (`theta_u`)
- Loads and updates Firestore user document
- Displays recent survey history from localStorage
- Supports detailed movie modal with OMDb data

---

## Data Management Strategy

### Firestore Collections

- `users`
  - User profile data
  - Explanation preference (`theta_u`)
- `ratings`
  - User movie ratings (batched writes)
- `savedRecommendations`
  - User-saved recommendation results

### Local Storage Usage

- `surveyHistory_<uid>`
  - Stores last N survey sessions
- `lastSurveyRecs_<uid>`
  - Caches most recent recommendations
- `savedRecs_<uid>`
  - Caches saved recommendations

This strategy:
- Reduces Firestore reads
- Improves performance
- Supports offline-friendly behavior

---

## API Design

- REST-based communication using FastAPI
- JSON request/response format
- Stateless backend endpoints
- Frontend sends:
  - Ratings
  - User preference parameters
- Backend returns:
  - Ranked recommendations
  - Natural language explanations

---

## External Integrations

### OMDb API
- Fetches:
  - Posters
  - Plot summaries
  - Director, actors, year
- Used lazily to reduce API usage

### Groq / LLM Backend
- Generates explainable recommendations
- Controlled via backend logic
- Supports adjustable explanation depth (`theta_u`)

---

## Extending the Project

### Backend
- Add new endpoints in `main.py`
- Extend recommendation logic in `fine_tune.py`
- Update schemas in `models.py`

### Frontend
- New UI features → `src/components/`
- New user flows → `src/pages/`
- Shared logic → `src/lib/`
- Auth-related logic → `src/auth/`