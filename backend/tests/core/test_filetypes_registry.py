import mimetypes
import pkgutil

import pytest

from app.core import filetypes, registry


@pytest.mark.parametrize(
    "name,ext",
    [("photo.JPG", "jpg"), ("/a/b.c/archive.tar.gz", "gz"), (".bashrc", ""), ("README", ""), ("C:\\x\\y.Tiff", "tiff"), ("dir.d/file", ""), ("trailing.", "")],
)
def test_extension_is_the_lower_case_text_after_the_last_dot_of_the_file_name(name, ext):
    assert filetypes.ext_of(name) == ext


@pytest.mark.parametrize(
    "ext,family",
    [("cr3", "image"), ("nef", "image"), ("heic", "image"), ("mov", "video"), ("flac", "audio"), ("usdz", "model"), ("stl", "model"), ("pdf", "pdf"), ("woff2", "font"), ("7z", "archive"), ("tsx", "text"), ("fvd", "family"), ("xyz123", "other"), ("", "other")],
)
def test_each_extension_falls_in_its_media_family(ext, family):
    assert filetypes.classify(ext) == family


def test_raw_camera_formats_are_images():
    assert all(filetypes.classify(ext) == "image" for ext in filetypes.RAW)


@pytest.mark.parametrize("name,media", [("a.jpg", "image/jpeg"), ("a.gif", "image/gif"), ("a.zip", "application/zip"), ("a.html", "text/html")])
def test_common_formats_get_the_standard_media_type(name, media):
    assert filetypes.content_type(name) == media == mimetypes.guess_type(name)[0]


def test_text_formats_unknown_to_the_system_are_served_as_utf8_text(monkeypatch):
    monkeypatch.setattr(mimetypes, "guess_type", lambda name, strict=True: (None, None))
    assert filetypes.content_type("Cargo.lock") == "text/plain; charset=utf-8"
    assert filetypes.content_type("blob.qqq") == "application/octet-stream"


def test_every_tool_module_loads_and_registers_one_tool(client):
    from app import tools as package

    modules = sorted(info.name for info in pkgutil.iter_modules(package.__path__) if not info.name.startswith("_"))
    assert registry.failed() == {}
    assert len(registry.tools()) == len(modules)


def test_capabilities_list_every_registered_tool_once(client):
    listed = client.get("/api/capabilities").json()["tools"]
    assert sorted(listed) == sorted(tool.id for tool in registry.tools())
    assert len(listed) == len(set(listed))


def test_every_tool_with_routes_answers_a_plain_get_on_one_of_them(client):
    assert registry.tools()
    quiet = []
    for tool in registry.tools():
        plain = [r.path for router in tool.routers for r in router.routes if "GET" in r.methods and "{" not in r.path and not any(p.field_info.is_required() for p in r.dependant.query_params)]
        if not plain:
            continue
        answered = [client.get(path) for path in plain[:3]]
        if not any(reply.status_code == 200 for reply in answered):
            quiet.append(tool.id)
    assert quiet == []


def test_tool_effects_are_limited_to_reads_adds_alters():
    with pytest.raises(ValueError, match="must declare its effect as one of reads, adds, alters"):
        registry.McpTool("x", "x", {}, lambda a: None, effect="deletes")


def test_registering_the_same_tool_id_twice_is_refused(client):
    existing = registry.tools()[0]
    with pytest.raises(ValueError, match=f"tool {existing.id} is already registered"):
        registry.register(registry.Tool(id=existing.id, title="again"))


def test_command_lookup_finds_a_listed_command_and_none_for_unknown(client):
    listed = registry.commands()
    if listed:
        assert registry.command(listed[0].id) is listed[0]
    assert registry.command("no-such-command-anywhere") is None
