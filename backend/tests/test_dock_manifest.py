import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from conftest import REPO

DOCK = REPO / "frontend" / "src" / "dock"
ADAPTER = REPO / "frontend" / "src" / "dock-adapter.ts"


def copied_agents(tmp_path):
    copy = tmp_path / "repo"
    (copy / "frontend" / "src").mkdir(parents=True)
    shutil.copytree(DOCK, copy / "frontend" / "src" / "dock")
    shutil.copytree(REPO / "setup", copy / "setup", ignore=shutil.ignore_patterns("__pycache__"))
    spec = importlib.util.spec_from_file_location("copied_agents", copy / "setup" / "agents.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return copy, module


def test_the_shared_dock_files_match_their_manifest():
    kept = json.loads((DOCK / "MANIFEST.json").read_text(encoding="utf-8"))
    assert kept["module"] == "dock" and kept["version"] == "2.1.0"
    now = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in DOCK.iterdir() if p.is_file() and p.name != "MANIFEST.json"}
    assert kept["files"] == now


def test_the_check_names_a_shared_file_edited_in_place(tmp_path):
    copy, agents = copied_agents(tmp_path)
    assert agents.dock_problems() == []
    with open(copy / "frontend" / "src" / "dock" / "dock.ts", "a", encoding="utf-8") as f:
        f.write("\n")
    (copy / "frontend" / "src" / "dock" / "extra.ts").write_text("export {};\n", encoding="utf-8")
    assert agents.dock_problems() == [
        "frontend/src/dock/dock.ts does not match MANIFEST.json; the shared dock module is copied whole from FormVis, never edited here",
        "frontend/src/dock/extra.ts does not match MANIFEST.json; the shared dock module is copied whole from FormVis, never edited here",
    ]


def test_the_shared_dock_imports_nothing_from_the_app():
    found = set()
    for path in DOCK.glob("*.ts"):
        found |= set(re.findall(r"(?:from|import)\s*\(?\s*'([^']+)'", path.read_text(encoding="utf-8")))
    assert sorted(x for x in found if not x.startswith(("./", "@xterm/"))) == []


def test_the_manifest_declares_the_dock_the_adapter_offers():
    dock = json.loads((REPO / "agents" / "manifest.json").read_text(encoding="utf-8"))["dock"]
    tabs = re.search(r"builtin: \[([^\]]*)\]", ADAPTER.read_text(encoding="utf-8")).group(1)
    assert dock["positions"] == ["bottom", "right"]
    assert dock["tabs"] == re.findall(r"'(\w+)'", tabs)


@pytest.mark.skipif(shutil.which("node") is None, reason="needs node")
def test_the_old_dock_key_is_moved_once_into_the_new_one():
    text = ADAPTER.read_text(encoding="utf-8")
    assert "storage: { key: 'formtools.dock', legacy: jsonLegacy(['formtools.terminal'], true) }" in text
    script = (
        f"import({json.dumps((DOCK / 'state.ts').as_uri())}).then((m) => {{"
        "const s = new Map([['formtools.terminal', JSON.stringify({open: true, h: 300})], ['formtools.prefs', '{}']]);"
        "const st = {getItem: (k) => s.has(k) ? s.get(k) : null, setItem: (k, v) => s.set(k, v), removeItem: (k) => s.delete(k)};"
        "const old = m.jsonLegacy(['formtools.terminal'], true);"
        "const first = m.moveLegacy(st, 'formtools.dock', old, {h: 280, w: 440});"
        "const seen = m.readSeen(st, 'formtools.dock');"
        "st.setItem('formtools.terminal', JSON.stringify({open: false, h: 150}));"
        "const second = m.moveLegacy(st, 'formtools.dock', old, {h: 280, w: 440});"
        "const fresh = m.readSeen({getItem: () => null, setItem: () => undefined, removeItem: () => undefined}, 'formtools.dock');"
        "console.log(JSON.stringify({first, second, seen, fresh, store: Object.fromEntries(s)}));});"
    )
    run = subprocess.run(["node", "--experimental-strip-types", "--no-warnings", "-e", script], capture_output=True, text=True, timeout=30)
    if run.returncode != 0 and "strip-types" in run.stderr:
        pytest.skip("this node cannot read TypeScript")
    out = json.loads(run.stdout)
    assert out["first"] is True and out["second"] is False
    assert out["seen"] is True and out["fresh"] is False
    assert json.loads(out["store"]["formtools.dock"]) == {"open": True, "side": "bottom", "h": 300, "w": 440, "tab": "", "seen": True}
    assert out["store"]["formtools.prefs"] == "{}"
