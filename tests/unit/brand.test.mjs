import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const url=p=>new URL("../../"+p,import.meta.url);
const tokens=JSON.parse(await readFile(url("brand/tokens.json"),"utf8"));
const wordmark=await readFile(url("brand/tapflow-wordmark.svg"),"utf8");
test("logo é somente lettering TapFlow, sem símbolo anexado",()=>{
 assert.equal(tokens.brand,"TapFlow");assert.equal(tokens.officialLogo.hasIcon,false);
 assert.match(wordmark,/<title>TapFlow<\/title>/);assert.match(wordmark,/fill-rule="evenodd"/);
 assert.doesNotMatch(wordmark,/<image|<text|<script/i);
});
test("cores fundamentais definidas em hex",()=>{
 assert.equal(tokens.colors.forest,"#024519");assert.equal(tokens.colors.lime,"#B6E229");
 for(const hex of Object.values(tokens.colors))assert.match(hex,/^#[0-9A-Fa-f]{6}$/);
});
test("redesening e movimento forçado não são autorizados",()=>{
 assert.equal(tokens.officialLogo.doNotRedraw,true);
 assert.equal(tokens.uiRules.mobileFirst,true);
 assert.equal(tokens.motion.reducedMotion,"disable ornamental motion");
});
