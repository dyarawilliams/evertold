import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApp } from "../../apps/api/src/app.js";
import { openDatabase } from "../../apps/api/src/db/sqlite.js";
import { findRepoRoot } from "../../apps/api/src/env.js";
import type { FetchLike } from "../../apps/api/src/services/fetch.js";
import { REMOVED_NOTE } from "../../apps/api/src/stories/ground.js";
import { withServer } from "./support.js";

const wav = Buffer.from("RIFF....WAVEfmt ");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tempDir(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "evertold-"));
  return {
    dir,
    cleanup: () => {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function offlineFetch(): FetchLike {
  return async () => {
    throw new Error("offline");
  };
}

function makeApp(audioDir: string, fetchImpl: FetchLike = offlineFetch()) {
  const database = openDatabase(":memory:");
  const app = createApp({
    env: {
      WEB_ORIGIN: "http://127.0.0.1:5173",
      TRANSCRIPTION_URL: "http://transcription.local",
      OLLAMA_BASE_URL: "http://ollama.local",
      OLLAMA_MODEL: "gemma3",
      repoRoot: findRepoRoot(process.cwd()),
    },
    database,
    audioDir,
    fetchImpl,
  });
  return { app, database };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json();
  assert.equal(isRecord(body), true);
  return body as Record<string, unknown>;
}

test("saves a typed story without inventing a transcript source", async () => {
  const audio = tempDir();
  const { app, database } = makeApp(audio.dir);
  try {
    await withServer(app, async (baseUrl) => {
      const createdResponse = await fetch(`${baseUrl}/api/stories`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Kitchen table",
          consent: true,
          transcript: "We kept the blue teapot.",
        }),
      });
      const created = await readJson(createdResponse);
      assert.equal(createdResponse.status, 201);
      assert.equal(created.transcriptSource, "manual");
      assert.equal(created.originalTranscript, "We kept the blue teapot.");
      assert.equal(created.saved, false);
      assert.equal(created.demo, false);
      assert.equal(created.insights, null);
      assert.equal(JSON.stringify(created).includes(audio.dir), false);

      const id = created.id;
      assert.equal(typeof id, "string");

      const patched = await readJson(
        await fetch(`${baseUrl}/api/stories/${String(id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            transcript: "We kept the blue teapot. It sat by the window.",
            saved: true,
          }),
        }),
      );
      assert.equal(patched.transcript, "We kept the blue teapot. It sat by the window.");
      assert.equal(patched.originalTranscript, "We kept the blue teapot.");
      assert.equal(patched.transcriptSource, "manual");
      assert.equal(patched.saved, true);

      const library = await readJson(await fetch(`${baseUrl}/api/stories?saved=true`));
      assert.equal(Array.isArray(library.stories), true);
      assert.equal((library.stories as unknown[]).length, 1);

      const exported = await readJson(await fetch(`${baseUrl}/api/stories/${String(id)}/export`));
      assert.equal(isRecord(exported.story), true);
      assert.match(String(exported.notice), /stored on this computer/);
      assert.equal(JSON.stringify(exported).includes("audioFilename"), false);

      const removed = await fetch(`${baseUrl}/api/stories/${String(id)}`, { method: "DELETE" });
      assert.equal(removed.status, 204);
      const missing = await fetch(`${baseUrl}/api/stories/${String(id)}`);
      assert.equal(missing.status, 404);
    });
  } finally {
    database.close();
    audio.cleanup();
  }
});

test("stores a recording and keeps the original Whisper transcript", async () => {
  const audio = tempDir();
  const fetchImpl: FetchLike = async (input, init) => {
    assert.match(String(input), /\/transcribe$/);
    assert.equal(init?.method, "POST");
    return new Response(
      JSON.stringify({
        source: "whisper",
        model: "base",
        text: "Hello from the recording.",
        segments: [{ start: 0, end: 1, text: "Hello from the recording." }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const { app, database } = makeApp(audio.dir, fetchImpl);
  try {
    await withServer(app, async (baseUrl) => {
      const created = await readJson(
        await fetch(`${baseUrl}/api/stories`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ consent: true, title: "Recording" }),
        }),
      );
      const id = String(created.id);
      const uploadedResponse = await fetch(`${baseUrl}/api/stories/${id}/audio`, {
        method: "POST",
        headers: { "content-type": "audio/wav" },
        body: new Uint8Array(wav),
      });
      const uploaded = await readJson(uploadedResponse);
      assert.equal(uploadedResponse.status, 200);
      assert.equal(uploaded.hasAudio, true);
      assert.equal(uploaded.audioMime, "audio/wav");
      assert.equal(JSON.stringify(uploaded).includes(audio.dir), false);

      const audioResponse = await fetch(`${baseUrl}/api/stories/${id}/audio`);
      assert.equal(audioResponse.status, 200);
      assert.equal(audioResponse.headers.get("cache-control"), "private, no-store");
      assert.deepEqual(new Uint8Array(await audioResponse.arrayBuffer()), new Uint8Array(wav));

      const ranged = await fetch(`${baseUrl}/api/stories/${id}/audio`, {
        headers: { range: "bytes=0-3" },
      });
      assert.equal(ranged.status, 206);
      assert.equal((await ranged.arrayBuffer()).byteLength, 4);

      const transcribed = await readJson(
        await fetch(`${baseUrl}/api/stories/${id}/transcribe`, { method: "POST" }),
      );
      assert.equal(transcribed.transcript, "Hello from the recording.");
      assert.equal(transcribed.originalTranscript, "Hello from the recording.");
      assert.equal(transcribed.transcriptSource, "whisper");
      assert.equal(transcribed.transcriptModel, "base");

      const edited = await readJson(
        await fetch(`${baseUrl}/api/stories/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transcript: "Hello from the recording. I trimmed a pause." }),
        }),
      );
      assert.equal(edited.originalTranscript, "Hello from the recording.");
      assert.equal(edited.transcriptSource, "whisper");

      const removed = await fetch(`${baseUrl}/api/stories/${id}`, { method: "DELETE" });
      assert.equal(removed.status, 204);
      assert.equal(fs.readdirSync(audio.dir).length, 0);
    });
  } finally {
    database.close();
    audio.cleanup();
  }
});

test("refuses a recording when consent is missing and when Whisper is down", async () => {
  const audio = tempDir();
  let calls = 0;
  const fetchImpl: FetchLike = async () => {
    calls += 1;
    return new Response(
      JSON.stringify({
        error: "whisper_unavailable",
        message: "faster-whisper is not installed. No transcript was created.",
      }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  };
  const { app, database } = makeApp(audio.dir, fetchImpl);
  try {
    await withServer(app, async (baseUrl) => {
      const deniedStory = await readJson(
        await fetch(`${baseUrl}/api/stories`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ consent: false }),
        }),
      );
      const denied = await readJson(
        await fetch(`${baseUrl}/api/stories/${String(deniedStory.id)}/audio`, {
          method: "POST",
          headers: { "content-type": "audio/wav" },
          body: new Uint8Array(wav),
        }),
      );
      assert.equal(denied.error, "consent_required");

      const story = await readJson(
        await fetch(`${baseUrl}/api/stories`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ consent: true, transcript: "Typed before the recording." }),
        }),
      );
      const id = String(story.id);
      await fetch(`${baseUrl}/api/stories/${id}/audio`, {
        method: "POST",
        headers: { "content-type": "audio/wav" },
        body: new Uint8Array(wav),
      });
      const failed = await readJson(
        await fetch(`${baseUrl}/api/stories/${id}/transcribe`, { method: "POST" }),
      );
      assert.equal(failed.error, "whisper_unavailable");
      assert.equal(JSON.stringify(failed).includes("Hello"), false);

      const current = await readJson(await fetch(`${baseUrl}/api/stories/${id}`));
      assert.equal(current.transcript, "Typed before the recording.");
      assert.equal(current.transcriptSource, "manual");
      assert.equal(calls, 1);
    });
  } finally {
    database.close();
    audio.cleanup();
  }
});

test("keeps only excerpts that appear in the transcript", async () => {
  const audio = tempDir();
  const transcript = "My name in this demo is Sample Narrator. We lived near Demo Creek.";
  let calls = 0;
  const fetchImpl: FetchLike = async () => {
    calls += 1;
    const content =
      calls === 1
        ? {
            summary: "Sample Narrator mentions Demo Creek.",
            people: [
              {
                label: "Sample Narrator",
                excerpt: "My name in this demo is Sample Narrator.",
              },
              { label: "Invented Cousin", excerpt: "My cousin Invented Cousin visited." },
            ],
            places: [{ label: "Demo Creek", excerpt: "We lived near Demo Creek." }],
            moments: [],
            topics: [],
            unknowns: [],
          }
        : {
            summary: "They married in 1954.",
            people: [],
            places: [],
            moments: [],
            topics: [],
            unknowns: [],
          };
    return new Response(JSON.stringify({ message: { content: JSON.stringify(content) } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const { app, database } = makeApp(audio.dir, fetchImpl);
  try {
    await withServer(app, async (baseUrl) => {
      const story = await readJson(
        await fetch(`${baseUrl}/api/stories`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ consent: true, transcript }),
        }),
      );
      const id = String(story.id);
      const response = await fetch(`${baseUrl}/api/stories/${id}/insights`, { method: "POST" });
      const body = await readJson(response);
      assert.equal(response.status, 200);
      assert.equal(isRecord(body.insights), true);
      const insights = body.insights as Record<string, unknown>;
      assert.equal(insights.source, "ollama");
      assert.equal(insights.model, "gemma3");
      assert.equal(insights.edited, false);
      const people = insights.people as { label: string }[];
      assert.deepEqual(
        people.map((person) => person.label),
        ["Sample Narrator"],
      );
      assert.equal((insights.unknowns as string[]).includes(REMOVED_NOTE), true);

      const invented = await readJson(
        await fetch(`${baseUrl}/api/stories`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ consent: true, transcript: "We had soup." }),
        }),
      );
      const rejected = await readJson(
        await fetch(`${baseUrl}/api/stories/${String(invented.id)}/insights`, { method: "POST" }),
      );
      assert.equal(rejected.error, "ungrounded_insights");
      const unchanged = await readJson(await fetch(`${baseUrl}/api/stories/${String(invented.id)}`));
      assert.equal(unchanged.insights, null);
    });
  } finally {
    database.close();
    audio.cleanup();
  }
});

test("does not invent insights when Gemma is unavailable", async () => {
  const audio = tempDir();
  const { app, database } = makeApp(audio.dir);
  try {
    await withServer(app, async (baseUrl) => {
      const story = await readJson(
        await fetch(`${baseUrl}/api/stories`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ consent: true, transcript: "We had soup on Sundays." }),
        }),
      );
      const failed = await readJson(
        await fetch(`${baseUrl}/api/stories/${String(story.id)}/insights`, { method: "POST" }),
      );
      assert.equal(failed.error, "gemma_unavailable");
      assert.equal(JSON.stringify(failed).includes("summary"), false);
      const current = await readJson(await fetch(`${baseUrl}/api/stories/${String(story.id)}`));
      assert.equal(current.insights, null);

      const blocked = await readJson(
        await fetch(`${baseUrl}/api/stories/${String(story.id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            insights: {
              source: "ollama",
              model: "gemma3",
              edited: false,
              summary: "We had soup on Sundays.",
              people: [],
              places: [],
              moments: [],
              topics: [],
              unknowns: ["Nothing else is known."],
            },
          }),
        }),
      );
      assert.equal(blocked.error, "insights_not_generated");
    });
  } finally {
    database.close();
    audio.cleanup();
  }
});

test("labels the synthetic demo and does not call a model", async () => {
  const audio = tempDir();
  let calls = 0;
  const fetchImpl: FetchLike = async () => {
    calls += 1;
    throw new Error("offline");
  };
  const { app, database } = makeApp(audio.dir, fetchImpl);
  try {
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/stories/demo`, { method: "POST" });
      const story = await readJson(response);
      assert.equal(response.status, 201);
      assert.equal(story.demo, true);
      assert.equal(story.saved, true);
      assert.equal(story.transcriptSource, "demo");
      assert.equal(story.transcriptModel, null);
      assert.equal(isRecord(story.insights), true);
      const insights = story.insights as Record<string, unknown>;
      assert.equal(insights.source, "demo");
      assert.equal(insights.model, null);
      assert.match(String(insights.summary), /not produced by Gemma or Whisper/);
      assert.equal(calls, 0);

      const again = await fetch(`${baseUrl}/api/stories/${String(story.id)}/insights`, {
        method: "POST",
      });
      assert.equal(again.status, 200);
      assert.equal(calls, 0);

      const exported = await readJson(
        await fetch(`${baseUrl}/api/stories/${String(story.id)}/export`),
      );
      assert.match(String(exported.notice), /Synthetic demonstration/);

      const status = await readJson(await fetch(`${baseUrl}/api/status`));
      assert.equal(isRecord(status.transcription) && status.transcription.available, false);
      assert.equal(isRecord(status.gemma) && status.gemma.available, false);
      assert.match(JSON.stringify(status), /not model output/);
    });
  } finally {
    database.close();
    audio.cleanup();
  }
});
