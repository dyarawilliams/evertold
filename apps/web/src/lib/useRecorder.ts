import { useEffect, useRef, useState } from "react";

export type RecorderPhase = "idle" | "recording" | "stopped";

export function recorderSupported(): boolean {
  return typeof MediaRecorder !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
}

export function useRecorder() {
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mime, setMime] = useState("audio/webm");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      clearTimer();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      recorder?.stream.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, []);

  async function start(): Promise<void> {
    setError(null);
    if (!recorderSupported()) {
      setError("This browser cannot record audio. Upload a recording or type the transcript instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = preferredMime();
      const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        clearTimer();
        const recordedMime = baseMime(recorder.mimeType || preferred || "audio/webm");
        setMime(recordedMime);
        setBlob(new Blob(chunksRef.current, { type: recordedMime }));
        setPhase("stopped");
      };
      recorderRef.current = recorder;
      recorder.start();
      setBlob(null);
      setSeconds(0);
      setPhase("recording");
      timerRef.current = window.setInterval(() => {
        setSeconds((value) => value + 1);
      }, 1000);
    } catch (caught) {
      setError(microphoneMessage(caught));
    }
  }

  function stop(): void {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  function reset(): void {
    setBlob(null);
    setSeconds(0);
    setPhase("idle");
    setError(null);
  }

  function clearTimer(): void {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  return {
    supported: recorderSupported(),
    phase,
    seconds,
    blob,
    mime,
    error,
    start,
    stop,
    reset,
  };
}

function preferredMime(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return "audio/webm;codecs=opus";
  }
  if (MediaRecorder.isTypeSupported("audio/webm")) {
    return "audio/webm";
  }
  if (MediaRecorder.isTypeSupported("audio/mp4")) {
    return "audio/mp4";
  }
  return "";
}

function baseMime(value: string): string {
  const base = value.split(";")[0]?.trim().toLowerCase();
  return base || "audio/webm";
}

function microphoneMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "The microphone permission was blocked. You can upload a recording or type the transcript instead.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No microphone was found. You can upload a recording or type the transcript instead.";
  }
  return "Recording could not start. You can upload a recording or type the transcript instead.";
}
