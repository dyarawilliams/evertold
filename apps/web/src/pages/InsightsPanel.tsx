import type { InsightItem, Insights } from "../lib/types.ts";
import { insightLabel } from "../lib/labels.ts";

const sections = [
  { key: "people", title: "People", hint: "A name must appear in an excerpt copied from the transcript." },
  { key: "places", title: "Places", hint: "A place must appear in an excerpt copied from the transcript." },
  { key: "moments", title: "Important moments", hint: "Describe the moment, then paste the words that support it." },
  { key: "topics", title: "Topics", hint: "Name the topic, then paste the words that support it." },
] as const;

export function InsightsPanel({
  insights,
  approved,
  demo,
  pending,
  confirmGenerate,
  onChange,
  onApproved,
  onGenerate,
  onClear,
}: {
  insights: Insights | null;
  approved: boolean;
  demo: boolean;
  pending: boolean;
  confirmGenerate: boolean;
  onChange: (insights: Insights) => void;
  onApproved: (approved: boolean) => void;
  onGenerate: () => void;
  onClear: () => void;
}) {
  return (
    <section className="paper flex flex-col gap-5 p-5 sm:p-6" aria-labelledby="insights-heading">
      <div>
        <h2 id="insights-heading" className="font-serif text-3xl">
          Insights
        </h2>
        <p className="mt-2 leading-relaxed">
          {insights
            ? insightLabel(insights)
            : demo
              ? "This synthetic story has no extra insights."
              : "Gemma can suggest a summary and the people, places, moments, and topics the transcript supports."}
        </p>
      </div>

      {demo ? null : (
        <div className="flex flex-col items-start gap-2">
          <button className="btn" type="button" onClick={onGenerate} disabled={pending}>
            {pending ? "Asking Gemma…" : confirmGenerate ? "Replace my edits" : insights ? "Generate again" : "Generate insights"}
          </button>
          {confirmGenerate ? <p>Generating again replaces the insights you edited.</p> : null}
        </div>
      )}

      {insights ? (
        <>
          <label className="field">
            Summary
            <textarea
              rows={5}
              value={insights.summary}
              onChange={(event) => onChange({ ...insights, summary: event.target.value, edited: true })}
            />
          </label>
          {sections.map((section) => (
            <InsightList
              key={section.key}
              title={section.title}
              hint={section.hint}
              items={insights[section.key]}
              onChange={(items) => onChange({ ...insights, [section.key]: items, edited: true })}
            />
          ))}
          {insights.unknowns.length > 0 ? (
            <div>
              <h3 className="font-serif text-2xl">Not established</h3>
              <ul className="mt-2 list-disc pl-5 leading-relaxed">
                {insights.unknowns.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <label className="flex items-start gap-3">
            <input
              className="mt-1 h-5 w-5"
              type="checkbox"
              checked={approved}
              onChange={(event) => onApproved(event.target.checked)}
            />
            <span>I reviewed these insights against the transcript.</span>
          </label>
          <button className="btn-quiet self-start" type="button" onClick={onClear}>
            Remove insights
          </button>
        </>
      ) : (
        <p>No insights yet. Names, dates, relationships, and places stay unknown until the transcript supports them.</p>
      )}
    </section>
  );
}

function InsightList({
  title,
  hint,
  items,
  onChange,
}: {
  title: string;
  hint: string;
  items: InsightItem[];
  onChange: (items: InsightItem[]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="font-serif text-2xl">{title}</legend>
      <p className="text-sm leading-relaxed">{hint}</p>
      {items.length === 0 ? <p>None kept from the transcript.</p> : null}
      {items.map((item, index) => (
        <div key={`${title}-${index}`} className="flex flex-col gap-3 border-t border-charcoal/10 pt-3">
          <label className="field">
            Label
            <input
              value={item.label}
              onChange={(event) => onChange(replaceItem(items, index, { ...item, label: event.target.value }))}
            />
          </label>
          <label className="field">
            Excerpt from the transcript
            <textarea
              rows={3}
              value={item.excerpt}
              onChange={(event) => onChange(replaceItem(items, index, { ...item, excerpt: event.target.value }))}
            />
          </label>
          <button
            className="btn-quiet self-start"
            type="button"
            onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
          >
            Remove {title.toLowerCase()} item
          </button>
        </div>
      ))}
      <button className="btn btn-secondary self-start" type="button" onClick={() => onChange([...items, { label: "", excerpt: "" }])}>
        Add {title.toLowerCase()}
      </button>
    </fieldset>
  );
}

function replaceItem(items: InsightItem[], index: number, next: InsightItem): InsightItem[] {
  return items.map((item, itemIndex) => (itemIndex === index ? next : item));
}
