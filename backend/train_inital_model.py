##
# @file train_inital_model.py
# @brief Trains the initial fairness-aware Neural Collaborative Filtering model.
#
# This module loads the MovieLens 1M dataset, constructs multiple bias features
# (popularity, interaction, and demographic), and trains a neural collaborative
# filtering model augmented with bias interaction modules.
#
# The trained model and encoders are saved to disk for later inference.
#

import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from sklearn.preprocessing import LabelEncoder,MinMaxScaler
import joblib
from models import NeuralCF, CombinedBiasInteractionModule, BIAS_COLS
from utility import compute_proportional_demographic_bias
import os

## Directory where dataset and trained artifacts are stored
DATA_DIR = "data/"

## Fixed user embedding size
NUM_EMBEDDING_USERS = 7000   # Fixed user embedding size

## Embedding dimensionality
EMBED_DIM = 32

## Number of training epochs
EPOCHS = 5

## Learning rate for optimizer
LR = 0.001

##
# @brief Load MovieLens 1M dataset files.
#
# Reads users, movies, and ratings data files from disk.
#
# @return tuple (users, movies, ratings) as pandas DataFrames
#
def load_ml1m():
    movies = pd.read_csv(DATA_DIR+"movies.dat", sep="::", engine="python",
                         names=["MovieID","Title","Genres"], encoding="ISO-8859-1")

    users = pd.read_csv(DATA_DIR+"users.dat", sep="::", engine="python",
                        names=["UserID","Gender","Age","Occupation","Zip-code"])

    ratings = pd.read_csv(DATA_DIR+"ratings.dat", sep="::", engine="python",
                          names=["UserID","MovieID","Rating","Timestamp"])

    return users, movies, ratings

##
# @brief Build bias-aware feature set for training.
#
# This function computes and normalizes:
# - Popularity Bias (PB)
# - Interaction Bias (IB)
# - Demographic Biases (Gender, Age, Occupation, Zip-code)
#
# The final merged dataset is saved as a pickle file.
#
# @param users DataFrame containing user metadata
# @param ratings DataFrame containing user-movie interactions
# @return DataFrame containing ratings augmented with bias features
#
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

##
# @brief Train the initial Neural Collaborative Filtering model.
#
# This function:
# - Loads MovieLens data
# - Builds bias features
# - Encodes users and items
# - Trains a neural CF model using MSE loss
# - Saves trained model weights and encoders
#
# @return None
#
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

##
# @brief Entry point of the script.
#
if __name__ == "__main__":
    train_initial()
