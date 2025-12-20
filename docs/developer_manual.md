# Developer / Code Manual {#developer_manual}

## Project Structure Overview

## Backend Architecture

### main.py
- FastAPI entry point
- Defines API routes

### fine_tune.py
- Defines finetuning of the model
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

- Fast API Based Communication
- JSON request/response format
- Backend communicates with Firebase and Groq

---

## Extending the Project
- New API routes go in `main.py`
- New UI features go in `components/`