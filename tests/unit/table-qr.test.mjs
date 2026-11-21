import test from "node:test";
import assert from "node:assert/strict";
import {tableMenuLink} from "../../apps/web/table-qr.mjs";

test("QR/NFC encoder receives a same-origin public selector with no bearer material",()=>{
 const url=tableMenuLink("https://preview.example.invalid","cafe-aurora","centro","ma1");
 assert.equal(url?.href,"https://preview.example.invalid/cardapio/cafe-aurora/centro?mesa=ma1");
 for(const slug of ["../app","a?token=bad","Upper","a--b"])assert.equal(tableMenuLink("https://preview.example.invalid",slug,"centro","ma1"),null);
 assert.equal(tableMenuLink("https://preview.example.invalid/@bad","cafe","centro","ma1"),null);
 assert.equal(tableMenuLink("http://preview.example.invalid","cafe","centro","ma1"),null);
 assert.equal(tableMenuLink("https://preview.example.invalid","cafe","centro","a&token=c"),null);
 assert.ok(tableMenuLink("http://127.0.0.1:8443","cafe","centro","ma1"));
});
