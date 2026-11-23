/** Lossless, explicitly tagged observations. No value is an identity by its shape. */
export type JsonWire =
  | ["null"]
  | ["boolean", boolean]
  | ["number", string]
  | ["string", string]
  | ["array", JsonWire[]]
  | ["object", [string, JsonWire][]];

export type WireUrl = {
  origin: ["app"] | ["external", string];
  path: string[];
  query: string;
};

export type WireBody =
  | ["not-exposed"]
  | ["json", JsonWire]
  | ["bytes", string]
  | ["multipart", (["bytes", string] | ["delimiter", boolean])[]];

export type WireContentType =
  ["absent"] | ["literal", string] | ["multipart-boundary", string, string];

export function projectUrl(url: string, appBase?: string): WireUrl | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!parsed.pathname.startsWith("/api/")) return null;
  if (parsed.username || parsed.password)
    throw new Error("Capture cannot record credentials embedded in an API URL");
  const appOrigin = appBase === undefined ? undefined : new URL(appBase).origin;
  // href preserves a bare '?' and query escaping; URLSearchParams would decode
  // before comparison and sorting would erase order between duplicate entries.
  const suffix = parsed.href.slice(`${parsed.origin}${parsed.pathname}`.length);
  return {
    origin: parsed.origin === appOrigin ? ["app"] : ["external", parsed.origin],
    path: parsed.pathname.split("/"),
    query: suffix.split("#", 1)[0]!,
  };
}

/** JSON.parse validates syntax; this small reader preserves the original numbers
 * and duplicate-key rejection. It does not construct user-keyed JS objects. */
function jsonWire(text: string): JsonWire {
  JSON.parse(text);
  let at = 0;
  const whitespace = () => {
    while (/\s/.test(text[at] ?? "") && at < text.length) at += 1;
  };
  const string = (): string => {
    const start = at++;
    while (text[at] !== '"') at += text[at] === "\\" ? 2 : 1;
    at += 1;
    return JSON.parse(text.slice(start, at)) as string;
  };
  const value = (): JsonWire => {
    whitespace();
    if (text[at] === '"') return ["string", string()];
    if (text[at] === "{") {
      at += 1;
      const entries: [string, JsonWire][] = [];
      const keys = new Set<string>();
      whitespace();
      while (text[at] !== "}") {
        const key = string();
        if (keys.has(key)) throw new Error("Duplicate JSON key");
        keys.add(key);
        whitespace();
        at += 1; // ':'; validated above
        entries.push([key, value()]);
        whitespace();
        if (text[at] === "}") break;
        at += 1;
        whitespace();
      }
      at += 1;
      entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return ["object", entries];
    }
    if (text[at] === "[") {
      at += 1;
      const items: JsonWire[] = [];
      whitespace();
      while (text[at] !== "]") {
        items.push(value());
        whitespace();
        if (text[at] === "]") break;
        at += 1;
      }
      at += 1;
      return ["array", items];
    }
    const match =
      /^(?:null|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
        text.slice(at),
      );
    if (!match) throw new Error("Invalid JSON token");
    const token = match[0];
    at += token.length;
    if (token === "null") return ["null"];
    if (token === "true" || token === "false")
      return ["boolean", token === "true"];
    return ["number", token];
  };
  return value();
}

/** Body and Content-Type must agree on the *same* validated boundary. Delimiters
 * are tagged separately from payload bytes, never replaced by a sentinel that
 * could also occur in a file. Everything except that delimiter stays literal. */
export function projectBody(
  raw: Uint8Array | null,
  contentType?: string,
): { body: WireBody; contentType: WireContentType } {
  const header: WireContentType =
    contentType === undefined ? ["absent"] : ["literal", contentType];
  if (raw === null) return { body: ["not-exposed"], contentType: header };
  const bytes = Buffer.from(raw);
  if (contentType && /^multipart\/form-data(?:\s*;|$)/i.test(contentType)) {
    const matches = [
      ...contentType.matchAll(/(?:^|;)\s*boundary=("([^"\r\n]+)"|([^;\s]+))/gi),
    ];
    const match = matches.length === 1 ? matches[0] : undefined;
    const boundary = match?.[2] ?? match?.[3];
    if (
      match &&
      boundary &&
      boundary.length <= 70 &&
      /^[\x20-\x7e]+$/.test(boundary)
    ) {
      const wire = bytes.toString("latin1");
      const marker = `--${boundary}`;
      if (
        wire.split("\r\n").filter((line) => line === `${marker}--`).length ===
          1 &&
        wire.startsWith(`${marker}\r\n`) &&
        (wire.endsWith(`\r\n${marker}--\r\n`) ||
          wire.endsWith(`\r\n${marker}--`))
      ) {
        const parts: (["bytes", string] | ["delimiter", boolean])[] = [];
        let chunk = "";
        const lines = wire.split("\r\n");
        for (const [index, line] of lines.entries()) {
          if (line === marker || line === `${marker}--`) {
            if (chunk)
              parts.push([
                "bytes",
                Buffer.from(chunk, "latin1").toString("base64"),
              ]);
            parts.push(["delimiter", line === `${marker}--`]);
            chunk = "";
          } else chunk += line;
          if (index < lines.length - 1) chunk += "\r\n";
        }
        if (chunk)
          parts.push([
            "bytes",
            Buffer.from(chunk, "latin1").toString("base64"),
          ]);
        const start = match.index! + match[0].length - match[1]!.length;
        return {
          body: ["multipart", parts],
          contentType: [
            "multipart-boundary",
            contentType.slice(0, start),
            contentType.slice(start + match[1]!.length),
          ],
        };
      }
    }
  }
  const text = bytes.toString("utf8");
  if (
    contentType &&
    /^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json(?:\s*;|$)/i.test(
      contentType,
    ) &&
    Buffer.from(text, "utf8").equals(bytes)
  ) {
    try {
      return { body: ["json", jsonWire(text)], contentType: header };
    } catch {
      // Invalid/duplicate-key JSON is still fully comparable as original bytes.
    }
  }
  return { body: ["bytes", bytes.toString("base64")], contentType: header };
}
