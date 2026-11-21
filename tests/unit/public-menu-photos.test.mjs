import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {demoPhoto} from "../../apps/web/public-menu-photos.mjs";

test("fotos demonstrativas não cruzam vitrines, lojas ou IDs",()=>{
  const resolve=id=>demoPhoto("cafe-aurora-demo","vitrine-demo",id);
  assert.equal(resolve("aurora-coado"),"/menu-photos/aurora/coado");
  for(const id of ["constructor","__proto__","Café coado","../aurora-coado",null])assert.equal(resolve(id),null);
  assert.equal(demoPhoto("outra-loja","vitrine-demo","aurora-coado"),null);
  assert.equal(demoPhoto("cafe-aurora-demo","outra-unidade","aurora-coado"),null);
});
test("variantes geradas cabem no limite de transferência e têm o formato correto",async()=>{
  const sizes=[["-96.webp",5_000],["-192.webp",10_000],["-192.jpg",12_000],["-720.webp",48_000],["-720.jpg",65_000]];
  for(const id of ["aurora-coado","aurora-cap","aurora-bolo","aurora-croissant"]){
    const base=demoPhoto("cafe-aurora-demo","vitrine-demo",id);
    for(const [suffix,limit] of sizes){
      const file=await readFile(new URL("../../apps/web"+base+suffix,import.meta.url));
      assert.ok(file.length>100&&file.length<=limit,base+suffix+": "+file.length);
      if(suffix.endsWith(".webp"))assert.equal(file.subarray(8,12).toString(),"WEBP");
      else assert.equal(file.readUInt16BE(0),0xffd8);
    }
  }
});
