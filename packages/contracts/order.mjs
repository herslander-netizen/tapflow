// Contrato puro de pedido para o TapFlow; sem rede, pagamento ou banco.
export function validateOrder(input){
 if(!input||typeof input!=="object")throw Error("Pedido inválido");
 const id=v=>typeof v==="string"&&/^[a-zA-Z0-9_-]{1,64}$/.test(v);
 if(!id(input.tenantId)||!id(input.tableId))throw Error("Tenant ou mesa inválidos");
 if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>30)throw Error("Itens inválidos");
 const lines=input.lines.map(l=>{
  if(!id(l.itemId)||!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>10)throw Error("Produto ou quantidade inválidos");
  if(!Array.isArray(l.addonIds)||l.addonIds.length>3||l.addonIds.some(a=>!id(a)))throw Error("Adicionais inválidos");
  return {itemId:l.itemId,quantity:l.quantity,addonIds:[...new Set(l.addonIds)].sort(),notes:typeof l.notes==="string"?l.notes.trim().slice(0,140):""};
 });
 return {tenantId:input.tenantId,tableId:input.tableId,lines};
}
export function quoteOrder(input,catalog){
 const order=validateOrder(input);
 const safe=v=>Number.isSafeInteger(v)&&v>=0&&v<=100000000;
 const lines=order.lines.map(l=>{
  const item=catalog.find(i=>i.id===l.itemId&&i.tenantId===order.tenantId&&i.available!==false);
  if(!item||!safe(item.price))throw Error("Produto indisponível ou preço inválido");
  const addons=l.addonIds.map(id=>{
   const a=(item.addons||[]).find(a=>a.id===id&&a.available!==false);
   if(!a||!safe(a.price))throw Error("Adicional indisponível");
   return {id:a.id,name:a.name,price:a.price};
  });
  const unitPrice=item.price+addons.reduce((n,a)=>n+a.price,0);
  const total=unitPrice*l.quantity;
  if(!safe(total))throw Error("Total inválido");
  return {...l,name:item.name,unitPrice,total,addons};
 });
 const total=lines.reduce((n,l)=>n+l.total,0);
 if(!safe(total))throw Error("Total inválido");
 return {...order,lines,total,currency:"BRL",paymentStatus:"not_required"};
}
