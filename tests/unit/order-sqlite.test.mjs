import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { createOrderApi } from "../../apps/api/order-service.mjs";
import { createOrderSessionAuthorizer } from "../../apps/api/order-session.mjs";

const schema = readFileSync(new URL("../../infra/free-stack/d1/0001_schema.sql", import.meta.url), "utf8");
const sessionsSchema = readFileSync(new URL("../../infra/free-stack/d1/0003_order_sessions.sql", import.meta.url), "utf8");
const cart = { lines: [{ itemId: "item-a", quantity: 2, addonIds: ["addon-a"] }] };
const session = { tenantId: "tenant-a", locationId: "loc-a", tableId: "table-a", sessionHash: "a".repeat(64) };

function setup(t, { beforeBatch } = {}) {
  const sql = new DatabaseSync(":memory:");
  t.after(() => sql.close());
  sql.exec(schema);
  sql.exec(sessionsSchema);
  sql.exec(`
    INSERT INTO tenants (id, slug, name, status) VALUES
      ('tenant-a', 'test-a', 'Cozinha fictícia A', 'active'), ('tenant-b', 'test-b', 'Cozinha fictícia B', 'active');
    INSERT INTO locations (id, tenant_id, name, status) VALUES
      ('loc-a', 'tenant-a', 'Unidade fictícia A', 'active'), ('loc-b', 'tenant-b', 'Unidade fictícia B', 'active');
    INSERT INTO dining_tables (id, tenant_id, location_id, label, is_active) VALUES
      ('table-a', 'tenant-a', 'loc-a', 'Mesa fictícia A', 1), ('table-b', 'tenant-b', 'loc-b', 'Mesa fictícia B', 1);
    INSERT INTO menu_items (id, tenant_id, location_id, name, price_cents, availability) VALUES
      ('item-a', 'tenant-a', 'loc-a', 'Item fictício A', 2500, 'available'),
      ('item-b', 'tenant-b', 'loc-b', 'Item fictício B', 1, 'available');
    INSERT INTO menu_addons (id, tenant_id, menu_item_id, name, price_cents) VALUES
      ('addon-a', 'tenant-a', 'item-a', 'Adicional fictício A', 400);
  `);
  sql.prepare(`INSERT INTO order_sessions(session_hash,tenant_id,location_id,table_id,expires_at_ms)
    VALUES (?,?,?,?,?)`).run(session.sessionHash, session.tenantId, session.locationId, session.tableId, Date.now()+60000);
  const db = {
    prepare(query) {
      const statement = sql.prepare(query);
      return { bind(...args) {
        return { query, first: async () => statement.get(...args),
          all: async () => ({results: statement.all(...args)}),
          execute: () => /^SELECT\b/.test(query)
            ? {results: statement.all(...args)}
            : {meta: {changes: Number(statement.run(...args).changes)}} };
      }};
    },
    async batch(statements) {
      if (beforeBatch) beforeBatch(sql);
      sql.exec("BEGIN");
      try {
        const result = statements.map(statement => statement.execute());
        sql.exec("COMMIT");
        return result;
      } catch (error) {
        sql.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const api = (context = session) => createOrderApi({ db, enabled: true, authorizeSession: async () => context });
  const counts = () => ["orders", "order_idempotency", "order_lines", "order_events"].map(table =>
    sql.prepare("SELECT count(*) AS n FROM " + table).get().n);
  return { api, counts, db, sql };
}
function post(payload = cart, key = "order-fixture-001") {
  return new Request("https://tapflow.example/v1/orders", {
    method: "POST", headers: {"content-type":"application/json", "idempotency-key":key},
    body: JSON.stringify(payload),
  });
}

test("SQL canônico: solicitações simultâneas geram um único pedido, linha e evento", async t => {
  const { api, counts } = setup(t);
  const requests = await Promise.all(Array.from({length: 6}, () => api()(post())));
  const results = await Promise.all(requests.map(response => response.json()));
  assert.deepEqual(requests.map(response => response.status).sort(), [200, 200, 200, 200, 200, 201]);
  assert.equal(new Set(results.map(result => result.id)).size, 1);
  assert.ok(results.every(result => result.total === 5800 && result.paymentStatus === "not_required"));
  assert.deepEqual(counts(), [1, 1, 1, 1]);
});

test("SQL canônico: duas cargas simultâneas com a mesma chave deixam só o pedido vencedor", async t => {
  const { api, counts } = setup(t);
  const alternate = { lines: [{ itemId: "item-a", quantity: 1, addonIds: [] }] };
  const responses = await Promise.all([api()(post()), api()(post(alternate))]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  assert.deepEqual(counts(), [1, 1, 1, 1]);
});

test("SQL canônico: mudança de preço entre cotação e gravação não deixa registro parcial", async t => {
  const { api, counts } = setup(t, {
    beforeBatch: sql => sql.exec("UPDATE menu_items SET price_cents = 3100 WHERE id = 'item-a'"),
  });
  assert.equal((await api()(post())).status, 409);
  assert.deepEqual(counts(), [0, 0, 0, 0]);
});

test("SQL canônico: falha ao registrar o evento desfaz todo o pedido", async t => {
  const { api, counts } = setup(t, {
    beforeBatch: sql => sql.exec(`CREATE TRIGGER reject_event BEFORE INSERT ON order_events
      BEGIN SELECT RAISE(ABORT, 'fixture-event-failure'); END;`),
  });
  assert.equal((await api()(post())).status, 503);
  assert.deepEqual(counts(), [0, 0, 0, 0]);
});

test("SQL canônico: item e pedido alheios não vazam através do endpoint", async t => {
  const { api, counts } = setup(t);
  const wrongItem = { lines: [{ itemId: "item-b", quantity: 1, addonIds: [] }] };
  assert.equal((await api()(post(wrongItem))).status, 422);
  const saved = await (await api()(post())).json();
  const get = () => new Request("https://tapflow.example/v1/orders/" + saved.id);
  const other = { tenantId:"tenant-b", locationId:"loc-b", tableId:"table-b", sessionHash:"b".repeat(64) };
  assert.equal((await api()(get())).status, 200);
  assert.equal((await api(other)(get())).status, 404);
  assert.deepEqual(counts(), [1, 1, 1, 1]);
});

test("sessão opaca e SQL real: revogação bloqueia criação e leitura, sem afetar pedido já gravado", async t => {
  const { db, sql, counts } = setup(t);
  const now = Date.now(), token = "q".repeat(43);
  const hash = createHash("sha256").update(token).digest("hex");
  sql.prepare(`INSERT INTO order_sessions(session_hash,tenant_id,location_id,table_id,expires_at_ms)
    VALUES (?,?,?,?,?)`).run(hash, session.tenantId, session.locationId, session.tableId, now + 60000);
  const api = createOrderApi({ db, enabled: true, authorizeSession: createOrderSessionAuthorizer({ db, now: () => now }) });
  const send = (key) => {
    const req = post(cart, key);
    req.headers.set("authorization", "Bearer " + token);
    return api(req);
  };
  const accepted = await send("session-first-001");
  assert.equal(accepted.status, 201);
  const acceptedOrder = await accepted.json();
  assert.equal(acceptedOrder.total, 5800);
  sql.prepare("UPDATE order_sessions SET revoked_at_ms=? WHERE session_hash=?").run(now, hash);
  assert.equal((await send("session-second-001")).status, 401);
  assert.equal((await api(new Request("https://tapflow.example/v1/orders/" + acceptedOrder.id, {
    headers: { authorization: "Bearer " + token },
  }))).status, 401);
  assert.deepEqual(counts(), [1, 1, 1, 1]);
});

for (const [condition, update] of [
  ["revogação", "UPDATE order_sessions SET revoked_at_ms=1"],
  ["expiração", "UPDATE order_sessions SET expires_at_ms=1"],
]) {
  test(`SQL canônico: ${condition} depois de autorizar impede gravação atômica`, async t => {
    const { api, counts } = setup(t, {beforeBatch: sql => sql.exec(update)});
    assert.equal((await api()(post())).status, 409);
    assert.deepEqual(counts(), [0, 0, 0, 0]);
  });
}
