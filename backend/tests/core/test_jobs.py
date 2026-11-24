import threading

from app.core import jobs
from app.core.errors import ApiError

from .support import wait_for


def test_job_started_runs_to_done_and_reports_its_result(client):
    def work(job):
        for name in ("a.png", "b.png", "c.png"):
            job.step(current=name)
        return {"written": 3}

    job = jobs.start("test-batch", "Three pictures", 3, work)
    reply = wait_for(client, job.id)
    assert (reply["state"], reply["done"], reply["total"], reply["current"], reply["result"]) == ("done", 3, 3, "c.png", {"written": 3})
    assert reply["kind"] == "test-batch" and reply["title"] == "Three pictures"
    assert reply["finished"] >= reply["started"]


def test_running_job_shows_as_running_and_is_listed_newest_first(client):
    gate = threading.Event()
    first = jobs.start("test", "first", 1, lambda job: gate.wait(2))
    second = jobs.start("test", "second", 1, lambda job: gate.wait(2))
    try:
        listed = [item["id"] for item in client.get("/api/jobs").json()["jobs"]]
        assert listed.index(second.id) < listed.index(first.id)
        assert client.get(f"/api/jobs/{first.id}").json()["state"] == "running"
    finally:
        gate.set()
    assert wait_for(client, second.id)["state"] == "done"


def test_cancel_route_stops_a_job_that_checks_for_cancel(client):
    started = threading.Event()

    def work(job):
        started.set()
        for _ in range(200):
            job.check()
            threading.Event().wait(0.01)
        return "finished anyway"

    job = jobs.start("test", "long", 200, work)
    started.wait(2)
    reply = client.post(f"/api/jobs/{job.id}/cancel")
    assert reply.status_code == 200 and reply.json()["id"] == job.id
    final = wait_for(client, job.id)
    assert (final["state"], final["result"]) == ("cancelled", None)


def test_job_that_returns_after_cancel_counts_as_cancelled(client):
    gate = threading.Event()
    job = jobs.start("test", "ignores cancel", 1, lambda j: gate.wait(2) and "value")
    client.post(f"/api/jobs/{job.id}/cancel")
    gate.set()
    assert wait_for(client, job.id)["state"] == "cancelled"


def test_job_raising_an_api_error_fails_with_its_sentence(client):
    def work(job):
        raise ApiError(400, "that picture cannot be read")

    final = wait_for(client, jobs.start("test", "bad", 1, work).id)
    assert final["state"] == "failed"
    assert final["errors"] == [{"path": "", "error": "that picture cannot be read"}]


def test_job_crashing_fails_and_names_the_exception(client, capsys):
    def work(job):
        raise ValueError("bad width")

    final = wait_for(client, jobs.start("test", "crash", 1, work).id)
    assert final["state"] == "failed"
    assert final["errors"] == [{"path": "", "error": "ValueError: bad width"}]


def test_job_keeps_per_file_errors_but_at_most_five_hundred(client):
    def work(job):
        for n in range(520):
            job.error(f"/p/{n}", "unreadable")
        return {"failed": 520}

    final = wait_for(client, jobs.start("test", "many errors", 0, work).id)
    assert final["state"] == "done"
    assert len(final["errors"]) == 500 and final["errors"][0] == {"path": "/p/0", "error": "unreadable"}


def test_step_can_set_progress_and_change_the_total(client):
    def work(job):
        job.step(done=5, total=10, current="half")
        job.step()
        return None

    final = wait_for(client, jobs.start("test", "steps", 2, work).id)
    assert (final["done"], final["total"], final["current"]) == (6, 10, "half")


def test_negative_total_is_counted_as_zero(client):
    assert wait_for(client, jobs.start("test", "neg", -4, lambda j: None).id)["total"] == 0


def test_unknown_job_is_answered_with_a_sentence(client):
    for reply in (client.get("/api/jobs/j999999"), client.post("/api/jobs/j999999/cancel")):
        assert (reply.status_code, reply.json()) == (404, {"ok": False, "error": "there is no job with that id"})


def test_only_the_newest_finished_jobs_are_kept(client, monkeypatch):
    monkeypatch.setattr(jobs, "KEEP", 3)
    made = []
    for n in range(6):
        made.append(jobs.start("test", f"keep {n}", 0, lambda j: None))
        wait_for(client, made[-1].id)
    listed = {item["id"] for item in client.get("/api/jobs").json()["jobs"]}
    assert made[-1].id in listed and made[0].id not in listed
    assert len(listed) <= 4
