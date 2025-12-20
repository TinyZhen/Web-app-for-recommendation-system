# System Architecture {#architecture}

## Backend
- `main.py`: FastAPI entry point
- `fine_tune.py`: Fine Tune Logic
- `models.py`: ML model definitions
- `firebase_admin_init.py`: Firebase Admin SDK initialization

## Frontend
- `components/`: Reusable UI components
  - MovieCard.jsx
  - RecommendCard.jsx
  - StarRating.jsx
- `auth/`: Authentication logic
- `lib/`: Utility functions