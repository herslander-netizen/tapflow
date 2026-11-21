// Prepare isolated assets only. No cloud calls, migrations or deploy.
import {cp,mkdir,readFile,rm,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {join} from "node:path";
const root=fileURLToPath(new URL("../",import.meta.url));
const assets=join(root,".build","merchant-preview-assets");
const packageDir=join(root,"node_modules","@auth0","auth0-spa-js");
const pkg=JSON.parse(await readFile(join(packageDir,"package.json"),"utf8"));
if(pkg.version!=="2.30.0")throw Error("SDK inesperado; revise package-lock.json.");
await rm(assets,{recursive:true,force:true});
await cp(join(root,"apps","web"),assets,{recursive:true});
await mkdir(join(assets,"vendor"),{recursive:true});
const source=await readFile(join(packageDir,"dist","auth0-spa-js.production.esm.js"),"utf8");
await writeFile(join(assets,"vendor","auth0-spa.production.mjs"),source.replace(/\n\/\/# sourceMappingURL=[^\n]+\s*$/,"\n"));
await cp(join(packageDir,"LICENSE"),join(assets,"vendor","auth0-spa.LICENSE.txt"));
console.log("Assets isolados do painel prontos; nenhum deploy executado.");
