import type { FetchLike } from "./fetch.js";

export type ServiceStatus = {
  transcription: { available: boolean; message: string };
  gemma: { available: boolean; model: string | null; message: string };
};

export async function readServiceStatus(options: {
  transcriptionUrl: string | null;
  ollamaBaseUrl: string | null;
  ollamaModel: string | null;
  fetchImpl: FetchLike;
}): Promise<ServiceStatus> {
  const transcriptionUrl = options.transcriptionUrl;
  const [transcriptionHealth, transcriptionReady, gemmaUp] = await Promise.all([
    transcriptionUrl
      ? probe(joinUrl(transcriptionUrl, "/health"), options.fetchImpl)
      : Promise.resolve(false),
    transcriptionUrl
      ? probe(joinUrl(transcriptionUrl, "/ready"), options.fetchImpl)
      : Promise.resolve(false),
    options.ollamaBaseUrl
      ? probe(joinUrl(options.ollamaBaseUrl, "/api/tags"), options.fetchImpl)
      : Promise.resolve(false),
  ]);

  const model = options.ollamaModel;
  return {
    transcription: {
      available: transcriptionReady,
      message: transcriptionMessage(transcriptionHealth, transcriptionReady),
    },
    gemma: {
      available: gemmaUp,
      model,
      message: gemmaUp
        ? model
          ? `Gemma is reachable through Ollama (${model}).`
          : "Gemma is reachable through Ollama."
        : "Gemma is not running through Ollama. EverTold will not invent insights. The synthetic demo is labeled and is not model output.",
    },
  };
}

function transcriptionMessage(health: boolean, ready: boolean): string {
  if (ready) {
    return "Whisper is reachable on this computer.";
  }
  if (health) {
    return "The transcription service is running, but faster-whisper is not installed. You can type a transcript. No transcript will be invented.";
  }
  return "Whisper is not running on this computer. You can type a transcript or load the synthetic demo. The demo is not a transcription.";
}

async function probe(url: string, fetchImpl: FetchLike): Promise<boolean> {
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(1_500) });
    return response.ok;
  } catch {
    return false;
  }
}

function joinUrl(base: string, pathname: string): string {
  return `${base.replace(/\/$/, "")}${pathname}`;
}
