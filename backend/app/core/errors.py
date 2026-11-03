from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


def failure(status: int, message: str) -> JSONResponse:
    return JSONResponse({"ok": False, "error": message}, status_code=status)


def install(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error(_: Request, exc: ApiError) -> JSONResponse:
        return failure(exc.status, exc.message)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        text = exc.detail if isinstance(exc.detail, str) and exc.detail else "request failed"
        if exc.status_code == 404 and text == "Not Found":
            text = "nothing is served at that address"
        return failure(exc.status_code, text)

    @app.exception_handler(RequestValidationError)
    async def invalid(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        where = ".".join(str(part) for part in first.get("loc", ()) if part != "query" and part != "body")
        return failure(400, f"the request is missing or has a bad value for {where or 'a field'}")
