(async function tapflowApp(){
  "use strict";
  const {brl,quantity,cartLine,cartTotal,nextOrderStatus} = await import("./domain.mjs");
  const {items} = await import("./demo-data.js");
  const main=document.getElementById("mainContent");
  const right=document.getElementById("rightContent");
  const side=document.getElementById("sideNav");
  const bottom=document.getElementById("bottomNav");
  const drawer=document.getElementById("drawerRoot");
  const toastEl=document.getElementById("toast");
  const table=document.getElementById("tableIndicator");
  if(!main||!right||!side||!bottom||!drawer||!toastEl) return;
  const n=new URLSearchParams(location.search).get("mesa");
  const tableLabel=n&&/^(0?[1-9]|[12][0-9]|30)$/.test(n)?"Mesa "+String(Number(n)).padStart(2,"0"):"Mesa 08";
  if(table)table.textContent=tableLabel;
  const state={page:"explorar",index:0,category:"Todos",search:"",favorites:new Set(),cart:[],orders:[],draft:null,cartOpen:false,modal:null,toastTimer:null,scrollLock:0};
  const NAV=[
    {id:"explorar",title:"Explorar",icon:"▶"},
    {id:"cardapio",title:"Cardápio",icon:"▦"},
    {id:"favoritos",title:"Favoritos",icon:"♡"},
    {id:"carrinho",title:"Carrinho",icon:"◈"},
    {id:"pedido",title:"Meus pedidos",icon:"◷"},
    {id:"cozinha",title:"Cozinha demo",icon:"♨"}
  ];
  const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
  const imageMarkup=(item,cssClass,loading="lazy")=>'<img class="'+cssClass+'" alt="'+escapeHTML("Foto ilustrativa de "+item.name)+'" loading="'+loading+'" src="'+escapeHTML(item.image)+'">';
  const byId=id=>items.find(item=>item.id===id);
  const totalCount=()=>state.cart.reduce((sum,line)=>sum+line.quantity,0);
  const lastOrder=()=>state.orders[state.orders.length-1];
  const statusName={submitted:"Pedido recebido",accepted:"Confirmado na cozinha",preparing:"Em preparo",ready:"Pronto para retirada",completed:"Entregue",rejected:"Pedido recusado",cancelled:"Cancelado"};
  const statusSteps=["submitted","accepted","preparing","ready","completed"];
  const isReducedMotion=matchMedia("(prefers-reduced-motion: reduce)").matches;
  function announce(message){
    clearTimeout(state.toastTimer);
    toastEl.textContent=message;
    toastEl.classList.add("show");
    state.toastTimer=setTimeout(()=>toastEl.classList.remove("show"),2800);
  }
  function navLink(item,selected,compact){
    const count=item.id==="carrinho"?totalCount():0;
    return '<button type="button" class="'+(compact?"bottom-link ":"side-link ")+(selected?"active":"")+'" data-action="nav" data-page="'+item.id+'" aria-current="'+(selected?"page":"false")+'"><span class="nav-icon" aria-hidden="true">'+item.icon+'</span><span>'+item.title+'</span>'+(count?'<span class="mini-count">'+count+'</span>':"")+'</button>';
  }
  function renderNavigation(){
    side.innerHTML=NAV.map(item=>navLink(item,state.page===item.id,false)).join("");
    bottom.innerHTML=NAV.filter(item=>["explorar","cardapio","carrinho","pedido"].includes(item.id)).map(item=>navLink(item,state.page===item.id,true)).join("");
  }
  function setPage(page){
    if(!NAV.some(n=>n.id===page))return;
    closeModal(false);
    state.page=page;
    if(page==="cardapio"||page==="favoritos"){state.search="";state.category="Todos";}
    render();
    const heading=main.querySelector("h1");
    if(heading&&page!=="explorar")heading.setAttribute("tabindex","-1");
    if(heading&&page!=="explorar")heading.focus({preventScroll:true});
  }
  function toggleFavorite(id){
    if(state.favorites.has(id)){state.favorites.delete(id);announce("Removido dos favoritos");}
    else{state.favorites.add(id);announce("Adicionado aos favoritos");}
    render();
  }
  function renderFeed(){
    const item=items[state.index];
    const liked=state.favorites.has(item.id);
    return '<div class="feed-layout"><div class="feed-stage" aria-label="Prato '+(state.index+1)+' de '+items.length+'">'+
      '<article class="reel">'+imageMarkup(item,"reel-image","eager")+'<div class="reel-placeholder" aria-hidden="true">'+item.emoji+'</div>'+
      '<div class="reel-pager" aria-hidden="true">'+items.map((_,i)=>'<span class="'+(i===state.index?"active":"")+'"></span>').join("")+'</div>'+
      '<div class="reel-top"><div class="reel-restaurant"><span class="restaurant-circle">S.</span> Studio Sabor</div><span class="media-label">FOTO ILUSTRATIVA · DEMO</span></div>'+
      '<div class="reel-top-icons"><button type="button" data-action="help" aria-label="Como funciona a demonstração">?</button></div>'+
      '<div class="reel-content"><p class="reel-kicker">'+escapeHTML(item.label)+' · '+escapeHTML(item.category)+'</p>'+
      '<h2 class="reel-title">'+escapeHTML(item.name)+'</h2><p class="reel-desc">'+escapeHTML(item.description)+'</p>'+
      '<div class="reel-price"><strong>'+brl(item.price)+'</strong><span>por porção</span></div>'+
      '<button class="reel-cta" type="button" data-action="detail" data-id="'+item.id+'" '+(!item.available?"disabled":"")+'><span>'+(item.available?"Personalizar e pedir":"Esgotado neste demo")+'</span><i aria-hidden="true">↗</i></button>'+
      '</div></article></div>'+
      '<div class="feed-switch" aria-label="Visualização"><button type="button" class="active" aria-current="page">Explorar</button><button type="button" data-action="nav" data-page="cardapio">Lista</button></div>'+
      '<div class="feed-controls">'+
      '<button class="control-circle" data-action="prev" type="button" aria-label="Prato anterior">↑</button>'+
      '<button class="control-circle" data-action="next" type="button" aria-label="Próximo prato">↓</button>'+
      '<button class="control-circle '+(liked?"primary":"")+'" data-action="fav" data-id="'+item.id+'" type="button" aria-pressed="'+liked+'" aria-label="'+(liked?"Remover favorito":"Salvar favorito")+'">'+(liked?"♥":"♡")+'</button>'+
      '<span class="feed-count">'+(state.index+1)+' / '+items.length+'</span></div></div>';
  }
  function filterItems(){
    const search=state.search.trim().toLocaleLowerCase("pt-BR");
    return items.filter(item=>(state.page!=="favoritos"||state.favorites.has(item.id))&&(state.category==="Todos"||item.category===state.category)&&(!search||(item.name+" "+item.description+" "+item.category).toLocaleLowerCase("pt-BR").includes(search)));
  }
  function renderCards(){
    const grid=document.getElementById("foodGrid");
    const counter=document.getElementById("resultCount");
    if(!grid)return;
    const filtered=filterItems();
    if(counter)counter.textContent=filtered.length+" prato"+(filtered.length===1?"":"s")+" encontrado"+(filtered.length===1?"":"s");
    grid.innerHTML=filtered.length?filtered.map(item=>{
      const liked=state.favorites.has(item.id);
      return '<article class="food-card">'+imageMarkup(item,"food-card-media")+'<div class="food-card-body"><span class="food-card-label">'+escapeHTML(item.category)+' · '+(item.available?"Disponível":"Esgotado")+'</span>'+
        '<h3>'+escapeHTML(item.name)+'</h3><p>'+escapeHTML(item.description)+'</p><div class="row"><strong>'+brl(item.price)+'</strong><button class="add-circle" type="button" data-action="detail" data-id="'+item.id+'" aria-label="'+(item.available?"Personalizar ":"Esgotado: ")+escapeHTML(item.name)+'" '+(!item.available?"disabled":"")+'>+</button></div>'+
        '<button class="favorite-inline" type="button" data-action="fav" data-id="'+item.id+'" aria-label="'+(liked?"Remover ":"Favoritar ")+escapeHTML(item.name)+'" aria-pressed="'+liked+'">'+(liked?"♥ Salvo":"♡ Favoritar")+'</button></div></article>';
    }).join(""):'<div class="empty-card"><span class="emoji">🍽️</span><h2>Nenhum prato por aqui</h2><p>Tente outra busca ou categoria.</p><button class="btn btn-secondary" type="button" data-action="reset-filters">Limpar filtros</button></div>';
  }
  function renderCollection(){
    const categoryOptions=["Todos",...new Set(items.map(i=>i.category))];
    const title=state.page==="favoritos"?"Seus favoritos":"Escolha do seu jeito";
    main.innerHTML='<div class="collection"><div class="collection-head"><div><span class="eyebrow">STUDIO SABOR · CARDÁPIO ILUSTRATIVO</span><h1>'+title+'</h1></div></div>'+
      '<p class="collection-desc">Fotos e valores fictícios para experimentar a jornada. Sem cobrança real.</p>'+
      '<label class="search-field"><span aria-hidden="true">⌕</span><input id="searchMenu" type="search" placeholder="Busque por prato ou ingrediente" autocomplete="off" value="'+escapeHTML(state.search)+'" aria-label="Buscar pratos"></label>'+
      '<div class="chips" aria-label="Categorias">'+categoryOptions.map(cat=>'<button type="button" data-action="category" data-category="'+escapeHTML(cat)+'" class="'+(state.category===cat?"active":"")+'" aria-pressed="'+(state.category===cat)+'">'+escapeHTML(cat)+'</button>').join("")+'</div>'+
      '<p id="resultCount" class="eyebrow" aria-live="polite"></p><div id="foodGrid" class="food-grid"></div></div>';
    renderCards();
  }
  function cartRows(){
    return state.cart.map((line,i)=>{
      const item=byId(line.itemId);
      if(!item)return "";
      return '<div class="cart-line">'+imageMarkup(item,"cart-thumb")+
        '<div class="cart-line-info"><b>'+escapeHTML(line.name)+'</b><small>'+escapeHTML(line.addons.join(", ")||"Sem adicionais")+'</small>'+
        (line.notes?'<small>Obs.: '+escapeHTML(line.notes)+'</small>':"")+
        '<div class="qty-actions"><button type="button" data-action="qty" data-index="'+i+'" data-delta="-1" aria-label="Diminuir quantidade de '+escapeHTML(line.name)+'">−</button><strong>'+line.quantity+'</strong><button type="button" data-action="qty" data-index="'+i+'" data-delta="1" aria-label="Aumentar quantidade de '+escapeHTML(line.name)+'" '+(line.quantity>=10?"disabled":"")+'>+</button></div></div><strong>'+brl(line.unitPrice*line.quantity)+'</strong></div>';
    }).join("");
  }
  function renderCart(){
    const hasItems=state.cart.length>0;
    main.innerHTML='<div class="collection"><span class="eyebrow">PEDIDO DEMONSTRATIVO · '+escapeHTML(tableLabel)+'</span><h1>Seu carrinho</h1>'+
      (hasItems?'<div class="cart-lines">'+cartRows()+'</div><div class="totals"><div class="total-row"><span>Subtotal</span><b>'+brl(cartTotal(state.cart))+'</b></div><div class="total-row"><span>Taxas nesta demonstração</span><span>'+brl(0)+'</span></div><div class="total-row"><strong>Total demonstrativo</strong><strong>'+brl(cartTotal(state.cart))+'</strong></div></div>'+
      '<p class="demo-note">Simulação: nenhum pedido será enviado ao restaurante e nenhuma cobrança será realizada.</p><button class="btn btn-primary btn-block" type="button" data-action="checkout">Revisar pedido →</button>'+
      '<button class="btn btn-secondary btn-block" type="button" data-action="nav" data-page="cardapio" style="margin-top:10px">Adicionar mais pratos</button>':
      '<div class="empty-card"><span class="emoji">🛒</span><h2>Seu carrinho está vazio</h2><p>Escolha um prato e personalize para começar.</p><button class="btn btn-primary" type="button" data-action="nav" data-page="explorar">Explorar pratos</button></div>')+'</div>';
  }
  function orderProgress(order){
    const current=statusSteps.indexOf(order.status);
    const terminal=["rejected","cancelled"].includes(order.status);
    return '<div class="order-steps">'+statusSteps.map((status,index)=>'<div class="step '+(!terminal&&(index<current?"done":index===current?"active":""))+'"><span class="step-dot">'+(index<current?"✓":index+1)+'</span><span>'+statusName[status]+'</span></div>').join("")+'</div>';
  }
  function renderOrders(){
    if(!state.orders.length){main.innerHTML='<div class="collection"><span class="eyebrow">ACOMPANHAMENTO SIMULADO</span><h1>Seus pedidos</h1><div class="empty-card"><span class="emoji">🧾</span><h2>Nada por enquanto</h2><p>Faça um pedido de demonstração para acompanhar as etapas.</p><button class="btn btn-primary" type="button" data-action="nav" data-page="explorar">Explorar cardápio</button></div></div>';return;}
    const o=lastOrder();
    main.innerHTML='<div class="collection"><span class="eyebrow">SIMULAÇÃO · NENHUM RESTAURANTE CONECTADO</span><h1>Acompanhe seu pedido</h1>'+
      '<div class="order-id"><small>Código ilustrativo · '+escapeHTML(tableLabel)+'</small><b>'+escapeHTML(o.id)+'</b></div>'+
      '<h2>'+escapeHTML(statusName[o.status])+'</h2><p class="collection-desc">Etapas controladas manualmente no painel de cozinha demonstrativo.</p>'+
      orderProgress(o)+'<div class="side-panel"><div class="total-row"><span>Itens</span><b>'+o.items.reduce((sum,l)=>sum+l.quantity,0)+'</b></div><div class="total-row"><span>Total ilustrativo</span><b>'+brl(o.total)+'</b></div>'+
      '<p>Pagamento: não exigido nesta simulação. Nenhuma transação ocorreu.</p></div>'+
      '<button class="btn btn-secondary btn-block" type="button" data-action="nav" data-page="cozinha" style="margin-top:18px">Abrir cozinha demo →</button>'+
      '<p class="collection-desc" style="margin-top:22px">Pedidos criados nesta sessão: '+state.orders.length+'. Não são salvos nem enviados a um servidor.</p></div>';
  }
  function renderKitchen(){
    const pending=state.orders.slice().reverse();
    main.innerHTML='<div class="collection"><span class="eyebrow">VISÃO DEMONSTRATIVA DO ESTABELECIMENTO</span><h1>Cozinha demo</h1>'+
      '<p class="collection-desc">Painel aberto apenas para testar a jornada. Não possui autenticação e não é adequado para pedidos reais.</p>'+
      '<div class="kitchen-list">'+(pending.length?pending.map(order=>{
        const next={submitted:"accepted",accepted:"preparing",preparing:"ready",ready:"completed"}[order.status];
        return '<article class="kitchen-ticket"><span class="eyebrow">'+escapeHTML(order.id)+' · '+escapeHTML(tableLabel)+'</span><h3>'+escapeHTML(statusName[order.status])+'</h3>'+
          '<p class="ticket-meta">Pedido ilustrativo · total '+brl(order.total)+'</p><ul>'+order.items.map(l=>'<li>'+l.quantity+'× '+escapeHTML(l.name)+(l.addons.length?" — "+escapeHTML(l.addons.join(", ")):"")+'</li>').join("")+'</ul>'+
          (next?'<button class="btn btn-primary" type="button" data-action="kitchen-next" data-id="'+order.id+'" data-next="'+next+'">'+escapeHTML(statusName[next])+' →</button>':"")+
          (order.status==="submitted"?'<button class="btn btn-secondary" type="button" data-action="kitchen-reject" data-id="'+order.id+'" style="margin-left:8px">Recusar demo</button>':"")+'</article>';
      }).join(""):'<div class="empty-card"><span class="emoji">👨‍🍳</span><h2>Sem pedidos de teste</h2><p>Monte um carrinho e envie um pedido simulado.</p><button class="btn btn-primary" data-action="nav" data-page="explorar">Ver pratos</button></div>')+'</div></div>';
  }
  function renderRight(){
    const count=totalCount();
    const sum=cartTotal(state.cart);
    right.innerHTML=count?
      '<div class="side-panel"><span class="eyebrow">'+count+' ITEM'+(count===1?"":"S")+' ADICIONADO'+(count===1?"":"S")+'</span><h3>Seu pedido está ganhando sabor.</h3><div class="summary-stat"><b>'+brl(sum)+'</b><small>Subtotal ilustrativo · sem pagamento</small></div><button class="btn btn-primary btn-block" type="button" data-action="nav" data-page="carrinho">Ver carrinho →</button></div><div class="right-helper"><span class="helper-icon">ⓘ</span><p>Protótipo demonstrativo. A cozinha real não recebe estes pedidos.</p></div>':
      '<div class="side-panel"><div class="hero-food-icon" aria-hidden="true">🍽️</div><h3>Seu próximo favorito está aqui.</h3><p>Explore o cardápio, personalize seu prato e acompanhe uma simulação de pedido.</p></div><div class="right-helper"><span class="helper-icon">ⓘ</span><p>Studio Sabor, preços e pedidos são fictícios.</p></div>';
  }
  function render(){
    renderNavigation();
    if(state.page==="explorar") main.innerHTML=renderFeed();
    else if(state.page==="cardapio"||state.page==="favoritos")renderCollection();
    else if(state.page==="carrinho")renderCart();
    else if(state.page==="pedido")renderOrders();
    else if(state.page==="cozinha")renderKitchen();
    renderRight();
  }
  function openModal(title,body,footer=""){
    const previous=document.activeElement;
    state.modal={previous};
    drawer.innerHTML='<div class="scrim" data-action="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header class="sheet-head"><h2 id="dialog-title">'+escapeHTML(title)+'</h2><button class="close-btn" type="button" data-action="close" aria-label="Fechar">×</button></header><div class="sheet-body">'+body+'</div>'+(footer?'<footer class="sheet-foot">'+footer+'</footer>':"")+'</section></div>';
    document.body.classList.add("modal-open");
    drawer.querySelector("[data-action=close]")?.focus();
  }
  function closeModal(restore=true){
    if(!state.modal)return;
    const previous=state.modal.previous;
    state.modal=null;state.draft=null;drawer.innerHTML="";
    document.body.classList.remove("modal-open");
    if(restore&&previous?.isConnected&&typeof previous.focus==="function")previous.focus();
  }
  function openDetail(id){
    const item=byId(id);
    if(!item||!item.available){announce("Prato indisponível nesta demonstração");return;}
    state.draft={itemId:id,addons:[],quantity:1,notes:""};
    showDetail();
  }
  function showDetail(){
    const draft=state.draft;if(!draft)return;
    const item=byId(draft.itemId);
    const price=item.price+draft.addons.reduce((sum,id)=>sum+item.addons.find(a=>a.id===id).price,0);
    const selectedCount=draft.addons.length;
    openModal("Personalize seu prato",imageMarkup(item,"detail-image","eager")+'<span class="food-card-label">'+escapeHTML(item.category)+'</span><h3 class="detail-title">'+escapeHTML(item.name)+'</h3><p class="detail-desc">'+escapeHTML(item.description)+'</p>'+
      '<p class="demo-note">Informações nutricionais e de alergênicos são ilustrativas: '+escapeHTML(item.allergens)+' Confirme sempre com o restaurante.</p>'+
      '<h4 class="label-heading">Adicionais opcionais (até 3)</h4>'+
      (item.addons.length?item.addons.map(a=>'<label class="option-row"><input type="checkbox" data-addon="'+a.id+'" '+(draft.addons.includes(a.id)?"checked":"")+' '+(selectedCount>=3&&!draft.addons.includes(a.id)?"disabled":"")+'><span>'+escapeHTML(a.name)+'</span><strong>'+brl(a.price)+'</strong></label>').join(""):'<p class="muted">Sem adicionais para este prato.</p>')+
      '<h4 class="label-heading">Quantidade</h4><div class="quantity"><button type="button" data-action="draft-qty" data-delta="-1" aria-label="Diminuir quantidade" '+(draft.quantity<=1?"disabled":"")+'>−</button><strong aria-live="polite">'+draft.quantity+'</strong><button type="button" data-action="draft-qty" data-delta="1" aria-label="Aumentar quantidade" '+(draft.quantity>=10?"disabled":"")+'>+</button></div>'+
      '<label class="field-label" for="detailNote">Observações (opcional)</label><textarea class="input" id="detailNote" maxlength="140" rows="2" placeholder="Ex.: sem cebola">'+escapeHTML(draft.notes)+'</textarea>',
      '<button class="btn btn-primary btn-block" type="button" data-action="add-cart">Adicionar ao carrinho · '+brl(price*draft.quantity)+'</button>');
  }
  function addToCart(){
    const draft=state.draft;if(!draft)return;
    const item=byId(draft.itemId);
    try{
      const line=cartLine(item,draft.addons,draft.quantity,draft.notes);
      const found=state.cart.find(existing=>existing.key===line.key);
      if(found){found.quantity=quantity(found.quantity+line.quantity);}
      else state.cart.push(line);
      closeModal(false);render();announce(item.name+" adicionado ao carrinho");
    }catch(error){announce(error.message||"Não foi possível adicionar o item");}
  }
  function changeQuantity(index,delta){
    const line=state.cart[index];if(!line)return;
    if(line.quantity+delta<=0)state.cart.splice(index,1);
    else{try{line.quantity=quantity(line.quantity+delta);}catch{announce("Máximo de 10 unidades por item");return;}}
    render();
  }
  function reviewCheckout(){
    if(!state.cart.length)return;
    const sum=cartTotal(state.cart);
    openModal("Revisar pedido",'<div class="demo-note">PEDIDO SIMULADO. Não enviaremos dados a restaurantes ou serviços de pagamento.</div>'+
      '<div class="order-id"><small>Local de demonstração</small><b>'+escapeHTML(tableLabel)+'</b></div>'+
      '<div class="cart-lines">'+cartRows().replaceAll('data-action="qty"','data-action="noop"')+'</div>'+
      '<div class="totals"><div class="total-row"><span>Subtotal ilustrativo</span><b>'+brl(sum)+'</b></div><div class="total-row"><span>Taxas</span><b>'+brl(0)+'</b></div><div class="total-row"><strong>Total</strong><strong>'+brl(sum)+'</strong></div></div>'+
      '<p class="collection-desc">Pagamento: não exigido na simulação. A confirmação será visível apenas nesta sessão.</p>',
      '<button class="btn btn-primary btn-block" type="button" data-action="submit-order">Confirmar pedido de teste →</button>');
  }
  function submitOrder(){
    if(!state.cart.length){announce("Carrinho vazio");return;}
    const now=Date.now();
    const id="TAP-"+String(now).slice(-6)+"-"+(state.orders.length+1);
    const itemsSnapshot=state.cart.map(l=>({...l,addonIds:[...l.addonIds],addons:[...l.addons]}));
    const order={id,items:itemsSnapshot,status:"submitted",paymentStatus:"not_required",total:cartTotal(itemsSnapshot),createdAt:now};
    state.orders.push(order);
    state.cart=[];
    closeModal(false);
    state.page="pedido";render();
    announce("Pedido de demonstração criado");
  }
  function progressOrder(id,next){
    const order=state.orders.find(o=>o.id===id);if(!order)return;
    try{order.status=nextOrderStatus(order.status,next);render();announce("Status demonstrativo atualizado");}
    catch(error){announce(error.message);}
  }
  function help(){
    openModal("Sobre o TapFlow",'<p class="detail-desc">Bem-vindo ao TapFlow, um protótipo da ALVO Digital. Nesta versão, pratos, preços, imagens, mesas e pedidos são ilustrativos.</p>'+
      '<div class="demo-note">O pedido de teste fica somente na memória desta aba e desaparece ao recarregar a página. Não existem pagamentos, restaurante conectado, autenticação ou serviço de entrega.</div>'+
      '<h3 class="label-heading">Como testar</h3><p class="detail-desc">Explore os pratos com as setas, selecione adicionais, adicione ao carrinho, envie o pedido simulado e abra “Cozinha demo” para avançar seus estados.</p>'+
      '<p class="detail-desc">QR Code e NFC serão integrados no futuro com tokens seguros por mesa.</p>');
  }
  document.addEventListener("click",event=>{
    const control=event.target.closest("[data-action]");if(!control)return;
    const action=control.dataset.action;
    if(action==="backdrop"&&event.target!==control)return;
    if(action==="nav"){setPage(control.dataset.page);return;}
    if(action==="explore"){event.preventDefault();setPage("explorar");return;}
    if(action==="next"||action==="prev"){state.index=(state.index+(action==="next"?1:items.length-1))%items.length;render();return;}
    if(action==="fav"){toggleFavorite(control.dataset.id);return;}
    if(action==="detail"){openDetail(control.dataset.id);return;}
    if(action==="category"){state.category=control.dataset.category;renderCollection();return;}
    if(action==="reset-filters"){state.search="";state.category="Todos";renderCollection();return;}
    if(action==="draft-qty"){if(!state.draft)return;const n=state.draft.quantity+Number(control.dataset.delta);if(n>=1&&n<=10){state.draft.quantity=n;showDetail();}return;}
    if(action==="add-cart"){addToCart();return;}
    if(action==="qty"){changeQuantity(Number(control.dataset.index),Number(control.dataset.delta));return;}
    if(action==="checkout"){reviewCheckout();return;}
    if(action==="submit-order"){submitOrder();return;}
    if(action==="kitchen-next"){progressOrder(control.dataset.id,control.dataset.next);return;}
    if(action==="kitchen-reject"){progressOrder(control.dataset.id,"rejected");return;}
    if(action==="help"){help();return;}
    if(action==="close"||action==="backdrop"){closeModal();return;}
  });
  document.addEventListener("input",event=>{
    if(event.target.id==="searchMenu"){state.search=event.target.value;renderCards();}
    if(event.target.id==="detailNote"&&state.draft)state.draft.notes=event.target.value.slice(0,140);
  });
  document.addEventListener("change",event=>{
    const box=event.target.closest("[data-addon]");if(!box||!state.draft)return;
    const id=box.dataset.addon;
    if(box.checked){if(state.draft.addons.length>=3){box.checked=false;announce("Escolha até 3 adicionais");return;}state.draft.addons.push(id);}
    else state.draft.addons=state.draft.addons.filter(x=>x!==id);
    // Preservar observação e recalcular o total exibido.
    const note=document.getElementById("detailNote");if(note)state.draft.notes=note.value;
    showDetail();
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&state.modal){closeModal();return;}
    if(state.modal){
      if(event.key==="Tab"){
        const focusable=[...drawer.querySelectorAll("button:not(:disabled),input:not(:disabled),textarea:not(:disabled)")];
        if(focusable.length){
          const first=focusable[0],last=focusable[focusable.length-1];
          if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
          else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
        }
      }
      return;
    }
    if(state.page!=="explorar"||event.target.closest("input,textarea,[contenteditable]"))return;
    if(event.key==="ArrowDown"||event.key==="ArrowRight"){event.preventDefault();state.index=(state.index+1)%items.length;render();}
    if(event.key==="ArrowUp"||event.key==="ArrowLeft"){event.preventDefault();state.index=(state.index+items.length-1)%items.length;render();}
  });
  let swipeStart=null;
  main.addEventListener("pointerdown",e=>{if(state.page==="explorar"&&e.target.closest(".reel"))swipeStart={y:e.clientY,x:e.clientX};});
  main.addEventListener("pointerup",e=>{
    if(!swipeStart||state.page!=="explorar"){swipeStart=null;return;}
    const dy=e.clientY-swipeStart.y,dx=e.clientX-swipeStart.x;swipeStart=null;
    if(Math.abs(dy)>70&&Math.abs(dy)>Math.abs(dx)*1.2){state.index=(state.index+(dy<0?1:items.length-1))%items.length;render();}
  });
  main.addEventListener("wheel",e=>{
    if(state.page!=="explorar"||!e.target.closest(".feed-layout")||Math.abs(e.deltaY)<16)return;
    e.preventDefault();
    const now=Date.now();
    if(now-state.scrollLock<490)return;
    state.scrollLock=now;state.index=(state.index+(e.deltaY>0?1:items.length-1))%items.length;render();
  },{passive:false});
  // Imagens são decorativas e externas; sem conexão não impedem a compra simulada.
  document.addEventListener("error",e=>{if(e.target instanceof HTMLImageElement){e.target.classList.add("image-failed");}},true);
  const hash=location.hash.replace("#","");
  if(NAV.some(n=>n.id===hash))state.page=hash;
  render();
})().catch(error=>{console.error('TapFlow demo:',error);const main=document.getElementById('mainContent');if(main)main.textContent='Não foi possível abrir a demonstração. Recarregue a página.';});
