import {applyTheme} from "./theme.mjs";
const $=id=>document.getElementById(id);
const path=/^\/cardapio\/([a-z0-9-]{1,64})\/([A-Za-z0-9_-]{1,64})\/?$/.exec(location.pathname);
const [status,retry,catalog,items,search]=["menuStatus","retry","catalog","menuItems","menuSearch"].map($);
const price=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const normalize=value=>String(value??"").normalize("NFD").replace(/\p{Mark}/gu,"").toLocaleLowerCase("pt-BR");
const element=(type,text)=>{const node=document.createElement(type);node.textContent=text;return node;};
let records=[],selected="",restricted=false;
function render(){
  const query=normalize(search.value).trim();
  const visible=records.filter(item=>(!selected||item.categoryId===selected)&&normalize([item.name,item.description,item.categoryName].join(" ")).includes(query));
  items.replaceChildren(...visible.map(item=>{
    const li=document.createElement("li");li.className="menu-item";
    if(item.categoryName){const category=element("p",item.categoryName);category.className="label";li.append(category);}
    li.append(element("h2",item.name));
    if(item.description)li.append(element("p",item.description));
    li.append(element("strong",price.format(item.priceCents/100)));
    if(!item.available)li.append(element("p","Esgotado"));
    if(item.addons.length){
      const details=document.createElement("details"),list=document.createElement("ul");
      details.append(element("summary","Ver adicionais"));
      for(const addon of item.addons)list.append(element("li",addon.name+" · "+price.format(addon.priceCents/100)));
      details.append(list);li.append(details);
    }
    return li;
  }));
  status.textContent= !records.length?"Este cardápio ainda não tem itens disponíveis.": !visible.length?"Nenhum item encontrado.":visible.length+" "+(visible.length===1?"item":"itens")+(restricted?" · catálogo parcial":"");
}
function categories(){
  const options=new Map(records.filter(i=>i.categoryId).map(i=>[i.categoryId,i.categoryName]));
  $("categories").hidden=!options.size;
  const bar=$("categoryButtons");
  bar.replaceChildren(...[["","Todos"],...options].map(([id,name])=>{
    const button=element("button",name);button.type="button";button.dataset.category=id;
    button.setAttribute("aria-pressed",String(id===selected));
    button.addEventListener("click",()=>{
      selected=id;
      for(const b of bar.children)b.setAttribute("aria-pressed",String(b.dataset.category===id));
      render();
    });
    return button;
  }));
}
async function load(){
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
    records=data.items;restricted=data.limited;selected="";search.value="";
    catalog.hidden=false;categories();render();
  }catch{
    status.textContent="Não foi possível carregar o cardápio. Confira sua conexão e tente de novo.";
    retry.hidden=false;
  }
}
search.addEventListener("input",render);retry.addEventListener("click",load);load();
