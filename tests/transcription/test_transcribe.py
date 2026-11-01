from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import Settings


def _client() -> TestClient:
    return TestClient(create_app(Settings(_env_file=None)))


def test_transcribe_reports_missing_whisper_without_a_transcript() -> None:
    response = _client().post(
        "/transcribe",
        content=b"not really audio",
        headers={"content-type": "audio/wav"},
    )

    assert response.status_code == 503
    body = response.json()
    assert body["error"] == "whisper_unavailable"
    assert "text" not in body
    assert "transcript" not in body


def test_transcribe_rejects_an_empty_or_unsupported_upload() -> None:
    client = _client()
    empty = client.post("/transcribe", content=b"", headers={"content-type": "audio/wav"})
    assert empty.status_code == 400
    assert empty.json()["error"] == "empty_audio"

    rejected = client.post(
        "/transcribe",
        content=b"hello",
        headers={"content-type": "text/plain"},
    )
    assert rejected.status_code == 415
    assert rejected.json()["error"] == "unsupported_audio"
