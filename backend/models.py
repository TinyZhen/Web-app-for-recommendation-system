##
# @file models.py
# @brief Pydantic models and neural network modules for recommendation system
# @details Contains data models for API responses and neural network modules for explanation extraction.
#
from pydantic import BaseModel, Field
from typing import List, Optional
import torch
import torch.nn as nn
import torch.nn.functional as F

##
# @class ExplanationVectorExtractor
# @brief Neural network module for extracting bias attribution vectors
# @details Processes JBF (Joint Bias Factor) input and outputs normalized bias scores
#          representing different bias types (Popularity, Interaction, Demographic).
#
class ExplanationVectorExtractor(nn.Module):
    ##
    # @brief Initialize the explanation vector extractor
    # @param input_dim Number of input features from JBF module
    #
    def __init__(self, input_dim):
        super(ExplanationVectorExtractor, self).__init__()
        self.proj = nn.Linear(input_dim, 6)  # Outputs: PB, IB, DB (collapsed)

    ##
    # @brief Forward pass to extract explanation vectors
    # @param jbf_input Input tensor from CombinedBiasInteractionModule
    # @return Normalized explanation vector with softmax applied
    # @details Shape: (batch_size, 6) - softmax normalized bias scores
    #
    def forward(self, jbf_input):
        raw_bias_scores = self.proj(jbf_input)  # shape: (batch, 6)
        explanation_vector = F.softmax(raw_bias_scores, dim=1)
        return explanation_vector  # [PB, IB, DB]


##
# @class Recommendation
# @brief Pydantic model for a single movie recommendation
# @details Contains movie information and recommendation score/reason.
#
class Recommendation(BaseModel):
    movie_id: str      ##< Unique identifier for the movie (IMDb format)
    title: str         ##< Movie title
    score: float = Field(ge=0)  ##< Recommendation confidence score (0-1)
    reason: Optional[str] = None  ##< Human-readable explanation for the recommendation

##
# @class Favorites
# @brief Pydantic model for a user's favorite movie
#
class Favorites(BaseModel):
    movie_id: str  ##< Unique identifier for the movie
    title: str     ##< Movie title
    
##
# @class RecsResponse
# @brief API response containing recommendations for a user
# @details Returns personalized movie recommendations with fairness-aware explanations.
#
class RecsResponse(BaseModel):
    user_uid: str                    ##< Firebase user unique identifier
    items: List[Recommendation]      ##< List of recommended movies

##
# @class FavsResponse
# @brief API response containing user's favorite movies
#
class FavsResponse(BaseModel):
    user_uid: str              ##< Firebase user unique identifier
    items: List[Favorites]     ##< List of favorite movies

##
# @brief Build a prompt for LLM-based recommendation explanations
# @details Generates user-friendly prompts adapted to explanation depth parameter (theta_u).
#          Deeper explanations include more fairness-related factors and transparency.
#
# @param E_ui dict Bias attribution vector with keys: PB, IB, DB_gender, DB_age, DB_occupation, DB_zipcode
# @param X_u dict User context (user_id, gender, age, occupation, zip)
# @param M_i dict Item context (item_id, title, category, popularity)
# @param theta_u float Explanation depth parameter in range [0.0, 1.0]
#        - <= 0.3: brief, single-factor explanation
#        - <= 0.7: moderate detail, two factors
#        - > 0.7: detailed, fairness-focused explanation
#
# @return str Formatted prompt string for the LLM
#
def build_explanation_prompt(E_ui, X_u, M_i, theta_u):

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
    user_context = f"User #{X_u['user_id']}"
    title = M_i.get('title') or f"Item #{M_i['item_id']}"
    item_context = f"{title} in the '{M_i['category']}' category"

    # Prompt formats by theta_u
    if theta_u <= 0.3:
        prompt = f"""
        Explain in one friendly sentence why {item_context} was recommended to {user_context}.
        Base the explanation on the most relevant factor: {top_biases_str}.
        """.strip()

    elif theta_u <= 0.7:
        prompt = f"""
        You're a helpful recommendation explanation assistant.

        Explain why {item_context} was recommended to {user_context}.
        Mention up to two top contributing factors such as: {top_biases_str}.
        Keep the explanation concise, user-friendly, and clear.
        """.strip()

    else:
        prompt = f"""
        You are a fairness-aware recommendation explanation assistant.

        User Context: {user_context}
        Item Context: {item_context}
        Top contributing fairness-related factors: {top_biases_str}

        Please generate a detailed, thoughtful, and transparent explanation for this recommendation.
        Focus on fairness and personalization while remaining easy to understand.
        """.strip()

    return prompt

def generate_llm_explanation(E_ui, X_u, M_i, theta_u, temperature=0.7):
    # Build prompt using your existing function
    prompt = build_explanation_prompt(E_ui, X_u, M_i, theta_u)

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You are a fairness-aware recommendation explanation assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=temperature,
            max_tokens=300
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"[LLM generation failed] {e}"