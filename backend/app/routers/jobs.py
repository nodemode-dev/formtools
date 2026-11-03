from fastapi import APIRouter

from app.core import jobs

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("")
def list_jobs() -> dict:
    return {"jobs": jobs.listing()}


@router.get("/{job_id}")
def job_status(job_id: str) -> dict:
    return jobs.get(job_id).to_dict()


@router.post("/{job_id}/cancel")
def cancel_job(job_id: str) -> dict:
    return jobs.cancel(job_id).to_dict()
