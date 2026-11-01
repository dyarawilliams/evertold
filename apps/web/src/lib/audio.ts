export function fileMime(file: File): string {
  const reported = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (reported.startsWith("audio/")) {
    return reported;
  }
  switch (file.name.split(".").pop()?.toLowerCase()) {
    case "wav":
      return "audio/wav";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "webm":
      return "audio/webm";
    case "ogg":
      return "audio/ogg";
    case "aac":
      return "audio/aac";
    default:
      return reported || "application/octet-stream";
  }
}
