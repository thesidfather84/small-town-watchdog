/**
 * Returns true only if the given URL is a valid external http/https link.
 * Guards against: undefined, null, "", "#", relative paths like "/source/123".
 */
export function isValidSourceUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
