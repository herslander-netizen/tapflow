import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { createOrderApi } from "../../../apps/api/order-service.mjs";
import { createOrderAdmissionIssuer, createOrderAdmissionRedeemer } from "../../../apps/api/order-admission.mjs";
import { createOrderSessionAuthorizer } from "../../../apps/api/order-session.mjs";
import { createOrderTracking } from "../../../apps/api/order-tracking.mjs";

const order = "ord_[a-f0-9]{40}";
const staticFiles = {
  "/": ["pilot.html", "text/html"], "/pilot.css": ["pilot.css", "text/css"],
  "/pilot.mjs": ["pilot.mjs", "text/javascript"], "/tracking-store.mjs": ["tracking-store.mjs", "text/javascript"],
};

export function createFixture() {
  const sql = new DatabaseSync(":memory:");
  for (const name of ["0001_schema", "0003_order_sessions", "0004_order_admissions",
    "0005_order_admission_issue_index", "0006_order_tracking_tokens"]) {
    sql.exec(readFileSync(new URL(`../../../infra/free-stack/d1/${name}.sql`, import.meta.url), "utf8"));
  }
  sql.exec(`
    INSERT INTO tenants (id, slug, name, status) VALUES ('test-t','local','Cozinha local fictícia','active');
    INSERT INTO locations (id,tenant_id,name,status) VALUES ('test-l','test-t','Unidade local','active');
    INSERT INTO dining_tables (id,tenant_id,location_id,label,is_active) VALUES ('test-m','test-t','test-l','Mesa 04',1);
    INSERT INTO menu_items (id,tenant_id,location_id,name,price_cents,availability)
      VALUES ('test-burger','test-t','test-l','Smash do piloto',2800,'available');
    INSERT INTO menu_addons (id,tenant_id,menu_item_id,name,price_cents)
      VALUES ('test-cheese','test-t','test-burger','Queijo extra',400);
  `);
  const db = {
    prepare(query) {
      const statement = sql.prepare(query);
      return { bind(...values) { return {
        first: async () => statement.get(...values),
        all: async () => ({ results: statement.all(...values) }),
        runBatch: () => query.startsWith("SELECT")
          ? { results: statement.all(...values) }
          : { meta: { changes: Number(statement.run(...values).changes) } },
      }; } };
    },
    async batch(statements) {
      sql.exec("BEGIN");
      try { const value = statements.map(s => s.runBatch()); sql.exec("COMMIT"); return value; }
      catch (error) { sql.exec("ROLLBACK"); throw error; }
    },
  };
  const secretFixtureIdentity = Symbol("only local fixture");
  const issue = createOrderAdmissionIssuer({
    db, requireCurrentStaffMembership:false, authorizeStaff: async (ctx, permission) => ctx === secretFixtureIdentity && ({
      staffId: "fixture-staff", tenantId: "test-t", locationId: "test-l", permission,
    }),
  });
  const redeem = createOrderAdmissionRedeemer({ db });
  const authorizeSession = createOrderSessionAuthorizer({ db });
  const handleOrder = createOrderApi({ db, enabled: true, authorizeSession });
  const tracking = createOrderTracking({ db, enabled: true });
  return { sql, issue: () => issue(secretFixtureIdentity, "test-m"), redeem, handleOrder, tracking };
}

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: {
  "content-type": "application/json; charset=utf-8",
} });
const fail = (status, error) => json(status, { error });

async function dispatch(req, fixture) {
  const { pathname, search, hash } = new URL(req.url);
  if (search || hash) return fail(400, "Abra a jornada sem parâmetros.");
  if (Object.hasOwn(staticFiles, pathname) && req.method === "GET") {
    const [file, type] = staticFiles[pathname];
    return new Response(readFileSync(new URL(file, import.meta.url)), {
      headers: { "content-type": type + "; charset=utf-8" },
    });
  }
  if (pathname === "/v1/table-admissions" && req.method === "POST") {
    const data = await req.json().catch(() => null);
    if (data?.tableId !== "test-m") return fail(404, "Mesa fictícia não encontrada.");
    const grant = await fixture.issue();
    return grant ? json(201, grant) : fail(429, "Aguarde antes de simular outro atendimento.");
  }
  if (pathname === "/v1/order-sessions" && req.method === "POST") {
    const data = await req.json().catch(() => null);
    const grant = await fixture.redeem(data?.code);
    return grant ? json(201, grant) : fail(403, "Código indisponível, expirado ou já usado.");
  }
  const find = pathname.match(new RegExp(`^/v1/order-tracking/(${order})$`));
  if (find && req.method === "GET") {
    const result = await fixture.tracking.read(req, find[1]);
    return result ? json(200, result) : fail(404, "Acompanhamento indisponível.");
  }
  if (find && req.method === "POST") {
    const grant = await fixture.tracking.issue(req, find[1]);
    return grant ? json(201, grant) : fail(404, "Não foi possível emitir o acompanhamento.");
  }
  if (["/v1/quotes", "/v1/orders"].includes(pathname) && req.method === "POST")
    return fixture.handleOrder(req);
  return fail(404, "Rota não existe no piloto.");
}

export function createPilotServer(port = 0) {
  const fixture = createFixture();
  const server = createServer(async (incoming, outgoing) => {
    let response;
    try {
      const expectedHost = `127.0.0.1:${server.address().port}`;
      const origin = "http://" + expectedHost;
      const method = incoming.method;
      if (incoming.headers.host !== expectedHost || !incoming.url?.startsWith("/") ||
          incoming.url.startsWith("//")) response = fail(403, "Apenas loopback.");
      else if (method !== "GET" && method !== "POST") response = fail(405, "Método não permitido.");
      else if ((incoming.headers.origin && incoming.headers.origin !== origin) ||
          (method === "POST" && (incoming.headers.origin !== origin ||
            !["same-origin", undefined].includes(incoming.headers["sec-fetch-site"])))) {
        response = fail(403, "Origem não autorizada.");
      } else {
        const body = [];
        let length = 0;
        for await (const data of incoming) {
          length += data.length;
          if (length > 12 * 1024) break;
          body.push(data);
        }
        if (length > 12 * 1024) response = fail(413, "Corpo muito grande.");
        else {
          const bytes = Buffer.concat(body);
          if (method === "POST" && (incoming.headers["content-type"] ?? "").split(";")[0] !== "application/json")
            response = fail(415, "Use application/json.");
          else if (method === "GET" && bytes.length) response = fail(400, "GET sem corpo.");
          else response = await dispatch(new Request(origin + incoming.url, {
            method, headers: incoming.headers,
            ...(method === "POST" ? { body: bytes } : {}),
          }), fixture);
        }
      }
    } catch { response = fail(503, "Serviço local indisponível."); }
    const headers = Object.fromEntries(response.headers.entries());
    outgoing.writeHead(response.status, { ...headers,
      "cache-control": "no-store", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff",
      "cross-origin-opener-policy": "same-origin", "x-frame-options": "DENY",
      "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    });
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  });
  server.on("close", () => fixture.sql.close());
  return {
    server, fixture,
    listen: () => new Promise((resolve, reject) => server.once("error", reject).listen(port, "127.0.0.1",
      () => resolve(`http://127.0.0.1:${server.address().port}`))),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const origin = await createPilotServer(8766).listen();
  console.log("TapFlow • laboratório local (sem pagamentos): " + origin);
}
