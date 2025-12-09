import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from sklearn.preprocessing import MinMaxScaler
#Define reusable E_ui extractor
def get_E_ui(row):
    return {
        "PB": row["E_learned_PB"],
        "IB": row["E_learned_IB"],
        "DB_gender": row["E_learned_DB_gender"],
        "DB_age": row["E_learned_DB_age"],
        "DB_occupation": row["E_learned_DB_occupation"],
        "DB_zipcode": row["E_learned_DB_zipcode"]
    }

def get_M_i(item_id,movies):
    row = movies[movies.MovieID == item_id].iloc[0]
    return {
        "item_id": row["MovieID"],
        "title": row["Title"],
        "category": row["Genres"].split("|")[0],  # or full genres
        "popularity": row.get("popularity",0.0) #Just for safety
    }

# def get_X_u(user_id,users):
#     # row = users[users.UserID == user_id].iloc[0]
#     subset = users[users.UserID == user_id]

#     # ✅ FIX: if numeric user_id (hash) doesn't exist in users.dat, fallback
#     if subset.empty:
#         return {
#             "user_id": user_id,
#             "gender": "Unknown",
#             "age": 0,
#             "occupation": "Unknown",
#             "zip": "00000"
#         }

#     row = subset.iloc[0]
#     return {
#         "user_id": row["UserID"],
#         "gender": row["Gender"],
#         "age": row["Age"],
#         "occupation": row["Occupation"],
#         "zip": row["Zip-code"]
#     }

def get_X_u(user_id, users, user_profile=None):
    """
    Returns user context for explanation.
    If user_profile (Firestore) is provided, prefer it over users.dat.
    """

    # 🔥 If Firestore user profile exists, use it
    if user_profile is not None:
        return {
            "name": user_profile.get("displayName", "User"),
            "user_id": user_id,
            "gender": user_profile.get("gender", "Unknown"),
            "age": user_profile.get("age", 0),
            "occupation": user_profile.get("occupation", "Unknown"),
            "zip": user_profile.get("zipcode", "00000")
        }

    # Otherwise, use MovieLens (ML-1M) users.dat
    subset = users[users.UserID == user_id]

    # If numeric hashed user not found → fallback
    if subset.empty:
        return {
            "name": "User",
            "user_id": user_id,
            "gender": "Unknown",
            "age": 0,
            "occupation": "Unknown",
            "zip": "00000"
        }

    row = subset.iloc[0]
    return {
        "name": f"User #{row['UserID']}",
        "user_id": row["UserID"],
        "gender": row["Gender"],
        "age": row["Age"],
        "occupation": row["Occupation"],
        "zip": row["Zip-code"]
    }

def build_explanation_prompt(E_ui, X_u, M_i, theta_u):
    """
    Builds a user-friendly prompt for LLM-based recommendation explanations.

    Args:
        E_ui (dict): Bias attribution vector (e.g., {"PB": 0.12, "IB": 0.10, ...})
        X_u (dict): User context (e.g., user_id, age, diversity_score)
        M_i (dict): Item context (e.g., item_id, title, category)
        theta_u (float): Explanation depth [0.0, 1.0]

    Returns:
        str: Prompt string for the LLM.
    """

    # Map bias keys to friendly labels
    BIAS_LABELS = {
        "PB": "popularity bias",
        "IB": "interaction patterns",
        "DB_gender": "gender preferences",
        "DB_age": "age group tendencies",
        "DB_occupation": "profession-based interests",
        "DB_zipcode": "regional viewing trends"
    }

    # Sort and map top contributing biases
    sorted_bias = sorted(E_ui.items(), key=lambda x: x[1], reverse=True)
    top_k = 3 if theta_u > 0.7 else 2 if theta_u > 0.3 else 1
    top_biases = sorted_bias[:top_k]
    top_biases_str = ", ".join([BIAS_LABELS.get(k, k.replace("_", " ")) for k, _ in top_biases])

    # User and item context
    # user_context = f"User #{X_u['user_id']}"
    user_context = X_u.get("name", "the user")

    title = M_i.get('title') or f"Item #{M_i['item_id']}"
    item_context = f"{title} in the '{M_i['category']}' category"

    # Prompt formats by theta_u
    # NOTE: ask the model to produce a neutral, reason-first explanation WITHOUT
    # addressing the user directly or using first-person phrases like "I recommend... to <name>".
    if theta_u <= 0.3:
        prompt = f"""
Provide one friendly sentence explaining the reason for recommending {item_context}.
Do NOT address the user by name or use first-person phrases such as "I recommend".
Base the explanation on the most relevant factor: {top_biases_str}.
        """.strip()

    elif theta_u <= 0.7:
        prompt = f"""
You're a recommendation explanation assistant.

Provide a concise explanation for recommending {item_context}.
Do NOT address the user directly or use first-person phrasing (e.g., avoid "I recommend this to...").
Mention up to two top contributing factors such as: {top_biases_str}.
Keep the explanation user-friendly and clear.
        """.strip()

    else:
        prompt = f"""
You are a fairness-aware recommendation explanation assistant.

Item Context: {item_context}
Top contributing fairness-related factors: {top_biases_str}

Generate a detailed, transparent explanation for recommending this item.
Do NOT include first-person recommendations or address a specific user (avoid phrases like "I recommend this to <name>").
Focus on fairness and personalization while remaining easy to understand.
        """.strip()

    return prompt

def generate_llm_explanation(E_ui, X_u, M_i, client, theta_u, temperature=0.7):
    # Build prompt using your existing function
    prompt = build_explanation_prompt(E_ui, X_u, M_i, theta_u)

    try:
        # Strong system instruction to avoid first-person recommendation phrasing
        system_msg = (
            "You generate neutral, factual recommendation explanations. "
            "Do NOT use first-person phrasing such as 'I recommend' or address the user by name. "
            "Provide reasons and contributing factors in concise language."
        )

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": prompt}
            ],
            temperature=temperature,
            max_tokens=300
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"[LLM generation failed] {e}"
    
# --- Proportional Demographic Bias (DB) helpers ---
def compute_proportional_demographic_bias(ratings_df: pd.DataFrame, users_df: pd.DataFrame, group_field: str, scaler) -> pd.DataFrame:
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