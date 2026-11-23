/** Read a bounded prefix even when an upstream ignores the HTTP Range header. */
export async function readArtifactPreviewBody(
  response: Response,
  limit: number,
) {
  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    return {
      bytes: buffer.slice(0, limit),
      truncated: buffer.byteLength > limit,
    };
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = limit - length;
      if (value.byteLength > remaining) {
        chunks.push(value.slice(0, remaining));
        length += remaining;
        truncated = true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
      length += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, truncated };
}
