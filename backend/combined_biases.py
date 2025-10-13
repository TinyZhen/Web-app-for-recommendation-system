import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler

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

#conver userid from strings to numbers and make those userid consistent in both user and ratings data

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

# --- Proportional Demographic Bias (DB) helpers ---
def compute_proportional_demographic_bias(ratings_df: pd.DataFrame, users_df: pd.DataFrame, group_field: str) -> pd.DataFrame:
    """Returns columns: ['UserID','MovieID', f'DB_{group_field_normalized}']"""
    bias_col = "DB_" + group_field.lower().replace("-", "")

    # Keep only necessary fields from users
    if group_field not in users_df.columns:
        # if group field is missing, return empty join shell
        return ratings_df[["UserID", "MovieID"]].assign(**{bias_col: np.nan})

    merged = ratings_df.merge(users_df[["UserID", group_field]], on="UserID", how="left")

    # size of each demographic group (# unique users per group)
    group_sizes = merged.groupby(group_field)["UserID"].nunique()

    # for each (group, item): # unique users in group who interacted with the item
    group_item_counts = (
        merged.groupby([group_field, "MovieID"])["UserID"]
        .nunique()
        .reset_index()
        .rename(columns={"UserID": "GroupInteractionCount"})
    )

    group_item_counts["GroupSize"] = group_item_counts[group_field].map(group_sizes)
    # proportion of group that interacted with item
    group_item_counts[bias_col] = (
        group_item_counts["GroupInteractionCount"] / group_item_counts["GroupSize"]
    ).fillna(0.0)

    result = group_item_counts[["MovieID", group_field, bias_col]]
    merged = merged.merge(result, on=["MovieID", group_field], how="left")

    # normalize 0..1
    merged[[bias_col]] = scaler.fit_transform(merged[[bias_col]].fillna(0.0))

    return merged[["UserID", "MovieID", bias_col]]

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

# Optional: if you want Timestamp back as epoch seconds:
combined_biases = combined_biases.merge(
    ratings[["UserID", "MovieID", "Timestamp"]],
    on=["UserID", "MovieID"],
    how="left",
    suffixes=("", "_dt")
)
combined_biases["Timestamp"] = (combined_biases["Timestamp"].view("int64") // 10**9)

# Show results
print("movie.head():")
print(movie.head(), "\n")
print("user.head():")
print(user.head(), "\n")
print("ratings (with PB/IB helpers) head():")
print(ratings.head(), "\n")
print("combined_biases.head():")
print(combined_biases.head())
