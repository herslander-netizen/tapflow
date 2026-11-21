const domain = (function domainFactory(){
  const transitions = Object.freeze({
    submitted:["accepted","rejected"],
    accepted:["preparing","cancelled"],
    preparing:["ready"],
    ready:["completed"],
    completed:[],
    rejected:[],
    cancelled:[]
  });
  function integer(value){return Number.isInteger(value) && value>=0;}
  function brl(cents){
    if(!integer(cents)) throw new RangeError("Valor em centavos inválido");
    return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(cents/100);
  }
  function quantity(value){
    const n=Number(value);
    if(!Number.isInteger(n)||n<1||n>10) throw new RangeError("Quantidade de 1 a 10");
    return n;
  }
  function unitPrice(item,addonIds=[]){
    if(!item||!integer(item.price)) throw new TypeError("Produto inválido");
    const unique=[...new Set(addonIds)];
    if(unique.length>3) throw new RangeError("Máximo de 3 adicionais");
    let price=item.price;
    for(const id of unique){
      const addon=item.addons.find(a=>a.id===id);
      if(!addon||!integer(addon.price)) throw new TypeError("Adicional inválido");
      price+=addon.price;
    }
    return price;
  }
  function cartLine(item,addonIds,qty,notes=""){
    if(item.available===false) throw new Error("Produto esgotado");
    const ids=[...new Set(addonIds)].sort();
    const count=quantity(qty);
    const clean=String(notes).trim().slice(0,140);
    const unit=unitPrice(item,ids);
    return {key:[item.id,...ids,clean].join("|"),itemId:item.id,name:item.name,image:item.image,emoji:item.emoji,addonIds:ids,addons:ids.map(id=>item.addons.find(a=>a.id===id).name),quantity:count,notes:clean,unitPrice:unit,total:unit*count};
  }
  function cartTotal(lines){
    return lines.reduce((sum,line)=>{
      if(!integer(line.unitPrice)||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>10) throw new TypeError("Linha inválida");
      return sum+line.unitPrice*line.quantity;
    },0);
  }
  function nextOrderStatus(current,next){
    if(!Object.prototype.hasOwnProperty.call(transitions,current)||!transitions[current].includes(next))throw new Error("Transição de pedido não permitida");
    return next;
  }
  return {brl,quantity,unitPrice,cartLine,cartTotal,nextOrderStatus,transitions};
})();
export const { brl,quantity,unitPrice,cartLine,cartTotal,nextOrderStatus,transitions } = domain;
