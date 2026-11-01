import type { Story } from "../lib/types.ts";
import { transcriptLabel } from "../lib/labels.ts";

export function TranscriptColumn({
  story,
  transcript,
  pending,
  confirmTranscribe,
  onTranscript,
  onUpload,
  onTranscribe,
}: {
  story: Story;
  transcript: string;
  pending: boolean;
  confirmTranscribe: boolean;
  onTranscript: (value: string) => void;
  onUpload: (file: File) => void;
  onTranscribe: () => void;
}) {
  const differs = story.originalTranscript.trim() !== "" && transcript !== story.originalTranscript;
  return (
    <section className="paper flex flex-col gap-5 p-5 sm:p-6" aria-labelledby="transcript-heading">
      <div>
        <h2 id="transcript-heading" className="font-serif text-3xl">
          Transcript
        </h2>
        <p className="mt-2 leading-relaxed">{transcriptLabel({ ...story, transcript })}</p>
      </div>

      {story.demo ? null : (
        <div className="flex flex-col gap-3">
          {story.hasAudio ? (
            <audio key={story.updatedAt} controls src={`/api/stories/${story.id}/audio`} className="w-full" />
          ) : (
            <p>No recording stored for this story.</p>
          )}
          <label className="field">
            {story.hasAudio ? "Replace recording" : "Add a recording"}
            <input
              type="file"
              accept="audio/wav,audio/mpeg,audio/mp4,audio/webm,audio/ogg,audio/aac"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  onUpload(file);
                }
                event.target.value = "";
              }}
            />
          </label>
          {story.hasAudio ? (
            <div className="flex flex-col items-start gap-2">
              <button className="btn" type="button" onClick={onTranscribe} disabled={pending}>
                {pending ? "Transcribing…" : confirmTranscribe ? "Replace transcript with Whisper" : "Transcribe with Whisper"}
              </button>
              {confirmTranscribe ? (
                <p>This replaces the working transcript and clears insights that belonged to the previous text.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {story.originalTranscript.trim() ? (
        <div>
          <h3 className="font-serif text-2xl">Original transcript</h3>
          <blockquote className="mt-3 border-l-4 border-sage pl-4 leading-relaxed whitespace-pre-wrap">
            {story.originalTranscript}
          </blockquote>
        </div>
      ) : (
        <p>No original transcript yet.</p>
      )}

      <label className="field">
        {differs ? "Working transcript" : "Edit transcript"}
        <textarea rows={12} value={transcript} onChange={(event) => onTranscript(event.target.value)} />
      </label>
      {differs ? (
        <button className="btn btn-secondary self-start" type="button" onClick={() => onTranscript(story.originalTranscript)}>
          Restore original transcript
        </button>
      ) : null}
    </section>
  );
}
