
import pytest
import os
import sys
from fastapi.testclient import TestClient
import tempfile

# Add website directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from db import Database
import db as db_module

# Fixture to mock the database
@pytest.fixture
def mock_db():
    # Create a temporary file for the database
    fd, path = tempfile.mkstemp()
    os.close(fd)
    
    # Initialize database with temp file
    original_db_file = db_module.DB_FILE
    db_module.DB_FILE = path
    test_db = Database()
    
    yield test_db
    
    # Cleanup
    db_module.DB_FILE = original_db_file
    if os.path.exists(path):
        os.remove(path)

# Fixture for the client
@pytest.fixture
def client(mock_db):
    # Override the global db instance in api and main if necessary
    # Since api.py imports db from db.py, mocking the file path in db.py 
    # and re-initializing should work if we force a reload or if we rely on the fact 
    # that the app imports from the module where we swapped the file path.
    # However, api.py likely imports the 'db' instance. 
    # We might need to patch the 'db' instance in api.py
    
    import api
    api.db = mock_db
    
    return TestClient(app)
