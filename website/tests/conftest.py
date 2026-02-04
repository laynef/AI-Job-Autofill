
import pytest
from fastapi.testclient import TestClient
from main import app
from db import Database
import os
import json
import tempfile

# Fixture for the TestClient
@pytest.fixture
def client():
    return TestClient(app)

# Fixture for a temporary database
@pytest.fixture
def mock_db(monkeypatch):
    # Create a temporary file for the DB
    fd, path = tempfile.mkstemp()
    
    # Initialize with empty structure
    initial_data = {
        "licenses": {},
        "usage": {}
    }
    with os.fdopen(fd, 'w') as tmp:
        json.dump(initial_data, tmp)
    
    # Patch the DB_FILE in db module
    monkeypatch.setenv("DB_FILE", path)
    
    # Re-initialize the database instance used in api.py
    # Note: This is tricky because `api.py` imports `db` instance from somewhere or creates it.
    # Let's check api.py imports. It imports `db` likely from `db.py` but let's check `api.py` content again.
    # Actually `api.py` imports `db` (variable) or uses `Database` class?
    # Looking at `api.py` snippet: `license_data = db.get_license(license_key)`
    # This implies `from db import db` or similar. 
    # We need to see where `db` instance is created.
    
    yield path
    
    # Cleanup
    os.remove(path)
