##
# @file main.py
# @brief FastAPI server for the fairness-aware recommendation backend
#
# @details
# This module exposes endpoints used by the frontend to:
# - Verify server health
# - Authenticate users via Firebase
# - Fine-tune a fairness-aware recommendation model per user
# - Generate personalized, explainable recommendations
#
# The implementation emphasizes:
# - Clear separation between API logic and ML pipelines
# - Firebase-based authentication
# - Robust error handling

from typing import Optional
import os
from fastapi import FastAPI, Depends, HTTPException, status, Header, Body
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from firebase_admin import auth as fb_auth, firestore
from firebase_admin_init import init_firebase_app, fb_read
import pandas as pd
import joblib

# ==============================================================
# Optional heavy imports (ML + LLM)
# ==============================================================
##
# @details
# These imports are wrapped in a try/except block so that
# static analysis, documentation generation, or lightweight
# tests can run without requiring GPU/ML dependencies.
#
try:
    import torch
    from openai import OpenAI
    from fine_tune import load_model_and_encoders, fine_tune_user, recommend_and_explain
except Exception:
    # When running static analysis or tests that don't require ML, these
    # dependencies may not be available. Defer import errors until used.
    torch = None
    OpenAI = None
    load_model_and_encoders = None
    fine_tune_user = None
    recommend_and_explain = None

# ==============================================================
# Application initialization
# ==============================================================
##
# @details
# Loads environment variables and initializes the Firebase app.
#
load_dotenv()
init_firebase_app()

db = firestore.client()

# ==============================================================
# CORS configuration
# ==============================================================
##
# @details
# Allowed origins are read from the ALLOWED_ORIGINS environment variable.
# Defaults to localhost for development.
#
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

app = FastAPI(title="Recommender API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================
# Authentication dependency
# ==============================================================
##
# @brief Verify Firebase ID token and extract user UID
#
# @param authorization Optional[str]
#        Authorization header containing a Bearer token
#
# @return str Firebase user UID
#
# @exception HTTPException
#        Raised if the token is missing or invalid.
#
# @details
# This dependency is used by protected endpoints to ensure
# that requests are authenticated via Firebase Authentication.
#
async def get_current_user(authorization: Optional[str] = Header(default=None)) -> str:
    """
    Verify Firebase ID token and return the user UID.

    @param authorization: Authorization header containing Bearer token
    @return: Firebase UID string
    @exception HTTPException: Raised if the token is missing or invalid
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        decoded = fb_auth.verify_id_token(token)
        return decoded.get("uid")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")

# ==============================================================
# Health endpoint
# ==============================================================
##
# @brief Healthcheck endpoint
#
# @return dict
#         JSON object indicating service availability
#
# @details
# This endpoint can be used by load balancers, deployment
# scripts, or monitoring tools to verify that the API is running.
#
@app.get("/health")
async def health() -> dict:
    """Healthcheck endpoint.

    @return: {"status": "ok"}
    """
    return {"status": "ok"}

# ==============================================================
# Fine-tune + recommend endpoint
# ==============================================================
##
# @brief Fine-tune a recommendation model for a user and return recommendations
#
# @param payload dict
#        Request body containing:
#        - ratings: list of {movieId, rating}
#        - top_k: number of recommendations to return (optional)
#
# @param uid str
#        Firebase user UID injected by get_current_user()
#
# @return dict
#         JSON object containing:
#         - user_uid: Firebase UID
#         - recommendations: list of recommended items with explanations
#
# @exception HTTPException
#        400 if payload is malformed
#        404 if user profile is not found
#        501 if ML components are unavailable
#        500 for unexpected internal errors
#
# @details
# Workflow:
# 1. Validate request payload
# 2. Load pre-trained model and encoders
# 3. Fetch user profile from Firestore
# 4. Convert user ratings into training format
# 5. Load MovieLens reference datasets
# 6. Fine-tune user embeddings (if user is new)
# 7. Generate fairness-aware recommendations
# 8. Produce LLM-based explanations
#
@app.post("/fine_tune_recommend")
async def fine_tune_recommend(payload: dict = Body(...), uid: str = Depends(get_current_user)) -> dict:
    """
    Fine-tune model for a user using provided ratings and return recommendations.

    Expected payload:
    {
        "ratings": [{"movieId": 1, "rating": 4}, ...],
        "top_k": 6
    }
    """

    # ---------------------------
    # 1. Validate payload
    # ---------------------------
    ratings_list = payload.get("ratings")
    print("🔥 backend received ratings:", ratings_list)
    if not ratings_list or not isinstance(ratings_list, list):
        raise HTTPException(status_code=400, detail="Missing or invalid 'ratings' in payload")

    if load_model_and_encoders is None:
        raise HTTPException(status_code=501, detail="Fine-tuning unavailable")

    try:
        # ---------------------------
        # 2. Load model, encoders
        # ---------------------------
        model, jbf, user_enc, item_enc, bias_df = load_model_and_encoders()

        # ---------------------------
        # 3. Load Firestore profile
        # ---------------------------
        fb_read(f"users/{uid}")
        user_doc = db.collection("users").document(uid).get()
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="User not found")
        user_profile = user_doc.to_dict()

        # ---------------------------
        # 4. Convert ratings into DF used for fine-tuning
        # ---------------------------
        numeric_uid = abs(hash(uid)) % (10 ** 8)

        df = pd.DataFrame(ratings_list)
        df["UserID"] = numeric_uid
        df["MovieID"] = df["movieId"].astype(int)
        df["Rating"] = df["rating"].astype(float)
        df = df[["UserID", "MovieID", "Rating"]]

        # ---------------------------
        # 5. Load MovieLens files
        # ---------------------------
        movies = pd.read_csv(os.path.join("data", "movies.dat"), sep="::", engine="python",
                             names=["MovieID", "Title", "Genres"], encoding="ISO-8859-1")
        users = pd.read_csv(os.path.join("data", "users.dat"), sep="::", engine="python",
                            names=["UserID", "Gender", "Age", "Occupation", "Zip-code"])
        ratings_all = pd.read_csv(os.path.join("data", "ratings.dat"), sep="::", engine="python",
                                  names=["UserID", "MovieID", "Rating", "Timestamp"])

        # ---------------------------
        # 6. Fine-tune (only if new user)
        # ---------------------------
        is_new = numeric_uid not in user_enc.classes_
        if is_new:
            model, user_enc = fine_tune_user(
                model, jbf, user_enc, item_enc, bias_df,
                numeric_uid, df
            )
            # Save updated state
            if torch is not None:
                torch.save(model.state_dict(), os.path.join("data", "neural_cf_fair_model.pth"))
            joblib.dump(user_enc, os.path.join("data", "user_encoder.pkl"))

        # ---------------------------
        # 7. Prepare LLM client
        # ---------------------------
        client = OpenAI(
            api_key=os.getenv("GROQ_API_KEY"),
            base_url="https://api.groq.com/openai/v1"
        )

        theta_u = float(user_profile.get("theta_u", 0.0))
        top_k = int(payload.get("top_k", 6))

        # ---------------------------
        # 8. ⭐ Correct call with ratings_input ⭐
        # ---------------------------
        results = recommend_and_explain(
            model,
            jbf,
            user_enc,
            item_enc,
            bias_df,
            numeric_uid,
            user_profile,
            users,
            movies,
            ratings_all,
            client,
            theta_u,
            ratings_input=ratings_list,   
            top_k=top_k,
        )

        return {"user_uid": uid, "recommendations": results}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
