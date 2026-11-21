import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const tokens=JSON.parse(await readFile(new URL("../../brand/tokens.json",import.meta.url),"utf8"));
const css=await readFile(new URL("../../apps/web/brand-theme.css",import.meta.url),"utf8");
const styles=await readFile(new URL("../../apps/web/styles.css",import.meta.url),"utf8");
const channel=h=>parseInt(h,16)/255;
const luminance=hex=>{
 const channels=hex.slice(1).match(/../g).map(channel).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
 return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
};
const ratio=(a,b)=>{
 const l=[luminance(a),luminance(b)].sort((x,y)=>y-x);
 return (l[0]+0.05)/(l[1]+0.05);
};
test("paleta cobre contraste AA em fundo e botões",()=>{
 const {forest,lime,cream,ink}=tokens.colors;
 for(const [a,b,label] of [[forest,lime,"CTA"],[forest,cream,"Cabeçalho"],[cream,ink,"Texto do cardápio"],[cream,forest,"Logo escuro"]]){
  const value=ratio(a,b);
  assert.ok(value>=4.5,label+" com contraste "+value.toFixed(2));
 }
});
test("navegação e botões possuem tamanho tocável e foco visível",()=>{
 assert.match(css,/min-width:44px;min-height:44px/);
 assert.match(css,/\.brand:focus-visible/);
 assert.match(css,/\.reel-cta:focus-visible/);
 assert.match(css,/color-scheme:light/);
});
test("não há símbolo ou lettering digitado legado no CSS",()=>{
 assert.doesNotMatch(styles,/\.brand-symbol|\.brand-text/);
 assert.match(styles,/fonts\.googleapis\.com\/css2\?family=Sora/);
});
