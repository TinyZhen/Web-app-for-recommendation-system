import os
from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from firebase_admin import auth as fb_auth
from firebase_admin_init import init_firebase_app
from models import Recommendation, RecsResponse, Favorites,FavsResponse
from typing import List

# ⬇️ import the callable from combined_biases
from combined_biases import compute_explanations

load_dotenv()
init_firebase_app()

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

app = FastAPI(title="Recommender API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

async def get_current_user(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        decoded = fb_auth.verify_id_token(token)
        return decoded.get("uid")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/recommend", response_model=RecsResponse)
async def recommendations(uid: str = Depends(get_current_user)):
    # TODO: plug real model using uid / profile / request params / survey (ratings atleast 20 movies)
    # For now, return mock recs.
    mock = [
        Recommendation(movie_id="tt0133093", title="The Matrix", score=0.97, reason="Sci‑fi classic that matches your action preference"),
        Recommendation(movie_id="tt0816692", title="Interstellar", score=0.95, reason="High rating for cerebral sci‑fi"),
        Recommendation(movie_id="tt0109830", title="Forrest Gump", score=0.91, reason="Popular feel‑good drama")
    ]
    return RecsResponse(user_uid=uid, items=mock)

# ⬇️ API to run the Python pipeline and return explanations
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