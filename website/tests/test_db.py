
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

    def test_create_update_revoke_license(self, mock_db):
        mock_db.create_license("key1", "user@example.com", plan="pro")
        license_data = mock_db.get_license("key1")
        assert license_data["active"] is True
        assert license_data["user_id"] == "user@example.com"
        assert license_data["plan"] == "pro"

        mock_db.update_license("key1", {"active": False})
        assert mock_db.get_license("key1")["active"] is False

        mock_db.revoke_license("key1")
        assert mock_db.get_license("key1")["active"] is False
        # Update non-existent key should be a no-op
        mock_db.update_license("missing", {"active": False})

    def test_usage_methods(self, mock_db):
        usage = mock_db.get_usage("device-1")
        assert usage["count"] == 0

        mock_db.increment_usage("device-1")
        assert mock_db.get_usage("device-1")["count"] == 1

        mock_db.update_usage("device-1", {"license_key": "key1"})
        assert mock_db.get_usage("device-1")["license_key"] == "key1"

    def test_load_error_is_handled(self, monkeypatch, tmp_path):
        # Force load to raise an error
        monkeypatch.setattr(db_module, "DB_FILE", str(tmp_path / "missing.json"))

        def bad_open(*_args, **_kwargs):
            raise OSError("boom")

        monkeypatch.setattr(db_module.os.path, "exists", lambda _path: True)
        monkeypatch.setattr("builtins.open", bad_open)

        db = Database()
        assert "licenses" in db.data

    def test_save_error_is_handled(self, monkeypatch, tmp_path):
        monkeypatch.setattr(db_module, "DB_FILE", str(tmp_path / "data.json"))

        def bad_open(*_args, **_kwargs):
            raise OSError("boom")

        monkeypatch.setattr("builtins.open", bad_open)

        db = Database()
        db.save()
