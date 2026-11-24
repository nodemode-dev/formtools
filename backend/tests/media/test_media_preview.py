import io
import struct

import pytest
from PIL import Image

from app.tools.media import preview

from .tools import audio, probe_doc, rig, stream, video


def png(width, height) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (200, 30, 30)).save(buffer, "PNG")
    return buffer.getvalue()


def pcm(*runs) -> bytes:
    return b"".join(struct.pack("<h", level) * count for level, count in runs)


def thumb(client, path, **params):
    return client.get("/api/media/thumb", params={"path": str(path), **params})


def test_a_video_thumbnail_comes_back_as_webp_scaled_to_fit_the_size_keeping_the_aspect(client, rig):
    rig.ffprobe(probe_doc([video()], duration="10"))
    rig.ffmpeg(payload=png(800, 400))
    answer = thumb(client, rig.file("a.mp4"), size=256)
    assert answer.status_code == 200
    assert answer.headers["content-type"] == "image/webp"
    assert answer.headers["cache-control"] == "private, max-age=300"
    image = Image.open(io.BytesIO(answer.content))
    assert image.format == "WEBP"
    assert image.size == (256, 128)


def test_the_thumbnail_frame_is_taken_a_tenth_of_the_way_in_and_scaled_by_the_filter(client, rig):
    rig.ffprobe(probe_doc([video()], duration="10"))
    rig.ffmpeg(payload=png(64, 64))
    thumb(client, rig.file("a.mp4"), size=200)
    args = rig.calls("ffmpeg")[0]
    assert args[args.index("-ss") + 1] == "1.000"
    assert "scale=w='min(200,iw)':h='min(200,ih)':force_original_aspect_ratio=decrease" in args
    assert args[args.index("-frames:v") + 1] == "1"
    assert args[-1] == "pipe:1"


@pytest.mark.parametrize("asked,used", [(10, 64), (9999, 512)])
def test_the_thumbnail_size_is_held_between_64_and_512(client, rig, asked, used):
    rig.ffprobe(probe_doc([video()], duration="10"))
    rig.ffmpeg(payload=png(64, 64))
    thumb(client, rig.file(f"a{asked}.mp4"), size=asked)
    assert f"min({used},iw)" in " ".join(rig.calls("ffmpeg")[0])


def test_the_same_thumbnail_is_served_from_the_cache_without_running_ffmpeg_again(client, rig):
    rig.ffprobe(probe_doc([video()], duration="10"))
    rig.ffmpeg(payload=png(300, 300))
    target = rig.file("a.mp4")
    first = thumb(client, target, size=128).content
    second = thumb(client, target, size=128).content
    assert first == second
    assert len(rig.calls("ffmpeg")) == 1


def test_an_audio_file_with_cover_art_gets_its_cover_as_the_thumbnail_without_seeking(client, rig):
    cover = video(1, "mjpeg", disposition={"attached_pic": 1})
    rig.ffprobe(probe_doc([audio(0, "mp3"), cover], names="mp3"))
    rig.ffmpeg(payload=png(100, 100))
    answer = thumb(client, rig.file("a.mp3"))
    assert Image.open(io.BytesIO(answer.content)).size == (100, 100)
    args = rig.calls("ffmpeg")[0]
    assert "-ss" not in args
    assert args[args.index("-map") + 1] == "0:1"


def test_an_audio_file_without_cover_art_has_no_thumbnail(client, rig):
    rig.ffprobe(probe_doc([audio(0, "mp3")], names="mp3"))
    rig.ffmpeg()
    answer = thumb(client, rig.file("a.mp3"))
    assert (answer.status_code, answer.json()["error"]) == (404, "that file has no picture to show")


def test_a_thumbnail_asked_with_no_ffmpeg_is_refused_with_the_install_hint(client, rig):
    rig.ffprobe(probe_doc([video()]))
    answer = thumb(client, rig.file("a.mp4"))
    assert (answer.status_code, answer.json()["error"]) == (503, "ffmpeg is not installed; put it on PATH or start formtools with FORM_FFMPEG_AUTO=1")


def test_a_thumbnail_ffmpeg_cannot_produce_is_refused_after_retrying_at_the_start(client, rig):
    rig.ffprobe(probe_doc([video()], duration="10"))
    rig.ffmpeg(payload=b"")
    answer = thumb(client, rig.file("a.mp4"))
    assert (answer.status_code, answer.json()["error"]) == (400, "ffmpeg could not make a picture from that file")
    first, second = rig.calls("ffmpeg")
    assert "-ss" in first and "-ss" not in second


def waveform(client, path, **params):
    return client.get("/api/media/waveform", params={"path": str(path), **params})


def test_the_waveform_peaks_follow_the_loudness_of_each_half_of_the_sound(client, rig):
    rig.ffprobe(probe_doc([audio(0, "mp3")], names="mp3", duration="2.0"))
    rig.ffmpeg(payload=pcm((16384, 8000), (8192, 8000)))
    body = waveform(client, rig.file("a.mp3"), points=100).json()
    assert body["duration"] == 2.0
    assert body["peaks"] == [0.5] * 50 + [0.25] * 50


def test_the_waveform_asks_ffmpeg_for_mono_8000_hz_signed_16_bit_samples(client, rig):
    rig.ffprobe(probe_doc([audio(0, "mp3")], names="mp3"))
    rig.ffmpeg(payload=pcm((1000, 400)))
    waveform(client, rig.file("a.mp3"))
    args = rig.calls("ffmpeg")[0]
    assert args[args.index("-map") + 1] == "0:a:0"
    assert args[args.index("-ac") + 1] == "1"
    assert args[args.index("-ar") + 1] == "8000"
    assert args[args.index("-f") + 1] == "s16le"


def test_a_short_sound_is_stretched_to_the_number_of_points_asked(client, rig):
    rig.ffprobe(probe_doc([audio(0, "mp3")], names="mp3"))
    rig.ffmpeg(payload=pcm((16384, 400)))
    peaks = waveform(client, rig.file("a.mp3"), points=120).json()["peaks"]
    assert len(peaks) == 120
    assert set(peaks) == {0.5}


def test_silence_gives_a_flat_zero_waveform(client, rig):
    rig.ffprobe(probe_doc([audio(0, "mp3")], names="mp3"))
    rig.ffmpeg(payload=pcm((0, 4000)))
    assert set(waveform(client, rig.file("a.mp3"), points=100).json()["peaks"]) == {0.0}


@pytest.mark.parametrize("asked,got", [(5, 100), (99999, 4000)])
def test_the_waveform_point_count_is_held_between_100_and_4000(client, rig, asked, got):
    rig.ffprobe(probe_doc([audio(0, "mp3")], names="mp3"))
    rig.ffmpeg(payload=pcm((100, 8000)))
    assert len(waveform(client, rig.file(f"w{asked}.mp3"), points=asked).json()["peaks"]) == got


def test_the_waveform_is_cached_per_file_and_point_count(client, rig):
    rig.ffprobe(probe_doc([audio(0, "mp3")], names="mp3"))
    rig.ffmpeg(payload=pcm((100, 800)))
    target = rig.file("a.mp3")
    waveform(client, target, points=100)
    waveform(client, target, points=100)
    assert len(rig.calls("ffmpeg")) == 1
    waveform(client, target, points=200)
    assert len(rig.calls("ffmpeg")) == 2


def test_the_waveform_of_a_silent_film_is_refused(client, rig):
    rig.ffprobe(probe_doc([video()]))
    rig.ffmpeg()
    answer = waveform(client, rig.file("a.mp4"))
    assert (answer.status_code, answer.json()["error"]) == (400, "that file has no audio")


def subtitles(client, path):
    return client.get("/api/media/subtitles", params={"path": str(path)})


def test_subtitles_lists_text_streams_and_matching_files_beside_the_video(client, rig):
    text = stream(2, "subtitle", "subrip", tags={"language": "fre", "title": "Francais"})
    picture = stream(3, "subtitle", "hdmv_pgs_subtitle")
    rig.ffprobe(probe_doc([video(), audio(), text, picture]))
    target = rig.file("clip.mp4")
    for name in ("clip.en.srt", "clip.fr.vtt", "clip.ass", "clipx.srt", "clip.txt", "other.srt"):
        rig.file(name, b"x")
    body = subtitles(client, target).json()
    assert body["embedded"] == [{"index": 2, "language": "fre", "title": "Francais", "codec": "subrip"}]
    assert body["external"] == [str(rig.work / name) for name in ("clip.ass", "clip.en.srt", "clip.fr.vtt")]


def subtitle(client, path, **params):
    return client.get("/api/media/subtitle", params={"path": str(path), **params})


def test_a_vtt_file_beside_the_video_is_handed_back_as_is_with_the_vtt_type(client, rig):
    target = rig.file("clip.mp4")
    rig.file("clip.en.vtt", "WEBVTT\n\n00:00.000 --> 00:01.000\nhello\n".encode())
    answer = subtitle(client, target, file="clip.en.vtt")
    assert answer.status_code == 200
    assert answer.headers["content-type"].startswith("text/vtt")
    assert answer.text == "WEBVTT\n\n00:00.000 --> 00:01.000\nhello\n"


@pytest.mark.parametrize("name", ["sub/clip.vtt", "clip.txt", "../clip.vtt"])
def test_a_subtitle_file_from_another_folder_or_of_another_kind_is_refused(client, rig, name):
    target = rig.file("clip.mp4")
    answer = subtitle(client, target, file=name)
    assert (answer.status_code, answer.json()["error"]) == (400, "the subtitle file must be a .srt, .ass, .ssa or .vtt file beside the video")


def test_an_absolute_subtitle_path_in_another_folder_is_refused(client, rig, tmp_path):
    target = rig.file("clip.mp4")
    elsewhere = tmp_path / "elsewhere.vtt"
    elsewhere.write_text("WEBVTT\n", encoding="utf-8")
    assert subtitle(client, target, file=str(elsewhere)).status_code == 400


def test_a_missing_subtitle_file_and_a_request_naming_neither_index_nor_file_are_refused(client, rig):
    target = rig.file("clip.mp4")
    missing = subtitle(client, target, file="none.vtt")
    assert (missing.status_code, missing.json()["error"]) == (404, "that subtitle file does not exist")
    neither = subtitle(client, target)
    assert (neither.status_code, neither.json()["error"]) == (400, "give index (an embedded subtitle stream) or file (a subtitle file beside the video)")


def test_an_srt_file_is_converted_to_webvtt_by_ffmpeg_reading_its_first_subtitle_stream(client, rig):
    rig.ffmpeg(payload=b"WEBVTT\n\nconverted\n")
    target = rig.file("clip.mp4")
    srt = rig.file("clip.srt", b"1\n00:00:00,000 --> 00:00:01,000\nhi\n")
    answer = subtitle(client, target, file="clip.srt")
    assert answer.text == "WEBVTT\n\nconverted\n"
    args = rig.calls("ffmpeg")[0]
    assert args[args.index("-i") + 1] == str(srt)
    assert args[args.index("-map") + 1] == "0:s:0"
    assert args[-3:] == ["-f", "webvtt", "pipe:1"]


def test_an_embedded_text_stream_is_converted_by_its_index_and_a_picture_stream_is_refused(client, rig):
    rig.ffprobe(probe_doc([video(), stream(2, "subtitle", "subrip"), stream(3, "subtitle", "hdmv_pgs_subtitle")]))
    rig.ffmpeg(payload=b"WEBVTT\n")
    target = rig.file("clip.mkv")
    assert subtitle(client, target, index=2).text == "WEBVTT\n"
    assert rig.calls("ffmpeg")[0][rig.calls("ffmpeg")[0].index("-map") + 1] == "0:2"
    refused = subtitle(client, target, index=3)
    assert (refused.status_code, refused.json()["error"]) == (400, "that stream is not a text subtitle stream")


def test_a_conversion_that_gives_nothing_is_refused(client, rig):
    rig.ffmpeg(payload=b"")
    target = rig.file("clip.mp4")
    rig.file("clip.srt", b"x")
    answer = subtitle(client, target, file="clip.srt")
    assert (answer.status_code, answer.json()["error"]) == (400, "ffmpeg could not convert those subtitles to WebVTT")


def snapshot(client, path, at):
    return client.post("/api/media/snapshot", json={"path": str(path), "time": at})


def test_the_stamp_is_hours_minutes_seconds_and_milliseconds_and_carries_a_rounded_up_second():
    assert preview.stamp(3725.5) == "01-02-05.500"
    assert preview.stamp(59.9996) == "00-01-00.000"
    assert preview.stamp(0) == "00-00-00.000"


def test_a_snapshot_is_saved_beside_the_video_named_with_the_time(client, rig):
    rig.ffprobe(probe_doc([video()], duration="10"))
    rig.ffmpeg(payload=png(32, 32))
    target = rig.file("a.mp4")
    body = snapshot(client, target, 5.25).json()
    expected = rig.work / "a 00-00-05.250.png"
    assert body == {"ok": True, "path": str(expected)}
    assert expected.read_bytes() == png(32, 32)
    args = rig.calls("ffmpeg")[0]
    assert args[args.index("-ss") + 1] == "5.250"
    assert args[args.index("-map") + 1] == "0:0"
    assert args[args.index("-frames:v") + 1] == "1"


def test_a_second_snapshot_at_the_same_time_gets_a_numbered_name_instead_of_overwriting(client, rig):
    rig.ffprobe(probe_doc([video()], duration="10"))
    rig.ffmpeg(payload=png(8, 8))
    target = rig.file("a.mp4")
    snapshot(client, target, 1)
    second = snapshot(client, target, 1).json()
    assert second["path"] == str(rig.work / "a 00-00-01.000 (2).png")
    assert (rig.work / "a 00-00-01.000.png").exists()


def test_a_snapshot_after_the_end_of_the_video_is_refused(client, rig):
    rig.ffprobe(probe_doc([video()], duration="10"))
    rig.ffmpeg()
    answer = snapshot(client, rig.file("a.mp4"), 10.5)
    assert (answer.status_code, answer.json()["error"]) == (400, "time is outside the video")
    assert not list(rig.work.glob("*.png"))


def test_a_negative_snapshot_time_is_refused_by_the_request_check(client, rig):
    rig.ffprobe(probe_doc([video()], duration="10"))
    answer = snapshot(client, rig.file("a.mp4"), -1)
    assert answer.status_code == 400
    assert answer.json()["ok"] is False
    assert not list(rig.work.glob("*.png"))


def test_a_snapshot_of_an_audio_file_is_refused(client, rig):
    rig.ffprobe(probe_doc([audio(0, "mp3")], names="mp3"))
    rig.ffmpeg()
    answer = snapshot(client, rig.file("a.mp3"), 0)
    assert (answer.status_code, answer.json()["error"]) == (400, "that file has no video to take a picture of")


def test_a_snapshot_ffmpeg_fails_on_leaves_no_picture_file_behind(client, rig):
    rig.ffprobe(probe_doc([video()], duration="10"))
    rig.ffmpeg(fail="boom")
    answer = snapshot(client, rig.file("a.mp4"), 2)
    assert (answer.status_code, answer.json()["error"]) == (400, "ffmpeg could not take a picture at that time")
    assert not list(rig.work.glob("*.png"))
