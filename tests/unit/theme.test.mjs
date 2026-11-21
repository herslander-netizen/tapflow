import test from "node:test";
import assert from "node:assert/strict";
import { THEME_PRESETS, DEFAULT_SETTINGS, isHex, createTheme, normalizeSettings, contrastRatio, applyTheme } from "../../apps/web/theme.mjs";

test("todos os presets mantêm contraste de leitura e CTA", () => {
  for (const [id, preset] of Object.entries(THEME_PRESETS)) {
    for (const mode of ["light","dark"]) {
      const theme = createTheme({preset:id, mode});
      assert.ok(theme.contrast.text >= 4.5, id + " texto "+mode);
      assert.ok(theme.contrast.muted >= 4.5, id + " secundário "+mode);
      assert.ok(theme.contrast.button >= 4.5, id + " CTA "+mode);
      assert.ok(theme.contrast.accentOnBackground >= 3, id + " contorno CTA "+mode);
      assert.equal(theme.settings.preset, id);
      assert.equal(theme.settings.mode, mode);
      assert.equal(theme.tokens["--theme-color-scheme"], mode);
      assert.equal(preset.label.length > 0, true);
    }
  }
});
test("acento claro em fundo claro recebe ajuste de contraste", () => {
  const theme = createTheme({ preset:"cafe", mode:"light", accent:"#FFFFFF" });
  assert.ok(theme.adjusted);
  assert.ok(contrastRatio(theme.tokens["--accent"], theme.tokens["--bg"]) >= 3);
  assert.ok(theme.contrast.button >= 4.5);
});
test("hex malicioso e valores não autorizados não entram em CSS", () => {
  assert.equal(isHex("red; background:url(https://invalid)"), false);
  const parsed = normalizeSettings({preset:"__proto__",mode:"x",accent:"#FFF}body{display:none",background:"transparent"});
  assert.deepEqual(parsed, DEFAULT_SETTINGS);
});
test("configurações de uma unidade não modificam as demais", () => {
  const a = createTheme({preset:"brasa"});
  const b = createTheme({preset:"doce"});
  assert.notEqual(a.tokens["--bg"], b.tokens["--bg"]);
  assert.equal(createTheme(null).settings.preset, "tapflow");
});
test("aplicar tokens aceita apenas entradas derivadas pelo motor", () => {
  const props = new Map();
  const root = { style:{setProperty:(key,value)=>props.set(key,value)}, dataset:{} };
  const outcome = applyTheme(root, {preset:"mar",accent:"#FFFFFF"});
  assert.equal(props.get("--bg"), "#F2FBFD");
  assert.equal(root.dataset.tapflowAppearance,"light");
  assert.equal(props.get("--accent"), outcome.effectiveAccent);
});

test("pares de tokens mantêm contraste nas superfícies realmente usadas", () => {
  const pairs = [
    ["--text", "--bg", 4.5],
    ["--muted", "--bg", 4.5],
    ["--on-input", "--surface-input", 4.5],
    ["--on-surface", "--surface-card", 4.5],
    ["--on-accent", "--accent", 4.5],
    ["--focus", "--bg", 3],
    ["--focus-on-input", "--surface-input", 3],
    ["--control-border", "--bg", 3],
    ["--muted-on-surface", "--surface-card", 4.5],
    ["--focus-on-surface", "--surface-card", 3]
  ];
  const overrides = [
    {},
    { background: "#757575", accent: "#B6E229" },
    { background: "#808080", accent: "#808080" },
    { background: "#000000", accent: "#000000" },
    { background: "#FFFFFF", accent: "#FFFFFF" }
  ];
  for (const preset of Object.keys(THEME_PRESETS)) {
    for (const mode of ["light", "dark"]) {
      for (const override of overrides) {
        const settings = { preset, mode, ...override };
        const { tokens, settings: normalized } = createTheme(settings);
        assert.deepEqual(normalized, { preset, mode, background: null, accent: null, ...override });
        for (const [foreground, background, minimum] of pairs) {
          const context = JSON.stringify(settings) + " " + foreground + "/" + background;
          assert.ok(isHex(tokens[foreground]), context + " primeiro token hex ausente");
          assert.ok(isHex(tokens[background]), context + " segundo token hex ausente");
          const ratio = contrastRatio(tokens[foreground], tokens[background]);
          assert.ok(ratio >= minimum, context + " " + ratio.toFixed(3) + ":" + "1 < " + minimum + ":1");
        }
      }
    }
  }
});
