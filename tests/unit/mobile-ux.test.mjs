import test from "node:test";
import assert from "node:assert/strict";
import {swipeDirection,actionIsInteractive} from "../../apps/web/mobile-ux.mjs";
test("swipe vertical move uma posição com limiar explícito",()=>{
 assert.equal(swipeDirection({dx:4,dy:-91}),1);
 assert.equal(swipeDirection({dx:8,dy:94}),-1);
});
test("interação em CTA, ângulo horizontal e toque curto não navegam",()=>{
 assert.equal(swipeDirection({dx:0,dy:-120,fromInteractive:true}),0);
 assert.equal(swipeDirection({dx:130,dy:-120}),0);
 assert.equal(swipeDirection({dx:1,dy:-32}),0);
 assert.equal(swipeDirection({dx:Infinity,dy:-80}),0);
});
test("detecta origem interativa sem DOM real",()=>{
 assert.equal(actionIsInteractive({closest:()=>({tagName:"BUTTON"})}),true);
 assert.equal(actionIsInteractive({closest:()=>null}),false);
});
