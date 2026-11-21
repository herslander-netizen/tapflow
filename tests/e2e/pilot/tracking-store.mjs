const key = "tapflow.table-pilot.tracking.v1";
const ORDER = /^ord_[a-f0-9]{40}$/;
const TOKEN = /^tftrk_[A-Za-z0-9_-]{43}$/;
const valid = (value, now) => value && typeof value.id === "string" && ORDER.test(value.id) &&
  typeof value.token === "string" && TOKEN.test(value.token) &&
  Number.isSafeInteger(value.expiresAtMs) && value.expiresAtMs > now &&
  value.expiresAtMs - now <= 86_400_000;

export function createTrackingStore(storage, now = Date.now) {
  const clear = () => {
    try { storage?.removeItem(key); } catch { /* storage unavailable */ }
  };
  return {
    clear,
    load() {
      try {
        const value = JSON.parse(storage?.getItem(key) ?? "null");
        if (valid(value, now())) return { id: value.id, token: value.token, expiresAtMs: value.expiresAtMs };
      } catch { /* invalid or blocked */ }
      clear();
      return null;
    },
    save(id, { token, expiresAtMs } = {}) {
      const value = { id, token, expiresAtMs };
      if (!valid(value, now())) return false;
      try {
        if (!storage) return false;
        storage.setItem(key, JSON.stringify(value));
        return true;
      } catch { return false; }
    },
  };
}

/** Same-origin path; only the scoped order id is placed in the path, never a token. */
export function statusRequest(id, token) {
  if (typeof id !== "string" || !ORDER.test(id) || typeof token !== "string" || !TOKEN.test(token))
    throw new Error("Acompanhamento inválido.");
  return {
    path: "/v1/order-tracking/" + id,
    init: { method: "GET", cache: "no-store", credentials: "omit", redirect: "error",
      headers: { Authorization: "Bearer " + token, Accept: "application/json" } },
  };
}
