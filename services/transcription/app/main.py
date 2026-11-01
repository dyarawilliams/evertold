import logging
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from app.settings import Settings

logger = logging.getLogger(__name__)

MAX_AUDIO_BYTES = 40 * 1024 * 1024

AUDIO_SUFFIXES = {
    "audio/webm": ".webm",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/wave": ".wav",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/mp4": ".m4a",
    "audio/m4a": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/ogg": ".ogg",
    "audio/aac": ".aac",
}


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    service: str


class Segment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: float
    end: float
    text: str


class TranscriptResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: str
    model: str
    text: str
    language: str | None
    segments: list[Segment]


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings if settings is not None else Settings()
    app = FastAPI(title="EverTold Transcription", version="0.0.0")
    app.state.settings = resolved

    @app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(status="ok", service="transcription")

    @app.get("/ready", response_model=None)
    def ready() -> HealthResponse | JSONResponse:
        try:
            # Imported here so startup and /health do not load the Whisper runtime.
            import faster_whisper as _faster_whisper
        except ImportError:
            _faster_whisper = None
        if _faster_whisper is None:
            return JSONResponse(
                status_code=503,
                content={
                    "error": "whisper_unavailable",
                    "message": "faster-whisper is not installed. No transcript was created.",
                },
            )
        return HealthResponse(status="ok", service="transcription")

    @app.post("/transcribe", response_model=None)
    async def transcribe(request: Request) -> TranscriptResponse | JSONResponse:
        mime = (request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
        suffix = AUDIO_SUFFIXES.get(mime)
        if suffix is None:
            return JSONResponse(
                status_code=415,
                content={
                    "error": "unsupported_audio",
                    "message": "Upload a WAV, MP3, M4A, WebM, OGG, or AAC recording.",
                },
            )

        audio = await request.body()
        if not audio:
            return JSONResponse(
                status_code=400,
                content={"error": "empty_audio", "message": "The recording file was empty."},
            )
        if len(audio) > MAX_AUDIO_BYTES:
            return JSONResponse(
                status_code=413,
                content={
                    "error": "audio_too_large",
                    "message": "That recording is larger than 40 MB.",
                },
            )

        try:
            model = get_whisper_model(request.app)
        except ImportError:
            return JSONResponse(
                status_code=503,
                content={
                    "error": "whisper_unavailable",
                    "message": "faster-whisper is not installed. No transcript was created.",
                },
            )
        except Exception:
            logger.exception("Whisper model failed to load")
            return JSONResponse(
                status_code=503,
                content={
                    "error": "whisper_unavailable",
                    "message": "Whisper could not load a model. No transcript was created.",
                },
            )

        temp_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as handle:
                handle.write(audio)
                temp_path = Path(handle.name)
            return transcribe_file(model, request.app.state.settings.whisper_model, temp_path)
        except Exception:
            logger.exception("Whisper transcription failed")
            return JSONResponse(
                status_code=500,
                content={
                    "error": "transcription_failed",
                    "message": "Whisper could not transcribe this recording. No transcript was created.",
                },
            )
        finally:
            if temp_path is not None:
                temp_path.unlink(missing_ok=True)

    return app


def get_whisper_model(app: FastAPI) -> Any:
    cached = getattr(app.state, "whisper_model", None)
    if cached is not None:
        return cached
    # Imported here so service startup does not load the Whisper runtime.
    from faster_whisper import WhisperModel

    settings: Settings = app.state.settings
    model = WhisperModel(
        settings.whisper_model,
        device=settings.whisper_device,
        compute_type=settings.whisper_compute_type,
    )
    app.state.whisper_model = model
    return model


def transcribe_file(model: Any, model_name: str, audio_path: Path) -> TranscriptResponse | JSONResponse:
    segments_iter, info = model.transcribe(str(audio_path))
    segments: list[Segment] = []
    parts: list[str] = []
    for segment in segments_iter:
        text = str(segment.text).strip()
        if not text:
            continue
        segments.append(Segment(start=float(segment.start), end=float(segment.end), text=text))
        parts.append(text)

    transcript = " ".join(parts).strip()
    if not transcript:
        return JSONResponse(
            status_code=422,
            content={
                "error": "empty_transcript",
                "message": "Whisper did not return any words. No transcript was invented.",
            },
        )

    language = getattr(info, "language", None)
    return TranscriptResponse(
        source="whisper",
        model=model_name,
        text=transcript,
        language=language if isinstance(language, str) else None,
        segments=segments,
    )


app = create_app()
