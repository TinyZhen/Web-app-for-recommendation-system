# Define reusable E_ui extractor
def get_E_ui(row):
    return {
        "PB": row["E_learned_PB"],
        "IB": row["E_learned_IB"],
        "DB_gender": row["E_learned_DB_gender"],
        "DB_age": row["E_learned_DB_age"],
        "DB_occupation": row["E_learned_DB_occupation"],
        "DB_zipcode": row["E_learned_DB_zipcode"]
    }

def get_M_i(item_id):
    row = movies[movies.MovieID == item_id].iloc[0]
    return {
        "item_id": row["MovieID"],
        "title": row["Title"],
        "category": row["Genres"].split("|")[0],  # or full genres
        "popularity": row["popularity"]
    }

def get_X_u(user_id):
    row = users[users.UserID == user_id].iloc[0]
    return {
        "user_id": row["UserID"],
        "gender": row["Gender"],
        "age": row["Age"],
        "occupation": row["Occupation"],
        "zip": row["Zip-code"]
    }