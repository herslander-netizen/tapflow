/*
 * TapFlow — motor de temas por estabelecimento (v1 demonstrativa).
 * Sem dependências, sem dados privados e sem acesso a banco.
 * UI utiliza funções semânticas, nunca CSS livre fornecido pelo usuário.
 */
export const THEME_PRESETS = Object.freeze({
  tapflow: { label:"TapFlow original", segment:"Identidade da plataforma", accent:"#B6E229", mode:"dark", light:"#FEFBF6", dark:"#003615" },
  brasa: { label:"Brasa", segment:"Hamburguerias e churrascarias", accent:"#EF744F", mode:"dark", light:"#FFF6EF", dark:"#211815" },
  cafe: { label:"Café", segment:"Cafeterias e padarias", accent:"#84502D", mode:"light", light:"#FFF8EF", dark:"#231B15" },
  doce: { label:"Doce", segment:"Docerias e sorveterias", accent:"#C92C74", mode:"light", light:"#FFF5FA", dark:"#281721" },
  mar: { label:"Mar", segment:"Peixarias e frutos do mar", accent:"#087996", mode:"light", light:"#F2FBFD", dark:"#0C2732" },
  gourmet: { label:"Gourmet", segment:"Restaurantes premium", accent:"#E5B968", mode:"dark", light:"#FBF7EF", dark:"#171611" },
  natural: { label:"Natural", segment:"Orgânicos e alimentação saudável", accent:"#28784F", mode:"light", light:"#F5FAF3", dark:"#112A1E" },
  urbano: { label:"Urbano", segment:"Bares e gastronomia contemporânea", accent:"#95B6FC", mode:"dark", light:"#F6F8FE", dark:"#151D2B" }
});
export const DEFAULT_SETTINGS = Object.freeze({ preset:"tapflow", mode:"dark", accent:null, background:null });
export const isHex = value => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
const hex = (value, fallback) => isHex(value) ? value.toUpperCase() : fallback;
const clamp = value => Math.max(0, Math.min(255, Math.round(value)));
const channels = color => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
const toHex = values => "#" + values.map(v => clamp(v).toString(16).padStart(2, "0")).join("").toUpperCase();
export function mixColors(a, b, fraction) {
  const first = channels(hex(a, "#000000")), second = channels(hex(b, "#FFFFFF"));
  const ratio = Math.max(0, Math.min(1, fraction));
  return toHex(first.map((c, i) => c + (second[i] - c) * ratio));
}
export function luminance(value) {
  const rgb = channels(hex(value, "#000000")).map(n => {
    const c = n / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
export function contrastRatio(a, b) {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
export function readableText(background) {
  return contrastRatio(background, "#FFFFFF") >= contrastRatio(background, "#000000") ? "#FFFFFF" : "#000000";
}
function ensureContrast(color, background, minimum = 3) {
  if (contrastRatio(color, background) >= minimum) return color;
  const destination = readableText(background);
  for (let i = 1; i <= 20; i++) {
    const candidate = mixColors(color, destination, i / 20);
    if (contrastRatio(candidate, background) >= minimum) return candidate;
  }
  return destination;
}
export function normalizeSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_SETTINGS };
  const preset = Object.hasOwn(THEME_PRESETS, value.preset) ? value.preset : DEFAULT_SETTINGS.preset;
  const source = THEME_PRESETS[preset];
  const mode = value.mode === "light" || value.mode === "dark" ? value.mode : source.mode;
  return {
    preset, mode,
    accent: isHex(value.accent) ? value.accent.toUpperCase() : null,
    background: isHex(value.background) ? value.background.toUpperCase() : null
  };
}
export function createTheme(value) {
  const settings = normalizeSettings(value);
  const preset = THEME_PRESETS[settings.preset];
  const background = settings.background || preset[settings.mode];
  const rawAccent = settings.accent || preset.accent;
  const accent = ensureContrast(rawAccent, background, 3);
  const text = readableText(background);
  const onAccent = readableText(accent);
  const surface = mixColors(background, text, settings.mode === "dark" ? 0.075 : 0.055);
  const card = mixColors(background, text, settings.mode === "dark" ? 0.115 : 0.085);
  const muted = ensureContrast(mixColors(background, text, 0.72), background, 4.5);
  const stroke = mixColors(background, text, 0.24);
  const input = mixColors(background, text, 0.13);
  const onInput = readableText(input);
  const onCard = readableText(card);
  const tokens = {
    "--bg": background,
    "--surface": surface,
    "--surface-card": card,
    "--surface-input": input,
    "--on-input": onInput,
    "--control-border": ensureContrast(stroke, background, 3),
    "--focus-on-input": onInput,
    "--accent": accent,
    "--on-accent": onAccent,
    "--text": text,
    "--muted": muted,
    "--stroke": stroke,
    "--focus": ensureContrast(accent, background, 3),
    "--on-surface": onCard,
    "--muted-on-surface": ensureContrast(mixColors(card, onCard, 0.74), card, 4.5),
    "--focus-on-surface": ensureContrast(accent, card, 3),
    "--theme-color-scheme": settings.mode
  };
  return { settings, tokens, rawAccent, effectiveAccent:accent,
    adjusted: rawAccent.toUpperCase() !== accent.toUpperCase(),
    contrast: { button:contrastRatio(accent, onAccent), accentOnBackground:contrastRatio(accent, background), text:contrastRatio(text, background), muted:contrastRatio(muted, background) }
  };
}
export function applyTheme(root, settings) {
  const theme = createTheme(settings);
  for (const [name, value] of Object.entries(theme.tokens)) root.style.setProperty(name, value);
  root.dataset.tapflowAppearance = theme.settings.mode;
  return theme;
}
