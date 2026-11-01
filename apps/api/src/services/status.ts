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
  const [transcriptionUp, gemmaUp] = await Promise.all([
    options.transcriptionUrl
      ? probe(joinUrl(options.transcriptionUrl, "/health"), options.fetchImpl)
      : Promise.resolve(false),
    options.ollamaBaseUrl
      ? probe(joinUrl(options.ollamaBaseUrl, "/api/tags"), options.fetchImpl)
      : Promise.resolve(false),
  ]);

  const model = options.ollamaModel;
  return {
    transcription: {
      available: transcriptionUp,
      message: transcriptionUp
        ? "Whisper is reachable on this computer."
        : "Whisper is not running on this computer. You can type a transcript or load the synthetic demo. The demo is not a transcription.",
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
