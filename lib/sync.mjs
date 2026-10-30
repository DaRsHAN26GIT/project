// Local edits use a separate revision counter from the last acknowledged server revision.
export function syncDecision(local, remote) {
  const expected = local.remoteRevision ?? 0;
  if (!remote)
    return expected === 0
      ? { action: "write", expected }
      : { action: "conflict" };
  if (remote.revision !== expected) return { action: "conflict" };
  return { action: "write", expected };
}
