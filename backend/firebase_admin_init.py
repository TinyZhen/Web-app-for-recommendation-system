import os
import firebase_admin
from firebase_admin import credentials, auth

_app = None

def init_firebase_app():
    global _app
    if _app is None:
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if not cred_path or not os.path.exists(cred_path):
            raise RuntimeError("Service account file not found. Set GOOGLE_APPLICATION_CREDENTIALS correctly.")
        cred = credentials.Certificate(cred_path)
        _app = firebase_admin.initialize_app(cred)
    return _app

__all__ = ["init_firebase_app", "auth"]