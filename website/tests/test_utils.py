import pytest
import os
import sys

# Add parent dir to path to import main
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import get_adblock_lib_path

pytestmark = pytest.mark.unit


def test_get_adblock_lib_path_returns_static_path():
    path = get_adblock_lib_path()
    assert path is None or path.startswith("/static/")


def test_get_adblock_lib_path_returns_none_when_no_match(monkeypatch):
    def fake_glob(_pattern):
        return []

    monkeypatch.setattr("glob.glob", fake_glob)
    path = get_adblock_lib_path()
    assert path is None
