# Developer / Code Manual {#developer_manual}

## Project Structure Overview

## Backend Architecture

### main.py
- FastAPI entry point
- Defines API routes

### combined_biases.py
- Implements fairness-aware recommendation logic

### model_classes.py
- Defines machine learning models and datasets

### models.py
- Defines API response models

### firebase_admin_init.py
- Initializes Firebase Admin SDK

---

## Frontend Architecture

### src/components/
Reusable UI components:
- `MovieCard.jsx`
- RecommendCard.jsx
- StarRating.jsx

### src/pages/
Page-level views:
- Home
- Recommend
- Survey
- SignIn / Register

### src/auth/
Authentication wrappers and route protection

---

## API Design

- REST-based communication
- JSON request/response format
- Backend communicates with Firebase and Groq

---

## Extending the Project
- New API routes go in `main.py`
- New UI features go in `components/`