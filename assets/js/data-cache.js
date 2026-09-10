(function initOpenTennisCache(root, factory) {
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.OPEN_TENNIS_CACHE = api;
})(typeof window !== "undefined" ? window : null, function createDefaultCache(root) {
  "use strict";

  const STORAGE_PREFIX = "openTennisDataCacheV1:";

  function createDataCache(runtime) {
    const memory = new Map();

    function hash(value) {
      let result = 2166136261;
      const text = String(value || "");
      for (let index = 0; index < text.length; index++) {
        result ^= text.charCodeAt(index);
        result = Math.imul(result, 16777619);
      }
      return (result >>> 0).toString(36);
    }

    function key(url) {
      return STORAGE_PREFIX + hash(url);
    }

    function read(url) {
      if (memory.has(url)) return memory.get(url);
      try {
        const raw = runtime && runtime.localStorage
          ? runtime.localStorage.getItem(key(url))
          : null;
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (entry.url !== url || typeof entry.text !== "string") return null;
        memory.set(url, entry);
        return entry;
      } catch (error) {
        return null;
      }
    }

    function write(url, text) {
      const entry = { url, text: String(text), updatedAt: Date.now() };
      memory.set(url, entry);
      try {
        if (runtime && runtime.localStorage) {
          runtime.localStorage.setItem(key(url), JSON.stringify(entry));
        }
      } catch (error) {
        // La memoria mantiene la sesión rápida aunque el navegador limite el almacenamiento.
      }
      return entry;
    }

    function notify(state) {
      if (!runtime || typeof runtime.dispatchEvent !== "function") return;
      try {
        const event = typeof runtime.CustomEvent === "function"
          ? new runtime.CustomEvent("open-tennis:data-status", { detail: state })
          : { type: "open-tennis:data-status", detail: state };
        runtime.dispatchEvent(event);
      } catch (error) {
        // El aviso es complementario; la carga de datos no debe depender de él.
      }
    }

    async function fetchFresh(url) {
      if (!runtime || typeof runtime.fetch !== "function") {
        throw new Error("No hay conexión disponible");
      }
      const response = await runtime.fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo actualizar la información");
      return response.text();
    }

    async function refreshMany(urls, previousEntries) {
      try {
        const texts = await Promise.all(urls.map(fetchFresh));
        const changed = texts.some((text, index) => !previousEntries[index] || previousEntries[index].text !== text);
        const entries = texts.map((text, index) => write(urls[index], text));
        notify({ available: true });
        return {
          texts,
          entries,
          changed,
          source: "network",
          updatedAt: Math.max(...entries.map(entry => entry.updatedAt))
        };
      } catch (error) {
        notify({ available: false, cached: previousEntries.every(Boolean) });
        throw error;
      }
    }

    async function loadMany(urls) {
      const normalizedUrls = (urls || []).map(url => String(url));
      const previousEntries = normalizedUrls.map(read);
      const hasCompleteCache = previousEntries.every(Boolean);
      const refresh = refreshMany(normalizedUrls, previousEntries);

      if (hasCompleteCache) {
        return {
          texts: previousEntries.map(entry => entry.text),
          entries: previousEntries,
          changed: false,
          source: "cache",
          updatedAt: Math.max(...previousEntries.map(entry => Number(entry.updatedAt || 0))),
          refresh: refresh.catch(() => null)
        };
      }

      const fresh = await refresh;
      return Object.assign({}, fresh, { refresh: Promise.resolve(null) });
    }

    async function getText(url) {
      const result = await loadMany([url]);
      return result.texts[0];
    }

    function peek(url) {
      const entry = read(String(url));
      return entry ? entry.text : null;
    }

    return { loadMany, getText, peek };
  }

  const api = createDataCache(root);
  api.createDataCache = createDataCache;
  return api;
});
