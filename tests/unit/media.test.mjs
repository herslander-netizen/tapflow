import test from "node:test";
import assert from "node:assert/strict";
import {videoForItem,canAutoplay} from "../../apps/web/media.mjs";
test("aceita vídeo HTTPS válido",()=>assert.equal(videoForItem({video:{src:"https://cdn.example/food.webm",type:"video/webm"}}).src,"https://cdn.example/food.webm"));
test("rejeita fontes não seguras",()=>{
  assert.equal(videoForItem({video:{src:"javascript:alert(1)",type:"video/mp4"}}),null);
  assert.equal(videoForItem({video:{src:"http://cdn.example/food.mp4",type:"video/mp4"}}),null);
  assert.equal(videoForItem({video:{src:"https://cdn.example/a.js",type:"text/javascript"}}),null);
  assert.equal(videoForItem({}),null);
});
test("respeita acessibilidade e economia de dados",()=>{
  assert.equal(canAutoplay(),true);
  assert.equal(canAutoplay({reducedMotion:true}),false);
  assert.equal(canAutoplay({saveData:true}),false);
  assert.equal(canAutoplay({hidden:true}),false);
});
