export type RecordMode = "record" | "upload" | "write";

export type Route =
  | { name: "dashboard" }
  | { name: "record"; mode: RecordMode }
  | { name: "library" }
  | { name: "story"; id: string }
  | { name: "not-found" };

export function parseRoute(pathname: string, search = ""): Route {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (path === "" || path === "/") {
    return { name: "dashboard" };
  }
  if (path === "/record") {
    return { name: "record", mode: parseMode(new URLSearchParams(search).get("mode")) };
  }
  if (path === "/library") {
    return { name: "library" };
  }
  const story = /^\/stories\/([^/]+)$/.exec(path);
  if (story?.[1]) {
    return { name: "story", id: decodeURIComponent(story[1]) };
  }
  return { name: "not-found" };
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case "dashboard":
      return "/";
    case "record":
      return route.mode === "record" ? "/record" : `/record?mode=${route.mode}`;
    case "library":
      return "/library";
    case "story":
      return `/stories/${encodeURIComponent(route.id)}`;
    case "not-found":
      return "/";
    default: {
      const neverRoute: never = route;
      return neverRoute;
    }
  }
}

function parseMode(value: string | null): RecordMode {
  switch (value) {
    case "upload":
    case "write":
    case "record":
      return value;
    default:
      return "record";
  }
}
