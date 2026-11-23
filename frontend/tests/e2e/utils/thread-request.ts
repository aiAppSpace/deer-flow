/** Thread identities occupy a complete, URL-decoded path segment. */
export function threadIdFromRequest(url: string): string | undefined {
  const segments = new URL(url).pathname.split("/");
  const index = segments.indexOf("threads");
  if (index < 0 || !segments[index + 1]) return undefined;
  return decodeURIComponent(segments[index + 1]!);
}
