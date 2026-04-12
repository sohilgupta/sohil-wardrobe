// tests/setup.js
// Node 25 ships a built-in localStorage that lacks .clear()/.key() and
// shadows jsdom's implementation. Replace it with a minimal in-memory map
// so all tests that touch localStorage work consistently.
if (typeof localStorage === "undefined" || typeof localStorage.clear !== "function") {
  const store = new Map();
  globalThis.localStorage = {
    setItem(k, v)  { store.set(k, String(v)); },
    getItem(k)     { return store.has(k) ? store.get(k) : null; },
    removeItem(k)  { store.delete(k); },
    clear()        { store.clear(); },
    key(n)         { return [...store.keys()][n] ?? null; },
    get length()   { return store.size; },
  };
}
