"""Uniform error body: {"error": {"code", "message", "details"}}."""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

_CODES = {
    400: "bad_request",
    404: "not_found",
    409: "conflict",
    422: "validation_error",
    424: "dependency_failed",
    501: "not_implemented",
    502: "bad_gateway",
    503: "unavailable",
}


class ApiError(Exception):
    def __init__(self, status: int, message: str, details: dict[str, Any] | None = None):
        self.status, self.message, self.details = status, message, details or {}


def not_found(what: str, id_: str) -> ApiError:
    return ApiError(404, f"{what} '{id_}' does not exist")


def conflict(message: str, **details: Any) -> ApiError:
    return ApiError(409, message, details)


def _body(status: int, message: str, details: dict[str, Any]) -> JSONResponse:
    code = _CODES.get(status, "error")
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "details": details}},
    )


def install(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api(_: Request, e: ApiError):
        return _body(e.status, e.message, e.details)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, e: StarletteHTTPException):
        return _body(e.status_code, str(e.detail), {})

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, e: RequestValidationError):
        errors = [{"loc": list(err["loc"]), "msg": err["msg"]} for err in e.errors()]
        return _body(422, "Request validation failed", {"errors": errors})
