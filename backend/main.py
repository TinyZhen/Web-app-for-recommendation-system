import os
from fastapi import FastAPI, Depends, HTTPException, status, Header, Body
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from firebase_admin import auth as fb_auth, firestore
from firebase_admin_init import init_firebase_app
from models import Recommendation, RecsResponse, Favorites, FavsResponse
from typing import List
import pandas as pd
import torch

# ⬇️ import the callable from combined_biases (old)
from combined_biases import compute_explanations

# 🟢 NEW: import fine-tuning pipeline
from fine_tune import load_model_and_encoders, fine_tune_user, recommend_and_explain
from openai import OpenAI

# ----------------------------------------------------
# 1️⃣ Setup and Initialization
# ----------------------------------------------------
load_dotenv()
init_firebase_app()

db = firestore.client()  # 🟢 NEW: Firestore client

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

app = FastAPI(title="Recommender API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# ----------------------------------------------------
# 2️⃣ Auth helper (same as before)
# ----------------------------------------------------
async def get_current_user(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        decoded = fb_auth.verify_id_token(token)
        return decoded.get("uid")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")

# ----------------------------------------------------
# 3️⃣ Default endpoints (unchanged)
# ----------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/recommend", response_model=RecsResponse)
async def recommendations(uid: str = Depends(get_current_user)):
    mock = [
        Recommendation(movie_id="tt0133093", title="The Matrix", score=0.97, reason="Sci-fi classic that matches your action preference"),
        Recommendation(movie_id="tt0816692", title="Interstellar", score=0.95, reason="High rating for cerebral sci-fi"),
        Recommendation(movie_id="tt0109830", title="Forrest Gump", score=0.91, reason="Popular feel-good drama")
    ]
    return RecsResponse(user_uid=uid, items=mock)

@app.post("/run-combined-biases")
def run_combined_biases(limit: int = 100) -> dict:
    explanations: List[str] = compute_explanations(limit=limit)
    return {"explanations": explanations}

@app.post("/favorites", response_model=FavsResponse)
def favorites(uid: str = Depends(get_current_user)):
    mock = [
        Favorites(movie_id="tt0122093", title="The Matrix"),
        Favorites(movie_id="tt0816692", title="Interstellar"),
        Favorites(movie_id="tt0109830", title="Forrest Gump")
    ]
    return FavsResponse(user_uid=uid, items=mock)

# ----------------------------------------------------
# 4️⃣ 🟢 NEW: Fine-tuning + Fairness-aware Recommendations
# ----------------------------------------------------
# @app.post("/fine_tune_recommend")
# async def fine_tune_recommend(uid: str = Depends(get_current_user)):
#     """
#     Fine-tune model for logged-in Firestore user and return explanation strings.
#     """
#     try:
#         # Step 1: Load model & encoders
#         model, jbf_module, user_enc, item_enc, bias_df = load_model_and_encoders()

#         # Step 2: Load user profile
#         user_ref = db.collection("users").document(uid)
#         user_doc = user_ref.get()
#         if not user_doc.exists:
#             raise HTTPException(status_code=404, detail="User not found")
#         user_data = user_doc.to_dict()

#         # Step 3: Load user ratings
#         rating_docs = db.collection("ratings").where("userId", "==", uid).stream()
#         ratings_list = [r.to_dict() for r in rating_docs]

#         if not ratings_list:
#             raise HTTPException(status_code=404, detail="User has no ratings")

#         new_user_ratings = pd.DataFrame(ratings_list)
#         # new_user_ratings["UserID"] = uid
#         # new_user_ratings["MovieID"] = new_user_ratings["movieId"].astype(int)
#         # new_user_ratings["Rating"] = new_user_ratings["rating"].astype(float)
#         # Step 5: Convert Firestore UID → numeric ID
#         numeric_id = abs(hash(uid)) % (10**6)

#         # Build DataFrame for fine-tuning
#         new_user_ratings = pd.DataFrame(ratings_list)
#         new_user_ratings["UserID"] = numeric_id   # 🔥 FIXED
#         new_user_ratings["MovieID"] = new_user_ratings["movieId"].astype(int)
#         new_user_ratings["Rating"] = new_user_ratings["rating"].astype(float)

#         new_user_ratings = new_user_ratings[["UserID", "MovieID", "Rating"]]

#         new_user_ratings = new_user_ratings[["UserID", "MovieID", "Rating"]]

#         # Step 4: Load ML-1M base datasets
#         movies = pd.read_csv("data/movies.dat", sep="::", engine="python",
#                              names=["MovieID", "Title", "Genres"], encoding="ISO-8859-1")
#         users = pd.read_csv("data/users.dat", sep="::", engine="python",
#                              names=["UserID", "Gender", "Age", "Occupation", "Zip-code"])
#         ratings_all = pd.read_csv("data/ratings.dat", sep="::", engine="python",
#                              names=["UserID", "MovieID", "Rating", "Timestamp"])

#         # Step 5: Make UID numeric index
#         numeric_id = abs(hash(uid)) % (10**6)

#         # Step 6: Fine-tune model
#         model = fine_tune_user(model, jbf_module, user_enc, item_enc, bias_df,
#                                numeric_id, new_user_ratings)

#         # Step 7: Setup Groq client
#         client = OpenAI(
#             api_key=os.getenv("GROQ_API_KEY"),
#             base_url="https://api.groq.com/openai/v1"
#         )

#         # # Step 8: Get fairness-aware explanations
#         # results = recommend_and_explain(
#         #     model, jbf_module, user_enc, item_enc, bias_df,
#         #     numeric_id, users, movies, ratings_all, client
#         # )

#         results = recommend_and_explain(
#             model, jbf_module, user_enc, item_enc, bias_df,
#             numeric_id, user_data, users, movies, ratings_all, client
#         )


#         # results is an array of dicts → convert into array of strings
#         explanation_strings = [rec.get("explanation", "") for rec in results]

#         # # Optional backend storage (not used by frontend)
#         # rec_collection = db.collection("recommendations")
#         # from datetime import datetime
#         # for txt in explanation_strings:
#         #     rec_collection.add({
#         #         "userId": uid,
#         #         "explanation": txt,
#         #         "createdAt": datetime.utcnow()
#         #     })

#         return {
#             "user_uid": uid,
#             "recommendations": explanation_strings  # ← ONLY STRINGS
#         }

#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# CHANGED: accepts ratings directly from frontend payload
@app.post("/fine_tune_recommend")
async def fine_tune_recommend(
    payload: dict = Body(...),  # ✅ CHANGED
    uid: str = Depends(get_current_user)
):
    try:
        # ✅ CHANGED: Load model & encoders
        model, jbf_module, user_enc, item_enc, bias_df = load_model_and_encoders()

        # ✅ Keep Firestore user profile read (1 safe read)
        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="User not found")

        user_data = user_doc.to_dict()

        # ✅✅✅ CHANGED: Ratings now come from frontend — NO Firestore READ
        ratings_list = payload.get("ratings")
        if not ratings_list:
            raise HTTPException(status_code=400, detail="No ratings provided")

        # ✅ CHANGED: Convert UID to numeric ID
        numeric_id = abs(hash(uid)) % (10**6)

        new_user_ratings = pd.DataFrame(ratings_list)
        new_user_ratings["UserID"] = numeric_id
        new_user_ratings["MovieID"] = new_user_ratings["movieId"].astype(int)
        new_user_ratings["Rating"] = new_user_ratings["rating"].astype(float)
        new_user_ratings = new_user_ratings[["UserID", "MovieID", "Rating"]]

        # ✅ Load ML-1M dataset locally (no Firebase here)
        movies = pd.read_csv("data/movies.dat", sep="::", engine="python",
                             names=["MovieID", "Title", "Genres"], encoding="ISO-8859-1")

        users = pd.read_csv("data/users.dat", sep="::", engine="python",
                             names=["UserID", "Gender", "Age", "Occupation", "Zip-code"])

        ratings_all = pd.read_csv("data/ratings.dat", sep="::", engine="python",
                             names=["UserID", "MovieID", "Rating", "Timestamp"])

        # ✅ Fine-tune model
        model = fine_tune_user(
            model, jbf_module, user_enc, item_enc, bias_df,
            numeric_id, new_user_ratings
        )

        # ✅ Setup Groq client
        client = OpenAI(
            api_key=os.getenv("GROQ_API_KEY"),
            base_url="https://api.groq.com/openai/v1"
        )

        results = recommend_and_explain(
            model, jbf_module, user_enc, item_enc, bias_df,
            numeric_id, user_data, users, movies, ratings_all, client
        )

        # ✅✅✅ CHANGED: NO MORE FIRESTORE WRITES HERE (CRITICAL FIX)
        explanation_strings = [rec.get("explanation", "") for rec in results]

        return {
            "user_uid": uid,
            "recommendations": explanation_strings
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
