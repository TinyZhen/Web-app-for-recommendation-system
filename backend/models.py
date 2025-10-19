from pydantic import BaseModel, Field
from typing import List, Optional
import torch
import torch.nn as nn
import torch.nn.functional as F

class ExplanationVectorExtractor(nn.Module):
    def __init__(self, input_dim):
        super(ExplanationVectorExtractor, self).__init__()
        self.proj = nn.Linear(input_dim, 6)  # Outputs: PB, IB, DB (collapsed)

    def forward(self, jbf_input):
        raw_bias_scores = self.proj(jbf_input)  # shape: (batch, 6)
        explanation_vector = F.softmax(raw_bias_scores, dim=1)
        return explanation_vector  # [PB, IB, DB]


class Recommendation(BaseModel):
    movie_id: str
    title: str
    score: float = Field(ge=0)
    reason: Optional[str] = None

class RecsResponse(BaseModel):
    user_uid: str
    items: List[Recommendation]

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