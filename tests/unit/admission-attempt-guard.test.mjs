import { test } from "node:test";
import { deepStrictEqual as eq, doesNotMatch, match, notEqual } from "node:assert/strict";
import { createAdmissionAttemptGuard } from "../../apps/api/admission-attempt-guard.mjs";

const trusted = { source: "cloudflare-verified-ingress", address: "192.0.2.44" };
const staff = { staffId: "fixture-staff", tenantId: "fixture-tenant", locationId: "fixture-location",
  permission: "issue_table_admission" };
const makeKey = () => crypto.subtle.importKey("raw", new Uint8Array(32).fill(42),
  { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
function limitedAfter(max) {
  const captured = [];
  const counts = new Map();
  return { captured, async limit({ key }) {
    captured.push(key);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return { success: counts.get(key) <= max };
  }};
}
async function make(options = {}) {
  const issueLimiter = limitedAfter(1), redeemLimiter = limitedAfter(1);
  const guard = createAdmissionAttemptGuard({ issueLimiter, redeemLimiter, key: await makeKey(), ...options });
  return { guard, issueLimiter, redeemLimiter };
}

test("edge admission counts denied attempts independently for issue/redeem; no raw address in limiter keys", async () => {
  const { guard, issueLimiter, redeemLimiter } = await make();
  eq(await guard.ingress("issue", trusted), { ok: true });
  eq(await guard.ingress("issue", trusted), { ok: false, status: 429 });
  eq(await guard.ingress("redeem", trusted), { ok: true });
  eq(await guard.ingress("redeem", trusted), { ok: false, status: 429 });
  eq(issueLimiter.captured[0], issueLimiter.captured[1]);
  eq(redeemLimiter.captured[0], redeemLimiter.captured[1]);
  notEqual(issueLimiter.captured[0].split(":").at(-1), redeemLimiter.captured[0].split(":").at(-1));
  for (const key of [...issueLimiter.captured, ...redeemLimiter.captured]) {
    match(key, /^admission:(issue|redeem):ingress:[0-9a-f]{64}$/);
    doesNotMatch(key, /192\.0\.2\.44/);
  }
});

test("missing trusted boundary, invalid input, and unverified staff fail before touching bindings", async () => {
  const { guard, issueLimiter, redeemLimiter } = await make();
  eq(await guard.ingress("redeem"), { ok: false, status: 503 });
  eq(await guard.ingress("redeem", { ...trusted, source: "x-forwarded-for" }), { ok: false, status: 503 });
  eq(await guard.ingress("redeem", { ...trusted, address: "192.0.2.44, 192.0.2.45" }), { ok: false, status: 503 });
  eq(await guard.ingress("unexpected", trusted), { ok: false, status: 503 });
  eq(await guard.staffIssue({ ...staff, permission: "other" }), { ok: false, status: 403 });
  eq(issueLimiter.captured, []);
  eq(redeemLimiter.captured, []);
});

test("trusted staff is scoped to tenant/location/actor; ingress bucket is separate", async () => {
  const { guard, issueLimiter } = await make();
  eq(await guard.ingress("issue", trusted), { ok: true });
  eq(await guard.staffIssue(staff), { ok: true });
  eq(await guard.staffIssue(staff), { ok: false, status: 429 });
  eq(await guard.staffIssue({ ...staff, tenantId: "fixture-tenant-b" }), { ok: true });
  eq(await guard.staffIssue({ ...staff, locationId: "fixture-location-b" }), { ok: true });
  eq(await guard.staffIssue({ ...staff, staffId: "fixture-staff-b" }), { ok: true });
  for (const key of issueLimiter.captured.slice(1)) {
    match(key, /^admission:issue:staff:[0-9a-f]{64}$/);
    doesNotMatch(key, /fixture/);
  }
});

test("absence, exception, malformed result, or missing key cannot open admission", async () => {
  for (const bindings of [
    { issueLimiter: undefined },
    { redeemLimiter: { async limit() { throw Error("private detail not surfaced"); } } },
    { redeemLimiter: { async limit() { return { success: "false" }; } } },
    { redeemLimiter: { async limit() {} } },
    { key: undefined },
    { key: await crypto.subtle.importKey("raw", new Uint8Array(32), { name:"HMAC", hash:"SHA-256" }, true, ["sign"]) },
  ]) {
    const { guard } = await make(bindings);
    eq(await guard.ingress("redeem", trusted), { ok: false, status: 503 });
  }
  const shared = limitedAfter(5);
  const { guard } = await make({ issueLimiter: shared, redeemLimiter: shared });
  eq(await guard.ingress("issue", trusted), { ok: false, status: 503 });
  eq(shared.captured, []);
});

test("alternate representations share a normalized edge bucket", async () => {
  const { guard } = await make();
  eq(await guard.ingress("redeem", { ...trusted, address: "2001:DB8:0:0:0:0:0:1" }), { ok: true });
  eq(await guard.ingress("redeem", { ...trusted, address: "2001:db8::1" }), { ok: false, status: 429 });
  eq(await guard.ingress("redeem", { ...trusted, address: "192.0.2.999" }), { ok: false, status: 503 });
});
