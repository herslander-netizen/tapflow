import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const base=new URL("../../apps/web/",import.meta.url);
const read=p=>readFile(new URL(p,base),"utf8");
test("app usa somente lettering aprovado, sem símbolo antigo",async()=>{
 const html=await read("index.html");
 assert.match(html,/<img class="brand-logo"[^>]+src="\.\/tapflow-wordmark\.svg"[^>]*alt="TapFlow"/);
 assert.doesNotMatch(html,/class="brand-symbol"|class="brand-text"/);
 assert.match(html,/brand-theme\.css/);
 assert.match(html,/name="theme-color" content="#024519"/);
});
test("cópia do logotipo tem o mesmo traçado vetorial registrado",async()=>{
 const web=await read("tapflow-wordmark.svg");
 const master=await readFile(new URL("../../brand/tapflow-wordmark.svg",import.meta.url),"utf8");
 assert.equal(web,master);
 assert.match(web,/<title>TapFlow<\/title>/);
 assert.doesNotMatch(web,/<text|<image|<script/i);
});
test("cores oficiais e cards claros com contraste definido",async()=>{
 const css=await read("brand-theme.css");
 assert.match(css,/#024519/);assert.match(css,/#B6E229/);assert.match(css,/#FEFBF6/);
 assert.match(css,/\.food-card\{background:#FFF/);
 assert.match(css, /\.sheet\{/);
 assert.match(css,/prefers-reduced-motion/);
});
test("build da demo embute logo e tema, sem criar backend",async()=>{
 const script=await readFile(new URL("../../scripts/build-preview-worker.mjs",import.meta.url),"utf8");
 assert.match(script,/tapflow-wordmark\.svg/);
 assert.match(script,/brand-theme\.css/);
 assert.match(script,/image\/svg\+xml/);
});
