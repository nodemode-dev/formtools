import uuid

import pytest


@pytest.fixture
def preset(client):
    name = f"lane-{uuid.uuid4().hex[:8]}"
    yield name
    client.delete(f"/api/batch/presets/{name}")


def find(client, name):
    return [p for p in client.get("/api/batch/presets").json()["presets"] if p["name"] == name]


def test_a_saved_preset_reads_back_with_its_actions_and_output(client, preset):
    body = {"actions": [{"id": "border", "params": {"size": 7, "color": "#ff0000"}}, {"id": "grayscale"}], "output": {"format": "webp", "quality": 55, "naming": "{name}_{n:3}"}}
    assert client.put(f"/api/batch/presets/{preset}", json=body).json() == {"ok": True, "name": preset}
    found = find(client, preset)
    assert len(found) == 1
    assert [a["id"] for a in found[0]["actions"]] == ["border", "grayscale"]
    assert found[0]["actions"][0]["params"]["size"] == 7
    assert found[0]["actions"][0]["params"]["color"] == "#ff0000"
    assert found[0]["output"]["format"] == "webp"
    assert found[0]["output"]["quality"] == 55
    assert found[0]["output"]["naming"] == "{name}_{n:3}"


def test_saving_again_under_the_same_name_replaces_the_preset(client, preset):
    client.put(f"/api/batch/presets/{preset}", json={"actions": [{"id": "sepia"}]})
    client.put(f"/api/batch/presets/{preset}", json={"actions": [{"id": "invert"}]})
    found = find(client, preset)
    assert len(found) == 1 and [a["id"] for a in found[0]["actions"]] == ["invert"]


def test_a_deleted_preset_is_gone_and_cannot_be_deleted_twice(client, preset):
    client.put(f"/api/batch/presets/{preset}", json={})
    assert client.delete(f"/api/batch/presets/{preset}").json() == {"ok": True}
    assert find(client, preset) == []
    again = client.delete(f"/api/batch/presets/{preset}")
    assert again.status_code == 404
    assert again.json()["error"] == "there is no preset with that name"


def test_a_preset_name_with_other_characters_is_refused(client):
    reply = client.put("/api/batch/presets/bad.name", json={})
    assert reply.status_code == 400
    assert reply.json()["error"] == "a preset name is 1 to 64 letters, digits, spaces, dashes or underscores"
    assert find(client, "bad.name") == []


def test_a_preset_with_an_unknown_action_is_refused_and_not_saved(client, preset):
    reply = client.put(f"/api/batch/presets/{preset}", json={"actions": [{"id": "explode"}]})
    assert reply.status_code == 400
    assert reply.json()["error"] == "unknown action explode"
    assert find(client, preset) == []


def test_a_preset_with_an_output_format_that_cannot_be_written_is_refused(client, preset):
    reply = client.put(f"/api/batch/presets/{preset}", json={"output": {"format": "psd"}})
    assert reply.status_code == 400
    assert reply.json()["error"] == "the output format is not one formtools can write"
    assert find(client, preset) == []


def test_a_preset_quality_outside_1_to_100_is_brought_into_range(client, preset):
    client.put(f"/api/batch/presets/{preset}", json={"output": {"quality": 500}})
    assert find(client, preset)[0]["output"]["quality"] == 100
