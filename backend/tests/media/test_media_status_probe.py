import os

from app.tools.media import fetch

from .tools import audio, probe_doc, rig, stream, video, script, FFMPEG


def info(client, path):
    return client.get("/api/media/info", params={"path": str(path)})


def test_status_with_no_ffmpeg_anywhere_reports_nothing_found_and_no_error(client, rig):
    assert client.get("/api/media/status").json() == {"ffmpeg": None, "ffprobe": None, "version": None, "fetching": False, "error": None}


def test_status_finds_ffmpeg_and_ffprobe_on_path_and_reads_the_version_word(client, rig, monkeypatch):
    rig.ffmpeg()
    rig.ffprobe(probe_doc([video()]))
    monkeypatch.setenv("FAKE_VERSION", "6.1.1")
    body = client.get("/api/media/status").json()
    assert body["ffmpeg"] == str(rig.bin / "ffmpeg")
    assert body["ffprobe"] == str(rig.bin / "ffprobe")
    assert body["version"] == "6.1.1"


def test_status_prefers_the_fetched_copy_and_puts_its_folder_first_on_path(client, rig):
    where = fetch.folder()
    where.mkdir(parents=True)
    script(where, f"ffmpeg-{fetch.host_triple()}", FFMPEG)
    rig.ffmpeg()
    body = client.get("/api/media/status").json()
    assert body["ffmpeg"] == str(where / "ffmpeg")
    assert os.environ["PATH"].split(os.pathsep)[0] == str(where)
    assert (where / "ffmpeg").exists()


def test_status_says_when_a_download_is_running_and_what_error_the_last_one_left(client, rig, monkeypatch):
    monkeypatch.setitem(fetch.STATE, "fetching", True)
    monkeypatch.setitem(fetch.STATE, "error", "ffmpeg could not be fetched: no network")
    body = client.get("/api/media/status").json()
    assert body["fetching"] is True
    assert body["error"] == "ffmpeg could not be fetched: no network"


def test_info_without_ffprobe_is_refused_with_the_install_hint(client, rig):
    target = rig.file("a.mp4")
    answer = info(client, target)
    assert answer.status_code == 503
    assert answer.json()["error"] == "ffmpeg is not installed; put it on PATH or start formtools with FORM_FFMPEG_AUTO=1"


def test_info_while_ffmpeg_is_downloading_asks_to_try_again(client, rig, monkeypatch):
    monkeypatch.setitem(fetch.STATE, "fetching", True)
    answer = info(client, rig.file("a.mp4"))
    assert (answer.status_code, answer.json()["error"]) == (503, "ffmpeg is still being downloaded, try again in a minute")


def test_info_after_a_failed_download_repeats_the_download_error(client, rig, monkeypatch):
    monkeypatch.setitem(fetch.STATE, "error", "ffmpeg 1 could not be fetched: offline")
    answer = info(client, rig.file("a.mp4"))
    assert (answer.status_code, answer.json()["error"]) == (503, "ffmpeg 1 could not be fetched: offline")


def test_info_names_a_missing_file_a_folder_and_a_relative_path_before_looking_for_tools(client, rig):
    assert (info(client, rig.work / "none.mp4").status_code, info(client, rig.work / "none.mp4").json()["error"]) == (404, "that file does not exist")
    folder = info(client, rig.work)
    assert (folder.status_code, folder.json()["error"]) == (400, "that path is not a file")
    relative = client.get("/api/media/info", params={"path": "clip.mp4"})
    assert (relative.status_code, relative.json()["error"]) == (400, "the path must be absolute")


def test_info_runs_ffprobe_with_json_output_streams_format_chapters_and_the_path(client, rig):
    rig.ffprobe(probe_doc([video(), audio()]))
    target = rig.file("a.mp4")
    assert info(client, target).status_code == 200
    assert rig.calls("ffprobe") == [["-v", "error", "-print_format", "json", "-show_format", "-show_streams", "-show_chapters", "-i", str(target)]]


def test_info_describes_a_video_stream_with_fraction_frame_rate_and_ten_bit_depth(client, rig):
    rig.ffprobe(probe_doc([video(avg_frame_rate="30000/1001", pix_fmt="yuv420p10le", profile="Main 10")]))
    body = info(client, rig.file("a.mp4")).json()
    first = body["streams"][0]
    assert (first["type"], first["codec"], first["width"], first["height"]) == ("video", "h264", 1920, 1080)
    assert first["fps"] == 29.97
    assert first["bit_depth"] == 10
    assert first["profile"] == "Main 10"


def test_info_reads_eight_bit_depth_from_a_plain_pixel_format(client, rig):
    rig.ffprobe(probe_doc([video(pix_fmt="yuv420p")]))
    assert info(client, rig.file("a.mp4")).json()["streams"][0]["bit_depth"] == 8


def test_info_reports_hdr_only_for_pq_or_hlg_transfer(client, rig):
    hdr = video(color_transfer="smpte2084", color_primaries="bt2020", color_space="bt2020nc")
    plain = video(1, color_transfer="bt709")
    rig.ffprobe(probe_doc([hdr, plain]))
    streams = info(client, rig.file("a.mp4")).json()["streams"]
    assert streams[0]["hdr"] == {"transfer": "smpte2084", "primaries": "bt2020", "matrix": "bt2020nc"}
    assert streams[1]["hdr"] is None


def test_info_describes_audio_streams_with_rate_language_and_flags(client, rig):
    track = audio(1, tags={"LANGUAGE": "eng", "title": "Main"}, disposition={"default": 1, "forced": 0}, bit_rate="128000")
    rig.ffprobe(probe_doc([video(), track]))
    second = info(client, rig.file("a.mp4")).json()["streams"][1]
    assert (second["type"], second["channels"], second["layout"], second["sample_rate"], second["bit_rate"]) == ("audio", 2, "stereo", 48000, 128000)
    assert (second["language"], second["title"], second["default"], second["forced"]) == ("eng", "Main", True, False)
    assert second["width"] is None and second["fps"] is None


def test_info_marks_attached_pictures_as_cover_and_gives_them_no_frame_rate(client, rig):
    cover = video(1, "mjpeg", disposition={"attached_pic": 1}, avg_frame_rate="90000/1")
    rig.ffprobe(probe_doc([audio(0, "mp3"), cover], names="mp3"))
    second = info(client, rig.file("a.mp3")).json()["streams"][1]
    assert second["cover"] is True
    assert second["fps"] is None


def test_info_maps_chapters_and_format_numbers(client, rig):
    chapters = [{"start_time": "0.000000", "end_time": "4.500000", "tags": {"title": "Intro"}}, {"start_time": "4.5", "end_time": "10", "tags": {}}]
    rig.ffprobe(probe_doc([video()], duration="10.5", chapters=chapters, tags={"title": "Clip"}))
    body = info(client, rig.file("a.mp4")).json()
    assert body["chapters"] == [{"start": 0.0, "end": 4.5, "title": "Intro"}, {"start": 4.5, "end": 10.0, "title": None}]
    assert body["format"]["duration"] == 10.5
    assert body["format"]["tags"] == {"title": "Clip"}
    assert (body["format"]["bit_rate"], body["format"]["size"]) == (1000, 5)


def test_info_calls_h264_and_aac_in_an_mp4_file_playable_as_is(client, rig):
    rig.ffprobe(probe_doc([video(), audio()]))
    assert info(client, rig.file("a.mp4")).json()["playable"] == {"native": True, "remux": True}


def test_info_calls_h264_in_matroska_playable_only_after_a_stream_copy(client, rig):
    rig.ffprobe(probe_doc([video(), audio()], names="matroska,webm"))
    assert info(client, rig.file("a.mkv")).json()["playable"] == {"native": False, "remux": True}


def test_info_calls_vp9_and_opus_in_webm_playable_as_is(client, rig):
    rig.ffprobe(probe_doc([video(0, "vp9"), audio(1, "opus")], names="matroska,webm"))
    assert info(client, rig.file("a.webm")).json()["playable"] == {"native": True, "remux": True}


def test_info_calls_hevc_unplayable_even_by_copying(client, rig):
    rig.ffprobe(probe_doc([video(0, "hevc"), audio()]))
    assert info(client, rig.file("a.mp4")).json()["playable"] == {"native": False, "remux": False}


def test_info_calls_an_mp3_file_playable_and_a_flac_file_native_but_not_copyable_to_mp4_or_webm(client, rig):
    rig.ffprobe(probe_doc([audio(0, "mp3")], names="mp3"))
    assert info(client, rig.file("a.mp3")).json()["playable"] == {"native": True, "remux": True}
    rig.ffprobe(probe_doc([audio(0, "flac")], names="flac"))
    assert info(client, rig.file("b.flac")).json()["playable"] == {"native": True, "remux": False}


def test_info_refuses_a_file_ffprobe_cannot_read(client, rig, monkeypatch):
    rig.ffprobe(probe_doc([video()]))
    monkeypatch.setenv("FAKE_PROBE_CODE", "1")
    answer = info(client, rig.file("junk.mp4"))
    assert (answer.status_code, answer.json()["error"]) == (415, "that file is not a media file ffmpeg can read")


def test_info_refuses_a_file_with_no_streams(client, rig):
    rig.ffprobe(probe_doc([]))
    answer = info(client, rig.file("empty.mp4"))
    assert (answer.status_code, answer.json()["error"]) == (415, "that file has no audio or video streams")


def test_info_asks_ffprobe_once_per_unchanged_file_and_again_after_the_file_changes(client, rig):
    rig.ffprobe(probe_doc([video()]))
    target = rig.file("a.mp4", b"one")
    info(client, target)
    info(client, target)
    assert len(rig.calls("ffprobe")) == 1
    target.write_bytes(b"longer content")
    info(client, target)
    assert len(rig.calls("ffprobe")) == 2
