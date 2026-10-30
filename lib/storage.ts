export type RecordEntry = {
  id: string;
  kind: string;
  value: unknown;
  updatedAt: string;
  revision: number;
  remoteRevision?: number;
  synced: boolean;
  owner: string;
};
const database = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("ruralclass", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("records", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
export async function records(owner = "demo") {
  const db = await database();
  try {
    return await new Promise<RecordEntry[]>((resolve, reject) => {
      const r = db.transaction("records").objectStore("records").getAll();
      r.onsuccess = () =>
        resolve((r.result as RecordEntry[]).filter((x) => x.owner === owner));
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function put(entry: RecordEntry) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction("records", "readwrite");
      t.objectStore("records").put(entry);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}
export async function save(
  kind: string,
  value: unknown,
  owner = "demo",
  id = crypto.randomUUID(),
) {
  id = `${owner}:${id}`;
  const prior = (await records(owner)).find((r) => r.id === id);
  const entry = {
    id,
    kind,
    value,
    owner,
    updatedAt: new Date().toISOString(),
    revision: (prior?.revision ?? 0) + 1,
    remoteRevision: prior?.remoteRevision ?? 0,
    synced: false,
  };
  await put(entry);
  return entry;
}
