export async function readJsonRequest(
  request: Request,
  limit = 48000,
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw Error("Empty request.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw Object.assign(Error("Request too large."), { status: 413 });
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
