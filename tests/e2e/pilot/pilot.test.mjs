import { test } from "node:test";
import { deepStrictEqual as eq, match, ok, rejects, throws } from "node:assert/strict";
import { createPilotServer } from "./server.mjs";
import { createTrackingStore, statusRequest } from "./tracking-store.mjs";

const exampleId = "ord_" + "a".repeat(40), exampleToken = "tftrk_" + "A".repeat(43);
const storage = () => {
  const values = new Map();
  return { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k), values };
};
test("persist only a valid scoped tracking token, same-tab reload, not another tab's separate storage", () => {
  const sameTab = storage();
  const now = () => 1000;
  eq(createTrackingStore(sameTab, now).save(exampleId, { token: exampleToken, expiresAtMs: 2000 }), true);
  eq(createTrackingStore(sameTab, now).load(), { id: exampleId, token: exampleToken, expiresAtMs: 2000 });
  eq(createTrackingStore(storage(), now).load(), null);
  eq(createTrackingStore(sameTab, () => 2000).load(), null);
  eq(sameTab.values.size, 0);
});

test("corrupt/expired/unsafe values and blocked storage do not spill to URLs or storage alternatives", () => {
  const a = storage();
  const signer = createTrackingStore(a, () => 1000);
  eq(signer.save("/bad", { token: exampleToken, expiresAtMs: 2000 }), false);
  eq(signer.save(exampleId, { token: exampleToken, expiresAtMs: 1000 }), false);
  eq(signer.save(exampleId, { token: "Bearer other-kind", expiresAtMs: 2000 }), false);
  eq(signer.save(exampleId, { token: exampleToken, expiresAtMs: 2000 }), true);
  const name = [...a.values.keys()][0];
  a.setItem(name, "broken{");
  eq(signer.load(), null);
  eq(a.values.size, 0);
  eq(createTrackingStore(null).load(), null);
  const broken = { getItem() { throw Error(); }, removeItem() { throw Error(); }, setItem() { throw Error(); } };
  eq(createTrackingStore(broken, () => 1000).load(), null);
  eq(createTrackingStore(broken, () => 1000).save(exampleId, { token: exampleToken, expiresAtMs: 2000 }), false);
  const req = statusRequest(exampleId, exampleToken);
  match(req.path, /^\/v1\/order-tracking\/ord_[a-f0-9]+$/);
  ok(!req.path.includes(exampleToken));
  eq(req.init.credentials, "omit");
  eq(req.init.headers.Authorization, "Bearer " + exampleToken);
  throws(() => statusRequest(exampleId + "/../elsewhere", exampleToken));
});

test("loopback HTTP fixture goes through one exact table/order and read-only tracking grant", async (t) => {
  const { server, listen, fixture } = createPilotServer();
  const base = await listen();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const post = (path, payload, token, headers = {}) => fetch(base + path, {
    method: "POST", headers: { Origin: base, "Content-Type": "application/json",
      ...(token && { Authorization: "Bearer " + token }), ...headers },
    body: JSON.stringify(payload),
  });
  eq((await post("/v1/table-admissions", { tableId: "test-m" }, null, { Origin: "http://different.test" })).status, 403);
  const { code } = await (await post("/v1/table-admissions", { tableId: "test-m" })).json();
  const { token: session } = await (await post("/v1/order-sessions", { code })).json();
  eq((await post("/v1/order-sessions", { code })).status, 403);
  const cart = { lines: [{ itemId: "test-burger", quantity: 1, addonIds: ["test-cheese"] }] };
  eq((await post("/v1/quotes", cart)).status, 401);
  const quote = await (await post("/v1/quotes", cart, session)).json();
  eq(quote.total, 3200);
  const headers = { "Idempotency-Key": "pilot.test.001" };
  const order = await (await post("/v1/orders", cart, session, headers)).json();
  eq(order.total, quote.total);
  eq(order.persisted, true);
  const second = await (await post("/v1/orders", cart, session, headers)).json();
  eq(second.id, order.id);
  eq(Number(fixture.sql.prepare("SELECT count(*) n FROM orders").get().n), 1);
  const trackingPath = "/v1/order-tracking/" + order.id;
  const firstGrant = await post(trackingPath, {}, session);
  eq(firstGrant.status, 201);
  await firstGrant.body.cancel(); // response lost after commit
  const grant = await (await post(trackingPath, {}, session)).json();
  eq(await (await post(trackingPath, {}, session)).json(), grant);
  eq(Number(fixture.sql.prepare("SELECT count(*) n FROM order_tracking_tokens").get().n), 1);
  const {code:otherCode}=await (await post("/v1/table-admissions",{tableId:"test-m"})).json();
  const {token:otherSession}=await (await post("/v1/order-sessions",{code:otherCode})).json();
  eq((await post(trackingPath, {}, otherSession)).status, 404);
  eq((await fetch(base + trackingPath)).status, 404);
  // Reject any query, do not echo it or transfer it. The synthetic value is not a credential.
  eq((await fetch(base + trackingPath + "?token=not-a-token")).status, 400);
  eq((await post("/v1/orders", cart, grant.token, headers)).status, 401);
  const req = statusRequest(order.id, grant.token);
  const status = await (await fetch(base + req.path, req.init)).json();
  eq(Object.keys(status).sort(), ["id", "status", "updatedAt"]);
  eq(status.status, "submitted");
  fixture.sql.prepare("UPDATE orders SET status='preparing' WHERE id=?").run(order.id);
  eq((await (await fetch(base + req.path, req.init)).json()).status, "preparing");
  fixture.sql.exec("UPDATE order_tracking_tokens SET revoked_at_ms=issued_at_ms");
  eq((await fetch(base + req.path, req.init)).status, 404);
});
