# System Architecture {#architecture}

## Backend
- `main.py`: FastAPI entry point
- `combined_biases.py`: Fairness-aware recommendation logic
- `model_classes.py`: ML model definitions
- `firebase_admin_init.py`: Firebase Admin SDK initialization

## Frontend
- `components/`: Reusable UI components
  - MovieCard.jsx
  - RecommendCard.jsx
  - StarRating.jsx
- `auth/`: Authentication logic
- `lib/`: Utility functions