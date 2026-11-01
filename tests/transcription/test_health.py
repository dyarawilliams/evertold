import sys

from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import Settings


def test_health_reports_the_transcription_service() -> None:
    client = TestClient(create_app(Settings(_env_file=None)))
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "transcription"}


def test_unknown_route_is_not_found() -> None:
    client = TestClient(create_app(Settings(_env_file=None)))
    response = client.get("/missing")

    assert response.status_code == 404


def test_startup_does_not_import_faster_whisper() -> None:
    sys.modules.pop("faster_whisper", None)
    create_app(Settings(_env_file=None))
    assert "faster_whisper" not in sys.modules
