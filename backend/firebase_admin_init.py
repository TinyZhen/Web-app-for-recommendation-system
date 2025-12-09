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

# --------------------------------------------------
# Global Firebase Debug Counters
# --------------------------------------------------
FIREBASE_READ_COUNT = 0
FIREBASE_WRITE_COUNT = 0

def fb_read(path: str):
    """Debug wrapper for firebase reads."""
    global FIREBASE_READ_COUNT
    FIREBASE_READ_COUNT += 1
    print(f"🔥 FIREBASE READ #{FIREBASE_READ_COUNT}: {path}")

def fb_write(path: str):
    """Debug wrapper for firebase writes."""
    global FIREBASE_WRITE_COUNT
    FIREBASE_WRITE_COUNT += 1
    print(f"📝 FIREBASE WRITE #{FIREBASE_WRITE_COUNT}: {path}")
