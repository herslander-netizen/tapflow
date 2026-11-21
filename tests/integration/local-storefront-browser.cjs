const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const { resolve, join } = require("node:path");
const assert = require("node:assert/strict");

// After build:merchant-preview, pass local Playwright and Chromium module paths.
// Optional third argument saves the synthetic visual preview.
const [playwrightModule, chromiumModule, screenshot] = process.argv.slice(2);
if (!playwrightModule || !chromiumModule) throw Error("Informe Playwright e Chromium locais");
const { chromium } = require(resolve(playwrightModule));
const runtime = require(resolve(chromiumModule));
const root = resolve(".build/merchant-preview-assets");
const path = "/cardapio/cafe-aurora-demo/vitrine-demo";
const foreign = "/cardapio/outra-loja/vitrine-demo";
const fixture = {
  name: "Café Aurora", location: { name: "Vitrine fictícia" }, table: { label: "Mesa 04" },
  appearance: { preset: "cafe", mode: "light" }, limited: false,
  items: [
    { id: "aurora-coado", name: "Café coado", description: "Filtrado e servido quente.", priceCents: 800, categoryId: "cafes", categoryName: "Cafés", available: true, addons: [] },
    { id: "aurora-cap", name: "Cappuccino da casa", description: "Espresso, leite vaporizado e cacau.", priceCents: 1200, categoryId: "cafes", categoryName: "Cafés", available: true, addons: [{ name: "Canela extra", priceCents: 100 }] },
    { id: "aurora-bolo", name: "Bolo de laranja com raspas e cobertura da casa", description: "Fatia de bolo caseiro.", priceCents: 1100, categoryId: "vitrine", categoryName: "Da vitrine", available: false, addons: [] },
    { id: "aurora-croissant", name: "Croissant de manteiga", description: "Massa folhada dourada.", priceCents: 1450, categoryId: "vitrine", categoryName: "Da vitrine", available: true, addons: [] }
  ]
};
const types = { "public-menu.html": "text/html", "public-menu.css": "text/css", "public-menu.mjs": "text/javascript", "theme.mjs": "text/javascript", "public-menu-photos.mjs": "text/javascript" };
let fail = true;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (["/api/public/menu/cafe-aurora-demo/vitrine-demo", "/api/public/menu/outra-loja/vitrine-demo"].includes(url.pathname)) {
      if (url.searchParams.get("mesa") === "retry" && fail) {
        fail = false; res.writeHead(503); return res.end();
      }
      const gray = url.searchParams.get("mesa") === "gray";
      const appearance = gray ? { preset: "cafe", mode: "dark", background: "#757575", accent: "#B6E229" } : fixture.appearance;
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ...fixture, appearance }));
    }
    if (/^\/menu-photos\/aurora\/(coado|cap|bolo|croissant)-(96|192|720)\.(webp|jpg)$/.test(url.pathname)) {
      const bytes = await readFile(join(root, url.pathname.slice(1)));
      res.writeHead(200, { "content-type": url.pathname.endsWith(".webp") ? "image/webp" : "image/jpeg" });
      return res.end(bytes);
    }
    const file = [path, foreign].includes(url.pathname) ? "public-menu.html" : url.pathname.slice(1);
    if (!Object.hasOwn(types, file)) throw Error("404");
    res.writeHead(200, { "content-type": types[file] });
    res.end(await readFile(join(root, file)));
  } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
});

(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: await runtime.executablePath(), headless: true,
      args: runtime.args.filter(a => !["--disable-web-security", "--allow-running-insecure-content"].includes(a)) });
    const page = await browser.newPage({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true });
    const errors = [], media = [];
    page.on("request", request => { if (request.url().includes("/menu-photos/")) media.push(new URL(request.url()).pathname); });
    page.on("pageerror", error => errors.push(String(error)));
    for (const width of [360, 390, 430, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin + path);
      await page.getByRole("heading", { name: "Café Aurora", exact: true }).waitFor();
      await page.getByText("4 itens", { exact: true }).waitFor();
      assert.equal(await page.locator("#menuItems > li").count(), 4);
      assert.ok(await page.locator(".item-heading strong").first().isVisible());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "overflow em " + width);
      if (width === 390 && screenshot) {
        await page.waitForFunction(() => [...document.querySelectorAll(".item-photo img")].slice(0,2).every(el => el.complete && el.naturalWidth > 0));
        await page.screenshot({ path: screenshot, fullPage: true });
      }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    assert.ok(media.some(path => /-(96|192)\.webp$/.test(path)), "thumbnail WebP requested");
    assert.ok(!media.some(path => /-720/.test(path)), "no larger photos before activation");
    const photo = page.getByRole("link", { name: "Ampliar foto ilustrativa de Cappuccino da casa" });
    await photo.focus();
    await page.keyboard.press("Enter");
    const viewer = page.getByRole("dialog", { name: "Cappuccino da casa" });
    await viewer.waitFor();
    await page.waitForFunction(() => document.querySelector("#photoContent img")?.naturalWidth === 720);
    assert.ok(media.some(path => /cap-720\.webp$/.test(path)));
    await page.keyboard.press("Escape");
    await viewer.waitFor({ state: "hidden" });
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Ampliar foto ilustrativa de Cappuccino da casa");
    const cafes = page.getByRole("button", { name: "Cafés", exact: true });
    await cafes.tap();
    assert.equal(await cafes.getAttribute("aria-pressed"), "true");
    assert.ok(await cafes.locator(".selected-mark").isVisible());
    await page.getByText("2 itens", { exact: true }).waitFor();
    const summary = page.locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await page.getByText("Canela extra", { exact: false }).waitFor();
    assert.equal(await summary.evaluate(el => el === document.activeElement), true);
    const search = page.getByRole("searchbox");
    await search.fill("espresso");
    await page.getByText("Canela extra", { exact: false }).waitFor();
    await search.fill("inexistente");
    await page.getByText("Nenhum item encontrado.").waitFor();
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    assert.equal(await search.evaluate(el => el === document.activeElement), true);
    assert.equal(await search.inputValue(), "");
    await page.getByText("4 itens", { exact: true }).waitFor();
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await cafes.evaluate(el => getComputedStyle(el).transitionDuration), "0s");
    assert.equal(await summary.evaluate(el => getComputedStyle(el).transitionDuration), "0s");

    await page.goto(origin + path + "?mesa=retry");
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await page.getByText("Mesa 04", { exact: true }).waitFor();
    await page.getByText("4 itens", { exact: true }).waitFor();
    await page.goto(origin + path + "?mesa=gray");
    await page.getByText("4 itens", { exact: true }).waitFor();
    const inputPair = await search.evaluate(el => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]);
    assert.deepEqual(inputPair, ["rgb(0, 0, 0)", "rgb(135, 135, 135)"]);
    await page.goto(origin + foreign);
    await page.getByText("4 itens", { exact: true }).waitFor();
    assert.equal(await page.locator(".item-photo").count(), 0, "not available in another storefront");
    await page.route("**/menu-photos/aurora/*", route => route.abort());
    await page.goto(origin + path);
    await page.getByText("4 itens", { exact: true }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll(".item-photo")].slice(0,2).every(link => link.hidden));
    assert.ok(await page.getByRole("heading", { name: "Cappuccino da casa" }).isVisible());
    assert.deepEqual(errors, []);
    console.log("Vitrine: 360/390/430/1280 px, toque, teclado, foco, busca, adicionais persistentes, movimento reduzido e recuperação de erro.");
  } finally {
    if (browser) await browser.close();
    await new Promise(r => server.close(r));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
