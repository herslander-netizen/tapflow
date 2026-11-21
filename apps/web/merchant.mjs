import { loadMerchantSession } from "./merchant-auth0.mjs";
import { DEFAULT_SETTINGS, THEME_PRESETS, createTheme, normalizeSettings } from "./theme.mjs";

const sessionHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const catalogBase = "/v1/merchant/tenants";
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const list = (value) => Array.isArray(value) ? value : [];
const pathId = (value) => encodeURIComponent(value);
const isToken = (value) =>
  typeof value === "string" && value.length <= 8192 && /^[A-Za-z0-9_.~-]+$/.test(value);

export function parseMenuPrice(value) {
  const match = String(value).trim().match(/^([0-9]{1,7})(?:[,.]([0-9]{1,2}))?$/);
  if (!match) throw new Error("Informe um preço como 29,90. Não use separador de milhar.");
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (cents > 100000000) throw new Error("Preço acima do limite deste piloto.");
  return cents;
}

function humanHttpError(status) {
  if (status === 401) return "A sessão expirou ou não está ativa. Entre novamente pelo acesso autorizado.";
  if (status === 403) return "Sua conta não tem acesso a esta ação ou a este estabelecimento.";
  if (status === 404) return "Recurso não encontrado neste ambiente. Atualize o painel.";
  if (status === 409) return "Os dados mudaram ou o identificador já existe. Atualize antes de tentar novamente.";
  if (status === 422 || status === 400) return "Confira os campos. O servidor não aceitou os dados.";
  if (status === 429) return "Muitas tentativas. Aguarde antes de continuar.";
  return "O servidor não conseguiu concluir a solicitação. Não tente novamente se a mudança já tiver sido aplicada.";
}

export function mountMerchant({
  document: doc = document,
  origin = location.origin,
  hostname = location.hostname,
  fetch: transport = fetch,
  getAccessToken,
  appearancePath = (tenantId) => `/api/merchant/${pathId(tenantId)}/appearance`,
} = {}) {
  const $ = (id) => doc.getElementById(id);
  const panel = $("panel");
  const inject = typeof getAccessToken === "function";
  const loopback = !inject && sessionHosts.has(hostname);
  const state = { token: null, tenantId: "", tenantSlug: "", locationId: "", busy: false, appearance: null, appearanceDirty: false };
  let tenantRecords = [];
  let catalog = { locations: [], categories: [], items: [], addons: [] };

  function say(message) { $("merchant-status").textContent = message; }
  function showError(message = "") {
    $("merchant-error").textContent = message;
    $("merchant-error").hidden = !message;
  }
  function options(select, rows, keep = select.value, placeholder = "Selecione") {
    const first = doc.createElement("option");
    first.value = "";
    first.textContent = placeholder;
    select.replaceChildren(first);
    for (const row of rows) {
      if (!row || typeof row.id !== "string" || typeof row.name !== "string") continue;
      const option = doc.createElement("option");
      option.value = row.id;
      option.textContent = row.name;
      select.append(option);
    }
    select.value = [...select.options].some((option) => option.value === keep) ? keep : "";
  }
  function entries(id, rows, describe) {
    const ul = $(id);
    const shown = rows.filter((row) => row && typeof row.name === "string");
    ul.replaceChildren();
    if (!shown.length) {
      const li = doc.createElement("li");
      li.textContent = "Nenhum registro neste contexto.";
      ul.append(li);
      return;
    }
    for (const row of shown) {
      const li = doc.createElement("li");
      li.textContent = describe(row);
      ul.append(li);
    }
  }
  function updateControls() {
    panel.setAttribute("aria-busy", String(state.busy));
    for (const field of panel.querySelectorAll("button, input, select, textarea")) {
      const section = field.closest("section")?.id;
      const needsTenant = section !== "estabelecimento" && section;
      const needsLocation = ["categorias", "itens", "adicionais"].includes(section);
      const needsAppearance = section === "aparencia" && !state.appearance;
      field.disabled = Boolean(state.busy || (needsTenant && !state.tenantId) ||
        (needsLocation && !state.locationId) || needsAppearance ||
        (field.id === "publish-appearance" && (!state.appearance?.revision || state.appearanceDirty)));
    }
  }
  function renderLocationLinks() {
    const ul = $("location-list");
    entries("location-list", catalog.locations, (x) => x.name);
    if (!state.appearance?.published || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(state.tenantSlug)) return;
    const shown = catalog.locations.filter((row) => row && typeof row.name === "string");
    shown.forEach((row, ix) => {
      if (row.status !== "active" || !/^[A-Za-z0-9_-]{1,64}$/.test(row.id ?? "")) return;
      const a = doc.createElement("a");
      a.href = `/cardapio/${pathId(state.tenantSlug)}/${pathId(row.id)}`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Abrir cardápio publicado";
      a.setAttribute("aria-label", "Abrir cardápio de " + row.name + " em nova aba");
      ul.children[ix].append(" · ", a);
    });
  }
  function renderCatalog() {
    const activeLocations=catalog.locations.filter(row=>row.status==="active");
    options($("location-scope"),activeLocations,state.locationId||(activeLocations.length===1?activeLocations[0].id:""));
    state.locationId = $("location-scope").value;
    const inLocation = (row) => row?.locationId === state.locationId;
    const categories = state.locationId ? catalog.categories.filter(inLocation) : [];
    const items = state.locationId ? catalog.items.filter(inLocation) : [];
    const itemIds = new Set(items.map((row) => row.id));
    const addons = catalog.addons.filter((row) => itemIds.has(row?.itemId));
    options($("item-category"), categories);
    options($("addon-item"), items);
    renderLocationLinks();
    entries("category-list", categories, (x) => x.name);
    const cost = (x) => Number.isSafeInteger(x.priceCents) ? ` · ${currency.format(x.priceCents / 100)}` : "";
    entries("item-list", items, (x) => x.name + cost(x));
    entries("addon-list", addons, (x) =>
      x.name + cost(x) + (items.find((item) => item.id === x.itemId)?.name
        ? ` · ${items.find((item) => item.id === x.itemId).name}` : ""));
    updateControls();
  }
  function readTheme() {
    return normalizeSettings({
      preset: $("theme-preset").value,
      mode: $("theme-mode").value,
      accent: $("theme-primary").value,
      background: $("theme-background").value,
    });
  }
  function previewAppearance(settings) {
    const theme = createTheme(settings);
    const sample = $("appearance-example");
    for (const name of ["bg", "text", "accent", "on-accent"]) {
      sample.style.setProperty(`--theme-${name}`, theme.tokens[`--${name}`]);
    }
  }
  function renderAppearance() {
    const draft = normalizeSettings(state.appearance?.draft ?? DEFAULT_SETTINGS);
    const theme = createTheme(draft);
    $("theme-preset").value = draft.preset;
    $("theme-mode").value = draft.mode;
    $("theme-primary").value = draft.accent ?? THEME_PRESETS[draft.preset].accent;
    $("theme-background").value = draft.background ?? theme.tokens["--bg"];
    $("appearance-state").textContent = state.appearance
      ? `Revisão ${state.appearance.revision} · ${state.appearance.published ? "Há aparência publicada." : "Ainda não publicada."}`
      : "Rascunho indisponível. Atualize o estabelecimento.";
    previewAppearance(draft);
    renderLocationLinks();
    updateControls();
  }
  async function api(path, method = "GET", data) {
    const target = new URL(path, origin);
    if (target.origin !== origin) throw new Error("Endereço de serviço inválido.");
    let token;
    try { token = inject ? await getAccessToken() : state.token; }
    catch { throw new Error("Não foi possível confirmar a sessão de administração."); }
    if (!isToken(token)) throw new Error("Não há sessão de administração disponível.");
    let response;
    try { response = await transport(target, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, ...(data ? { "Content-Type": "application/json" } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    } catch { throw new Error("Falha de conexão. Atualize para verificar o resultado antes de repetir a ação."); }
    if (!response.ok) throw new Error(humanHttpError(response.status));
    try { return await response.json(); } catch { throw new Error("Resposta inválida do servidor do piloto."); }
  }
  async function run(work) {
    if (state.busy) return;
    state.busy = true;
    updateControls();
    showError();
    say("Aguarde…");
    try { await work(); }
    catch (error) {
      say("");
      showError(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
    } finally {
      state.busy = false;
      updateControls();
    }
  }
  const tenantPath = () => `${catalogBase}/${pathId(state.tenantId)}`;
  async function loadCatalog() {
    catalog = { locations: [], categories: [], items: [], addons: [] };
    if (state.tenantId) {
      const data = await api(`${tenantPath()}/catalog`);
      catalog = Object.fromEntries(Object.keys(catalog).map((key) => [key, list(data[key])]));
    }
    renderCatalog();
  }
  async function loadAppearance() {
    state.appearance = null;
    state.appearanceDirty = false;
    renderAppearance();
    if (!state.tenantId) return;
    const data = await api(appearancePath(state.tenantId));
    if (!Number.isInteger(data.revision) || data.revision < 0 || !data.draft) {
      throw new Error("O servidor não forneceu um rascunho válido.");
    }
    state.appearance = data;
    renderAppearance();
  }
  async function loadScope() {
    state.tenantId = $("tenant-scope").value;
    state.tenantSlug = tenantRecords.find((tenant) => tenant.id === state.tenantId)?.slug ?? "";
    state.locationId = "";
    state.appearance = null;
    state.appearanceDirty = false;
    catalog = { locations: [], categories: [], items: [], addons: [] };
    renderCatalog();
    renderAppearance();
    await loadCatalog();
    // A edição de catálogo deve funcionar mesmo quando a aparência exige permissão de dona.
    try { await loadAppearance(); }
    catch (error) { $("appearance-state").textContent = error.message; }
  }
  async function loadTenants(preferred = state.tenantId) {
    const data = await api(catalogBase);
    tenantRecords = list(data.tenants);
    options($("tenant-scope"), tenantRecords, preferred || tenantRecords[0]?.id);
    await loadScope();
  }
  function submit(id, work) {
    $(id).addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fields = new FormData(form);
      void run(() => work(form, fields));
    });
  }
  const value = (fields, field) => String(fields.get(field) ?? "").trim();
  submit("form-tenant", async (form, f) => {
    const create = await api(catalogBase, "POST", {
      slug: value(f, "slug"), name: value(f, "name"), locationName: value(f, "locationName"),
    });
    form.reset();
    try { await loadTenants(create.tenant?.id); say("Estabelecimento e primeira unidade criados."); }
    catch { say("Estabelecimento criado. Use Atualizar estabelecimentos para carregar a lista; não recrie."); }
  });
  $("load-tenants").addEventListener("click", () => void run(async () => {
    await loadTenants();
    say("Estabelecimentos atualizados.");
  }));
  $("tenant-scope").addEventListener("change", () => void run(async () => {
    await loadScope();
    say("Estabelecimento selecionado.");
  }));
  $("location-scope").addEventListener("change", () => {
    state.locationId = $("location-scope").value;
    renderCatalog();
    say(state.locationId ? "Catálogo filtrado pela unidade." : "Selecione uma unidade.");
  });
  const createRecord = (formId, route, make, label) => submit(formId, async (form, f) => {
    if (!state.tenantId) throw new Error("Selecione um estabelecimento.");
    if (route !== "locations" && !state.locationId) throw new Error("Selecione uma unidade.");
    await api(`${tenantPath()}/${route}`, "POST", make(f));
    form.reset();
    try { await loadCatalog(); say(`${label} salvo.`); }
    catch { say(`${label} salvo. Atualize o estabelecimento para carregar a lista; não repita o cadastro.`); }
  });
  createRecord("form-location", "locations", (f) => ({ name: value(f, "name") }), "Cadastro da unidade");
  createRecord("form-category", "categories", (f) => ({
    locationId: state.locationId, name: value(f, "name"),
  }), "Cadastro da categoria");
  createRecord("form-item", "items", (f) => ({
    locationId: state.locationId, categoryId: value(f, "categoryId"), name: value(f, "name"),
    ...(value(f, "description") ? { description: value(f, "description") } : {}),
    priceCents: parseMenuPrice(value(f, "price")),
    availability: value(f, "availability"),
  }), "Cadastro do prato");
  createRecord("form-addon", "addons", (f) => ({
    locationId: state.locationId, itemId: value(f, "itemId"), name: value(f, "name"),
    priceCents: parseMenuPrice(value(f, "price")), isAvailable: f.has("isAvailable"),
  }), "Cadastro do adicional");

  for (const [id, theme] of Object.entries(THEME_PRESETS)) {
    const opt = doc.createElement("option");
    opt.value = id;
    opt.textContent = theme.label;
    $("theme-preset").append(opt);
  }
  function markAppearanceEdited(event) {
    if (["theme-preset", "theme-mode"].includes(event.target.id)) {
      const preset = THEME_PRESETS[$("theme-preset").value];
      if (preset) {
        if (event.target.id === "theme-preset") $("theme-mode").value = preset.mode;
        $("theme-primary").value = preset.accent;
        $("theme-background").value = preset[$("theme-mode").value];
      }
    }
    state.appearanceDirty = true;
    previewAppearance(readTheme());
    updateControls();
  }
  $("form-appearance").addEventListener("input", markAppearanceEdited);
  submit("form-appearance", async () => {
    if (!state.appearance) throw new Error("Carregue o rascunho antes de editar.");
    state.appearance = await api(appearancePath(state.tenantId), "POST", {
      revision: state.appearance.revision, settings: readTheme(),
    });
    state.appearanceDirty = false;
    renderAppearance();
    say("Rascunho salvo. Ainda não foi publicado.");
  });
  $("publish-appearance").addEventListener("click", () => void run(async () => {
    if (!state.appearance?.revision || state.appearanceDirty) throw new Error("Salve o rascunho antes de publicar.");
    state.appearance = await api(`${appearancePath(state.tenantId)}/publish`, "POST", { revision: state.appearance.revision });
    renderAppearance();
    say("Aparência publicada. O cardápio das unidades ativas está visível no piloto.");
  }));

  if (loopback) {
    $("local-access").hidden = false;
    $("access-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const input = $("access-token");
      const token = input.value.trim();
      input.value = "";
      if (!isToken(token)) {
        showError("Informe um token de teste válido.");
        return;
      }
      state.token = token;
      $("clear-access").hidden = false;
      panel.hidden = false;
      void run(async () => { await loadTenants(); say("Sessão local e catálogo carregados."); });
    });
    $("clear-access").addEventListener("click", () => {
      if (state.busy) return;
      state.token = null;
      panel.hidden = true;
      $("clear-access").hidden = true;
      tenantRecords = [];
      options($("tenant-scope"), []);
      void loadScope();
      showError();
      say("Token local removido.");
    });
    say("O piloto local precisa de um token de teste temporário.");
  } else if (inject) {
    panel.hidden = false;
    void run(async () => { await loadTenants(); say("Painel carregado."); });
  } else {
    say("Sessão de administração não configurada neste ambiente.");
  }
}

if (typeof window !== "undefined") {
  // Do not accept an injected browser global in the hosted build.
  void loadMerchantSession().then(({managed,getAccessToken})=>{
    if(!managed||getAccessToken)mountMerchant({getAccessToken});
  });
}
