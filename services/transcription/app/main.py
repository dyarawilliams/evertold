from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict

from app.settings import Settings


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    service: str


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings if settings is not None else Settings()
    app = FastAPI(title="EverTold Transcription", version="0.0.0")
    app.state.settings = resolved

    @app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(status="ok", service="transcription")

    return app


app = create_app()
