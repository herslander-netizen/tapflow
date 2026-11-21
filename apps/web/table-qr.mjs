const part=/^[A-Za-z0-9_-]{1,64}$/;
const slugAllowed=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function tableMenuLink(origin,slug,locationId,tableId){
  if(typeof slug!=="string"||slug.length>48||!slugAllowed.test(slug)||
     typeof locationId!=="string"||!part.test(locationId)||typeof tableId!=="string"||!part.test(tableId))return null;
  try{
    const base=new URL(origin);
    if(base.origin!==origin||!(base.protocol==="https:"||
      (base.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(base.hostname))))return null;
    return new URL(`/cardapio/${slug}/${locationId}?mesa=${tableId}`,base);
  }catch{return null;}
}

export async function downloadTableQr({document,url,stillCurrent=()=>true}={}){
  if(!(url instanceof URL))throw TypeError("Link inválido");
  const {default:make}=await import("/vendor/qrcode-generator.mjs");
  const source=make(0,"M");
  source.addData(url.href,"Byte");
  source.make();
  if(!stillCurrent())return false;
  // The encoder receives only a public URL, never auth or a one-use order code.
  // The matrix outputs only numeric geometry and fixed monochrome colors.
  const size=source.getModuleCount(),bounds=size+8;
  let path="";
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(source.isDark(y,x))path+=`M${x+4} ${y+4}h1v1h-1z`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bounds} ${bounds}" width="360" height="360" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h${bounds}v${bounds}H0z"/><path fill="#000" d="${path}"/></svg>`;
  const file=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));
  const a=document.createElement("a");
  a.href=file;a.download="tapflow-qr-mesa.svg";
  document.body.append(a);
  try{a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(file),1000);}
  return true;
}
