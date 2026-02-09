
import pytest
from db import Database
import db as db_module
import os
import tempfile
import importlib

pytestmark = pytest.mark.unit

class TestDatabase:
    def test_init_creates_structure(self):
        # Create a temp file
        fd, path = tempfile.mkstemp()
        os.close(fd)
        os.remove(path) # Start with no file
        
        # Patch the module-level DB_FILE variable
        original_db_file = db_module.DB_FILE
        db_module.DB_FILE = path
        
        try:
            db = Database()
            db.save()
            
            assert os.path.exists(path)
            assert "licenses" in db.data
            assert "usage" in db.data
        finally:
            # Restore original DB_FILE
            db_module.DB_FILE = original_db_file
            # Cleanup
            if os.path.exists(path):
                os.remove(path)

    def test_save_and_load(self):
        fd, path = tempfile.mkstemp()
        os.close(fd)
        
        # Write data
        db = Database()
        db.data["licenses"]["test_key"] = {"active": True}
        
        original_db_file = db_module.DB_FILE
        db_module.DB_FILE = path
        try:
            db.save()
            assert os.path.exists(path)

            # Load into a new instance to verify persistence
            db2 = Database()
            assert "licenses" in db2.data
            assert "test_key" in db2.data["licenses"]
            assert db2.data["licenses"]["test_key"]["active"] is True
        finally:
            db_module.DB_FILE = original_db_file
            if os.path.exists(path):
                os.remove(path)

    def test_get_license(self, mock_db):
        mock_db.data["licenses"]["test_key"] = {"active": True, "user_id": "test@example.com"}
        license_data = mock_db.get_license("test_key")
        assert license_data is not None
        assert license_data["active"] is True
        assert license_data["user_id"] == "test@example.com"
        
        assert mock_db.get_license("invalid_key") is None
