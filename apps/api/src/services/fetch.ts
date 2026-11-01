export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export function defaultFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
