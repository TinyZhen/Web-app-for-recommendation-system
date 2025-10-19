import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from sklearn.preprocessing import MinMaxScaler
from utility import get_E_ui, get_M_i, get_X_u, generate_llm_explanation, build_explanation_prompt, compute_proportional_demographic_bias
from models import ExplanationVectorExtractor


# ---------------------------
# 1) Firestore -> DataFrames
# ---------------------------
cred = credentials.Certificate("serviceAccountKey.json")
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Movies
movies_ref = db.collection("movies")
movies_docs = movies_ref.stream()
movies_list = []
for doc in movies_docs:
    d = doc.to_dict()
    movies_list.append({
        "MovieID": d.get("movieId"),
        "Title": d.get("title"),
        "Genres": d.get("genresStr"),
    })
movie = pd.DataFrame(movies_list)

# Users
users_ref = db.collection("users")
users_docs = users_ref.stream()
users_list = []
for doc in users_docs:
    d = doc.to_dict()
    users_list.append({
        "UserID": d.get("uid"),
        "Gender": d.get("gender"),
        "Age": d.get("age"),
        "Occupation": d.get("occupation"),
        "Zip-code": d.get("zipcode"),
    })
user = pd.DataFrame(users_list)

# Ratings
ratings_ref = db.collection("ratings")
ratings_docs = ratings_ref.stream()
ratings_list = []
for doc in ratings_docs:
    d = doc.to_dict()
    ratings_list.append({
        "UserID": d.get("userId"),
        "MovieID": d.get("movieId"),
        "Rating": d.get("rating"),
        "Timestamp": d.get("timestamp"),
    })
ratings = pd.DataFrame(ratings_list)

# Ensure IDs are strings (prevents category issues)
for col in ["UserID", "MovieID"]:
    if col in ratings.columns:
        ratings[col] = ratings[col].astype(str)
    if col in user.columns:
        user[col] = user[col].astype(str)

# Convert Timestamp (could be Firestore string) -> epoch seconds (int)
# If already epoch ints, this will still work.
ratings["Timestamp"] = pd.to_datetime(ratings["Timestamp"]).astype("int64") // 10**9

#convert userid from strings to numbers and make those userid consistent in both user and ratings data
# 1. Collect all unique userIds from both DataFrames
all_user_ids = pd.concat([user["UserId"], ratings["UserId"]]).unique()

# 2. Fit LabelEncoder on the combined set
encoder = LabelEncoder()
encoder.fit(all_user_ids)

# 3. Transform both DataFrames consistently
user["UserId_num"] = encoder.transform(user["UserId"])
ratings["UserId_num"] = encoder.transform(ratings["UserId"])

# 4. Drop old UserId if you don’t need it
user = user.drop(columns=["UserId"])
ratings = ratings.drop(columns=["UserId"])

user = user.rename(columns={"UserId_num": "UserId"})
ratings = ratings.rename(columns={"UserId_num":"UserId"})

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
# convert epoch seconds to pandas datetime for ordering
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

# Compute DBs (will handle missing columns gracefully)
pdb_gender     = compute_proportional_demographic_bias(ratings, user, "Gender")
pdb_age        = compute_proportional_demographic_bias(ratings, user, "Age")
pdb_occupation = compute_proportional_demographic_bias(ratings, user, "Occupation")
pdb_zipcode    = compute_proportional_demographic_bias(ratings, user, "Zip-code")

# Combine all DBs
combined_pdb = (
    pdb_gender
    .merge(pdb_age, on=["UserID", "MovieID"], how="left")
    .merge(pdb_occupation, on=["UserID", "MovieID"], how="left")
    .merge(pdb_zipcode, on=["UserID", "MovieID"], how="left")
)

# Merge PB and IB
combined_pb_ib = ratings[["UserID", "MovieID", "PB"]].merge(
    interaction_bias[["UserID", "MovieID", "IB"]],
    on=["UserID", "MovieID"],
    how="left"
)

# Final combined biases per (UserID, MovieID)
combined_biases = combined_pb_ib.merge(combined_pdb, on=["UserID", "MovieID"], how="left")
combined_biases['Rating'] = ratings['Rating']

# # Optional: if you want Timestamp back as epoch seconds:
# combined_biases = combined_biases.merge(
#     ratings[["UserID", "MovieID", "Timestamp"]],
#     on=["UserID", "MovieID"],
#     how="left",
#     suffixes=("", "_dt")
# )
# combined_biases["Timestamp"] = (combined_biases["Timestamp"].view("int64") // 10**9)

# Show results
# print("movie.head():")
# print(movie.head(), "\n")
# print("user.head():")
# print(user.head(), "\n")
# print("ratings (with PB/IB helpers) head():")
# print(ratings.head(), "\n")
# print("combined_biases.head():")
# print(combined_biases.head())

# Extract and convert all bias dimensions into tensor
bias_columns = ['PB', 'IB', 'DB_gender', 'DB_age', 'DB_occupation', 'DB_zipcode']
bias_tensor = torch.tensor(combined_biases[bias_columns].values, dtype=torch.float32)

# Define projection dimensions
k = 8  # latent space dimensionality

# Learnable parameters (add one for item exposure)
W_PB = nn.Parameter(torch.randn(1, k))
W_IB = nn.Parameter(torch.randn(1, k))
W_DB_gender = nn.Parameter(torch.randn(1, k))
W_DB_age = nn.Parameter(torch.randn(1, k))
W_DB_occupation = nn.Parameter(torch.randn(1, k))
W_DB_zipcode = nn.Parameter(torch.randn(1, k))

# Define the activation function ϕ (e.g., ReLU)
activation = nn.ReLU()

# Bias projection to latent space
b_PB           = activation(bias_tensor[:, 0].unsqueeze(1)) @ W_PB
b_IB           = activation(bias_tensor[:, 1].unsqueeze(1)) @ W_IB
b_DB_gender    = activation(bias_tensor[:, 2].unsqueeze(1)) @ W_DB_gender
b_DB_age       = activation(bias_tensor[:, 3].unsqueeze(1)) @ W_DB_age
b_DB_occupation= activation(bias_tensor[:, 4].unsqueeze(1)) @ W_DB_occupation
b_DB_zipcode   = activation(bias_tensor[:, 5].unsqueeze(1)) @ W_DB_zipcode

# Step 1: Concatenate individual embeddings (add b_IE)
individuals = [
    b_PB,
    b_IB,
    b_DB_gender,
    b_DB_age,
    b_DB_occupation,
    b_DB_zipcode
]

# Step 2: Define interaction terms
interactions = []

# PB ⊙ each DB dimension
for db in [b_DB_gender, b_DB_age, b_DB_occupation, b_DB_zipcode]:
    interactions.append(b_PB * db)

# IB ⊙ each DB dimension
for db in [b_DB_gender, b_DB_age, b_DB_occupation, b_DB_zipcode]:
    interactions.append(b_IB * db)

# All pairwise interactions between DB dimensions
db_list = [b_DB_gender, b_DB_age, b_DB_occupation, b_DB_zipcode]
for i in range(len(db_list)):
    for j in range(i + 1, len(db_list)):
        interactions.append(db_list[i] * db_list[j])

# Step 3: Concatenate everything
jbf_input = torch.cat(individuals + interactions, dim=1)

# Step 4: Define linear layer and activation (if not already defined)
input_dim = jbf_input.shape[1]
W_jbf = nn.Linear(input_dim, 1)  # scalar per (u, i)
sigma = nn.Sigmoid()

# Step 5: Compute JBF*
JBF_star = sigma(W_jbf(jbf_input))

combined_biases['JBF_star'] = JBF_star.detach().numpy().flatten()

input_dim = jbf_input.shape[1]
extractor = ExplanationVectorExtractor(input_dim)

# Extract E_ui
E_ui = extractor(jbf_input)

# Lets compare the collapsed jbf_input with the original
bias_columns = ["PB", "IB", "DB_gender", "DB_age", "DB_occupation", "DB_zipcode"]
E_ui_raw = combined_biases[bias_columns].apply(lambda row: softmax(row.values), axis=1)

E_ui_raw_df = pd.DataFrame(E_ui_raw.tolist(), columns=[f"E_raw_{col}" for col in bias_columns])

# Convert E_ui into a dataframe
E_ui_np = E_ui.detach().cpu().numpy()

# Create DataFrame
bias_labels = ["PB", "IB", "DB_gender", "DB_age", "DB_occupation", "DB_zipcode"]
E_ui_df = pd.DataFrame(E_ui_np, columns=[f"E_learned_{col}" for col in bias_labels])

combined_df = pd.concat([E_ui_raw_df, E_ui_df], axis=1)

# Compute difference columns
for col in bias_labels:
    combined_df[f"delta_{col}"] = combined_df[f"E_learned_{col}"] - combined_df[f"E_raw_{col}"]

# Set your Groq API key
client = OpenAI(
    api_key="GROQ_API_KEY_REMOVED",
    base_url="https://api.groq.com/openai/v1"
)

popularity = ratings.groupby("MovieID").size().reset_index(name="num_ratings")
movie = movie.merge(popularity, on="MovieID", how="left")

# Label popularity: high if in top 25%
threshold = movie["num_ratings"].quantile(0.75)
movie["popularity"] = movie["num_ratings"].apply(lambda x: "high" if x >= threshold else "low")

combined_df['UserID'] = ratings['UserID']
combined_df['MovieID'] = ratings['MovieID']

# Generate explanations row by row
explanations = []

# Take 10000 rows for the experiment
experiment_df = combined_df.head(100)

theta_u_values = np.random.rand(len(experiment_df))
experiment_df['theta_u'] = theta_u_values

count = 1
for i, row in experiment_df.iterrows():
    user_id = row["UserID"]
    item_id = row["MovieID"]
    theta_u = row["theta_u"]

    E_ui = get_E_ui(row)
    X_u = get_X_u(user_id,user)
    M_i = get_M_i(item_id,movie)

    try:
        #explanation = build_theta_explanation(E_ui, X_u, M_i, theta_u, temperature=0.9)
        explanation = generate_llm_explanation(E_ui, X_u, M_i, theta_u, temperature=0.9)
    except Exception as e:
        explanation = f"Failed to generate: {e}"

    print(count, ": ", explanation)
    explanations.append(explanation)
    count += 1