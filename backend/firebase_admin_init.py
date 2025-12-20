##
# @file firebase_admin_init.py
# @brief Firebase Admin SDK initialization and debug helpers
#
# @details
# This module provides:
# - Safe, singleton-style initialization of the Firebase Admin SDK
# - Access to Firebase authentication utilities
# - Lightweight debug counters for tracking Firestore read/write usage
#
# The initialization relies on a Google service account JSON file
# whose path must be provided via the GOOGLE_APPLICATION_CREDENTIALS
# environment variable.
#
import os
import firebase_admin
from firebase_admin import credentials, auth

# ==============================================================
# Firebase App Singleton
# ==============================================================
##
# @var _app
# @brief Cached Firebase app instance
#
# @details
# Ensures Firebase Admin SDK is initialized only once per process.
#
_app = None

##
# @brief Initialize and return the Firebase Admin app
#
# @return firebase_admin.App
#         Initialized Firebase application instance
#
# @exception RuntimeError
#        Raised if the service account file is missing or invalid
#
# @details
# This function initializes the Firebase Admin SDK using a service
# account certificate specified by the GOOGLE_APPLICATION_CREDENTIALS
# environment variable. Subsequent calls return the cached app instance.
#
def init_firebase_app():
    global _app
    if _app is None:
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if not cred_path or not os.path.exists(cred_path):
            raise RuntimeError("Service account file not found. Set GOOGLE_APPLICATION_CREDENTIALS correctly.")
        cred = credentials.Certificate(cred_path)
        _app = firebase_admin.initialize_app(cred)
    return _app

##
# @brief Public exports for this module
#
# @details
# Exposes init_firebase_app() and Firebase authentication utilities
# to importing modules.
#
__all__ = ["init_firebase_app", "auth"]

# ==============================================================
# Firebase Debug Counters
# ==============================================================
##
# @var FIREBASE_READ_COUNT
# @brief Global counter for Firebase read operations
#
# @details
# Incremented every time fb_read() is called.
#
FIREBASE_READ_COUNT = 0

##
# @var FIREBASE_WRITE_COUNT
# @brief Global counter for Firebase write operations
#
# @details
# Incremented every time fb_write() is called.
#
FIREBASE_WRITE_COUNT = 0

##
# @brief Debug wrapper for Firebase read operations
#
# @param path str
#        Firebase document or collection path being read
#
# @details
# This helper function increments a global read counter and prints
# a formatted debug message to standard output. Intended for local
# debugging and performance monitoring.
#
def fb_read(path: str):
    """Debug wrapper for firebase reads."""
    global FIREBASE_READ_COUNT
    FIREBASE_READ_COUNT += 1
    print(f"🔥 FIREBASE READ #{FIREBASE_READ_COUNT}: {path}")

##
# @brief Debug wrapper for Firebase write operations
#
# @param path str
#        Firebase document or collection path being written
#
# @details
# This helper function increments a global write counter and prints
# a formatted debug message to standard output. Intended for local
# debugging and audit tracing.
#
def fb_write(path: str):
    """Debug wrapper for firebase writes."""
    global FIREBASE_WRITE_COUNT
    FIREBASE_WRITE_COUNT += 1
    print(f"📝 FIREBASE WRITE #{FIREBASE_WRITE_COUNT}: {path}")
