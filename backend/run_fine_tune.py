#run_fine_tune.py
# import pandas as pd
# from fine_tune import load_model_and_encoders, fine_tune_user, recommend_and_explain
# from openai import OpenAI

# # Load trained model + encoders
# model, jbf_module, user_enc, item_enc, bias_df = load_model_and_encoders(".")

# # Example new user ratings
# new_user_ratings = pd.DataFrame({
#     "UserID": [9999, 9999, 9999],
#     "MovieID": [1, 50, 260],
#     "Rating": [5, 4, 3]
# })

# # Fine-tune the model for this new user
# model = fine_tune_user(model, jbf_module, user_enc, item_enc, bias_df, 9999, new_user_ratings)

# # Prepare OpenAI client (Groq)
# client = OpenAI(
#     api_key="YOUR_GROQ_KEY",
#     base_url="https://api.groq.com/openai/v1"
# )

# # You need to load your datasets here
# users = pd.read_csv("data/users.dat", sep="::", engine="python", names=["UserID","Gender","Age","Occupation","Zip-code"])
# movies = pd.read_csv("data/movies.dat", sep="::", engine="python", names=["MovieID","Title","Genres"], encoding="ISO-8859-1")
# ratings = pd.read_csv("data/ratings.dat", sep="::", engine="python", names=["UserID","MovieID","Rating","Timestamp"])

# # Generate recommendations + explanations
# results = recommend_and_explain(model, jbf_module, user_enc, item_enc, bias_df, 9999, users, movies, ratings, client)

# # Display or return JSON
# for r in results:
#     print(f"\n🎬 {r['title']}\nE_ui: {r['E_ui']}\n🗣️ {r['explanation']}")
