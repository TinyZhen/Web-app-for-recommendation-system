# ============================================
# 1. MODEL CLASSES
# ============================================
# model_classes.py

import torch
from torch import nn
from torch.utils.data import Dataset

# Default order of bias components
BIAS_COLS = ["PB", "IB", "DB_gender", "DB_age", "DB_occupation", "DB_zipcode"]

class CombinedBiasInteractionModule(nn.Module):
    def __init__(self, k=16, h=32):
        super().__init__()
        self.k = k
        self.W = nn.ParameterDict({c: nn.Parameter(torch.randn(1, k)) for c in BIAS_COLS})
        self.act = nn.ReLU()
        self.interaction_layer = nn.Sequential(
            nn.Linear(21 * k, h),
            nn.ReLU(),
            nn.Linear(h, 1),
            nn.Sigmoid()
        )

    def forward(self, bias_tensor):
        emb = [self.act(bias_tensor[:, i:i+1]) @ self.W[c] for i, c in enumerate(BIAS_COLS)]
        inter = [emb[i] * emb[j] for i in range(len(emb)) for j in range(i + 1, len(emb))]
        jbf_input = torch.cat(emb + inter, dim=1)
        return self.interaction_layer(jbf_input).squeeze()


class NeuralCF(nn.Module):
    def __init__(self, num_users, num_items, embedding_dim=32):
        super().__init__()
        self.user_embedding_mlp = nn.Embedding(num_users, embedding_dim)
        self.item_embedding_mlp = nn.Embedding(num_items, embedding_dim)
        self.user_embedding_gmf = nn.Embedding(num_users, embedding_dim)
        self.item_embedding_gmf = nn.Embedding(num_items, embedding_dim)
        self.mlp = nn.Sequential(
            nn.Linear(2 * embedding_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 32),
            nn.ReLU()
        )
        self.output_layer = nn.Linear(embedding_dim + 32, 1)

    def forward(self, user, item):
        u_mlp, i_mlp = self.user_embedding_mlp(user), self.item_embedding_mlp(item)
        mlp_out = self.mlp(torch.cat([u_mlp, i_mlp], dim=1))
        u_gmf, i_gmf = self.user_embedding_gmf(user), self.item_embedding_gmf(item)
        gmf_out = u_gmf * i_gmf
        return self.output_layer(torch.cat([gmf_out, mlp_out], dim=1)).squeeze()

class RatingsWithBiasDataset(Dataset):
    def __init__(self, df):
        self.user = torch.tensor(df["user"].values, dtype=torch.long)
        self.item = torch.tensor(df["item"].values, dtype=torch.long)
        self.rating = torch.tensor(df["Rating"].values, dtype=torch.float32)
        self.bias_tensor = torch.tensor(df[BIAS_COLS].values, dtype=torch.float32)
    def __len__(self): return len(self.rating)
    def __getitem__(self, idx):
        return self.user[idx], self.item[idx], self.rating[idx], self.bias_tensor[idx]