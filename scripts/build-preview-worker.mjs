// Build local do Worker TapFlow DEMO, sem segredos e sem deploy.
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const names=["index.html","styles.css","experience.css","app.js","domain.mjs","demo-data.js","media.mjs"];
const files={};
for(const name of names)files["/"+name]=await readFile(resolve(root,"apps/web",name),"utf8");
if(!files["/index.html"].includes("mainContent")||!files["/app.js"].includes("renderFeed"))throw Error("Fontes da experiência incompletas");
const code=[
  "// TapFlow - preview demonstrativa ALVO Digital. Sem pedidos reais.",
  "const FILES="+JSON.stringify(files)+";",
  "const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8'};",
  "const CSP=\"default-src 'self'; base-uri 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; media-src 'self' https://upload.wikimedia.org; connect-src 'self'; object-src 'none'; frame-ancestors 'none';\";",
  "const headers=(type,cache)=>({'content-type':type,'cache-control':cache,'content-security-policy':CSP,'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','x-frame-options':'DENY'});",
  "export default {async fetch(request,env){",
  "const url=new URL(request.url);",
  "if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({error:'A demonstração não recebe pedidos reais.'}),{status:405,headers:{...headers('application/json; charset=utf-8','no-store'),'allow':'GET, HEAD'}});",
  "if(url.pathname==='/api/health'){let databaseConnected=false;try{const row=await env.DB.prepare('SELECT COUNT(*) AS total FROM tenants').first();databaseConnected=Number.isInteger(row?.total);}catch{}const body=JSON.stringify({product:'TapFlow',environment:'preview',status:'demo-only',databaseConnected,ordersPersistent:false,paymentsEnabled:false,aiEnabled:false});return new Response(request.method==='HEAD'?null:body,{status:databaseConnected?200:503,headers:headers('application/json; charset=utf-8','no-store')});}",
  "const path=url.pathname==='/'?'/index.html':url.pathname;const body=FILES[path];",
  "if(typeof body!=='string')return new Response('Página não encontrada',{status:404,headers:headers('text/plain; charset=utf-8','no-store')});",
  "const ext=path.slice(path.lastIndexOf('.'));return new Response(request.method==='HEAD'?null:body,{status:200,headers:headers(MIME[ext]||'text/plain; charset=utf-8',ext==='.html'?'public, max-age=60':'public, max-age=600')});",
  "}};"
].join("\n");
const out=resolve(root,".build","tapflow-preview-worker.mjs");
await mkdir(dirname(out),{recursive:true});
await writeFile(out,code,"utf8");
console.log("Worker DEMO gerado sem deploy:",out,code.length,"caracteres");
