import { useEffect, useState } from "react";
import { Notice } from "../components/Notice.tsx";
import { AppLink, useRouter } from "../components/Router.tsx";
import { forgetStory, rememberStory } from "../db/index.ts";
import { fileMime } from "../lib/audio.ts";
import {
  deleteStory,
  downloadExport,
  generateInsights,
  getStory,
  patchStory,
  transcribeStory,
  uploadAudio,
} from "../lib/api.ts";
import type { InsightItem, Insights, Story, StoryPatch } from "../lib/types.ts";
import { InsightsPanel } from "./InsightsPanel.tsx";
import { TranscriptColumn } from "./TranscriptColumn.tsx";

type Pending = "save" | "transcribe" | "insights" | "delete" | "export" | "upload" | null;

export function StoryPage({ id }: { id: string }) {
  const { navigate } = useRouter();
  const [story, setStory] = useState<Story | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [insights, setInsights] = useState<Insights | null>(null);
  const [approved, setApproved] = useState(false);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [confirmTranscribe, setConfirmTranscribe] = useState(false);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function apply(next: Story): void {
    setStory(next);
    setTitle(next.title);
    setTranscript(next.transcript);
    setInsights(next.insights);
    setApproved(next.insightsApproved);
    setConsent(next.consent);
    setConfirmTranscribe(false);
    setConfirmGenerate(false);
    void rememberStory(next);
  }

  useEffect(() => {
    let cancelled = false;
    setStory(null);
    setMissing(false);
    setLoadError(null);
    setMessage(null);
    setError(null);
    void getStory(id).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        apply(result.data);
        return;
      }
      if (result.status === 404) {
        setMissing(true);
        return;
      }
      setLoadError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function save(): Promise<void> {
    if (!story) {
      return;
    }
    if (insights && insights.summary.trim() === "") {
      setError("Add a summary, or remove the insights, before saving.");
      return;
    }
    setPending("save");
    setError(null);
    setMessage(null);
    const patch: StoryPatch = {
      title: title.trim() || "Untitled story",
      transcript,
      consent: story.consent || consent,
      saved: true,
      insightsApproved: insights ? approved : false,
    };
    if (insights) {
      patch.insights = {
        ...insights,
        summary: insights.summary.trim(),
        people: filled(insights.people),
        places: filled(insights.places),
        moments: filled(insights.moments),
        topics: filled(insights.topics),
      };
    } else if (story.insights) {
      patch.insights = null;
    }
    const result = await patchStory(story.id, patch);
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    apply(result.data);
    setMessage(result.data.saved ? "Memory saved on this computer." : "Story updated.");
  }

  async function transcribe(): Promise<void> {
    if (!story) {
      return;
    }
    if ((transcript.trim() !== "" || insights) && !confirmTranscribe) {
      setConfirmTranscribe(true);
      setMessage(null);
      return;
    }
    setPending("transcribe");
    setError(null);
    const result = await transcribeStory(story.id);
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    apply(result.data);
    setMessage("Whisper saved a transcript. Earlier insights were cleared because they belonged to the previous text.");
  }

  async function generate(): Promise<void> {
    if (!story) {
      return;
    }
    if (insights?.edited && !confirmGenerate) {
      setConfirmGenerate(true);
      setMessage(null);
      return;
    }
    setPending("insights");
    setError(null);
    if (transcript !== story.transcript) {
      const saved = await patchStory(story.id, { transcript });
      if (!saved.ok) {
        setPending(null);
        setError(saved.message);
        return;
      }
      apply(saved.data);
    }
    const result = await generateInsights(story.id);
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    apply(result.data);
    setMessage(
      result.data.insights?.source === "demo"
        ? "These insights are a synthetic demonstration."
        : "Gemma returned insights. Review them against the transcript before you rely on them.",
    );
  }

  async function upload(file: File): Promise<void> {
    if (!story) {
      return;
    }
    setPending("upload");
    setError(null);
    const result = await uploadAudio(story.id, file, fileMime(file));
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    apply(result.data);
    setMessage("Recording stored on this computer.");
  }

  async function remove(): Promise<void> {
    if (!story) {
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setPending("delete");
    setError(null);
    const result = await deleteStory(story.id);
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await forgetStory(story.id);
    navigate("/library");
  }

  async function exportStory(): Promise<void> {
    if (!story) {
      return;
    }
    setPending("export");
    setError(null);
    const result = await downloadExport(story.id);
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage("Export downloaded. It does not include the audio file.");
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-serif text-4xl">Story</h1>
        <Notice tone="error">{loadError}</Notice>
      </div>
    );
  }
  if (missing) {
    return (
      <div className="paper flex flex-col items-start gap-4 p-8">
        <h1 className="font-serif text-4xl">That story is not on this computer</h1>
        <AppLink className="btn" href="/library">
          Back to the library
        </AppLink>
      </div>
    );
  }
  if (!story) {
    return (
      <p role="status" className="text-lg">
        Loading story…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <AppLink href="/library" className="btn-quiet">
            Library
          </AppLink>
          <h1 id="page-title" tabIndex={-1} className="mt-3 font-serif text-4xl leading-tight">
            <label>
              <span className="sr-only">Title</span>
              <input
                className="title-input"
                value={title}
                maxLength={200}
                placeholder="Untitled story"
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" type="button" onClick={() => void save()} disabled={pending !== null || (!story.consent && !consent)}>
            {pending === "save" ? "Saving…" : story.saved ? "Save changes" : "Save memory"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => void exportStory()} disabled={pending !== null}>
            {pending === "export" ? "Exporting…" : "Export JSON"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => void remove()} disabled={pending !== null}>
            {confirmDelete ? "Delete permanently" : "Delete"}
          </button>
        </div>
      </div>

      {story.demo ? (
        <Notice tone="demo">
          Synthetic demonstration. This story was not transcribed by Whisper, and its insights were not written by Gemma.
        </Notice>
      ) : null}
      {story.consent ? (
        <p>Consent to store this story was recorded.</p>
      ) : (
        <label className="flex items-start gap-3">
          <input className="mt-1 h-5 w-5" type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>I have permission to store this story on this computer.</span>
        </label>
      )}
      {confirmDelete ? <Notice tone="status">Delete removes the recording, transcript, and insights from this computer.</Notice> : null}
      {message ? <Notice tone="status">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <TranscriptColumn
          story={story}
          transcript={transcript}
          pending={pending === "transcribe" || pending === "upload"}
          confirmTranscribe={confirmTranscribe}
          onTranscript={setTranscript}
          onUpload={(file) => void upload(file)}
          onTranscribe={() => void transcribe()}
        />
        <InsightsPanel
          insights={insights}
          approved={approved}
          demo={story.demo}
          pending={pending === "insights"}
          confirmGenerate={confirmGenerate}
          onChange={setInsights}
          onApproved={setApproved}
          onGenerate={() => void generate()}
          onClear={() => {
            setInsights(null);
            setApproved(false);
          }}
        />
      </div>
    </div>
  );
}

function filled(items: InsightItem[]): InsightItem[] {
  return items
    .map((item) => ({ label: item.label.trim(), excerpt: item.excerpt.trim() }))
    .filter((item) => item.label !== "" && item.excerpt !== "");
}
