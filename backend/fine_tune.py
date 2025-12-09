# backend/fine_tune.py
import os
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.preprocessing import LabelEncoder
import joblib
from model_classes import NeuralCF, CombinedBiasInteractionModule, BIAS_COLS
from utility import get_X_u, get_M_i, generate_llm_explanation

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")


# ------------------------------
# Hyperparameters
# ------------------------------
EMBEDDING_DIM = 32
LAMBDA_FAIR = 1.0
MU_REG = 1e-4
FINE_TUNE_EPOCHS = 30


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


def recommend_and_explain(
    model, jbf_module, user_encoder, item_encoder, base_bias_df,
    new_user_id, user_profile, users, movies, ratings, client, theta_u, top_k=6
):

    num_items = len(item_encoder.classes_)
    uid = user_encoder.transform([new_user_id])[0]
    user_t = torch.tensor([uid] * num_items)
    item_t = torch.arange(num_items)

    bias_df = base_bias_df.drop_duplicates("MovieID")[["MovieID"] + BIAS_COLS]
    bias_df = bias_df.set_index("MovieID").reindex(item_encoder.classes_, fill_value=0.0)
    bias_t = torch.tensor(bias_df[BIAS_COLS].values, dtype=torch.float32)

    with torch.no_grad():
        preds = model(user_t, item_t)
        fair_preds = preds - LAMBDA_FAIR * jbf_module(bias_t)

    top_idx = torch.topk(fair_preds, top_k).indices.numpy()
    recommended_items = item_encoder.inverse_transform(top_idx)

    results = []
    # theta_u = float(np.random.rand())

    for mid in recommended_items:
        row = bias_df.loc[mid].to_dict()
        raw_bias_vec = np.array(list(row.values()), dtype=float)
        exps = np.exp(raw_bias_vec - raw_bias_vec.max())
        probs = exps / exps.sum() if exps.sum() > 0 else np.ones_like(exps) / len(exps)
        E_ui = {k: float(v) for k, v in zip(BIAS_COLS, probs)}

        # X_u = get_X_u(new_user_id, users)
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

