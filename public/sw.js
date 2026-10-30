const CACHE = "ruralclass-v4";
const PAGES = [
  "/",
  "/dashboard",
  "/timetable",
  "/activities",
  "/replanning",
  "/assistant",
  "/analytics",
  "/simulation",
  "/portal",
  "/offline",
  "/impact",
  "/presentation",
  "/evaluation",
  "/icon.svg",
];
self.addEventListener("install", (e) =>
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PAGES))),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (
    e.request.method !== "GET" ||
    u.origin !== self.location.origin ||
    u.pathname.startsWith("/api/")
  )
    return;
  if (e.request.mode === "navigate") {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const response = await fetch(e.request);
          if (response.ok && PAGES.includes(u.pathname))
            await cache.put(u.pathname, response.clone());
          return response;
        } catch {
          return (await cache.match(u.pathname)) || Response.error();
        }
      }),
    );
    return;
  }
  if (u.pathname.startsWith("/_next/static/") || u.pathname === "/icon.svg")
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const old = await c.match(e.request);
        if (old) return old;
        const response = await fetch(e.request);
        if (response.ok) await c.put(e.request, response.clone());
        return response;
      }),
    );
});
