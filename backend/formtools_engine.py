import copy
import os
import sys
import threading
import time

REQUIRED = ("fastapi", "uvicorn", "PIL", "numpy", "psd_tools", "OpenEXR")
OPTIONAL = ("rawpy",)


def selfcheck() -> int:
    missing = []
    for name in REQUIRED:
        try:
            __import__(name)
        except Exception as exc:
            missing.append(f"{name}: {exc}")
    for name in OPTIONAL:
        try:
            __import__(name)
        except Exception as exc:
            print(f"optional library unavailable, {name}: {exc}", file=sys.stderr)
    try:
        from app.core import config, registry

        import app.main

        if registry.failed():
            missing.extend(f"tool {name}: {reason}" for name, reason in registry.failed().items())
        if not registry.tools():
            missing.append("no tool registered")
        if getattr(sys, "frozen", False) and config.dist_dir() is None:
            missing.append("the bundled ui folder is missing")
    except Exception as exc:
        missing.append(f"app: {exc!r}")
    if missing:
        for line in missing:
            print(line, file=sys.stderr)
        return 1
    print("ok")
    return 0


def watch_parent() -> None:
    if os.name != "posix":
        return
    if not (getattr(sys, "frozen", False) or os.environ.get("FORMTOOLS_WATCH_PARENT") == "1"):
        return
    parent = os.getppid()
    if parent <= 1:
        return

    def run() -> None:
        while os.getppid() == parent:
            time.sleep(2)
        os._exit(0)

    threading.Thread(target=run, name="formtools-parent-watch", daemon=True).start()


def log_config() -> dict:
    from uvicorn.config import LOGGING_CONFIG

    config = copy.deepcopy(LOGGING_CONFIG)
    for handler in config["handlers"].values():
        handler["stream"] = "ext://sys.stdout"
    for formatter in config["formatters"].values():
        formatter["use_colors"] = False
    return config


def announce_port(server, data) -> None:
    from app.core import runtime

    def run() -> None:
        for _ in range(600):
            if server.started and server.servers:
                break
            time.sleep(0.1)
        else:
            return
        try:
            runtime.write_port(data, server.servers[0].sockets[0].getsockname()[1])
        except (OSError, IndexError):
            return

    threading.Thread(target=run, name="formtools-port-file", daemon=True).start()


def serve() -> int:
    from app.core import config, runtime

    data = config.data_dir()
    try:
        runtime.claim(data)
    except runtime.AlreadyRunning as err:
        print(err, file=sys.stderr)
        return 2
    watch_parent()
    import signal

    import uvicorn

    from app.main import app

    def leave(_signum, _frame) -> None:
        runtime.release(data)
        os._exit(0)

    signal.signal(signal.SIGTERM, leave)

    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=config.engine_port(), log_level="info", log_config=log_config()))
    announce_port(server, data)
    try:
        server.run()
    finally:
        runtime.release(data)
    return 0 if server.started else 3


def main() -> int:
    args = sys.argv[1:]
    if "--version" in args:
        from app import __version__

        print(f"formtools {__version__}")
        return 0
    if "--thumbnail" in args:
        from app.tools.desktop import thumbnail

        return thumbnail.main(args[args.index("--thumbnail") + 1:])
    if "--selfcheck" in args:
        return selfcheck()
    return serve()


if __name__ == "__main__":
    import multiprocessing

    multiprocessing.freeze_support()
    sys.exit(main())
