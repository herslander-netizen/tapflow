import { createTrackingStore, statusRequest } from "./tracking-store.mjs";

const $ = (id) => document.getElementById(id);
let session = null, quote = null, pendingKey = null, persisted = false, track = null, confirmedOrderId = null;
let storage = null;
try { storage = sessionStorage; } catch { /* unavailable */ }
const trackingStore = createTrackingStore(storage);
const brl = (cents) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const labels = { submitted: "Aguardando o restaurante", preparing: "Em preparo", ready: "Pronto", delivered: "Entregue", cancelled: "Cancelado" };
const updateCart = () => {
  $("cheese").disabled = !session || Boolean(pendingKey) || persisted;
  $("quote").disabled = !session || Boolean(pendingKey) || persisted;
  $("order").disabled = !quote || persisted;
};
const renderTracking = () => {
  $("refresh").disabled = !track;
  $("clear").disabled = !track;
};

async function post(path, data = {}, token = null, idempotency = null) {
  const response = await fetch(path, {
    method: "POST", cache: "no-store", credentials: "omit", redirect: "error",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(idempotency ? { "Idempotency-Key": idempotency } : {}) },
    body: JSON.stringify(data),
  });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.error ?? "Não concluído."), { status: response.status });
  return body;
}
const currentCart = () => ({ lines: [{ itemId: "test-burger", quantity: 1, addonIds: $("cheese").checked ? ["test-cheese"] : [] }] });

function forget(message) {
  track = null;
  trackingStore.clear();
  $("trackingState").textContent = message;
  $("storageState").textContent = "";
  renderTracking();
}
async function loadStatus() {
  if (!track) return;
  const current = track;
  $("refresh").disabled = true;
  try {
    const req = statusRequest(current.id, current.token);
    const res = await fetch(req.path, req.init);
    if (track !== current) return;
    if ([401, 403, 404].includes(res.status)) return forget("Acompanhamento expirado, revogado ou indisponível.");
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (track !== current) return;
    $("trackingState").textContent = data.id === current.id && Object.hasOwn(labels, data.status)
      ? labels[data.status] : "Status não reconhecido.";
  } catch {
    if (track === current) $("trackingState").textContent = "Falha temporária. Tente atualizar sem reenviar o pedido.";
  } finally { renderTracking(); }
}

$("start").addEventListener("click", async () => {
  $("start").disabled = true;
  try {
    const { code } = await post("/v1/table-admissions", { tableId: "test-m" });
    session = await post("/v1/order-sessions", { code });
    $("authState").textContent = "Mesa 04 liberada para uma simulação nesta página.";
  } catch (err) {
    $("authState").textContent = err.status ? err.message : "Não foi possível abrir a mesa.";
    $("start").disabled = false;
  }
  updateCart();
});
$("cheese").addEventListener("change", () => {
  quote = null;
  $("price").textContent = "Confira o novo valor na cotação.";
  updateCart();
});
$("quote").addEventListener("click", async () => {
  $("quote").disabled = true;
  $("cheese").disabled = true;
  quote = null;
  $("order").disabled = true;
  try {
    const cart = currentCart();
    const response = await post("/v1/quotes", cart, session.token);
    quote = { cart, total: response.total };
    $("price").textContent = "Cotação do servidor: " + brl(quote.total);
  } catch (err) {
    $("orderState").textContent = err.status ? err.message : "Falha na cotação; nenhum pedido criado.";
  } finally { updateCart(); }
});
$("order").addEventListener("click", async () => {
  if (!quote || persisted) return;
  pendingKey ??= "pilot:" + crypto.randomUUID();
  updateCart();
  $("order").disabled = true;
  try {
    const body = await post("/v1/orders", quote.cart, session.token, pendingKey);
    if (body.persisted !== true) throw new Error();
    persisted = true;
    $("orderState").textContent = "Pedido fictício gravado: " + brl(body.total) + ". Sem cobrança.";
    confirmedOrderId=body.id;
    await recoverTracking();
  } catch (err) {
    $("orderState").textContent = err.status ? err.message
      : "Resultado incerto. Tente confirmar novamente sem mudar o pedido.";
  } finally { updateCart(); }
});
async function recoverTracking(){
  if(!confirmedOrderId || !session) return;
  $("recover").disabled=true;
  try {
    const response=await post("/v1/order-tracking/"+confirmedOrderId,{},session.token);
    statusRequest(confirmedOrderId,response.token);
    track={id:confirmedOrderId,token:response.token,expiresAtMs:response.expiresAtMs};
    $("recover").hidden=true;
    $("storageState").textContent=trackingStore.save(track.id,response)
      ? "Você pode recarregar esta aba e continuar acompanhando." :
        "Armazenamento indisponível: acompanhe sem recarregar a página.";
    await loadStatus();
  }catch(err){
    $("trackingState").textContent="Pedido confirmado, mas ainda sem acompanhamento. Não refaça o pedido.";
    $("recover").hidden=false;
  }finally {
    $("recover").disabled=false;
  }
}
$("recover").addEventListener("click",recoverTracking);
$("refresh").addEventListener("click", loadStatus);
$("clear").addEventListener("click", () => forget("Acompanhamento removido desta aba."));
track = trackingStore.load();
renderTracking();
if (track) {
  $("start").disabled = true;
  persisted = true;
  $("storageState").textContent = "Acompanhamento recuperado nesta aba.";
  void loadStatus();
}
