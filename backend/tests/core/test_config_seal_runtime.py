import hashlib
import hmac
import json
import logging
import os
from pathlib import Path

import pytest

from app.core import config, runtime, seal


@pytest.mark.parametrize("raw,port", [("", 8240), ("9123", 9123), ("0", 0), ("65535", 65535), ("65536", 8240), ("-1", 8240), ("abc", 8240), (" 7000 ", 7000)])
def test_engine_port_reads_the_environment_and_falls_back_to_8240(monkeypatch, raw, port):
    monkeypatch.setenv("FORMTOOLS_PORT", raw)
    assert config.engine_port() == port


def test_data_folder_follows_the_environment_and_is_created(monkeypatch, tmp_path):
    target = tmp_path / "a" / "b"
    monkeypatch.setenv("FORMTOOLS_DATA_DIR", str(target))
    assert config.data_dir() == target and target.is_dir()
    cache = config.cache_dir("thumbs", "256")
    assert cache == target / "cache" / "thumbs" / "256" and cache.is_dir()


@pytest.mark.skipif(not __import__("sys").platform.startswith("linux"), reason="the XDG rule applies on Linux only")
def test_linux_data_folder_uses_an_absolute_xdg_folder_and_ignores_a_relative_one(monkeypatch, tmp_path):
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path / "xdg"))
    assert config.platform_data_dir() == tmp_path / "xdg" / "formtools"
    monkeypatch.setenv("XDG_DATA_HOME", "relative/xdg")
    assert config.platform_data_dir() == Path.home() / ".local" / "share" / "formtools"


def test_built_window_folder_is_found_only_when_it_holds_index_html(monkeypatch, tmp_path):
    monkeypatch.setenv("FORMTOOLS_DIST", str(tmp_path))
    assert config.dist_dir() is None
    (tmp_path / "index.html").write_text("<html></html>", encoding="utf-8")
    assert config.dist_dir() == tmp_path


@pytest.fixture
def sealed(monkeypatch):
    key = bytes(range(32))
    monkeypatch.setattr(seal, "_CACHE", {"tried": True, "available": True, "key": key})
    return key


def test_sealed_settings_carry_an_hmac_sha256_of_the_sealed_fields(sealed):
    signed = seal.sign({"agentAccess": "allowed", "theme": "dark"})
    expected = hmac.new(sealed, b'{"agentAccess":"allowed"}', hashlib.sha256).hexdigest()
    assert signed == {"agentAccess": "allowed", "theme": "dark", "seal": expected}


def test_signed_settings_read_back_as_sealed_ok(sealed):
    view = seal.effective(seal.sign({"agentAccess": "allowed", "theme": "dark"}))
    assert view == {"agentAccess": "allowed", "theme": "dark", "seal": "ok", "sealBroken": False}


def test_hand_loosened_agent_access_is_put_back_to_ask_and_marked_broken(sealed):
    stored = seal.sign({"agentAccess": "blocked"})
    stored["agentAccess"] = "allowed"
    view = seal.effective(stored)
    assert (view["agentAccess"], view["seal"], view["sealBroken"]) == ("ask", "broken", True)


def test_unsigned_settings_that_do_not_loosen_access_are_left_alone(sealed):
    assert seal.effective({"agentAccess": "blocked"}) == {"agentAccess": "blocked", "seal": "unsealed", "sealBroken": False}


def test_without_a_keychain_settings_are_read_as_unavailable_and_signed_without_a_seal(monkeypatch):
    monkeypatch.setattr(seal, "_CACHE", {"tried": True, "available": False, "key": None})
    assert seal.effective({"agentAccess": "allowed", "seal": "x"}) == {"agentAccess": "allowed", "seal": "unavailable", "sealBroken": False}
    assert seal.sign({"agentAccess": "allowed", "seal": "old"}) == {"agentAccess": "allowed"}


def test_engine_log_is_written_in_the_logs_folder_and_names_the_process(tmp_path):
    try:
        path = runtime.start_logging(tmp_path)
        logging.getLogger("formtools").info("a line from the test")
        for handler in logging.getLogger("formtools").handlers:
            handler.flush()
        text = path.read_text(encoding="utf-8")
    finally:
        runtime.stop_logging()
    assert path == tmp_path / "Logs" / "formtools-engine.log"
    assert f"engine started, pid {os.getpid()}" in text and "a line from the test" in text
    assert not any(h.get_name() == "formtools-file" for h in logging.getLogger("uvicorn").handlers)


def test_port_file_records_this_process_and_release_removes_only_its_own_files(tmp_path):
    runtime.write_port(tmp_path, 51234)
    assert json.loads((tmp_path / "engine.port").read_text()) == {"pid": os.getpid(), "port": 51234}
    (tmp_path / "engine.lock").write_text(json.dumps({"pid": os.getpid() + 100000}), encoding="utf-8")
    runtime.release(tmp_path)
    assert not (tmp_path / "engine.port").exists()
    assert (tmp_path / "engine.lock").exists()
