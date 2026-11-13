# Demo credits

Nothing in this demo is third-party media. Every file in the recording was made by formtools' own demo generator (`backend/app/tools/demos/bench.py`): the models are trimesh primitives, the sweep and the chord are synthesised with numpy, and the video is drawn frame by frame with Pillow and encoded by the family's ffmpeg build.

`assets/recording.js` holds the engine's answers for that folder, recorded by `scripts/demo-record.py`. The script, stylesheet and fonts the page loads are the shared ones in `demo/assets/`; their third-party contents are listed in `demo/CREDITS.md` and `NOTICE.md`.

The app opens the same demo from Home > Demos, Help > Demos and the `demo-bench` command, with the same generator, so this note covers it too.
