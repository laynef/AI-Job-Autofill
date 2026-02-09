"""
Simple JSON-based database for license and usage tracking
For production: Replace with PostgreSQL, Firebase, or Cloud SQL
"""

import json
import os
from datetime import datetime
from typing import Dict, Optional
import threading

DB_FILE = os.environ.get("DB_FILE", "/data/hiredalways.json")

class Database:
    def __init__(self):
        self.lock = threading.RLock()
        self.data = {
            "licenses": {},  # {license_key: {active, user_id, start_date, etc}}
            "usage": {}      # {device_fingerprint: {count, license_key, last_used}}
        }
        self.load()

    def load(self):
        """Load database from file"""
        try:
            if os.path.exists(DB_FILE):
                with open(DB_FILE, 'r') as f:
                    loaded_data = json.load(f)
                    self.data.update(loaded_data)
                    print(f"Database loaded from {DB_FILE}")
        except Exception as e:
            print(f"Warning: Could not load database: {e}")
            # Continue with empty database

    def save(self):
        """Save database to file"""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)

            with self.lock:
                with open(DB_FILE, 'w') as f:
                    json.dump(self.data, f, indent=2)
        except Exception as e:
            print(f"Error saving database: {e}")

    # License methods
    def get_license(self, license_key: str) -> Optional[Dict]:
        """Get license data"""
        return self.data["licenses"].get(license_key)

    def create_license(self, license_key: str, user_id: str, **kwargs):
        """Create a new license"""
        with self.lock:
            self.data["licenses"][license_key] = {
                "active": True,
                "user_id": user_id,
                "start_date": datetime.now().isoformat(),
                "created_at": datetime.now().isoformat(),
                **kwargs
            }
            self.save()

    def update_license(self, license_key: str, updates: Dict):
        """Update license data"""
        with self.lock:
            if license_key in self.data["licenses"]:
                self.data["licenses"][license_key].update(updates)
                self.save()

    def revoke_license(self, license_key: str):
        """Revoke a license"""
        self.update_license(license_key, {"active": False})

    # Usage methods
    def get_usage(self, device_fingerprint: str) -> Dict:
        """Get usage data for a device"""
        if device_fingerprint not in self.data["usage"]:
            with self.lock:
                self.data["usage"][device_fingerprint] = {
                    "count": 0,
                    "license_key": None,
                    "last_used": None,
                    "created_at": datetime.now().isoformat()
                }
                self.save()
        return self.data["usage"][device_fingerprint]

    def increment_usage(self, device_fingerprint: str):
        """Increment usage counter"""
        with self.lock:
            usage = self.get_usage(device_fingerprint)
            usage["count"] += 1
            usage["last_used"] = datetime.now().isoformat()
            self.save()

    def update_usage(self, device_fingerprint: str, updates: Dict):
        """Update usage data"""
        with self.lock:
            usage = self.get_usage(device_fingerprint)
            usage.update(updates)
            self.save()

# Global database instance
db = Database()
