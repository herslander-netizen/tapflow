/** Best-effort Cloudflare edge brake. Never replaces D1 issuance/consumption limits. */
const allowed = Object.freeze({ ok: true });
const limited = Object.freeze({ ok: false, status: 429 });
const unavailable = Object.freeze({ ok: false, status: 503 });
const forbidden = Object.freeze({ ok: false, status: 403 });
const id = (v) => typeof v === "string" && /^[A-Za-z0-9_.:-]{1,128}$/.test(v);
const actionIsKnown = (v) => v === "issue" || v === "redeem";
const encoder = new TextEncoder();

function normalizeEdgeAddress(value) {
  // The caller must establish provenance; normalizing does not authenticate an address.
  if (typeof value !== "string" || value.length > 45) return null;
  if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(value)) {
    const parts = value.split(".").map(Number);
    return parts.every((part) => part <= 255) ? parts.join(".") : null;
  }
  if (!value.includes(":") || !/^[0-9A-Fa-f:.]+$/.test(value)) return null;
  try { return new URL(`https://[${value}]`).hostname; } catch { return null; }
}

function validKey(key) {
  return key?.type === "secret" && key.extractable === false && key.algorithm?.name === "HMAC" &&
    key.algorithm?.hash?.name === "SHA-256" && key.algorithm.length >= 256 && key.usages?.includes("sign");
}

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), (x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Bindings must use separate namespace IDs in the actual Worker.
 * No Request or untrusted headers are read here. Do not pass identities from JSON,
 * cookies or caller-controlled headers. The boundary owns source/provenance checks.
 */
export function createAdmissionAttemptGuard({ issueLimiter, redeemLimiter, key } = {}) {
  async function check(action, dimension, parts) {
    if (issueLimiter === redeemLimiter || typeof issueLimiter?.limit !== "function" ||
        typeof redeemLimiter?.limit !== "function" || !validKey(key)) return unavailable;
    const binding = action === "issue" ? issueLimiter : redeemLimiter;
    try {
      const material = encoder.encode(JSON.stringify(["tapflow-admission-edge-v1", action, dimension, ...parts]));
      const digest = hex(await crypto.subtle.sign("HMAC", key, material));
      const outcome = await binding.limit({ key: `admission:${action}:${dimension}:${digest}` });
      if (outcome?.success === true) return allowed;
      if (outcome?.success === false) return limited;
      return unavailable;
    } catch {
      return unavailable;
    }
  }

  return {
    /**
     * For either action, call before reading payload, checking an admission code
     * or invoking staff auth. Accepts only a canonical address from trusted edge ingress.
     */
    ingress(action, { source, address } = {}) {
      if (!actionIsKnown(action) || source !== "cloudflare-verified-ingress")
        return Promise.resolve(unavailable);
      const normalized = normalizeEdgeAddress(address);
      return normalized ? check(action, "ingress", [normalized]) : Promise.resolve(unavailable);
    },

    /**
     * Only after existing authorizeStaff has verified credentials and resolved
     * permissions. Uses the exact result of that trusted function below.
     */
    staffIssue(staff) {
      if (staff?.permission !== "issue_table_admission" ||
          ![staff.staffId, staff.tenantId, staff.locationId].every(id)) return Promise.resolve(forbidden);
      return check("issue", "staff", [staff.tenantId, staff.locationId, staff.staffId]);
    },
  };
}
