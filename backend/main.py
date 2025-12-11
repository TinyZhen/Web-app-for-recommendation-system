"""
main.py
FastAPI server for the fairness-aware recommendation backend.

This file exposes a small set of endpoints used by the frontend and testing tools:
- /health: basic healthcheck
- /recommend: (mock) recommendations
- /run-combined-biases: run batch bias explanation routine
- /favorites: (mock) favorites list
- /fine_tune_recommend: fine-tune model for a user and return fairness-aware recommendations

The implementation keeps dependencies minimal and includes clear error handling
and Doxygen-style docstrings to make automatic documentation generation straightforward.
"""

from typing import List, Optional
import os
from fastapi import FastAPI, Depends, HTTPException, status, Header, Body
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from firebase_admin import auth as fb_auth, firestore
from firebase_admin_init import init_firebase_app, fb_read
from models import Recommendation, RecsResponse, Favorites, FavsResponse
import pandas as pd
import joblib

# Optional heavy imports used only by fine-tune path
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

# Optional legacy utility
try:
    from combined_biases import compute_explanations
except Exception:
    compute_explanations = None


load_dotenv()
init_firebase_app()

db = firestore.client()

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

app = FastAPI(title="Recommender API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def get_current_user(authorization: Optional[str] = Header(default=None)) -> str:
    """
    Verify Firebase ID token and return the user UID.

    @param authorization: Authorization header containing Bearer token
    @return: Firebase UID string
    @raises HTTPException: 401 if token missing or invalid
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        decoded = fb_auth.verify_id_token(token)
        return decoded.get("uid")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")


@app.get("/health")
async def health() -> dict:
    """Healthcheck endpoint.

    @return: {"status": "ok"}
    """
    return {"status": "ok"}


@app.get("/recommend", response_model=RecsResponse)
async def recommendations(uid: str = Depends(get_current_user)) -> RecsResponse:
    """Return a small mock set of recommendations for the authenticated user.

    This endpoint is intentionally simple and used by the front-end during development.
    """
    mock = [
        Recommendation(movie_id="tt0133093", title="The Matrix", score=0.97, reason="Sci-fi classic that matches your action preference"),
        Recommendation(movie_id="tt0816692", title="Interstellar", score=0.95, reason="High rating for cerebral sci-fi"),
        Recommendation(movie_id="tt0109830", title="Forrest Gump", score=0.91, reason="Popular feel-good drama"),
    ]
    return RecsResponse(user_uid=uid, items=mock)


@app.post("/run-combined-biases")
def run_combined_biases(limit: int = 100) -> dict:
    """Run the legacy combined bias explanation routine.

    @param limit: maximum number of explanations to produce
    @return: dictionary with key "explanations" containing list[str]
    """
    if compute_explanations is None:
        raise HTTPException(status_code=501, detail="compute_explanations not available in this environment")
    explanations: List[str] = compute_explanations(limit=limit)
    return {"explanations": explanations}


@app.post("/favorites", response_model=FavsResponse)
def favorites(uid: str = Depends(get_current_user)) -> FavsResponse:
    """Return a mock favorites list for the authenticated user."""
    mock = [
        Favorites(movie_id="tt0122093", title="The Matrix"),
        Favorites(movie_id="tt0816692", title="Interstellar"),
        Favorites(movie_id="tt0109830", title="Forrest Gump"),
    ]
    return FavsResponse(user_uid=uid, items=mock)


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
            ratings_input=ratings_list,   # ⭐⭐⭐ 必须加这个
            top_k=top_k,
        )

        return {"user_uid": uid, "recommendations": results}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
