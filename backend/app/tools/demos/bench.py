import subprocess
import wave
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image, ImageDraw

from app.tools.demos import art
from app.tools.media import exe

RATE = 48000
README = """# 3D and media bench

Every file here was made by the formtools demo generator on this computer.

- bench-scene.glb: a box, a sphere and a cylinder in one scene, each with its own colour
- torus.obj, icosphere.stl, cone.ply and capsule.off: one primitive per format, to view and convert
- cube-100mm.stl: a cube 100 units on a side, for measuring
- sweep.wav: a six-second sweep from 20 Hz to 20 kHz
- chord.wav: a three-second stereo chord
- orbit.webm: a short video drawn frame by frame (only when ffmpeg is installed)
"""


def coloured(mesh: trimesh.Trimesh, rgba: tuple[int, int, int, int]) -> trimesh.Trimesh:
    mesh.visual.vertex_colors = np.tile(np.array(rgba, dtype=np.uint8), (len(mesh.vertices), 1))
    return mesh


def write_wav(path: Path, samples: np.ndarray, channels: int) -> None:
    data = (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(channels)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes(data.tobytes())


def sweep() -> np.ndarray:
    seconds = 6.0
    t = np.arange(int(RATE * seconds)) / RATE
    f0, f1 = 20.0, 20000.0
    k = np.log(f1 / f0) / seconds
    phase = 2 * np.pi * f0 * (np.exp(k * t) - 1) / k
    fade = np.minimum(1.0, np.minimum(t / 0.05, (seconds - t) / 0.05))
    return 0.5 * np.sin(phase) * fade


def chord() -> np.ndarray:
    seconds = 3.0
    t = np.arange(int(RATE * seconds)) / RATE
    envelope = np.exp(-t * 1.2) * np.minimum(1.0, t / 0.01)
    left = sum(np.sin(2 * np.pi * f * t) for f in (220.0, 277.18, 329.63)) / 3
    right = sum(np.sin(2 * np.pi * f * t) for f in (220.0, 329.63, 440.0)) / 3
    return (np.stack([left, right], axis=1) * envelope[:, None] * 0.6).reshape(-1)


def wire(draw: ImageDraw.ImageDraw, mesh: trimesh.Trimesh, angle: float, centre: tuple[float, float], scale: float, colour) -> None:
    turn = trimesh.transformations.rotation_matrix(angle, (0.3, 1.0, 0.2))
    points = trimesh.transform_points(mesh.vertices, turn)
    flat = points[:, :2] * scale * (1 + points[:, 2:3] * 0.15) + np.array(centre)
    for a, b in mesh.edges_unique[:: max(1, len(mesh.edges_unique) // 900)]:
        draw.line((tuple(flat[a]), tuple(flat[b])), fill=colour, width=1)


def write_video(path: Path) -> bool:
    ffmpeg = exe.find("ffmpeg")
    if not ffmpeg:
        return False
    width, height, frames = 640, 360, 72
    backdrop = art.landscape(5100, width, height, "night", (0.8, 0.2))
    torus = trimesh.creation.torus(1.0, 0.38, major_sections=36, minor_sections=14)
    args = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{width}x{height}", "-r", "24", "-i", "-",
            "-c:v", "libvpx", "-b:v", "900k", "-deadline", "realtime", "-cpu-used", "8", "-pix_fmt", "yuv420p", str(path)]
    try:
        proc = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=exe.NO_WINDOW)
        assert proc.stdin is not None
        for index in range(frames):
            frame = backdrop.copy()
            wire(ImageDraw.Draw(frame), torus, index / frames * 2 * np.pi, (width / 2, height / 2), 92, (255, 196, 140))
            proc.stdin.write(frame.tobytes())
        proc.stdin.close()
        ok = proc.wait(timeout=120) == 0
    except (OSError, subprocess.SubprocessError, AssertionError):
        ok = False
    if not ok or not path.is_file() or path.stat().st_size == 0:
        path.unlink(missing_ok=True)
        return False
    return True


def build(folder: Path) -> list[str]:
    notes: list[str] = []
    box = coloured(trimesh.creation.box((1.2, 1.2, 1.2)), (249, 115, 22, 255))
    sphere = coloured(trimesh.creation.icosphere(3, 0.75), (62, 123, 250, 255))
    sphere.apply_translation((2.0, 0, 0))
    cylinder = coloured(trimesh.creation.cylinder(0.5, 1.6, sections=48), (70, 167, 88, 255))
    cylinder.apply_translation((-2.0, 0, 0))
    scene = trimesh.Scene()
    for name, mesh in (("Box", box), ("Sphere", sphere), ("Cylinder", cylinder)):
        scene.add_geometry(mesh, node_name=name, geom_name=name)
    scene.export(str(folder / "bench-scene.glb"))
    trimesh.creation.torus(1.0, 0.35, major_sections=64, minor_sections=24).export(str(folder / "torus.obj"))
    trimesh.creation.icosphere(4, 1.0).export(str(folder / "icosphere.stl"))
    trimesh.creation.cone(0.8, 1.6, sections=64).export(str(folder / "cone.ply"))
    trimesh.creation.capsule(1.4, 0.5, count=(24, 24)).export(str(folder / "capsule.off"))
    trimesh.creation.box((100.0, 100.0, 100.0)).export(str(folder / "cube-100mm.stl"))
    write_wav(folder / "sweep.wav", sweep(), 1)
    write_wav(folder / "chord.wav", chord(), 2)
    (folder / "README.md").write_text(README, encoding="utf-8")
    if not write_video(folder / "orbit.webm"):
        notes.append("The bench has no video: ffmpeg is not installed. Install it or start formtools with FORM_FFMPEG_AUTO=1, then open this demo again.")
    return notes


def cover(width: int, height: int) -> Image.Image:
    sheet = art.landscape(5200, width, height, "night", (0.82, 0.18))
    draw = ImageDraw.Draw(sheet)
    wire(draw, trimesh.creation.torus(1.0, 0.38, major_sections=36, minor_sections=14), 0.7, (width * 0.32, height * 0.42), height * 0.2, (255, 196, 140))
    wire(draw, trimesh.creation.icosphere(2, 1.0), 0.4, (width * 0.74, height * 0.4), height * 0.16, (140, 190, 255))
    wave_y = height * 0.82
    t = np.linspace(0, 1, width)
    ys = wave_y + np.sin(2 * np.pi * (3 + 40 * t ** 2) * t) * height * 0.07 * (1 - t * 0.5)
    draw.line(list(zip(range(width), ys.tolist())), fill=(120, 230, 160), width=2)
    return sheet
