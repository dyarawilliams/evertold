import { useEffect, useState, type FormEvent } from "react";
import { Notice } from "../components/Notice.tsx";
import { AppLink, useRouter } from "../components/Router.tsx";
import { db, rememberStory, type PendingRecording } from "../db/index.ts";
import { fileMime } from "../lib/audio.ts";
import { createStory, uploadAudio } from "../lib/api.ts";
import { formatDuration, formatWhen } from "../lib/format.ts";
import type { RecordMode } from "../lib/routes.ts";
import { useRecorder } from "../lib/useRecorder.ts";

export function RecordPage({ mode }: { mode: RecordMode }) {
  const { navigate } = useRouter();
  const recorder = useRecorder();
  const [consent, setConsent] = useState(false);
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingRecording[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    void loadPending(setPending);
  }, []);

  useEffect(() => {
    if (!recorder.blob) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(recorder.blob);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [recorder.blob]);

  async function saveAudio(audio: Blob, mime: string): Promise<void> {
    setBusy(true);
    setError(null);
    const created = await createStory({
      title: title.trim() || undefined,
      consent: true,
    });
    if (!created.ok) {
      await keepLocal(audio, mime, title);
      setError(`${created.message} The recording is kept in this browser.`);
      setBusy(false);
      await loadPending(setPending);
      return;
    }
    const uploaded = await uploadAudio(created.data.id, audio, mime);
    if (!uploaded.ok) {
      await db.recordings.put({
        id: created.data.id,
        title: title.trim() || created.data.title,
        mime,
        blob: audio,
        createdAt: new Date().toISOString(),
      });
      setError(`${uploaded.message} The recording is kept in this browser.`);
      setBusy(false);
      await loadPending(setPending);
      return;
    }
    await rememberStory(uploaded.data);
    setBusy(false);
    navigate(`/stories/${uploaded.data.id}`);
  }

  async function retry(item: PendingRecording): Promise<void> {
    setBusy(true);
    setError(null);
    const uploaded = await uploadAudio(item.id, item.blob, item.mime);
    if (!uploaded.ok && uploaded.status === 404) {
      const created = await createStory({ title: item.title, consent: true });
      if (!created.ok) {
        setError(created.message);
        setBusy(false);
        return;
      }
      const second = await uploadAudio(created.data.id, item.blob, item.mime);
      if (!second.ok) {
        setError(second.message);
        setBusy(false);
        return;
      }
      await db.recordings.delete(item.id);
      await rememberStory(second.data);
      setBusy(false);
      navigate(`/stories/${second.data.id}`);
      return;
    }
    if (!uploaded.ok) {
      setError(uploaded.message);
      setBusy(false);
      return;
    }
    await db.recordings.delete(item.id);
    await rememberStory(uploaded.data);
    setBusy(false);
    navigate(`/stories/${uploaded.data.id}`);
  }

  async function saveTranscript(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const created = await createStory({
      title: title.trim() || undefined,
      consent: true,
      transcript,
    });
    setBusy(false);
    if (!created.ok) {
      setError(created.message);
      return;
    }
    await rememberStory(created.data);
    navigate(`/stories/${created.data.id}`);
  }

  const consentLabel =
    mode === "write"
      ? "I have permission to store this story on this computer."
      : "I have permission from the people in this recording to store their voice and words on this computer.";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 id="page-title" tabIndex={-1} className="font-serif text-5xl leading-tight">
          Record a story
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed">
          Start with consent. Then record, upload, or write. Nothing is sent except to the local Whisper and Gemma
          services you run yourself.
        </p>
      </div>

      <nav aria-label="Ways to add a story">
        <ul className="flex flex-wrap gap-2">
          <li>
            <AppLink className={mode === "record" ? "tab is-current" : "tab"} href="/record" current={mode === "record"}>
              Record
            </AppLink>
          </li>
          <li>
            <AppLink
              className={mode === "upload" ? "tab is-current" : "tab"}
              href="/record?mode=upload"
              current={mode === "upload"}
            >
              Upload
            </AppLink>
          </li>
          <li>
            <AppLink
              className={mode === "write" ? "tab is-current" : "tab"}
              href="/record?mode=write"
              current={mode === "write"}
            >
              Write
            </AppLink>
          </li>
        </ul>
      </nav>

      <label className="paper flex items-start gap-3 p-5">
        <input
          className="mt-1 h-5 w-5"
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>{consentLabel}</span>
      </label>

      <label className="field max-w-xl">
        Title
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="Untitled story" />
      </label>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {recorder.error ? <Notice tone="error">{recorder.error}</Notice> : null}

      {mode === "record" ? (
        <section className="paper flex flex-col gap-5 p-6" aria-labelledby="record-panel">
          <h2 id="record-panel" className="font-serif text-3xl">
            Microphone
          </h2>
          {recorder.supported ? null : (
            <Notice tone="status">This browser cannot record audio. Upload a recording or write the transcript.</Notice>
          )}
          <p aria-live="polite" className="sr-only">
            {recorder.phase === "recording" ? "Recording." : recorder.phase === "stopped" ? "Recording stopped." : ""}
          </p>
          <p className="font-serif text-5xl" aria-hidden="true">
            {formatDuration(recorder.seconds)}
          </p>
          <div className="flex flex-wrap gap-3">
            {recorder.phase === "recording" ? (
              <button className="btn" type="button" onClick={recorder.stop}>
                Stop recording
              </button>
            ) : (
              <button className="btn" type="button" onClick={() => void recorder.start()} disabled={!consent || !recorder.supported || busy}>
                Start recording
              </button>
            )}
            {recorder.blob ? (
              <button className="btn btn-secondary" type="button" onClick={recorder.reset} disabled={busy}>
                Discard take
              </button>
            ) : null}
          </div>
          {previewUrl ? <audio controls src={previewUrl} className="w-full" /> : null}
          {recorder.blob ? (
            <button className="btn self-start" type="button" disabled={!consent || busy} onClick={() => void saveAudio(recorder.blob as Blob, recorder.mime)}>
              {busy ? "Saving…" : "Save recording and continue"}
            </button>
          ) : null}
        </section>
      ) : null}

      {mode === "upload" ? (
        <form
          className="paper flex flex-col gap-5 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!file) {
              setError("Choose an audio file first.");
              return;
            }
            void saveAudio(file, fileMime(file));
          }}
        >
          <h2 className="font-serif text-3xl">Upload</h2>
          <label className="field">
            Audio file
            <input
              type="file"
              accept="audio/wav,audio/mpeg,audio/mp4,audio/webm,audio/ogg,audio/aac,.wav,.mp3,.m4a,.webm,.ogg,.aac"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button className="btn self-start" type="submit" disabled={!consent || !file || busy}>
            {busy ? "Uploading…" : "Upload and continue"}
          </button>
        </form>
      ) : null}

      {mode === "write" ? (
        <form className="paper flex flex-col gap-5 p-6" onSubmit={(event) => void saveTranscript(event)}>
          <h2 className="font-serif text-3xl">Transcript</h2>
          <label className="field">
            Words to keep
            <textarea
              rows={10}
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              required
            />
          </label>
          <button className="btn self-start" type="submit" disabled={!consent || transcript.trim() === "" || busy}>
            {busy ? "Saving…" : "Continue to the story"}
          </button>
        </form>
      ) : null}

      {pending.length > 0 ? (
        <section aria-labelledby="pending-recordings">
          <h2 id="pending-recordings" className="font-serif text-3xl">
            Kept in this browser
          </h2>
          <p className="mt-2 max-w-2xl leading-relaxed">These recordings have not reached the API yet.</p>
          <ul className="mt-4 flex flex-col gap-3">
            {pending.map((item) => (
              <li key={item.id} className="paper flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm">{formatWhen(item.createdAt)}</p>
                </div>
                <button className="btn" type="button" disabled={busy} onClick={() => void retry(item)}>
                  Try again
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

async function loadPending(setPending: (rows: PendingRecording[]) => void): Promise<void> {
  try {
    const rows = await db.recordings.orderBy("createdAt").reverse().toArray();
    setPending(rows);
  } catch {
    setPending([]);
  }
}

async function keepLocal(audio: Blob, mime: string, title: string): Promise<void> {
  try {
    await db.recordings.put({
      id: crypto.randomUUID(),
      title: title.trim() || "Untitled story",
      mime,
      blob: audio,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // The visitor still has the take in the page until they leave.
  }
}
