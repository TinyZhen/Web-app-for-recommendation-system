##
# @file fine_tune.py
# @brief Fine-tuning and inference pipeline for fairness-aware recommendation system
# @details Provides functions to load pre-trained models, fine-tune for new users,
#          and generate fairness-aware recommendations with LLM explanations.
#

# backend/fine_tune.py
import os
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
# from sklearn.preprocessing import LabelEncoder
import joblib
from models import NeuralCF, CombinedBiasInteractionModule, BIAS_COLS
from utility import get_X_u, get_M_i, generate_llm_explanation

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")


# ==============================================================
# @brief Hyperparameters for fine-tuning and training
# ==============================================================
EMBEDDING_DIM = 32      ##< Dimension of user/item embeddings
LAMBDA_FAIR = 1.0       ##< Fairness regularization weight in loss function
MU_REG = 1e-4           ##< L2 regularization weight
FINE_TUNE_EPOCHS = 300   ##< Number of epochs for fine-tuning new user


##
# @brief Load pre-trained neural network model and encoders
# @param model_dir str Optional path to model directory. If None, uses default 'data/' subdirectory.
# @return tuple (model, jbf_module, user_encoder, item_encoder, bias_dataframe)
#         - model: NeuralCF instance with loaded weights
#         - jbf_module: CombinedBiasInteractionModule instance
#         - user_encoder: LabelEncoder for user IDs
#         - item_encoder: LabelEncoder for item IDs
#         - base_bias_df: DataFrame with bias annotations
# @details Loads all necessary components for inference: embeddings are sized
#          to match the saved model, ensuring compatibility with new user fine-tuning.
#          Model is set to eval mode and jbf_module is also in eval mode.
#
def load_model_and_encoders(model_dir=None):
    if model_dir is None:
        model_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    print(">>> Loading model_dir:", model_dir)

    # ----- Load encoders -----
    user_encoder = joblib.load(os.path.join(model_dir, "user_encoder.pkl"))
    item_encoder = joblib.load(os.path.join(model_dir, "item_encoder.pkl"))
    base_bias_df = pd.read_pickle(os.path.join(model_dir, "combined_biases_with_pred.pkl"))

    # ----- Load saved model weights (to extract REAL embedding size) -----
    state = torch.load(os.path.join(model_dir, "neural_cf_fair_model.pth"), map_location="cpu")

    real_num_users = state["user_embedding_mlp.weight"].shape[0]
    real_num_items = state["item_embedding_mlp.weight"].shape[0]

    print(">>> REAL num_users from saved model:", real_num_users)
    print(">>> REAL num_items from saved model:", real_num_items)

    # ----- Create model with correct size -----
    model = NeuralCF(real_num_users, real_num_items, EMBEDDING_DIM)
    model.load_state_dict(state)
    model.eval()

    # ----- Load JBF module -----
    jbf_module = CombinedBiasInteractionModule(k=16, h=32)
    jbf_module.load_state_dict(
        torch.load(os.path.join(model_dir, "jbf_module.pth"), map_location="cpu")
    )
    jbf_module.eval()

    return model, jbf_module, user_encoder, item_encoder, base_bias_df




##
# @brief Fine-tune model embeddings for a new user
# @param model NeuralCF Pre-trained model to fine-tune
# @param jbf CombinedBiasInteractionModule Fairness module (fixed during fine-tuning)
# @param user_enc LabelEncoder User ID encoder (updated with new user)
# @param item_enc LabelEncoder Item ID encoder (unchanged)
# @param bias_df pd.DataFrame Pre-computed bias factors for all items
# @param new_user_id int Numeric user ID (hashed Firebase UID)
# @param new_user_ratings pd.DataFrame User ratings with columns: UserID, MovieID, Rating
# @return tuple (fine_tuned_model, updated_user_encoder)
# @details Expands user embedding matrices to accommodate new user, performs gradient-based
#          optimization on user embedding parameters only. Fairness loss term pulls predictions
#          away from biased directions. Returns updated model and encoder.
#
def fine_tune_user(model, jbf, user_enc, item_enc, bias_df, new_user_id, new_user_ratings):

    # ---------------------------
    # EXPAND USER ENCODER + EMBEDDING
    # ---------------------------
    if new_user_id not in user_enc.classes_:
        user_enc.classes_ = np.append(user_enc.classes_, new_user_id)

        with torch.no_grad():
            mean_mlp = model.user_embedding_mlp.weight.mean(0, keepdim=True)
            mean_gmf = model.user_embedding_gmf.weight.mean(0, keepdim=True)

            model.user_embedding_mlp.weight = nn.Parameter(
                torch.cat([model.user_embedding_mlp.weight, mean_mlp], dim=0)
            )
            model.user_embedding_gmf.weight = nn.Parameter(
                torch.cat([model.user_embedding_gmf.weight, mean_gmf], dim=0)
            )

    # encode ids
    new_user_ratings["user"] = user_enc.transform(new_user_ratings["UserID"])
    new_user_ratings["item"] = item_enc.transform(new_user_ratings["MovieID"])

    bias_merge = bias_df[["MovieID"] + BIAS_COLS].drop_duplicates()
    df = new_user_ratings.merge(bias_merge, on="MovieID", how="left").fillna(0.0)

    u = torch.tensor(df["user"].values, dtype=torch.long)
    i = torch.tensor(df["item"].values, dtype=torch.long)
    r = torch.tensor(df["Rating"].values, dtype=torch.float32)
    b = torch.tensor(df[BIAS_COLS].values, dtype=torch.float32)

    # only update this user's embedding rows
    for name, p in model.named_parameters():
        p.requires_grad = ("user_embedding" in name)

    opt = torch.optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=0.001)
    loss_fn = nn.MSELoss()

    for _ in range(FINE_TUNE_EPOCHS):
        opt.zero_grad()
        preds = model(u, i)
        fair = preds - LAMBDA_FAIR * jbf(b)
        loss = loss_fn(fair, r)
        loss.backward()
        opt.step()

    return model, user_enc


##
# @brief Generate fairness-aware + rating-aware recommendations
#        Uses user ratings to build a preference vector for personalized ranking.
#
def recommend_and_explain(
    model, jbf_module, user_encoder, item_encoder, base_bias_df,
    new_user_id, user_profile, users, movies, ratings,
    client, theta_u, ratings_input, top_k=6
):

    # ==============================================================
    # Prepare item embeddings and bias vectors
    # ==============================================================
    num_items = len(item_encoder.classes_)
    uid = user_encoder.transform([new_user_id])[0]

    user_t = torch.tensor([uid] * num_items)
    item_t = torch.arange(num_items)

    # Build fair bias matrix aligned with item order
    bias_df = base_bias_df.drop_duplicates("MovieID")[["MovieID"] + BIAS_COLS]
    bias_df = bias_df.set_index("MovieID").reindex(item_encoder.classes_, fill_value=0.0)
    bias_t = torch.tensor(bias_df[BIAS_COLS].values, dtype=torch.float32)

    # ==============================================================
    # Step 1: Original fairness-aware CF predictions
    # ==============================================================
    with torch.no_grad():
        preds = model(user_t, item_t)            # raw CF scores
        fair_preds = preds - LAMBDA_FAIR * jbf_module(bias_t)  # fairness adjustment

    # ==============================================================
    # Step 2: Genre-based personalization (MovieLens format)
    # ==============================================================

    if ratings_input and len(ratings_input) > 0:
        try:
            # ------------------------------------------------
            # 2.1 Extract all genres from FULL movies DF
            #     since movies['Genres'] = "A|B|C" string
            # ------------------------------------------------
            all_genres = set()
            for gs in movies['Genres'].fillna(''):
                for g in gs.split('|'):
                    if g.strip():
                        all_genres.add(g.strip())

            all_genres = sorted(all_genres)
            genre_to_idx = {g: idx for idx, g in enumerate(all_genres)}
            num_genres = len(all_genres)

            # ------------------------------------------------
            # 2.2 Build genre matrix for ALL items
            # ------------------------------------------------
            genre_matrix = torch.zeros((num_items, num_genres), dtype=torch.float32)

            for idx, mid in enumerate(item_encoder.classes_):
                row = movies[movies['MovieID'] == int(mid)]
                if not row.empty:
                    gs = row.iloc[0]['Genres']
                    for g in gs.split('|'):
                        g = g.strip()
                        if g in genre_to_idx:
                            genre_matrix[idx, genre_to_idx[g]] = 1.0

            # ------------------------------------------------
            # 2.3 Build user preference vector from ratings_input
            # ------------------------------------------------
            movie_ids = [int(r["movieId"]) for r in ratings_input]
            scores = torch.tensor([r["rating"] for r in ratings_input], dtype=torch.float32)
            scores = scores / scores.max()

            item_indices = item_encoder.transform(movie_ids)
            item_indices = torch.tensor(item_indices, dtype=torch.long)

            selected_genres = genre_matrix[item_indices]  
            user_genre_pref = (selected_genres.T @ scores).float()

            if user_genre_pref.sum() > 0:
                user_genre_pref = user_genre_pref / user_genre_pref.sum()
            else:
                user_genre_pref = torch.ones(num_genres) / num_genres

            # ------------------------------------------------
            # 2.4 Compute GENRE similarity
            # ------------------------------------------------
            sim_scores = genre_matrix @ user_genre_pref

            # ------------------------------------------------
            # 2.5 Combine with fairness-aware CF scores
            # ------------------------------------------------
            ALPHA = 0.35
            min_std = 0.2
            eps = 1e-8

            fair_mean = fair_preds.mean()
            fair_std = fair_preds.std(unbiased=False).clamp(min=min_std)
            fair_z = (fair_preds - fair_mean) / (fair_std + eps)

            sim_mean = sim_scores.mean()
            sim_std = sim_scores.std(unbiased=False).clamp(min=min_std)
            sim_z = (sim_scores - sim_mean) / (sim_std + eps)

            final_scores = fair_z + ALPHA * sim_z

            print("🔥 fair_preds[:10]:", fair_preds[:10])
            print("🔥 sim_scores[:10]:", sim_scores[:10])
            print("🔥 final_scores[:10]:", final_scores[:10])

        except Exception as e:
            print(">>> Preference vector failed:", e)
            final_scores = fair_preds


    # ==============================================================
    # Step 3: Select top-K ranked items
    # ==============================================================
    top_idx = torch.topk(final_scores, top_k).indices.numpy()
    recommended_items = item_encoder.inverse_transform(top_idx)

    results = []

    # ==============================================================
    # Step 4: LLM explanation (your original code)
    # ==============================================================
    for mid in recommended_items:
        row = bias_df.loc[mid].to_dict()
        raw_bias_vec = np.array(list(row.values()), dtype=float)
        exps = np.exp(raw_bias_vec - raw_bias_vec.max())
        probs = exps / exps.sum() if exps.sum() > 0 else np.ones_like(exps) / len(exps)
        E_ui = {k: float(v) for k, v in zip(BIAS_COLS, probs)}

        X_u = get_X_u(new_user_id, users, user_profile=user_profile)
        M_i = get_M_i(mid, movies)
        explanation = generate_llm_explanation(E_ui, X_u, M_i, client, theta_u)

        results.append(
            {
                "movie_id": int(mid),
                "title": M_i["title"],
                "genres": M_i.get("category", "").split("|") if M_i.get("category") else [],
                "E_ui": E_ui,
                "explanation": explanation,
            }
        )

    return results

