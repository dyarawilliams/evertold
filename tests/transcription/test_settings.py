import pytest

from app.settings import Settings


def test_whisper_defaults_come_from_ai_config(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("WHISPER_MODEL", raising=False)
    monkeypatch.delenv("WHISPER_DEVICE", raising=False)
    monkeypatch.delenv("WHISPER_COMPUTE_TYPE", raising=False)

    settings = Settings(_env_file=None)

    assert settings.whisper_model == "base"
    assert settings.whisper_device == "cpu"
    assert settings.whisper_compute_type == "int8"


def test_whisper_environment_overrides_the_config_file(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("WHISPER_MODEL", "small")
    settings = Settings(_env_file=None)
    assert settings.whisper_model == "small"
