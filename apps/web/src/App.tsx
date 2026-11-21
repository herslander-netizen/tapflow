import { useEffect, useRef, useState } from "react";
import { catalog, restaurant } from "./catalog";
import { addCartLine, cartTotal, formatMoney, itemUnitPrice, lineTotal } from "./domain";
import type { CartLine, DemoOrder, MenuItem } from "./domain";

type View = "feed" | "list" | "cart" | "order" | "staff";
type Glyph = "play" | "list" | "bag" | "clock" | "back" | "plus" | "minus" | "search" | "close" | "check" | "arrow";

function Icon({ name, size = 22 }: { name: Glyph; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "play" && <><path d="m9 5 11 7-11 7V5Z" /><path d="M4 4v16" /></>}
      {name === "list" && <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></>}
      {name === "bag" && <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 9V7a3 3 0 0 1 6 0v2" /></>}
      {name === "clock" && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
      {name === "back" && <><path d="m14 6-6 6 6 6" /></>}
      {name === "plus" && <><path d="M12 5v14M5 12h14" /></>}
      {name === "minus" && <><path d="M5 12h14" /></>}
      {name === "search" && <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>}
      {name === "close" && <><path d="M5 5 19 19M19 5 5 19" /></>}
      {name === "check" && <><path d="m4 12 5 5L20 6" /></>}
      {name === "arrow" && <><path d="M4 12h16m-6-6 6 6-6 6" /></>}
    </svg>
  );
}

function ProductMedia({ item, active }: { item: MenuItem; active: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!video.current) return;
    if (active) void video.current.play().catch(() => {});
    else video.current.pause();
  }, [active]);
  return (
    <div className="media-layer">
      <img src={item.poster} alt={"Fotografia ilustrativa: " + item.name} loading={active ? "eager" : "lazy"} />
      {item.videoUrl && <video ref={video} src={item.videoUrl} poster={item.poster} muted playsInline loop preload="none" aria-label={"Vídeo do prato " + item.name} />}
    </div>
  );
}

export function App() {
  const [view, setView] = useState<View>("feed");
  const [activeId, setActiveId] = useState(catalog[0].id);
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [extras, setExtras] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [order, setOrder] = useState<DemoOrder | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [notice, setNotice] = useState("");

  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cartTotal(cart, catalog);
  const categories = ["Todos", ...new Set(catalog.map(item => item.category))];
  const shown = catalog.filter(item => (filter === "Todos" || item.category === filter) &&
    (item.name + " " + item.description + " " + item.tags.join(" ")).toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  const statusLabels: Record<DemoOrder["status"], string> = {
    recebido: "Recebido", preparando: "Em preparo", pronto: "Pronto", entregue: "Entregue"
  };
  const steps: DemoOrder["status"][] = ["recebido", "preparando", "pronto", "entregue"];

  useEffect(() => {
    if (view !== "feed") return;
    const scrollRoot = document.getElementById("feed-scroller");
    if (!scrollRoot || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      const item = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (item) setActiveId(item.target.getAttribute("data-item") || catalog[0].id);
    }, { root: scrollRoot, threshold: [0.55, 0.75] });
    scrollRoot.querySelectorAll("[data-item]").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [view]);

  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.querySelector<HTMLButtonElement>(".sheet-close")?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [selected]);

  function openProduct(item: MenuItem) {
    if (!item.available) return;
    setExtras([]);
    setQuantity(1);
    setSelected(item);
  }

  function addProduct() {
    if (!selected || !selected.available) return;
    setCart(lines => addCartLine(lines, {
      lineId: crypto.randomUUID(), itemId: selected.id, extraIds: extras, quantity
    }));
    setNotice(selected.name + " adicionado ao carrinho.");
    setSelected(null);
  }

  function updateLine(lineId: string, delta: number) {
    setCart(lines => lines.map(line => line.lineId === lineId
      ? { ...line, quantity: line.quantity + delta } : line).filter(line => line.quantity > 0));
  }

  function submitDemo() {
    if (!cart.length) return;
    const identifier = ("0000" + String(Date.now() % 10000)).slice(-4);
    setOrder({ number: "TF-DEMO-" + identifier, lines: cart.map(line => ({ ...line })),
      totalCents: total, status: "recebido" });
    setCart([]);
    setView("order");
    setNotice("Pedido fictício criado somente nesta demonstração.");
  }

  function advanceDemo() {
    setOrder(current => {
      if (!current) return null;
      const nextIndex = Math.min(steps.indexOf(current.status) + 1, steps.length - 1);
      return { ...current, status: steps[nextIndex] };
    });
  }

  return (
    <div className="workspace">
      <aside className="editorial" aria-label="Informações da demonstração">
        <div className="wordmark">tapflow<span className="wordmark-dot">.</span></div>
        <div className="editorial-copy">
          <p className="overline">ALVO DIGITAL / EXPERIÊNCIA GASTRONÔMICA</p>
          <h1>O cardápio que dá vontade de pedir.</h1>
          <p>Descubra. Personalize. Peça. Uma vitrine gastronômica que transforma a escolha em experiência.</p>
          <div className="editorial-line"><span>01 — Descobrir</span><span>02 — Escolher</span><span>03 — Pedir</span></div>
        </div>
        <div className="editorial-note">DEMONSTRAÇÃO VISUAL · SEM COBRANÇA · SEM PEDIDOS REAIS</div>
      </aside>

      <div className="phone-shell">
        <header className="topbar">
          <div className="restaurant-heading">
            <span className="eyebrow">{view === "staff" ? "OPERAÇÃO FICTÍCIA" : restaurant.table + " · DEMO"}</span>
            <strong>{view === "staff" ? "Painel da equipe" : restaurant.name}</strong>
          </div>
          <button className="staff-switch" onClick={() => setView(view === "staff" ? "feed" : "staff")} aria-label={view === "staff" ? "Voltar ao cardápio" : "Abrir painel da equipe, demonstração"}>
            {view === "staff" ? "Cliente" : "Equipe"} <Icon name="arrow" size={16} />
          </button>
        </header>

        <div className="content-area">
          {view === "feed" && (
            <div className="feed-scroll" id="feed-scroller" aria-label="Feed de pratos, role para explorar">
              {catalog.map((item, index) => (
                <article className="feed-card" key={item.id} data-item={item.id} aria-label={"Prato " + (index + 1) + " de " + catalog.length + ": " + item.name}>
                  <ProductMedia item={item} active={activeId === item.id} />
                  <div className="feed-shade" />
                  <div className="feed-head"><span className="feed-count">{String(index + 1).padStart(2, "0")} / {String(catalog.length).padStart(2, "0")}</span><span className="feed-kind">{item.videoUrl ? "VÍDEO DO PRATO" : "VITRINE COM FOTO"}</span></div>
                  <div className="feed-bottom">
                    <div className="category-line"><span className="category-mark" /> {item.category}</div>
                    <h2>{item.name}</h2>
                    <p>{item.description}</p>
                    <div className="feed-purchase">
                      <div><small>A PARTIR DE</small><strong>{formatMoney(item.priceCents)}</strong></div>
                      <button className="button button-lime" disabled={!item.available} onClick={() => openProduct(item)}>
                        {item.available ? "Escolher prato" : "Esgotado"} {item.available && <Icon name="arrow" size={18} />}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              <p className="feed-tail">Fim da vitrine · Explore o cardápio completo na aba Cardápio.</p>
            </div>
          )}

          {view === "list" && (
            <section className="list-page" aria-label="Cardápio completo">
              <div className="page-intro">
                <p className="overline">ESCOLHA DO SEU JEITO</p>
                <h2>O que vai ser hoje?</h2>
                <p>Confira os pratos sem precisar assistir a vídeos.</p>
              </div>
              <label className="search-box"><Icon name="search" size={19} /><span className="sr-only">Buscar pratos</span>
                <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar pratos ou ingredientes" />
              </label>
              <div className="category-filter" role="group" aria-label="Filtrar categorias">
                {categories.map(category => <button key={category} className={filter === category ? "category-filter__active" : ""} aria-pressed={filter === category} onClick={() => setFilter(category)}>{category}</button>)}
              </div>
              <div className="list-heading"><h3>Nosso cardápio</h3><span>{shown.length} itens</span></div>
              {shown.length === 0 && <div className="empty-panel"><h3>Nenhum prato encontrado</h3><p>Tente outra busca ou veja todas as categorias.</p><button onClick={() => { setSearch(""); setFilter("Todos"); }} className="button button-outline">Limpar filtros</button></div>}
              <div className="dish-list">
                {shown.map(item => (
                  <article className="dish-row" key={item.id}>
                    <img src={item.poster} alt={"Foto ilustrativa: " + item.name} loading="lazy" />
                    <div className="dish-row-info">
                      <span className="row-category">{item.category}</span>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                      <div className="dish-row-bottom"><strong>{formatMoney(item.priceCents)}</strong>
                        <button className="icon-button add-button" disabled={!item.available} onClick={() => openProduct(item)} aria-label={item.available ? "Personalizar " + item.name : item.name + " esgotado"}>{item.available ? <Icon name="plus" /> : "—"}</button>
                      </div>
                      {!item.available && <small className="unavailable">Indisponível no momento</small>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {view === "cart" && (
            <section className="standard-page" aria-label="Carrinho">
              <div className="page-intro"><p className="overline">SEU PEDIDO</p><h2>Quase lá.</h2><p>Revise tudo antes de enviar.</p></div>
              {!cart.length ? <div className="empty-panel"><div className="empty-icon"><Icon name="bag" size={32} /></div><h3>Seu carrinho está vazio</h3><p>Explore a vitrine e escolha seu primeiro prato.</p><button className="button button-lime" onClick={() => setView("feed")}>Explorar pratos <Icon name="arrow" size={17} /></button></div> :
                <>
                  <div className="cart-rows">{cart.map(line => {
                    const item = catalog.find(candidate => candidate.id === line.itemId);
                    if (!item) return null;
                    return <article className="cart-row" key={line.lineId}>
                      <img src={item.poster} alt="" loading="lazy" />
                      <div className="cart-row-info"><h3>{item.name}</h3>
                        {line.extraIds.length > 0 && <p>{line.extraIds.map(id => item.extras.find(extra => extra.id === id)?.name).filter(Boolean).join(" · ")}</p>}
                        <strong>{formatMoney(lineTotal(line, catalog))}</strong>
                      </div>
                      <div className="qty-compact"><button onClick={() => updateLine(line.lineId, -1)} aria-label={"Diminuir " + item.name}><Icon name="minus" size={15} /></button><span>{line.quantity}</span><button onClick={() => updateLine(line.lineId, 1)} aria-label={"Aumentar " + item.name}><Icon name="plus" size={15} /></button></div>
                    </article>;
                  })}</div>
                  <div className="bill"><div><span>Subtotal</span><strong>{formatMoney(total)}</strong></div><div><span>Taxas adicionais</span><span>Não aplicadas na demo</span></div><div className="bill-total"><span>Total demonstrativo</span><strong>{formatMoney(total)}</strong></div></div>
                  <p className="disclaimer">Sem cobrança. Este pedido não será enviado a um restaurante. O total de produção deverá ser recalculado pelo servidor.</p>
                  <button className="button button-lime button-full" onClick={submitDemo}>Criar pedido de demonstração <Icon name="arrow" size={18} /></button>
                </>}
            </section>
          )}

          {view === "order" && (
            <section className="standard-page" aria-label="Acompanhamento do pedido">
              <div className="page-intro"><p className="overline">ACOMPANHAMENTO</p><h2>Na cozinha.</h2><p>O caminho do pedido, em cada etapa.</p></div>
              {!order ? <div className="empty-panel"><div className="empty-icon"><Icon name="clock" size={32} /></div><h3>Nenhum pedido ainda</h3><p>Faça um pedido de demonstração para acompanhar seu progresso.</p><button className="button button-lime" onClick={() => setView("feed")}>Explorar cardápio</button></div> :
                <>
                  <div className="order-card"><span className="overline">PEDIDO FICTÍCIO</span><strong>{order.number}</strong><span className="status-pill">{statusLabels[order.status]}</span><p>Simulação local · {formatMoney(order.totalCents)} · Não é um pedido real.</p></div>
                  <ol className="timeline">{steps.map((step, index) => <li key={step} className={index <= steps.indexOf(order.status) ? "timeline--done" : ""}>
                    <span className="timeline-node">{index <= steps.indexOf(order.status) ? <Icon name="check" size={15} /> : index + 1}</span>
                    <div><strong>{statusLabels[step]}</strong><p>{["Seu pedido foi registrado na demo.", "O preparo foi iniciado na simulação.", "A cozinha sinalizou conclusão na demo.", "Entrega demonstrativa concluída."][index]}</p></div>
                  </li>)}</ol>
                  <button className="button button-outline button-full" onClick={() => setView("staff")}>Abrir painel fictício da equipe <Icon name="arrow" size={18} /></button>
                </>}
            </section>
          )}

          {view === "staff" && (
            <section className="standard-page staff-page" aria-label="Painel operacional simulado">
              <div className="page-intro"><p className="overline">MODO EQUIPE · SIMULAÇÃO</p><h2>Pedidos em foco.</h2><p>Visão operacional apenas para demonstrar o fluxo de status.</p></div>
              <div className="staff-summary"><div><span>Pedidos na demo</span><strong>{order ? "01" : "00"}</strong></div><div><span>Em aberto</span><strong>{order && order.status !== "entregue" ? "01" : "00"}</strong></div></div>
              {order ? <div className="staff-order">
                <div className="staff-order-head"><span>{order.number}</span><span>{restaurant.table}</span></div>
                <h3>{statusLabels[order.status]}</h3>
                <p>{order.lines.reduce((sum, line) => sum + line.quantity, 0)} item(ns) · {formatMoney(order.totalCents)}</p>
                {order.lines.map(line => <div className="staff-item" key={line.lineId}>{line.quantity}× {catalog.find(i => i.id === line.itemId)?.name || "Item"}</div>)}
                {order.status !== "entregue" && <button className="button button-lime button-full" onClick={advanceDemo}>Avançar para {statusLabels[steps[steps.indexOf(order.status) + 1]]} <Icon name="arrow" size={17} /></button>}
              </div> : <div className="empty-panel"><h3>Nenhum pedido na fila</h3><p>Crie um pedido fictício pelo cardápio para testá-lo aqui.</p><button className="button button-outline" onClick={() => setView("feed")}>Ver cardápio</button></div>}
              <p className="disclaimer">O acesso deste painel não é protegido: somente demo com dados fictícios. A autenticação real e o isolamento por restaurante serão implementados em etapa própria.</p>
            </section>
          )}
        </div>

        <nav className="bottom-nav" aria-label="Navegação principal">
          {([
            ["feed", "Explorar", "play"], ["list", "Cardápio", "list"], ["cart", "Carrinho", "bag"], ["order", "Pedido", "clock"]
          ] as const).map(([target, label, glyph]) => <button key={target} onClick={() => setView(target)} aria-current={view === target ? "page" : undefined}>
            <span className="nav-icon"><Icon name={glyph} size={21} />{target === "cart" && count > 0 && <span className="cart-dot">{count}</span>}</span><span>{label}</span>
          </button>)}
        </nav>
        <div className="announcement sr-only" aria-live="polite">{notice}</div>
      </div>

      {selected && <div className="sheet-layer">
        <div className="sheet-backdrop" onClick={() => setSelected(null)} aria-hidden="true" />
        <section className="product-sheet" role="dialog" aria-modal="true" aria-labelledby="product-title">
          <div className="sheet-handle" aria-hidden="true" />
          <div className="sheet-photo"><img src={selected.poster} alt={"Foto ilustrativa: " + selected.name} /><button className="sheet-close icon-button" onClick={() => setSelected(null)} aria-label="Fechar detalhes"><Icon name="close" size={20} /></button></div>
          <div className="sheet-body">
            <span className="overline">{selected.category}</span><h2 id="product-title">{selected.name}</h2><p>{selected.description}</p>
            <div className="allergens"><strong>Informações sobre alergênicos</strong><span>{selected.allergens.join(" · ") || "Consulte o estabelecimento"}</span><small>Dados ilustrativos. Confirme ingredientes com a equipe em pedidos reais.</small></div>
            {selected.extras.length > 0 && <fieldset className="extras-fieldset"><legend>Personalize seu prato</legend>{selected.extras.map(extra =>
              <label className="extra-option" key={extra.id}><span><input type="checkbox" checked={extras.includes(extra.id)} onChange={event => setExtras(current => event.target.checked ? [...current, extra.id] : current.filter(id => id !== extra.id))} /><span>{extra.name}</span></span><strong>+ {formatMoney(extra.priceCents)}</strong></label>
            )}</fieldset>}
            <div className="sheet-actions">
              <div className="quantity"><button onClick={() => setQuantity(q => Math.max(1, q - 1))} aria-label="Diminuir quantidade"><Icon name="minus" size={17} /></button><output aria-live="polite">{quantity}</output><button onClick={() => setQuantity(q => Math.min(99, q + 1))} aria-label="Aumentar quantidade"><Icon name="plus" size={17} /></button></div>
              <button className="button button-lime sheet-add" onClick={addProduct}>Adicionar · {formatMoney(itemUnitPrice(selected, extras) * quantity)}</button>
            </div>
          </div>
        </section>
      </div>}
    </div>
  );
}
