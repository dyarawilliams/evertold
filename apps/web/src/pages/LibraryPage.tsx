import { useEffect, useState } from "react";
import { Notice } from "../components/Notice.tsx";
import { AppLink } from "../components/Router.tsx";
import { rememberStories, savedMemories } from "../db/index.ts";
import { listStories } from "../lib/api.ts";
import { formatWhen } from "../lib/format.ts";
import type { Story } from "../lib/types.ts";

export function LibraryPage() {
  const [stories, setStories] = useState<Story[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listStories(true).then(async (result) => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setStories(result.data);
        setOffline(false);
        await rememberStories(result.data);
        return;
      }
      try {
        const cached = await savedMemories();
        setStories(cached.map((row) => row.story));
        setOffline(cached.length > 0);
        setError(cached.length > 0 ? null : result.message);
      } catch {
        setStories([]);
        setError(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 id="page-title" tabIndex={-1} className="font-serif text-5xl">
          Library
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed">Memories you have saved on this computer.</p>
      </div>
      {offline ? (
        <Notice tone="status">
          Showing memories saved in this browser. The API is not reachable, so this list may be incomplete.
        </Notice>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {stories === null ? (
        <p role="status">Loading memories…</p>
      ) : stories.length === 0 ? (
        <div className="paper flex flex-col items-start gap-4 p-8">
          <h2 className="font-serif text-3xl">No memories yet</h2>
          <p className="max-w-xl leading-relaxed">Save a story after you record, upload, or type a transcript.</p>
          <AppLink className="btn" href="/record">
            Record a story
          </AppLink>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {stories.map((story) => (
            <li key={story.id}>
              <article className="paper flex h-full flex-col gap-3 p-5">
                <p className="text-sm">{formatWhen(story.updatedAt)}</p>
                <h2 className="font-serif text-2xl">{story.title}</h2>
                {story.demo ? <p>Synthetic demonstration. Not from Whisper or Gemma.</p> : null}
                <p className="line-clamp-4 leading-relaxed">
                  {story.insights?.summary || story.transcript || "No transcript yet."}
                </p>
                <p className="text-sm">
                  {story.insights
                    ? story.insights.source === "demo"
                      ? "Demo insights"
                      : story.insightsApproved
                        ? "AI insights reviewed"
                        : "AI insights not yet reviewed"
                    : "No insights yet"}
                </p>
                <AppLink className="btn mt-auto self-start" href={`/stories/${story.id}`}>
                  Open
                </AppLink>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
