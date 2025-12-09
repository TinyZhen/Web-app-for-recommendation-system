import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from sklearn.preprocessing import LabelEncoder,MinMaxScaler
import joblib
from model_classes import NeuralCF, CombinedBiasInteractionModule, BIAS_COLS
from utility import compute_proportional_demographic_bias
import os


DATA_DIR = "data/"
NUM_EMBEDDING_USERS = 7000   # Fixed user embedding size
EMBED_DIM = 32
EPOCHS = 5
LR = 0.001

def load_ml1m():
    movies = pd.read_csv(DATA_DIR+"movies.dat", sep="::", engine="python",
                         names=["MovieID","Title","Genres"], encoding="ISO-8859-1")

    users = pd.read_csv(DATA_DIR+"users.dat", sep="::", engine="python",
                        names=["UserID","Gender","Age","Occupation","Zip-code"])

    ratings = pd.read_csv(DATA_DIR+"ratings.dat", sep="::", engine="python",
                          names=["UserID","MovieID","Rating","Timestamp"])

    return users, movies, ratings

def build_bias_features(users, ratings):
    from sklearn.preprocessing import MinMaxScaler

    # ----- 1. Popularity Bias -----
    pop = ratings["MovieID"].value_counts() / len(ratings)
    ratings["PB"] = ratings["MovieID"].map(pop).fillna(0.0)

    # scale PB
    scaler_pb = MinMaxScaler()
    ratings["PB"] = scaler_pb.fit_transform(ratings[["PB"]])

    # ----- 2. Interaction Bias -----
    ratings = ratings.sort_values(["UserID","Timestamp"])
    ratings["idx"] = ratings.groupby("UserID").cumcount()
    ratings["IB"] = np.exp(-0.01 * ratings["idx"])

    scaler_ib = MinMaxScaler()
    ratings["IB"] = scaler_ib.fit_transform(ratings[["IB"]])

    # ----- 3. Demographic Bias (Gender / Age / Occupation / Zip) -----
    scaler_demo = MinMaxScaler()

    pdb_g = compute_proportional_demographic_bias(ratings, users, "Gender", scaler_demo)
    pdb_a = compute_proportional_demographic_bias(ratings, users, "Age", scaler_demo)
    pdb_o = compute_proportional_demographic_bias(ratings, users, "Occupation", scaler_demo)
    pdb_z = compute_proportional_demographic_bias(ratings, users, "Zip-code", scaler_demo)

    # Merge all demographic bias
    bias = (
        pdb_g.merge(pdb_a, on=["UserID", "MovieID"])
             .merge(pdb_o, on=["UserID", "MovieID"])
             .merge(pdb_z, on=["UserID", "MovieID"])
    )

    # ----- 4. Combine everything -----
    final = ratings.merge(bias, on=["UserID", "MovieID"])
    final = final.fillna(0.0)

    # Save
    final.to_pickle("data/combined_biases_with_pred.pkl")
    return final



def train_initial():
    users, movies, ratings = load_ml1m()
    df = build_bias_features(users, ratings)

    # Encoders
    user_enc = LabelEncoder()
    item_enc = LabelEncoder()
    df["user"] = user_enc.fit_transform(df["UserID"])
    df["item"] = item_enc.fit_transform(df["MovieID"])

    joblib.dump(user_enc, DATA_DIR+"user_encoder.pkl")
    joblib.dump(item_enc, DATA_DIR+"item_encoder.pkl")

    num_items = len(item_enc.classes_)

    # Models
    model = NeuralCF(NUM_EMBEDDING_USERS, num_items, EMBED_DIM)
    jbf = CombinedBiasInteractionModule()

    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    loss_fn = nn.MSELoss()

    users_t = torch.tensor(df["user"].values, dtype=torch.long)
    items_t = torch.tensor(df["item"].values, dtype=torch.long)
    ratings_t = torch.tensor(df["Rating"].values, dtype=torch.float32)
    bias_t = torch.tensor(df[BIAS_COLS].values, dtype=torch.float32)

    for epoch in range(EPOCHS):
        optimizer.zero_grad()
        pred = model(users_t, items_t)
        loss = loss_fn(pred, ratings_t)
        loss.backward()
        optimizer.step()
        print(f"[Epoch {epoch}] Loss = {loss.item():.4f}")

    torch.save(model.state_dict(), DATA_DIR+"neural_cf_fair_model.pth")
    torch.save(jbf.state_dict(), DATA_DIR+"jbf_module.pth")

    print("🎉 Done! Initial model trained and saved.")

if __name__ == "__main__":
    train_initial()
