# End-User Manual {#user_manual}

This document provides instructions for end users on how to set up, build,
run, and use the **Web App for Recommendation System**.

The application is a full-stack recommendation system with a
**React + Vite + Firebase frontend** and a **FastAPI + Groq backend**.

---

## 🚀 Setup Instructions

Follow these steps after pulling the repository.

---

## 1. Create `.env` file in the frontend (Vite)

**Path:**

```
front_end/.env
```

**Content (replace with your own keys):**

```env
VITE_API_KEY=your_firebase_api_key
VITE_AUTH_DOMAIN=your_auth_domain
VITE_PROJECT_ID=your_project_id
VITE_STORAGE_BUCKET=your_storage_bucket
VITE_MESSAGING_SENDER_ID=your_sender_id
VITE_APP_ID=your_app_id
VITE_MEASUREMENT_ID=your_measurement_id
VITE_OMDB_API_KEY=your_omdb_api_key
```

---

## 2. Create `firebase.js` in `front_end/src/`

**Path:**

```
front_end/src/firebase.js
```

**Content:**

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

---

## 3. Create `serviceAccountKey.json` in backend

**Path:**

```
backend/serviceAccountKey.json
```

**Steps:**

- Firebase Console → Project Settings  
- Go to **Service Accounts**  
- Select **Node.js**  
- Click **Generate new private key**  
- Rename the file to `serviceAccountKey.json`  
- Place it inside the backend folder  

---

## 4. Create backend `.env` file

**Path:**

```
backend/.env
```

**Content:**

```env
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json
ALLOWED_ORIGINS=http://localhost:5173
PORT=8000
GROQ_API_KEY=your_groq_api_key_here
OMDB_API_KEY=your_omdb_api_key_here
```

---

## 5. Get OMDb API Key

Used to fetch movie data.

**Steps:**

1. Visit: https://www.omdbapi.com/apikey.aspx  
2. Select **FREE plan**  
3. Enter your email  
4. Confirm the activation email  
5. Copy your API key  
6. Put it into:
   - `front_end/.env` → `VITE_OMDB_API_KEY`
   - `backend/.env` → `OMDB_API_KEY`

---

## 6. Install dependencies

**Frontend:**

```bash
cd front_end
npm install
```

**Backend:**

```bash
cd backend
pip install -r requirements.txt
```

---

## 7. Run frontend

```bash
cd front_end
npm run dev
```

Runs at:

```
http://localhost:5173
```

---

## 8. Run backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Backend runs at:

```
http://localhost:8000
```

---

## 9. Viewing the Code Documentation (Doxygen)

This project uses **Doxygen** to generate developer-oriented code documentation.

The GitHub repository intentionally contains only the **documentation sources and configuration**, not the generated HTML output. This follows standard software engineering best practices, where generated files are built locally.

---

### 🛠 Installing Doxygen

Before generating the documentation, Doxygen must be installed on your system.

#### macOS (using Homebrew)
```bash
brew install doxygen
```
#### Ubuntu/Debian Linux
```bash
sudo apt update
sudo apt install doxygen
```

#### Windows
**Steps:**
1. Download the installer from: https://www.doxygen.nl/download.html
2. Run the installer and follow the setup instructions.
3. Ensure doxygen is available in your system PATH.

Verify the installation:
```bash
doxygen --version
```

### Steps to Generate and View Doxygen Documentation
1. Navigate to the documentation directory:
```bash
cd docs
```
2. Run Doxygen using the provided configuration file:
```bash
doxygen Doxyfile
```
3. Open the generated documentation in a web browser:
```bash
open ../doxygen_output/html/index.html
```