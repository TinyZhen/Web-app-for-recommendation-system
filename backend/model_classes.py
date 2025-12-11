##
# @file model_classes.py
# @brief Core neural network architectures for fairness-aware recommendation system
# @details Contains NeuralCF (Collaborative Filtering), CombinedBiasInteractionModule (fairness),
#          and dataset utilities for training and inference.
#

import torch
from torch import nn
from torch.utils.data import Dataset

##
# @brief Default order of bias components in the system
# @details Used consistently across modules: Popularity Bias, Interaction Bias, 
#          and Demographic Biases (gender, age, occupation, zipcode)
#
BIAS_COLS = ["PB", "IB", "DB_gender", "DB_age", "DB_occupation", "DB_zipcode"]

##
# @class CombinedBiasInteractionModule
# @brief Joint Bias Factor (JBF) module for modeling bias interactions
# @details Computes pairwise interactions between different bias factors and produces
#          a fairness adjustment score. Essential for fairness-aware recommendations.
#
class CombinedBiasInteractionModule(nn.Module):
    ##
    # @brief Initialize the JBF module
    # @param k int Feature dimension for bias embeddings (default: 16)
    # @param h int Hidden dimension for interaction layer (default: 32)
    # @details Creates learnable weight matrices for each bias component and
    #          interaction layers to model complex bias dependencies.
    #
    def __init__(self, k=16, h=32):
        super().__init__()
        self.k = k  ##< Embedding dimension for bias factors
        self.W = nn.ParameterDict({c: nn.Parameter(torch.randn(1, k)) for c in BIAS_COLS})
        self.act = nn.ReLU()
        self.interaction_layer = nn.Sequential(
            nn.Linear(21 * k, h),
            nn.ReLU(),
            nn.Linear(h, 1),
            nn.Sigmoid()
        )

    ##
    # @brief Forward pass through JBF module
    # @param bias_tensor torch.Tensor Input bias tensor of shape (batch_size, 6)
    #        where each element corresponds to a bias component value
    # @return torch.Tensor Fairness adjustment scores of shape (batch_size,)
    # @details Computes embeddings for each bias component, calculates pairwise interactions,
    #          and passes through interaction layers to produce fairness scores.
    #
    def forward(self, bias_tensor):
        emb = [self.act(bias_tensor[:, i:i+1]) @ self.W[c] for i, c in enumerate(BIAS_COLS)]
        inter = [emb[i] * emb[j] for i in range(len(emb)) for j in range(i + 1, len(emb))]
        jbf_input = torch.cat(emb + inter, dim=1)
        return self.interaction_layer(jbf_input).squeeze()



##
# @class NeuralCF
# @brief Neural Collaborative Filtering model combining MLP and GMF
# @details Implements dual-path architecture: MLP processes concatenated embeddings,
#          GMF uses element-wise multiplication. Final layer combines both paths
#          for rating prediction.
#
class NeuralCF(nn.Module):
    ##
    # @brief Initialize NeuralCF model
    # @param num_users int Total number of users in the system
    # @param num_items int Total number of items in the system
    # @param embedding_dim int Dimension of user and item embeddings (default: 32)
    # @details Creates separate embeddings for MLP and GMF paths to maximize expressiveness.
    #
    def __init__(self, num_users, num_items, embedding_dim=32):
        super().__init__()
        ##< MLP path embeddings
        self.user_embedding_mlp = nn.Embedding(num_users, embedding_dim)
        self.item_embedding_mlp = nn.Embedding(num_items, embedding_dim)
        ##< GMF path embeddings
        self.user_embedding_gmf = nn.Embedding(num_users, embedding_dim)
        self.item_embedding_gmf = nn.Embedding(num_items, embedding_dim)
        
        ##< MLP layers: concatenate embeddings and pass through dense layers
        self.mlp = nn.Sequential(
            nn.Linear(2 * embedding_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 32),
            nn.ReLU()
        )
        ##< Final output layer combining MLP and GMF paths
        self.output_layer = nn.Linear(embedding_dim + 32, 1)

    ##
    # @brief Forward pass through NeuralCF model
    # @param user torch.Tensor User indices of shape (batch_size,)
    # @param item torch.Tensor Item indices of shape (batch_size,)
    # @return torch.Tensor Predicted ratings of shape (batch_size,)
    # @details Computes MLP and GMF paths independently, then concatenates
    #          and passes through output layer for final rating prediction.
    #
    def forward(self, user, item):
        u_mlp, i_mlp = self.user_embedding_mlp(user), self.item_embedding_mlp(item)
        mlp_out = self.mlp(torch.cat([u_mlp, i_mlp], dim=1))
        u_gmf, i_gmf = self.user_embedding_gmf(user), self.item_embedding_gmf(item)
        gmf_out = u_gmf * i_gmf
        return self.output_layer(torch.cat([gmf_out, mlp_out], dim=1)).squeeze()

    ##
    # @brief Return combined item embedding for similarity-based personalization.
    # @param item_indices torch.Tensor of item IDs
    # @return torch.Tensor Embedding matrix [num_items, 2 * embedding_dim]
    #
    def item_embeddings(self, item_indices):
        """
        Build the same representation the model uses internally:
        item_embedding = concat(GMF_embedding, MLP_embedding)
        """

        i_gmf = self.item_embedding_gmf(item_indices)   # [N, dim]
        i_mlp = self.item_embedding_mlp(item_indices)   # [N, dim]

        # concat into final embedding used for similarity calculations
        return torch.cat([i_gmf, i_mlp], dim=1)          # [N, 2*dim]
##
# @class RatingsWithBiasDataset
# @brief PyTorch Dataset for ratings combined with bias information
# @details Provides efficient batched access to user-item-rating triplets with
#          associated bias factor annotations for fair training.
#
class RatingsWithBiasDataset(Dataset):
    ##
    # @brief Initialize dataset from DataFrame
    # @param df pd.DataFrame DataFrame containing columns: user, item, Rating, and BIAS_COLS
    # @details Converts DataFrame to tensors for efficient GPU/CPU processing.
    #
    def __init__(self, df):
        self.user = torch.tensor(df["user"].values, dtype=torch.long)
        self.item = torch.tensor(df["item"].values, dtype=torch.long)
        self.rating = torch.tensor(df["Rating"].values, dtype=torch.float32)
        self.bias_tensor = torch.tensor(df[BIAS_COLS].values, dtype=torch.float32)
    
    ##
    # @brief Return dataset length
    # @return int Number of samples in dataset
    #
    def __len__(self): 
        return len(self.rating)
    
    ##
    # @brief Get a single sample from dataset
    # @param idx int Index of sample to retrieve
    # @return tuple (user_id, item_id, rating, bias_vector)
    #
    def __getitem__(self, idx):
        return self.user[idx], self.item[idx], self.rating[idx], self.bias_tensor[idx]