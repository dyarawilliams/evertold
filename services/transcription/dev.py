from pathlib import Path

import uvicorn

from app.settings import Settings


def main() -> None:
    settings = Settings()
    service_root = Path(__file__).resolve().parent
    uvicorn.run(
        "app.main:app",
        host=settings.transcription_host,
        port=settings.transcription_port,
        reload=True,
        reload_dirs=[str(service_root)],
    )


if __name__ == "__main__":
    main()
