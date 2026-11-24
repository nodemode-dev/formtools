import pytest

from .tools import audio, probe_doc, rig, stream, video, wait_job


def start(client, path, op, **more):
    return client.post("/api/media/copy", json={"path": str(path), "op": op, **more})


def run(client, path, op, **more):
    started = start(client, path, op, **more)
    assert started.status_code == 200, started.text
    return wait_job(client, started.json()["id"])


def mp4_with_audio(rig):
    rig.ffprobe(probe_doc([video(), audio()], duration="10"))
    rig.ffmpeg(payload=b"copied bytes")


def test_a_remux_of_an_mp4_makes_a_matroska_copy_beside_the_source_holding_what_ffmpeg_wrote(client, rig):
    mp4_with_audio(rig)
    source = rig.file("a.mp4", b"source")
    job = run(client, source, "remux")
    expected = rig.work / "a (remux).mkv"
    assert job["state"] == "done"
    assert job["result"] == {"path": str(expected), "size": len(b"copied bytes"), "keyframe_cut": False}
    assert expected.read_bytes() == b"copied bytes"
    assert source.read_bytes() == b"source"
    assert (job["done"], job["total"]) == (1000, 1000)


def test_a_remux_copies_every_stream_without_re_encoding_and_without_seeking(client, rig):
    mp4_with_audio(rig)
    run(client, rig.file("a.mp4"), "remux")
    args = rig.calls("ffmpeg")[0]
    assert args[args.index("-c") + 1] == "copy"
    maps = [args[i + 1] for i, word in enumerate(args) if word == "-map"]
    assert maps == ["0:0", "0:1"]
    assert "-ss" not in args and "-t" not in args and "-movflags" not in args
    assert args[-1] == str(rig.work / "a (remux).mkv")


def test_a_remux_of_a_matroska_file_defaults_to_mp4_with_the_faststart_flag(client, rig):
    mp4_with_audio(rig)
    job = run(client, rig.file("a.mkv"), "remux")
    assert job["result"]["path"] == str(rig.work / "a (remux).mp4")
    args = rig.calls("ffmpeg")[0]
    assert args[args.index("-movflags") + 1] == "+faststart"


def test_a_trim_keeps_the_source_container_and_seeks_before_the_input(client, rig):
    mp4_with_audio(rig)
    job = run(client, rig.file("a.mp4"), "trim", start=2, end=7)
    assert job["result"]["path"] == str(rig.work / "a (trim).mp4")
    assert job["result"]["keyframe_cut"] is True
    args = rig.calls("ffmpeg")[0]
    assert args.index("-ss") < args.index("-i")
    assert args[args.index("-ss") + 1] == "2.000"
    assert args[args.index("-t") + 1] == "5.000"
    assert args[args.index("-avoid_negative_ts") + 1] == "make_zero"


def test_a_trim_with_only_an_end_cuts_from_the_start_for_that_long(client, rig):
    mp4_with_audio(rig)
    run(client, rig.file("a.mp4"), "trim", end=3.5)
    args = rig.calls("ffmpeg")[0]
    assert "-ss" not in args
    assert args[args.index("-t") + 1] == "3.500"


def test_a_second_copy_gets_a_numbered_name_and_the_first_is_left_alone(client, rig):
    mp4_with_audio(rig)
    source = rig.file("a.mp4")
    run(client, source, "remux")
    second = run(client, source, "remux")
    assert second["result"]["path"] == str(rig.work / "a (remux) (2).mkv")
    assert (rig.work / "a (remux).mkv").read_bytes() == b"copied bytes"


@pytest.mark.parametrize(
    "codec,suffix",
    [("aac", "m4a"), ("mp3", "mp3"), ("flac", "flac"), ("opus", "opus"), ("vorbis", "ogg"), ("pcm_s16le", "mka")],
)
def test_extracting_audio_picks_the_container_that_matches_the_codec(client, rig, codec, suffix):
    rig.ffprobe(probe_doc([video(), audio(1, codec)]))
    rig.ffmpeg(payload=b"a")
    job = run(client, rig.file(f"c-{codec}.mp4"), "extract-audio")
    assert job["result"]["path"] == str(rig.work / f"c-{codec} (audio).{suffix}")
    maps = [a for a in rig.calls("ffmpeg")[0] if a.startswith("0:")]
    assert maps == ["0:1"]


def test_an_audio_only_container_keeps_just_the_first_audio_stream_while_matroska_audio_keeps_all(client, rig):
    rig.ffprobe(probe_doc([video(), audio(1, "aac"), audio(2, "aac")]))
    rig.ffmpeg(payload=b"a")
    run(client, rig.file("a.mp4"), "extract-audio", container="mp3")
    run(client, rig.file("a.mp4"), "extract-audio", container="mka")
    first, second = rig.calls("ffmpeg")
    assert [a for a in first if a.startswith("0:")] == ["0:1"]
    assert [a for a in second if a.startswith("0:")] == ["0:1", "0:2"]


def test_chosen_streams_are_used_in_the_order_given_without_repeats(client, rig):
    mp4_with_audio(rig)
    run(client, rig.file("a.mp4"), "remux", streams=[1, 0, 1])
    assert [a for a in rig.calls("ffmpeg")[0] if a.startswith("0:")] == ["0:1", "0:0"]


def test_a_matroska_remux_keeps_text_subtitles_and_attachments_but_an_mp4_one_drops_them(client, rig):
    streams = [video(), audio(), stream(2, "subtitle", "subrip"), stream(3, "attachment", "ttf")]
    rig.ffprobe(probe_doc(streams))
    rig.ffmpeg(payload=b"a")
    run(client, rig.file("a.mp4"), "remux", container="mkv")
    run(client, rig.file("b.mp4"), "remux", container="mp4")
    first, second = rig.calls("ffmpeg")
    assert [a for a in first if a.startswith("0:")] == ["0:0", "0:1", "0:2", "0:3"]
    assert [a for a in second if a.startswith("0:")] == ["0:0", "0:1"]


@pytest.mark.parametrize(
    "op,more,message",
    [
        ("extract-audio", {"container": "mp4"}, "container must be one of m4a, mka, mp3, flac, opus, ogg for extract-audio"),
        ("trim", {"start": 5, "end": 5}, "end must be after start"),
        ("trim", {"start": 5, "end": 2}, "end must be after start"),
        ("trim", {}, "trim needs a start or an end"),
        ("remux", {"streams": [9]}, "stream 9 does not exist in that file"),
    ],
)
def test_a_copy_request_that_makes_no_sense_is_refused_with_the_reason(client, rig, op, more, message):
    mp4_with_audio(rig)
    answer = start(client, rig.file("a.mp4"), op, **more)
    assert (answer.status_code, answer.json()["error"]) == (400, message)
    assert not list(rig.work.glob("*(*"))


def test_extracting_audio_from_a_silent_video_is_refused(client, rig):
    rig.ffprobe(probe_doc([video()]))
    rig.ffmpeg()
    answer = start(client, rig.file("a.mp4"), "extract-audio")
    assert (answer.status_code, answer.json()["error"]) == (400, "that file has no audio")


@pytest.mark.parametrize("more", [{"container": "avi"}, {"start": -1}, {"op": "burn"}])
def test_a_copy_request_with_a_value_outside_the_allowed_set_is_refused(client, rig, more):
    mp4_with_audio(rig)
    body = {"path": str(rig.file("a.mp4")), "op": "remux", **more}
    answer = client.post("/api/media/copy", json=body)
    assert answer.status_code == 400
    assert answer.json()["ok"] is False


def test_a_copy_that_ffmpeg_cannot_do_fails_the_job_with_its_message_and_leaves_no_file(client, rig):
    rig.ffprobe(probe_doc([video(), audio()]))
    rig.ffmpeg(fail="boom happened")
    job = run(client, rig.file("a.mp4"), "remux")
    assert job["state"] == "failed"
    assert job["errors"][0]["error"] == "ffmpeg could not copy the streams: boom happened"
    assert not (rig.work / "a (remux).mkv").exists()


def test_a_copy_with_no_ffmpeg_fails_the_job_with_the_install_hint(client, rig):
    rig.ffprobe(probe_doc([video(), audio()]))
    job = run(client, rig.file("a.mp4"), "remux")
    assert job["state"] == "failed"
    assert job["errors"][0]["error"] == "ffmpeg is not installed; put it on PATH or start formtools with FORM_FFMPEG_AUTO=1"


@pytest.mark.xfail(strict=True, reason="DEFECT: when ffmpeg is missing the failed copy job leaves an empty reserved file (for example 'a (remux).mkv') beside the source; every other failed copy removes its output, so a failed job should leave nothing behind")
def test_a_copy_with_no_ffmpeg_leaves_no_empty_output_file(client, rig):
    rig.ffprobe(probe_doc([video(), audio()]))
    job = run(client, rig.file("a.mp4"), "remux")
    assert job["state"] == "failed"
    assert not (rig.work / "a (remux).mkv").exists()


def test_copy_of_a_missing_file_is_refused_before_any_tool_is_needed(client, rig):
    answer = start(client, rig.work / "none.mp4", "remux")
    assert (answer.status_code, answer.json()["error"]) == (404, "that file does not exist")


def play(client, path, **params):
    return client.get("/api/media/stream", params={"path": str(path), **params})


def test_a_stream_of_h264_and_aac_is_copied_into_fragmented_mp4_and_served_without_caching_or_ranges(client, rig):
    rig.ffprobe(probe_doc([video(), audio()], names="matroska,webm"))
    rig.ffmpeg(payload=b"fragments" * 5000)
    answer = play(client, rig.file("a.mkv"))
    assert answer.status_code == 200
    assert answer.headers["content-type"] == "video/mp4"
    assert answer.headers["cache-control"] == "no-store"
    assert answer.headers["accept-ranges"] == "none"
    assert answer.content == b"fragments" * 5000


def test_the_stream_command_copies_only_playable_streams_with_fragmented_mp4_flags(client, rig):
    rig.ffprobe(probe_doc([video(), audio(1, "ac3"), audio(2, "aac"), stream(3, "subtitle", "subrip")]))
    rig.ffmpeg(payload=b"x")
    play(client, rig.file("a.mkv"))
    args = rig.calls("ffmpeg")[0]
    assert [a for a in args if a.startswith("0:")] == ["0:0", "0:2"]
    assert args[args.index("-c") + 1] == "copy"
    assert "-sn" in args and "-dn" in args
    assert args[args.index("-movflags") + 1] == "frag_keyframe+empty_moov+default_base_moof"
    assert args[-3:] == ["-f", "mp4", "pipe:1"]
    assert "-ss" not in args


def test_a_stream_started_at_a_time_seeks_before_the_input(client, rig):
    rig.ffprobe(probe_doc([video(), audio()]))
    rig.ffmpeg(payload=b"x")
    play(client, rig.file("a.mkv"), start=12.5)
    args = rig.calls("ffmpeg")[0]
    assert args.index("-ss") < args.index("-i")
    assert args[args.index("-ss") + 1] == "12.500"


def test_a_negative_stream_start_is_treated_as_the_beginning(client, rig):
    rig.ffprobe(probe_doc([video(), audio()]))
    rig.ffmpeg(payload=b"x")
    assert play(client, rig.file("a.mkv"), start=-4).status_code == 200
    assert "-ss" not in rig.calls("ffmpeg")[0]


def test_a_vp9_and_opus_file_is_streamed_as_webm(client, rig):
    rig.ffprobe(probe_doc([video(0, "vp9"), audio(1, "opus"), audio(2, "aac")], names="matroska,webm"))
    rig.ffmpeg(payload=b"w")
    answer = play(client, rig.file("a.mkv"))
    assert answer.headers["content-type"] == "video/webm"
    args = rig.calls("ffmpeg")[0]
    assert [a for a in args if a.startswith("0:")] == ["0:0", "0:1"]
    assert args[args.index("-f") + 1] == "webm"
    assert "-movflags" not in args


def test_an_audio_only_file_is_streamed_with_an_audio_type(client, rig):
    rig.ffprobe(probe_doc([audio(0, "mp3")], names="mp3"))
    rig.ffmpeg(payload=b"m")
    assert play(client, rig.file("a.mp3")).headers["content-type"] == "audio/mp4"


def test_a_file_whose_codecs_cannot_be_copied_into_a_playable_container_is_refused(client, rig):
    rig.ffprobe(probe_doc([video(0, "hevc"), audio()]))
    rig.ffmpeg()
    answer = play(client, rig.file("a.mkv"))
    assert (answer.status_code, answer.json()["error"]) == (415, "that file cannot be made playable by copying its streams")
    assert rig.calls("ffmpeg") == []


def test_streaming_with_no_ffmpeg_is_refused_with_the_install_hint(client, rig):
    rig.ffprobe(probe_doc([video(), audio()]))
    answer = play(client, rig.file("a.mkv"))
    assert (answer.status_code, answer.json()["error"]) == (503, "ffmpeg is not installed; put it on PATH or start formtools with FORM_FFMPEG_AUTO=1")


def test_a_stream_ffmpeg_produces_nothing_for_is_refused(client, rig):
    rig.ffprobe(probe_doc([video(), audio()]))
    rig.ffmpeg(payload=b"")
    answer = play(client, rig.file("a.mkv"))
    assert (answer.status_code, answer.json()["error"]) == (400, "ffmpeg could not copy the streams of that file")
