import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from sklearn.preprocessing import MinMaxScaler
from utility import get_E_ui, get_M_i, get_X_u, generate_llm_explanation, build_explanation_prompt, compute_proportional_demographic_bias
from models import ExplanationVectorExtractor
from scipy.special import softmax
from openai import OpenAI
from pathlib import Path

# ---------------------------
# expose a function the API can call
# ---------------------------
def compute_explanations(limit: int = 10):
    # ---------------------------
    # 1) Firestore -> DataFrames  (kept commented; using file fallback below)
    # ---------------------------
    # cred = credentials.Certificate("serviceAccountKey.json")
    # try:
    #     firebase_admin.get_app()
    # except ValueError:
    #     firebase_admin.initialize_app(cred)
    #
    # db = firestore.client()
    #
    # # Movies
    # movies_ref = db.collection("movies")
    # movies_docs = movies_ref.stream()
    # movies_list = []
    # for doc in movies_docs:
    #     d = doc.to_dict()
    #     movies_list.append({
    #         "MovieID": d.get("movieId"),
    #         "Title": d.get("title"),
    #         "Genres": d.get("genresStr"),
    #     })
    # movie = pd.DataFrame(movies_list)
    #
    # # Users
    # users_ref = db.collection("users")
    # users_docs = users_ref.stream()
    # users_list = []
    # for doc in users_docs:
    #     d = doc.to_dict()
    #     users_list.append({
    #         "UserID_str": d.get("uid"),
    #         "Gender": d.get("gender"),
    #         "Age": d.get("age"),
    #         "Occupation": d.get("occupation"),
    #         "Zip-code": d.get("zipcode"),
    #     })
    # user = pd.DataFrame(users_list)
    #
    # # Ratings
    # ratings_ref = db.collection("ratings")
    # ratings_docs = ratings_ref.stream()
    # ratings_list = []
    # for doc in ratings_docs:
    #     d = doc.to_dict()
    #     ratings_list.append({
    #         "UserID_str": d.get("userId"),
    #         "MovieID": d.get("movieId"),
    #         "Rating": d.get("rating"),
    #         "Timestamp": d.get("timestamp"),
    #     })
    # ratings = pd.DataFrame(ratings_list)
    #
    # # Ensure IDs are strings (prevents category issues)
    # for col in ["UserID_str", "MovieID"]:
    #     if col in ratings.columns:
    #         ratings[col] = ratings[col].astype(str)
    #     if col in user.columns:
    #         user[col] = user[col].astype(str)
    #
    # # Convert Timestamp (could be Firestore string) -> epoch seconds (int)
    # ratings["Timestamp"] = pd.to_datetime(ratings["Timestamp"]).astype("int64") // 10**9
    #
    # # Convert UIDs to ints consistently (if using Firestore path)
    # all_user_ids = pd.concat([user["UserID_str"], ratings["UserID_str"]], ignore_index=True).dropna().unique()
    # uid_to_idx = {uid: idx for idx, uid in enumerate(all_user_ids)}
    # user["UserID"] = user["UserID_str"].map(uid_to_idx)
    # ratings["UserID"] = ratings["UserID_str"].map(uid_to_idx)

    
    DATA_DIR = Path(__file__).resolve().parent / "data"
    user = pd.read_csv(
        DATA_DIR / "users.dat",
        sep="::", engine="python",
        names=["UserID", "Gender", "Age", "Occupation", "Zip-code"]
    )
    ratings = pd.read_csv(
        DATA_DIR / "ratings.dat",
        sep="::", engine="python",
        names=["UserID", "MovieID", "Rating", "Timestamp"]
    )
    movie = pd.read_csv(
        DATA_DIR / "movies.dat",
        sep="::", engine="python",
        names=["MovieID", "Title", "Genres"],
        encoding="ISO-8859-1"
    )

    # ---------------------------
    # 2) Bias Feature Engineering
    # ---------------------------
    scaler = MinMaxScaler()

    # --- Popularity Bias (PB) ---
    item_popularity = ratings["MovieID"].value_counts().to_dict()
    total_popularity = sum(item_popularity.values())
    ratings["PB"] = ratings["MovieID"].map(lambda i: item_popularity.get(i, 0) / total_popularity if total_popularity else 0.0)
    ratings[["PB"]] = scaler.fit_transform(ratings[["PB"]])

    # --- Interaction Bias (IB) ---
    ratings["Timestamp"] = pd.to_datetime(ratings["Timestamp"], unit="s")
    ratings = ratings.sort_values(by=["UserID", "Timestamp"])
    ratings["TimeIndex"] = ratings.groupby("UserID").cumcount()

    eta = 0.01
    ratings["w_t"] = np.exp(-eta * ratings["TimeIndex"])
    ratings["r_wt"] = ratings["Rating"] * ratings["w_t"]

    user_movie_group = ratings.groupby(["UserID", "MovieID"], as_index=False)[["r_wt", "w_t"]].sum()
    interaction_bias = user_movie_group.copy()
    interaction_bias["IB"] = interaction_bias["r_wt"] / interaction_bias["w_t"]
    interaction_bias[["IB"]] = scaler.fit_transform(interaction_bias[["IB"]])

    # Demographic biases
    pdb_gender     = compute_proportional_demographic_bias(ratings, user, "Gender", scaler)
    pdb_age        = compute_proportional_demographic_bias(ratings, user, "Age", scaler)
    pdb_occupation = compute_proportional_demographic_bias(ratings, user, "Occupation", scaler)
    pdb_zipcode    = compute_proportional_demographic_bias(ratings, user, "Zip-code", scaler)

    combined_pdb = (
        pdb_gender
        .merge(pdb_age, on=["UserID", "MovieID"], how="left")
        .merge(pdb_occupation, on=["UserID", "MovieID"], how="left")
        .merge(pdb_zipcode, on=["UserID", "MovieID"], how="left")
    )

    combined_pb_ib = ratings[["UserID", "MovieID", "PB"]].merge(
        interaction_bias[["UserID", "MovieID", "IB"]],
        on=["UserID", "MovieID"],
        how="left"
    )

    combined_biases = combined_pb_ib.merge(combined_pdb, on=["UserID", "MovieID"], how="left")
    combined_biases["Rating"] = ratings["Rating"]

    # ---- Embedding projection (same as your code) ----
    bias_columns = ["PB", "IB", "DB_gender", "DB_age", "DB_occupation", "DB_zipcode"]
    bias_tensor = torch.tensor(combined_biases[bias_columns].values, dtype=torch.float32)

    k = 8
    W_PB = nn.Parameter(torch.randn(1, k))
    W_IB = nn.Parameter(torch.randn(1, k))
    W_DB_gender = nn.Parameter(torch.randn(1, k))
    W_DB_age = nn.Parameter(torch.randn(1, k))
    W_DB_occupation = nn.Parameter(torch.randn(1, k))
    W_DB_zipcode = nn.Parameter(torch.randn(1, k))
    activation = nn.ReLU()

    b_PB            = activation(bias_tensor[:, 0].unsqueeze(1)) @ W_PB
    b_IB            = activation(bias_tensor[:, 1].unsqueeze(1)) @ W_IB
    b_DB_gender     = activation(bias_tensor[:, 2].unsqueeze(1)) @ W_DB_gender
    b_DB_age        = activation(bias_tensor[:, 3].unsqueeze(1)) @ W_DB_age
    b_DB_occupation = activation(bias_tensor[:, 4].unsqueeze(1)) @ W_DB_occupation
    b_DB_zipcode    = activation(bias_tensor[:, 5].unsqueeze(1)) @ W_DB_zipcode

    individuals = [b_PB, b_IB, b_DB_gender, b_DB_age, b_DB_occupation, b_DB_zipcode]
    interactions = []
    for db in [b_DB_gender, b_DB_age, b_DB_occupation, b_DB_zipcode]:
        interactions.append(b_PB * db)
    for db in [b_DB_gender, b_DB_age, b_DB_occupation, b_DB_zipcode]:
        interactions.append(b_IB * db)
    db_list = [b_DB_gender, b_DB_age, b_DB_occupation, b_DB_zipcode]
    for i in range(len(db_list)):
        for j in range(i + 1, len(db_list)):
            interactions.append(db_list[i] * db_list[j])

    jbf_input = torch.cat(individuals + interactions, dim=1)
    input_dim = jbf_input.shape[1]
    W_jbf = nn.Linear(input_dim, 1)
    sigma = nn.Sigmoid()

    JBF_star = sigma(W_jbf(jbf_input))
    combined_biases["JBF_star"] = JBF_star.detach().numpy().flatten()

    extractor = ExplanationVectorExtractor(input_dim)
    E_ui = extractor(jbf_input)

    E_ui_raw = combined_biases[bias_columns].apply(lambda row: softmax(row.values), axis=1)
    E_ui_raw_df = pd.DataFrame(E_ui_raw.tolist(), columns=[f"E_raw_{col}" for col in bias_columns])
    E_ui_np = E_ui.detach().cpu().numpy()
    bias_labels = ["PB", "IB", "DB_gender", "DB_age", "DB_occupation", "DB_zipcode"]
    E_ui_df = pd.DataFrame(E_ui_np, columns=[f"E_learned_{col}" for col in bias_labels])
    combined_df = pd.concat([E_ui_raw_df, E_ui_df], axis=1)

    for col in bias_labels:
        combined_df[f"delta_{col}"] = combined_df[f"E_learned_{col}"] - combined_df[f"E_raw_{col}"]

    client = OpenAI(
        api_key="GROQ_API_KEY_REMOVED",
        base_url="https://api.groq.com/openai/v1"
    )

    popularity = ratings.groupby("MovieID").size().reset_index(name="num_ratings")
    movie2 = movie.merge(popularity, on="MovieID", how="left")
    threshold = movie2["num_ratings"].quantile(0.75)
    movie2["popularity"] = movie2["num_ratings"].apply(lambda x: "high" if x >= threshold else "low")

    combined_df["UserID"] = ratings["UserID"]
    combined_df["MovieID"] = ratings["MovieID"]

    explanations = []
    experiment_df = combined_df.head(max(1, int(limit))).copy()
    experiment_df.loc[:, "theta_u"] = np.random.rand(len(experiment_df))

    count = 1
    for _, row in experiment_df.iterrows():
        user_id = row["UserID"]
        item_id = row["MovieID"]
        theta_u = row["theta_u"]

        e_ui_vec = get_E_ui(row)
        X_u = get_X_u(user_id, user)
        M_i = get_M_i(item_id, movie2)

        try:
            explanation = generate_llm_explanation(e_ui_vec, X_u, M_i, client=client, theta_u=theta_u, temperature=0.9)
        except Exception as e:
            explanation = f"Failed to generate: {e}"

        explanations.append(f"{count} : {explanation}")
        count += 1

    return explanations


# Optional: keep CLI behavior for manual testing
if __name__ == "__main__":
    out = compute_explanations(limit=10)
    for line in out:
        print(line)
