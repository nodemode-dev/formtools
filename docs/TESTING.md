# Testing formtools

formtools' tests run the app and check what a user or a calling program would notice. This page says how to run them, where they live and what a test must do to be accepted.

## Running the tests

```sh
./formtools test                     # every layer
./formtools test engine              # one layer: unit or engine
./formtools test engine -k rename    # the rest of the line goes to the runner
```

On Windows use `formtools.bat test`. Run `./formtools install` first. The engine tests need pytest and httpx in the backend venv, which the install does not add:

```sh
backend/venv/bin/python -m pip install pytest httpx
```

## The layers

| Layer | Tool | Where | What it runs against |
| --- | --- | --- | --- |
| unit | vitest, happy-dom | `frontend/tests/unit/` | exported interface functions and stores, no browser |
| engine | pytest | `backend/tests/` | the real FastAPI app in process, and the engine's public functions |

The tests are grouped by area, one folder for each: `backend/tests/<area>/` (a package with its own `__init__.py`) and `frontend/tests/unit/<area>/`. The test files directly in `backend/tests/` are the older ones and run in the same layer.

## What the shared base gives a test

`backend/tests/conftest.py` holds the fixtures every engine test can use, next to pytest's own `tmp_path`. A test that writes files writes them under `tmp_path`, never into the repository or the person's folders.

## The five rules

1. The test runs the app through a public surface: an HTTP route, a command through the command runner, an MCP tool, a worker request, an exported interface function, or the visible interface in a browser.
2. It checks a result a user or a calling program would notice: geometry, a number, a saved or exported file, a refusal, an undo, something on screen.
3. Its expected value comes from outside the code under test: mathematics, the rules of a file format checked by an independent reader, the manual and the format documents in `docs/`, an invariant (undo then redo, save then open, export then import), two independent paths that must agree, or a fixture that states its own content.
4. It can fail. Change the expected value once, see the test fail, and change it back.
5. Its name says the behaviour in plain words.

Not accepted:

- reading source files to check text, spelling, comments or formatting;
- checks that a file, function, class or route merely exists;
- a check of the status code alone, with nothing checked in the answer;
- snapshot files made by running the code and saving what came out;
- replacing the thing under test with a stand-in and testing the stand-in;
- a skip or an expected failure without a written reason.

## When a test shows the app is wrong

Do not bend the test. Keep it and mark it as a strict expected failure with a reason that starts with `DEFECT:` and says what the app does, what it should do and where that is stated. `git grep -n "DEFECT:" backend/tests frontend/tests` lists the known ones. When the app is fixed, the strict mark makes the test fail until the mark is removed, so a fix cannot go unnoticed.

## Changing behaviour

A change in behaviour updates its tests in the same pull request. New test data is made by hand or by formtools itself; no third-party picture, font or model is added for a test.

## CI

Every pull request runs one job, `test`, on Linux. It installs the engine and the frontend the way the other jobs do, then runs the two layers one step each, so the step that fails names the layer. The tests do not run on macOS or Windows in CI.
