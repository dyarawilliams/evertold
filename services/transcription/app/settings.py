import json
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def repo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in [current, *current.parents]:
        manifest = parent / "package.json"
        agents = parent / "AGENTS.md"
        if not manifest.is_file() or not agents.is_file():
            continue
        name = json.loads(manifest.read_text(encoding="utf-8")).get("name")
        if name == "evertold":
            return parent
    raise RuntimeError("Could not find the EverTold repository root.")


def whisper_defaults() -> dict[str, str]:
    config_path = repo_root() / "ai" / "transcription" / "model.json"
    raw = json.loads(config_path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise RuntimeError("ai/transcription/model.json must be an object.")

    model = raw.get("model")
    device = raw.get("device")
    compute_type = raw.get("computeType")
    values = (model, device, compute_type)
    if not all(isinstance(value, str) and value.strip() for value in values):
        raise RuntimeError(
            "ai/transcription/model.json must include model, device, and computeType."
        )
    return {
        "model": model,
        "device": device,
        "compute_type": compute_type,
    }


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=repo_root() / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    transcription_host: str = "127.0.0.1"
    transcription_port: int = 8000
    whisper_model: str = ""
    whisper_device: str = ""
    whisper_compute_type: str = ""

    def model_post_init(self, _context: object) -> None:
        defaults = whisper_defaults()
        if not self.whisper_model:
            self.whisper_model = defaults["model"]
        if not self.whisper_device:
            self.whisper_device = defaults["device"]
        if not self.whisper_compute_type:
            self.whisper_compute_type = defaults["compute_type"]
