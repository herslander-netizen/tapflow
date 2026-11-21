import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
test("bundle da prévia é gerado sem tokens, sem deploy e sem API de pedidos",async()=>{
 const run=spawnSync(process.execPath,[resolve(root,"scripts/build-preview-worker.mjs")],{cwd:root,encoding:"utf8"});
 assert.equal(run.status,0,run.stderr);
 const s=await readFile(resolve(root,".build","tapflow-preview-worker.mjs"),"utf8");
 assert.ok(s.length>45000);
 assert.match(s,/ordersPersistent:false/);
 assert.match(s,/paymentsEnabled:false/);
 assert.doesNotMatch(s,/GROQ_API_KEY|GEMINI_API_KEY|sk-proj-/);
});
