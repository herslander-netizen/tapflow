const BASE = "/v1/merchant/kitchen";
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const TOKEN = /^[A-Za-z0-9_.~-]{1,8192}$/;
const statusNames = Object.freeze({
  submitted: "Recebido", accepted: "Aceito", preparing: "Em preparo", ready: "Pronto",
  completed: "Concluído", rejected: "Recusado", cancelled: "Cancelado",
});
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const array = (value) => Array.isArray(value) ? value : [];
const key = encodeURIComponent;
const text = (value, empty = "") => typeof value === "string" ? value : empty;
const validId = (value) => typeof value === "string" && ID.test(value);
const known = (status) => typeof status === "string" && Object.hasOwn(statusNames, status);
const money = (cents, currency) =>
  currency === "BRL" && Number.isSafeInteger(cents) ? brl.format(cents / 100) : "Valor não informado";
const time = (value) => {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? date.format(parsed) : "Horário não informado";
};
const httpMessage = (status) => {
  if (status === 401) return "Sessão expirada ou inválida. Entre novamente pelo acesso autorizado.";
  if (status === 403 || status === 404) return "O painel ou esta unidade não está disponível para sua conta.";
  if (status === 409) return "O pedido mudou em outra sessão. Atualize a lista antes de agir de novo.";
  if (status === 429) return "Muitas solicitações. Tente novamente em instantes.";
  return "Não foi possível concluir. Atualize para conferir o estado antes de repetir a ação.";
};

/** Session provider intentionally injected by a trusted host or synthetic test. */
export function mountKitchen({
  document: doc = document,
  root = doc,
  origin = location.origin,
  fetch: transport = fetch,
  getAccessToken,
} = {}) {
  if (typeof getAccessToken !== "function") return false;
  const $ = (id) => root.querySelector("#" + id);
  let disposed = false;
  const lifecycle = new (doc.defaultView?.AbortController ?? AbortController)();
  const listen = (node,type,fn) => node.addEventListener(type,fn,{signal:lifecycle.signal});
  const panel = $("kitchen-panel"), tenantSelect = $("kitchen-tenant"), locationSelect = $("kitchen-location");
  const orderList = $("kitchen-orders"), refreshButton = $("kitchen-refresh"), empty = $("kitchen-empty");
  let units = [], orders = [], busy = false;
  const details = new Map();
  const invalidActions = new Set();
  const say = (message) => { if (!disposed) $("kitchen-status").textContent = message; };
  function error(message = "") {
    if (disposed) return;
    const box = $("kitchen-error");
    box.textContent = message;
    box.hidden = !message;
  }
  function element(tag, value, className) {
    const node = doc.createElement(tag);
    if (value !== undefined) node.textContent = value;
    if (className) node.className = className;
    return node;
  }
  function options(select, rows, keep, placeholder) {
    const first = element("option", placeholder);
    first.value = "";
    select.replaceChildren(first);
    for (const [id, name] of rows) {
      const option = element("option", name);
      option.value = id;
      select.append(option);
    }
    if ([...select.options].some((entry) => entry.value === keep)) select.value = keep;
  }
  const route = (id = "") =>
    `${BASE}/${key(tenantSelect.value)}/${key(locationSelect.value)}/orders${id ? "/" + key(id) : ""}`;

  async function api(path, method = "GET", data) {
    if (disposed) throw new Error("Sessão encerrada.");
    let token;
    try { token = await getAccessToken(); } catch { token = null; }
    if (disposed || typeof token !== "string" || !TOKEN.test(token)) {
      throw new Error("Sessão de equipe não disponível.");
    }
    const target = new URL(path, origin);
    if (target.origin !== origin) throw new Error("Endereço da cozinha inválido.");
    let response;
    const requestAbort = new AbortController();
    const abort = () => requestAbort.abort();
    lifecycle.signal.addEventListener("abort", abort, { once: true });
    const deadline = setTimeout(abort, 10000);
    try {
      response = await transport(target, {
        method, cache: "no-store", redirect: "error",
        signal: requestAbort.signal,
        headers: { Authorization: `Bearer ${token}`, ...(data ? { "Content-Type": "application/json" } : {}) },
        ...(data ? { body: JSON.stringify(data) } : {}),
      });
    } catch {
      throw new Error("Falha de conexão. Atualize para conferir o estado antes de repetir a ação.");
    } finally { clearTimeout(deadline); lifecycle.signal.removeEventListener("abort", abort); }
    if (!response.ok) throw new Error(httpMessage(response.status));
    let result;
    try { result = await response.json(); } catch { throw new Error("Resposta inválida do serviço da cozinha."); }
    if (disposed) throw new Error("Sessão encerrada.");
    return result;
  }
  function controls() {
    if (disposed) return;
    panel.setAttribute("aria-busy", String(busy));
    tenantSelect.disabled = busy || units.length === 0;
    locationSelect.disabled = busy || !tenantSelect.value;
    refreshButton.disabled = busy || !locationSelect.value;
    for (const action of orderList.querySelectorAll("button, textarea")) {
      action.disabled = busy || (action.dataset.mutation === "true" &&
        invalidActions.has(action.dataset.order));
    }
  }
  async function run(work, { pending = "Aguarde…" } = {}) {
    if (busy || disposed) return false;
    busy = true;
    controls();
    error();
    say(pending);
    try { await work(); return true; }
    catch (failure) {
      error(failure instanceof Error ? failure.message : "Não foi possível carregar os pedidos.");
      say("");
      return false;
    } finally { busy = false; controls(); }
  }
  function selectLocationOptions(keep) {
    const filtered = units.filter((entry) => entry.tenantId === tenantSelect.value);
    options(locationSelect, filtered.map((entry) => [entry.locationId, entry.locationName]), keep,
      "Selecione a unidade");
    if (!locationSelect.value && filtered.length === 1) locationSelect.value = filtered[0].locationId;
  }
  function renderList() {
    orderList.replaceChildren();
    empty.hidden = orders.length > 0;
    empty.textContent = locationSelect.value ? "Nenhum pedido nesta unidade." : "Selecione uma unidade para ver os pedidos.";
    for (const order of orders) {
      if (!validId(order?.id)) continue;
      const row = element("li", undefined, "order");
      const top = element("header");
      const heading = element("h3", "Pedido " + order.id.slice(-8));
      heading.tabIndex = -1;
      top.append(heading, element("span", statusNames[order.status] ?? "Status não informado", "badge"));
      row.append(top, element("p", [
        text(order.tableLabel, "Sem mesa informada"), time(order.createdAt),
        money(order.totalCents, order.currency),
      ].join(" · ")));
      const open = element("button", details.has(order.id) ? "Ocultar detalhes" : "Ver detalhes", "alt");
      open.type = "button";
      open.setAttribute("aria-label", open.textContent + " do pedido " + order.id.slice(-8));
      open.setAttribute("aria-expanded", String(details.has(order.id)));
      open.addEventListener("click", () => {
        if (details.has(order.id)) {
          details.delete(order.id);
          renderList();
          focusOrder(order.id);
          return;
        }
        void run(async () => {
          const result = await api(route(order.id));
          if (result?.order?.id !== order.id || !known(result.order.status)) {
            throw new Error("O serviço não retornou o pedido solicitado.");
          }
          details.set(order.id, result.order);
          renderList();
          say("Detalhes carregados.");
          focusOrder(order.id);
        });
      });
      row.dataset.orderId = order.id;
      row.append(open);
      const detail = details.get(order.id);
      if (detail) addDetail(row, detail);
      orderList.append(row);
    }
    controls();
  }
  function focusOrder(id) {
    for (const row of orderList.children) {
      if (row.dataset.orderId === id) { row.querySelector("h3")?.focus(); return; }
    }
    refreshButton.focus();
  }
  function addDetail(row, order) {
    row.querySelector(".badge").textContent = statusNames[order.status];
    const items = element("ul", undefined, "items");
    items.setAttribute("aria-label", "Itens do pedido");
    for (const item of array(order.lines)) {
      if (!item || typeof item.name !== "string") continue;
      const quantity = Number.isSafeInteger(item.quantity) ? `${item.quantity} × ` : "";
      const li = element("li", quantity + item.name);
      const extras = array(item.addons).map((extra) => typeof extra === "string" ? extra : text(extra?.name)).filter(Boolean);
      if (extras.length) li.append(element("p", "Adicionais: " + extras.join(", ")));
      if (text(item.notes)) li.append(element("p", "Observação: " + item.notes));
      items.append(li);
    }
    row.append(items);
    if (!items.children.length) row.append(element("p", "Itens não informados pelo serviço."));
    const transitions = [...new Set(array(order.allowedTransitions).filter(known))]
      .filter((status) => status !== order.status && status !== "cancelled");
    if (!transitions.length) {
      row.append(element("p", "Não há mudança de status disponível para este pedido."));
      return;
    }
    const actions = element("div", undefined, "actions");
    const reasonId = "reason-" + order.id;
    let reason;
    if (transitions.includes("rejected")) {
      const label = element("label", "Motivo para recusar");
      label.htmlFor = reasonId;
      reason = element("textarea");
      reason.id = reasonId;
      reason.maxLength = 240;
      reason.rows = 2;
      reason.dataset.mutation = "true";
      reason.dataset.order = order.id;
      actions.append(label, reason);
    }
    for (const status of transitions) {
      const target = element("button", {
        accepted: "Aceitar pedido", preparing: "Iniciar preparo", ready: "Marcar como pronto",
        completed: "Concluir pedido", rejected: "Recusar pedido", cancelled: "Cancelar pedido",
      }[status] ?? "Mudar para " + statusNames[status], ["rejected", "cancelled"].includes(status) ? "alt" : "");
      target.type = "button";
      target.dataset.mutation = "true";
      target.dataset.order = order.id;
      target.addEventListener("click", () => {
        const why = reason?.value.trim();
        const negative = status === "rejected";
        if (negative && !why) {
          error("Informe um motivo para recusar este pedido.");
          reason?.focus();
          return;
        }
        void run(async () => {
          invalidActions.add(order.id); // never repeat a change with the same stale status
          const changed = await api(route(order.id) + "/transition", "POST", {
            expectedStatus: order.status, status, ...(negative ? { reason: why } : {}),
          });
          if (changed?.id !== order.id || changed.status !== status) {
            throw new Error("Mudança sem confirmação. Atualize a lista antes de agir.");
          }
          try {
            await loadOrders();
          } catch {
            possibleStaleList(order.id);
            say("Status alterado. Atualize a lista para conferir o pedido.");
            return;
          }
          say("Status atualizado para " + statusNames[status] + ".");
          focusOrder(order.id);
        });
      });
      actions.append(target);
    }
    row.append(actions);
  }
  function possibleStaleList(id) {
    details.delete(id);
    orders = orders.filter((order) => order.id !== id);
    renderList();
    refreshButton.focus();
  }
  async function loadOrders() {
    details.clear();
    orders = [];
    renderList();
    if (!validId(tenantSelect.value) || !validId(locationSelect.value)) {
      say("Selecione uma unidade.");
      return;
    }
    const result = await api(route());
    orders = array(result.orders).filter((order) => validId(order?.id) && known(order.status));
    invalidActions.clear();
    renderList();
    say(result.limited ? "Lista limitada pelo servidor. Atualize para acompanhar novos pedidos."
      : orders.length === 1 ? "1 pedido carregado." : `${orders.length} pedidos carregados.`);
  }

  listen(tenantSelect, "change", () => void run(async () => {
    selectLocationOptions("");
    await loadOrders();
  }));
  listen(locationSelect, "change", () => void run(loadOrders));
  listen(refreshButton, "click", () => void run(loadOrders));

  void run(async () => {
    const result = await api(BASE + "/units");
    units = array(result.units).filter((entry) => validId(entry?.tenantId) && validId(entry?.locationId)
      && typeof entry.tenantName === "string" && typeof entry.locationName === "string");
    const tenants = [...new Map(units.map((entry) => [entry.tenantId, entry.tenantName])).entries()];
    options(tenantSelect, tenants, tenants.length === 1 ? tenants[0][0] : "", "Selecione o estabelecimento");
    selectLocationOptions("");
    panel.hidden = false;
    if (locationSelect.value) await loadOrders();
    else say(units.length ? "Selecione a unidade da cozinha." : "Sua conta não tem unidades disponíveis.");
  }, { pending: "Verificando o acesso à cozinha…" });
  return () => {
    if (disposed) return;
    disposed = true;
    lifecycle.abort();
    units = [];
    orders = [];
    details.clear();
    invalidActions.clear();
    orderList.replaceChildren();
    options(tenantSelect, [], "", "Selecione o estabelecimento");
    options(locationSelect, [], "", "Selecione a unidade");
    panel.hidden = true;
    $("kitchen-error").hidden = true;
    $("kitchen-error").textContent = "";
    $("kitchen-status").textContent = "O painel exige uma sessão de equipe verificada.";
    panel.setAttribute("aria-busy","false");
  };
}
