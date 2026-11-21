import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
const root=resolve(process.cwd(),"apps/web");
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8"};
const port=Number(process.env.PORT||4173);
createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
    const candidate=resolve(root,"."+pathname.replace(/\/$/,"/index.html"));
    if(candidate!==root&&!candidate.startsWith(root+sep)){res.writeHead(403).end("Proibido");return;}
    const info=await stat(candidate);
    if(!info.isFile())throw new Error("Não é arquivo");
    const bytes=await readFile(candidate);
    res.writeHead(200,{"content-type":types[extname(candidate)]||"application/octet-stream","cache-control":"no-store","x-content-type-options":"nosniff"});
    res.end(bytes);
  }catch{res.writeHead(404,{"content-type":"text/plain; charset=utf-8"}).end("Não encontrado");}
}).listen(port,"127.0.0.1",()=>console.log("TapFlow demo: http://127.0.0.1:"+port));
