import {applyTheme} from "./theme.mjs";
import {demoPhoto,demoVideo} from "./public-menu-photos.mjs";
const $=id=>document.getElementById(id);
const path=/^\/cardapio\/([a-z0-9-]{1,64})\/([A-Za-z0-9_-]{1,64})\/?$/.exec(location.pathname);
const [status,retry,catalog,items,search]=["menuStatus","retry","catalog","menuItems","menuSearch"].map($);
const price=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const normalize=value=>String(value??"").normalize("NFD").replace(/\p{Mark}/gu,"").toLocaleLowerCase("pt-BR");
const element=(type,text)=>{const node=document.createElement(type);node.textContent=text;return node;};
const clearFilters=$("clearFilters");
const expanded=new Set();
let records=[],selected="",restricted=false;
function picture(base,{large=false,loading="lazy",alt=""}={}){
  const output=element("picture"),source=element("source"),image=element("img");
  const size=large?720:192;
  source.type="image/webp";
  source.srcset=large?base+"-720.webp":base+"-96.webp 96w, "+base+"-192.webp 192w";
  if(!large)source.sizes="78px";
  image.width=size;image.height=size*2/3;image.alt=alt;
  image.loading=loading;image.decoding="async";
  output.append(source,image);
  return {output,image,src:base+"-"+size+".jpg"};
}
function videoOption(base,name,photo){
  const section=element("div"), button=element("button","Ver em vídeo"), status=element("p");
  section.className="demo-video";
  button.type="button";
  status.setAttribute("role","status");
  section.append(button,status);
  let video;
  function release(){
    if(!video)return;
    const target=video;
    video=undefined;
    target.pause();
    target.removeAttribute("src");
    target.load();
    target.remove();
  }
  button.addEventListener("click",()=>{
    if(video){
      release();
      photo.hidden=false;
      status.textContent="";
      button.textContent="Ver em vídeo";
      return;
    }
    const player=element("video");
    player.controls=true;
    player.playsInline=true;
    player.muted=true;
    player.preload="metadata";
    player.setAttribute("aria-label","Animação demonstrativa de "+name);
    const formats=[["webm","video/webm"],["mp4","video/mp4"]];
    const supported=formats.filter(([,type])=>player.canPlayType(type));
    button.disabled=true;
    status.textContent="Carregando animação…";
    video=player;
    function unavailable(){
      release();
      photo.hidden=false;
      button.textContent="Ver em vídeo";
      status.textContent="O vídeo não carregou. A foto e a descrição continuam disponíveis.";
      button.disabled=false;
      button.focus();
    }
    function nextFormat(){
      if(video!==player)return;
      const format=supported.shift();
      if(!format){unavailable();return;}
      player.src=base+"."+format[0];
    }
    player.addEventListener("error",nextFormat);
    player.addEventListener("loadedmetadata",()=>{
      if(video!==player)return;
      photo.hidden=true;
      button.disabled=false;
      button.textContent="Voltar à foto";
      status.textContent="Animação demonstrativa · sem áudio";
      player.focus();
    });
    player.tabIndex=0;
    section.append(player);
    nextFormat();
  });
  return {section,release};
}
const viewer=$("reelsViewer"), track=$("reelsTrack"), position=$("reelsPosition");
const closeReels=$("closeReels"), previous=$("previousReel"), next=$("nextReel");
const historyKey="tapflowStorefrontReels";
const modalSupported=typeof viewer.showModal==="function";
const isOpen=()=>viewer.hasAttribute("open");
const shell=document.querySelector(".menu-shell");
let visibleRecords=[], reelSession=null, slides=[], active=-1, motion=null, closing=false, scrollFrame=0;
function photoTrigger(item,base,index){
  const button=element("button");
  button.type="button";
  button.className="item-photo";
  button.setAttribute("aria-label","Ver no Reels: "+item.name);
  if(base){
    const thumb=picture(base,{loading:index<2?"eager":"lazy"});
    thumb.image.addEventListener("error",()=>thumb.output.remove());
    button.append(thumb.output);
    thumb.image.src=thumb.src;
  }
  button.append(element("span","Ver no Reels"));
  button.addEventListener("click",()=>openReels(item,button));
  return button;
}
function makeSlide(item,index,total){
  const slide=element("article"), detail=element("div"), photo=element("div");
  slide.className="reels-frame";
  slide.setAttribute("aria-label",String(index+1)+" de "+total+": "+item.name);
  detail.className="reels-details";
  if(item.categoryName)detail.append(element("p",item.categoryName));
  detail.append(element("h2",item.name),element("strong",price.format(item.priceCents/100)));
  if(item.description)detail.append(element("p",item.description));
  if(!item.available)detail.append(element("p","Esgotado"));
  if(item.addons.length){
    const extras=element("details"), list=element("ul");
    extras.append(element("summary","Adicionais"));
    for(const addon of item.addons)list.append(element("li",addon.name+" · "+price.format(addon.priceCents/100)));
    extras.append(list);detail.append(extras);
  }
  detail.append(element("p","Para pedir, fale com a equipe."));
  photo.className="reels-photo";
  const base=demoPhoto(path?.[1],path?.[2],item.id);
  if(base){
    const image=picture(base,{large:true,loading:"lazy",alt:"Foto ilustrativa de "+item.name});
    image.image.addEventListener("error",()=>photo.replaceChildren(element("p","Foto indisponível")));
    photo.append(image.output,element("p","Foto ilustrativa da demonstração."));
    image.image.src=image.src;
  }else photo.append(element("p","Foto indisponível"));
  const media=element("div");
  slide.append(photo,detail,media);
  return {slide,photo,media,item};
}
function releaseMotion(){
  motion?.release();
  motion?.section.remove();
  motion=null;
  if(slides[active])slides[active].photo.hidden=false;
}
function activate(index){
  if(!reelSession||index===active||!slides[index])return;
  const previousTop=slides[index].slide.getBoundingClientRect().top;
  releaseMotion();
  active=index;reelSession.index=index;
  position.textContent=(index+1)+" de "+slides.length;
  previous.setAttribute("aria-disabled",String(index===0));
  next.setAttribute("aria-disabled",String(index===slides.length-1));
  const {item,photo,media}=slides[index];
  const videoBase=demoVideo(path?.[1],path?.[2],item.id);
  if(videoBase){motion=videoOption(videoBase,item.name,photo);media.append(motion.section);}
  // Releasing a player above the active item can change its measured position.
  const adjustment=slides[index].slide.getBoundingClientRect().top-previousTop;
  if(adjustment)track.scrollTop+=adjustment;
}
function moveTo(index){
  if(!slides[index]||index===active)return;
  const target=slides[index].slide;
  activate(index);
  track.scrollTop+=target.getBoundingClientRect().top-track.getBoundingClientRect().top;
}
function showReels(){
  if(isOpen()||!reelSession)return;
  slides=reelSession.items.map((item,index)=>makeSlide(item,index,reelSession.items.length));
  track.replaceChildren(...slides.map(entry=>entry.slide));
  if(modalSupported)viewer.showModal();
  else{
    viewer.setAttribute("open","");
    viewer.setAttribute("aria-modal","true");
    viewer.setAttribute("role","dialog");
    shell.inert=true;
  }
  closeReels.focus({preventScroll:true});
  moveTo(reelSession.index);
}
function openReels(item,trigger){
  if(isOpen()||closing)return;
  const index=visibleRecords.indexOf(item);
  if(index<0)return;
  reelSession={id:Math.random().toString(36).slice(2),items:[...visibleRecords],index,trigger,scrollX:window.scrollX,scrollY:window.scrollY};
  try{history.pushState({...history.state,[historyKey]:reelSession.id},"",location.href);}
  catch{reelSession.id=null;}
  showReels();
}
function hideReels(){
  if(!isOpen())return;
  cancelAnimationFrame(scrollFrame);scrollFrame=0;
  releaseMotion();
  if(modalSupported)viewer.close();
  else{viewer.removeAttribute("open");shell.inert=false;}
  track.replaceChildren();slides=[];active=-1;
  const session=reelSession;
  if(session){
    (session.trigger.isConnected?session.trigger:search).focus({preventScroll:true});
    const restoreScroll=()=>window.scrollTo({left:session.scrollX,top:session.scrollY,behavior:"instant"});
    restoreScroll();
    requestAnimationFrame(()=>{
      if(!isOpen()&&reelSession===session&&!closing&&document.activeElement===(session.trigger.isConnected?session.trigger:search))restoreScroll();
    });
  }
}
function exitReels(){
  if(closing||!isOpen())return;
  if(reelSession?.id&&history.state?.[historyKey]===reelSession.id){closing=true;history.back();}
  else hideReels();
}
closeReels.addEventListener("click",exitReels);
viewer.addEventListener("cancel",event=>{event.preventDefault();exitReels();});
viewer.addEventListener("keydown",event=>{
  if(modalSupported)return;
  if(event.key==="Escape"){event.preventDefault();exitReels();return;}
  if(event.key!=="Tab")return;
  const controls=[...viewer.querySelectorAll("button:not(:disabled),[tabindex='0'],summary")].filter(el=>el.getClientRects().length);
  const index=controls.indexOf(document.activeElement);
  if(index<0||event.shiftKey&&index===0||!event.shiftKey&&index===controls.length-1){
    event.preventDefault();
    (event.shiftKey?controls.at(-1):controls[0])?.focus();
  }
});
previous.addEventListener("click",()=>moveTo(active-1));
next.addEventListener("click",()=>moveTo(active+1));
track.addEventListener("keydown",event=>{
  if(event.target!==track||!["ArrowUp","ArrowDown"].includes(event.key))return;
  event.preventDefault();
  moveTo(active+(event.key==="ArrowUp"?-1:1));
});
track.addEventListener("scroll",()=>{
  if(scrollFrame||!isOpen())return;
  scrollFrame=requestAnimationFrame(()=>{
    scrollFrame=0;
    if(!isOpen())return;
    const top=track.getBoundingClientRect().top+Math.min(72,track.clientHeight/4);
    const current=slides.findIndex(({slide})=>slide.getBoundingClientRect().bottom>top);
    if(current>=0)activate(current);
  });
});
window.addEventListener("popstate",event=>{
  closing=false;
  if(reelSession?.id&&event.state?.[historyKey]===reelSession.id)showReels();
  else hideReels();
});
window.addEventListener("pagehide",()=>{if(isOpen())releaseMotion();});
window.addEventListener("pageshow",event=>{
  if(event.persisted&&isOpen()&&active>=0){
    const index=active;active=-1;activate(index);
  }
});
function render(){
  const query=normalize(search.value).trim();
  const visible=records.filter(item=>(!selected||item.categoryId===selected)&&normalize([item.name,item.description,item.categoryName].join(" ")).includes(query));
  visibleRecords=visible;
  items.replaceChildren(...visible.map((item,index)=>{
    const li=document.createElement("li");li.className="menu-item";
    if(item.categoryName){const category=element("p",item.categoryName);category.className="label";li.append(category);}
    const head=element("div");
    head.className="item-heading";
    head.append(element("h2",item.name),element("strong",price.format(item.priceCents/100)));
    const body=element("div");body.className="item-body";
    body.append(head);
    if(item.description){const description=element("p",item.description);description.className="item-description";body.append(description);}
    const base=demoPhoto(path?.[1],path?.[2],item.id);
    const row=element("div");row.className="item-row";
    row.append(body,photoTrigger(item,base,index));li.append(row);
    if(!item.available){const unavailable=element("p","Esgotado");unavailable.className="item-status";li.append(unavailable);}
    if(item.addons.length){
      const details=document.createElement("details"),list=document.createElement("ul");
      const summary=element("summary");
      summary.append(element("span","Adicionais"),element("small",String(item.addons.length)));
      summary.setAttribute("aria-label",`Adicionais de ${item.name}: ${item.addons.length}`);
      details.append(summary);
      details.open=expanded.has(item.id);
      // A rebuilt or filtered card must not change the saved disclosure state.
      details.addEventListener("toggle",()=>{
        if(!details.isConnected)return;
        if(details.open)expanded.add(item.id);else expanded.delete(item.id);
      });
      for(const addon of item.addons)list.append(element("li",addon.name+" · "+price.format(addon.priceCents/100)));
      details.append(list);li.append(details);
    }
    return li;
  }));
  clearFilters.hidden=!!visible.length||!records.length||(!query&&!selected);
  status.textContent= !records.length?"Este cardápio ainda não tem itens disponíveis.": !visible.length?"Nenhum item encontrado.":visible.length+" "+(visible.length===1?"item":"itens")+(restricted?" · catálogo parcial":"");
}
function categories(){
  const options=new Map(records.filter(i=>i.categoryId).map(i=>[i.categoryId,i.categoryName]));
  $("categories").hidden=!options.size;
  const bar=$("categoryButtons");
  bar.replaceChildren(...[["","Todos"],...options].map(([id,name])=>{
    const button=element("button",name);button.type="button";button.dataset.category=id;
    const check=element("span","✓");
    check.className="selected-mark";
    check.setAttribute("aria-hidden","true");
    button.prepend(check);
    button.setAttribute("aria-pressed",String(id===selected));
    button.addEventListener("click",()=>{
      selected=id;
      for(const b of bar.children)b.setAttribute("aria-pressed",String(b.dataset.category===id));
      render();
    });
    return button;
  }));
}
async function load({fromRetry=false}={}){
  retry.hidden=true;catalog.hidden=true;status.textContent="Carregando cardápio…";
  if(!path){status.textContent="Link de cardápio inválido.";return;}
  try{
    const choice=new URLSearchParams(location.search).getAll("mesa");
    if(choice.length>1||(choice.length===1&&!/^[A-Za-z0-9_-]{1,64}$/.test(choice[0]))){
      status.textContent="Link de mesa inválido. Peça o endereço à equipe.";return;
    }
    const table=choice.length?"?mesa="+encodeURIComponent(choice[0]):"";
    const response=await fetch("/api/public/menu/"+path[1]+"/"+path[2]+table,{cache:"no-store",signal:AbortSignal.timeout(12000)});
    if(response.status===404){status.textContent=table?"Este cardápio ou mesa está indisponível. Confirme com a equipe.":"Este cardápio ainda não foi publicado ou está indisponível.";return;}
    if(!response.ok)throw Error("Falha de rede");
    const data=await response.json();
    applyTheme(document.documentElement,data.appearance);
    document.title=data.name+" | Cardápio";
    $("storeTitle").textContent=data.name;$("storeLocation").textContent=data.location.name;
    const tableBadge=$("tableBadge");tableBadge.hidden=!data.table?.label;tableBadge.textContent=data.table?.label??"";
    records=data.items;restricted=data.limited;selected="";search.value="";expanded.clear();
    catalog.hidden=false;categories();render();
    if(fromRetry&&document.activeElement===document.body)search.focus();
  }catch{
    status.textContent="Não foi possível carregar o cardápio. Confira sua conexão e tente de novo.";
    retry.hidden=false;
  }
}
clearFilters.addEventListener("click",()=>{
  search.value="";selected="";
  for(const button of $("categoryButtons").children)button.setAttribute("aria-pressed",String(button.dataset.category===""));
  search.focus();
  render();
});
search.addEventListener("input",render);retry.addEventListener("click",()=>load({fromRetry:true}));load();
