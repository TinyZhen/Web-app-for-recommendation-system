##
# @file utility.py
# @brief Utility functions for user/item context extraction and LLM-based explanations
# @details Provides helper functions to retrieve user demographics, item information,
#          and generate natural language explanations for recommendations using LLMs.
#
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from sklearn.preprocessing import MinMaxScaler

##
# @brief Extract bias attribution vector from bias DataFrame row
# @param row pd.Series Row from bias DataFrame containing bias components
# @return dict Dictionary with keys: PB, IB, DB_gender, DB_age, DB_occupation, DB_zipcode
#        Each value is the bias attribution score for that component
#
def get_E_ui(row):
    return {
        "PB": row["E_learned_PB"],
        "IB": row["E_learned_IB"],
        "DB_gender": row["E_learned_DB_gender"],
        "DB_age": row["E_learned_DB_age"],
        "DB_occupation": row["E_learned_DB_occupation"],
        "DB_zipcode": row["E_learned_DB_zipcode"]
    }

##
# @brief Extract item (movie) context for explanation generation
# @param item_id int MovieID to look up
# @param movies pd.DataFrame Movies DataFrame with columns: MovieID, Title, Genres, popularity
# @return dict Dictionary with keys: item_id, title, category, popularity
#        category is extracted from the first genre in the Genres field
#
def get_M_i(item_id, movies):
    row = movies[movies.MovieID == item_id].iloc[0]
    return {
        "item_id": row["MovieID"],
        "title": row["Title"],
        "category": row["Genres"].split("|")[0],  # or full genres
        "popularity": row.get("popularity", 0.0) #Just for safety
    }

##
# @brief Extract user context for explanation generation
# @param user_id int Numeric user ID
# @param users pd.DataFrame MovieLens users.dat with demographics
# @param user_profile dict Optional Firestore user profile (takes precedence)
# @return dict User context dictionary with keys: name, user_id, gender, age, occupation, zip
# @details Prefers Firestore user_profile if available, otherwise falls back to MovieLens.
#          If user not found in either source, returns default values.
#
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

##
# @brief Build a user-friendly LLM prompt for recommendation explanations
#
# @param E_ui dict Bias attribution vector with keys:
#        PB, IB, DB_gender, DB_age, DB_occupation, DB_zipcode
# @param X_u dict User context (e.g., name, age, occupation)
# @param M_i dict Item context (e.g., title, category)
# @param theta_u float Explanation depth parameter in range [0.0, 1.0]
#
# @return str Natural-language prompt string for the LLM
#
# @details
# The explanation depth is controlled by theta_u:
# - theta_u <= 0.3 → brief, single-factor explanation
# - 0.3 < theta_u <= 0.7 → moderate explanation with up to two factors
# - theta_u > 0.7 → detailed, fairness-aware explanation
#
# The generated prompt explicitly avoids first-person phrasing and direct user addressing.
#
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

##
# @brief Generate a natural-language explanation using an LLM
#
# @param E_ui dict Bias attribution vector
# @param X_u dict User context
# @param M_i dict Item context
# @param client OpenAI-compatible client instance
# @param theta_u float Explanation depth parameter
# @param temperature float Sampling temperature for the LLM (default: 0.7)
#
# @return str Generated explanation text, or an error message if generation fails
#
# @details
# This function constructs a prompt using build_explanation_prompt() and
# invokes a chat-completion LLM to generate a neutral, reason-based explanation.
# The system prompt explicitly discourages first-person recommendations.
#
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
    
##
# @brief Compute proportional demographic bias for a given demographic attribute
#
# @param ratings_df pd.DataFrame Ratings data with columns: UserID, MovieID
# @param users_df pd.DataFrame User metadata containing the demographic field
# @param group_field str Demographic attribute (e.g., Gender, Age, Occupation, Zip-code)
# @param scaler sklearn.preprocessing.MinMaxScaler Instance used to normalize bias values
#
# @return pd.DataFrame DataFrame with columns:
#         UserID, MovieID, DB_<group_field>
#
# @details
# The proportional demographic bias is computed as:
#   (# unique users in demographic group who interacted with item)
#   -------------------------------------------------------------
#   (total # unique users in that demographic group)
#
# The resulting values are normalized to [0, 1] using MinMaxScaler.
#
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