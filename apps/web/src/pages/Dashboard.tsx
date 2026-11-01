import { useEffect, useState } from "react";
import { Notice } from "../components/Notice.tsx";
import { AppLink, useRouter } from "../components/Router.tsx";
import { createDemoStory, getStatus, listStories } from "../lib/api.ts";
import { rememberStories } from "../db/index.ts";
import { formatWhen } from "../lib/format.ts";
import type { ServiceStatus, Story } from "../lib/types.ts";

export function Dashboard() {
  const { navigate } = useRouter();
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [memories, setMemories] = useState<Story[] | null>(null);
  const [drafts, setDrafts] = useState<Story[] | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoPending, setDemoPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getStatus().then((result) => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setStatus(result.data);
      } else {
        setStatusError(result.message);
      }
    });
    void Promise.all([listStories(true), listStories(false)]).then(([saved, open]) => {
      if (cancelled) {
        return;
      }
      if (saved.ok && open.ok) {
        setMemories(saved.data.slice(0, 4));
        setDrafts(open.data.slice(0, 4));
        void rememberStories([...saved.data, ...open.data]);
        return;
      }
      if (!saved.ok) {
        setLibraryError(saved.message);
      } else if (!open.ok) {
        setLibraryError(open.message);
      }
      setMemories([]);
      setDrafts([]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadDemo(): Promise<void> {
    setDemoPending(true);
    setDemoError(null);
    const result = await createDemoStory();
    setDemoPending(false);
    if (!result.ok) {
      setDemoError(result.message);
      return;
    }
    navigate(`/stories/${result.data.id}`);
  }

  return (
    <div className="flex flex-col gap-14">
      <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
        <div>
          <p className="text-sm tracking-[0.16em] uppercase">Family oral history</p>
          <h1 id="page-title" tabIndex={-1} className="mt-3 max-w-3xl font-serif text-5xl leading-[1.05] sm:text-6xl">
            Every story deserves to live on.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed">
            Record someone you love, upload a recording you already have, or type the words you remember. EverTold
            keeps those words, then asks Gemma only for what the transcript supports.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <AppLink className="btn" href="/record">
              Record a story
            </AppLink>
            <AppLink className="btn btn-secondary" href="/record?mode=upload">
              Upload audio
            </AppLink>
            <AppLink className="btn btn-secondary" href="/record?mode=write">
              Write a transcript
            </AppLink>
          </div>
        </div>
        <aside className="paper p-6">
          <h2 className="font-serif text-2xl">On this computer</h2>
          {statusError ? <Notice tone="error">{statusError}</Notice> : null}
          {status ? (
            <div className="mt-4 flex flex-col">
              <ServiceLine label="Whisper" available={status.transcription.available} message={status.transcription.message} />
              <ServiceLine label="Gemma" available={status.gemma.available} message={status.gemma.message} />
            </div>
          ) : statusError ? null : (
            <p className="mt-4" role="status">
              Checking local services…
            </p>
          )}
          <button className="btn btn-secondary mt-5" type="button" onClick={() => void loadDemo()} disabled={demoPending}>
            {demoPending ? "Loading demo…" : "Load a synthetic demo"}
          </button>
          {demoError ? (
            <div className="mt-3">
              <Notice tone="error">{demoError}</Notice>
            </div>
          ) : null}
        </aside>
      </section>

      <section aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="font-serif text-3xl">
          From voice to memory
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Step number="01" title="Capture" text="Record with consent, upload audio, or type a transcript." />
          <Step number="02" title="Keep the words" text="Whisper can transcribe. The original transcript stays beside any edit." />
          <Step number="03" title="Review insights" text="Gemma suggests a summary, people, places, moments, and topics. You approve them." />
          <Step number="04" title="Save" text="A saved memory appears in the library on this computer." />
        </ol>
      </section>

      <section aria-labelledby="recent-memories">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="recent-memories" className="font-serif text-3xl">
            Recent memories
          </h2>
          <AppLink href="/library" className="btn-quiet">
            Open the library
          </AppLink>
        </div>
        {libraryError ? (
          <div className="mt-4">
            <Notice tone="error">{libraryError}</Notice>
          </div>
        ) : null}
        {memories === null ? (
          <p className="mt-4" role="status">
            Loading memories…
          </p>
        ) : memories.length === 0 ? (
          <div className="paper mt-4 p-6">
            <p>No memories saved yet. A recording, an upload, or a typed transcript can become one.</p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {memories.map((story) => (
              <li key={story.id}>
                <StoryCard story={story} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {drafts && drafts.length > 0 ? (
        <section aria-labelledby="in-progress">
          <h2 id="in-progress" className="font-serif text-3xl">
            In progress
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {drafts.map((story) => (
              <li key={story.id}>
                <StoryCard story={story} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ServiceLine({ label, available, message }: { label: string; available: boolean; message: string }) {
  return (
    <div className="border-t border-charcoal/10 py-3">
      <p className="font-medium">
        {label}
        <span className="sr-only">: </span>
        <span className="font-normal"> {available ? "Available" : "Unavailable"}</span>
      </p>
      <p className="mt-1 text-sm leading-relaxed">{message}</p>
    </div>
  );
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <li className="paper step-card p-5">
      <p className="font-serif text-3xl">{number}</p>
      <h3 className="mt-2 font-serif text-2xl">{title}</h3>
      <p className="mt-2 leading-relaxed">{text}</p>
    </li>
  );
}

function StoryCard({ story }: { story: Story }) {
  return (
    <article className="paper flex h-full flex-col gap-3 p-5">
      <p className="text-sm">{formatWhen(story.updatedAt)}</p>
      <h3 className="font-serif text-2xl">{story.title}</h3>
      {story.demo ? <p>Synthetic demonstration</p> : null}
      <p className="line-clamp-3 leading-relaxed">{story.insights?.summary || story.transcript || "No transcript yet."}</p>
      <AppLink className="btn mt-auto self-start" href={`/stories/${story.id}`}>
        Open
      </AppLink>
    </article>
  );
}
