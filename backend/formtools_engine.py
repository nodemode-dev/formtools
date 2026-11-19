import copy
import logging
import os
import sys
import threading
import time
from pathlib import Path

if sys.stdin is None:
    sys.stdin = open(os.devnull, encoding="utf-8")
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w", encoding="utf-8")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w", encoding="utf-8")

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


def watch_shell(data) -> None:
    from app.core import runtime, startup

    shell = startup.shell_pid()
    if not shell and (getattr(sys, "frozen", False) or os.environ.get("FORMTOOLS_WATCH_PARENT") == "1"):
        shell = os.getppid()
    if shell <= 1:
        return

    def leave() -> None:
        logging.getLogger("formtools").info("the app that started this engine is gone (process %s), stopping", shell)
        runtime.release(data)
        os._exit(0)

    startup.watch(shell, leave)


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
    from app.core import config, runtime, startup, window_key

    try:
        data = config.data_dir()
        logs = runtime.start_logging(data).parent
    except OSError as err:
        print(f"formtools cannot use its data folder: {err}", file=sys.stderr)
        return 5
    startup.keep_errors(logs)
    log = logging.getLogger("formtools")
    if startup.alone():
        beside = startup.app_beside(Path(sys.executable))
        if beside is not None and startup.open_app(beside):
            log.info("started without its app, so it opened %s and stopped", beside)
            return 0
        log.error("started without its app, and no app program was found near %s", sys.executable)
        print("formtools-engine is a part of FormTools and serves nothing on its own. Open FormTools instead.", file=sys.stderr)
        return 4
    try:
        runtime.claim(data)
    except runtime.AlreadyRunning as err:
        log.error("%s", err)
        print(err, file=sys.stderr)
        return 2
    watch_shell(data)
    if window_key.stdout_mode():
        print(window_key.LINE + window_key.KEY, flush=True)
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
    try:
        return serve()
    except Exception:
        logging.getLogger("formtools").exception("the engine stopped on an error")
        raise


if __name__ == "__main__":
    import multiprocessing

    multiprocessing.freeze_support()
    sys.exit(main())
