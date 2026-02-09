import os
import pytest
from fastapi import Request
from fastapi.responses import Response
from starlette.requests import Request as StarletteRequest
import main

pytestmark = pytest.mark.unit


def _make_request():
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [],
    }
    return StarletteRequest(scope)


def test_security_headers_middleware_removes_server_header():
    middleware = main.SecurityHeadersMiddleware(main.app)

    async def call_next(_request: Request):
        response = Response("ok")
        response.headers["Server"] = "test"
        return response

    request = _make_request()
    import asyncio
    response = asyncio.run(middleware.dispatch(request, call_next))

    assert "Server" not in response.headers
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"


def test_get_adblock_lib_path_from_path_file(tmp_path, monkeypatch):
    lib_dir = tmp_path / "static" / "js"
    lib_dir.mkdir(parents=True)
    lib_file = lib_dir / "lib-123.js"
    lib_file.write_text("console.log('ok');")

    path_file = tmp_path / "adblock-lib-path.txt"
    path_file.write_text(str(lib_file))

    monkeypatch.chdir(tmp_path)
    result = main.get_adblock_lib_path()

    assert result.endswith("/static/js/lib-123.js")


def test_get_adblock_lib_path_from_glob(tmp_path, monkeypatch):
    lib_dir = tmp_path / "static" / "js"
    lib_dir.mkdir(parents=True)
    lib_file = lib_dir / "lib-abc.js"
    lib_file.write_text("console.log('ok');")

    monkeypatch.chdir(tmp_path)
    result = main.get_adblock_lib_path()

    assert result == "/static/js/lib-abc.js"


def test_get_adblock_lib_path_missing_file_falls_back(tmp_path, monkeypatch):
    path_file = tmp_path / "adblock-lib-path.txt"
    path_file.write_text(str(tmp_path / "static" / "js" / "missing.js"))

    lib_dir = tmp_path / "static" / "js"
    lib_dir.mkdir(parents=True)
    lib_file = lib_dir / "lib-fallback.js"
    lib_file.write_text("console.log('ok');")

    monkeypatch.chdir(tmp_path)
    result = main.get_adblock_lib_path()
    assert result == "/static/js/lib-fallback.js"


def test_get_adblock_lib_path_error(monkeypatch):
    def boom(_pattern):
        raise Exception("boom")

    monkeypatch.setattr(main.glob, "glob", boom)
    assert main.get_adblock_lib_path() is None


def test_adblock_library_returns_fallback(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    # Ensure no file found
    monkeypatch.setattr(main.glob, "glob", lambda _pattern: [])

    import asyncio
    response = asyncio.run(main.adblock_library())
    assert "Anti-adblock library not found" in response.body.decode()


def test_adblock_library_serves_file(monkeypatch, tmp_path):
    lib_dir = tmp_path / "static" / "js"
    lib_dir.mkdir(parents=True)
    lib_file = lib_dir / "lib-999.js"
    lib_file.write_text("console.log('ok');")

    path_file = tmp_path / "adblock-lib-path.txt"
    path_file.write_text(str(lib_file))

    monkeypatch.chdir(tmp_path)

    import asyncio
    response = asyncio.run(main.adblock_library())
    assert "console.log('ok')" in response.body.decode()


def test_adblock_library_serves_glob_file(monkeypatch, tmp_path):
    lib_dir = tmp_path / "static" / "js"
    lib_dir.mkdir(parents=True)
    lib_file = lib_dir / "lib-555.js"
    lib_file.write_text("console.log('glob');")

    path_file = tmp_path / "adblock-lib-path.txt"
    path_file.write_text(str(tmp_path / "static" / "js" / "missing.js"))

    monkeypatch.chdir(tmp_path)

    import asyncio
    response = asyncio.run(main.adblock_library())
    assert "console.log('glob')" in response.body.decode()


def test_adblock_library_handles_exception(monkeypatch):
    def bad_exists(_path):
        raise Exception("boom")

    monkeypatch.setattr(main.os.path, "exists", bad_exists)

    import asyncio
    response = asyncio.run(main.adblock_library())
    assert "Error loading anti-adblock library" in response.body.decode()
