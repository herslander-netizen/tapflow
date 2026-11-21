import { THEME_PRESETS, DEFAULT_SETTINGS, applyTheme, createTheme, normalizeSettings } from "./theme.mjs";

/*
 * Editor de aparência da DEMO: dados locais, sem autenticação, sem API e sem
 * modificar outras unidades. Produção deverá oferecer a tela apenas ao dono
 * ou gerente autorizado e consultar a configuração publicada pelo servidor.
 */
const STORAGE_KEY = "tapflow:appearance:demo:studio-sabor:v1";
const root = document.documentElement;
const host = document.querySelector(".topbar-context");
const clone = value => ({...value});
function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : clone(DEFAULT_SETTINGS);
  } catch {
    return clone(DEFAULT_SETTINGS);
  }
}
let committed = readSaved();
let draft = clone(committed);
let accepted = false;
applyTheme(root, committed);

if (host) {
  const open = document.createElement("button");
  open.type = "button";
  open.className = "appearance-open";
  open.textContent = "🎨 Cores";
  open.setAttribute("aria-label", "Personalizar cores desta demonstração");
  open.setAttribute("title", "Aparência do cardápio · modo demonstração");
  host.prepend(open);

  const dialog = document.createElement("dialog");
  dialog.className = "appearance-dialog";
  dialog.setAttribute("aria-labelledby", "appearance-title");
  dialog.setAttribute("aria-describedby", "appearance-description");
  document.body.appendChild(dialog);

  function presetMarkup() {
    return Object.entries(THEME_PRESETS).map(([id, preset]) => {
      const selected = draft.preset === id;
      return '<button type="button" class="appearance-preset' + (selected ? ' is-selected' : '') +
        '" data-theme-preset="' + id + '" aria-pressed="' + selected + '">' +
        '<span class="appearance-swatch" aria-hidden="true"><i style="background:' + preset.dark +
        '"></i><i style="background:' + preset.light + '"></i><i style="background:' +
        preset.accent + '"></i></span><strong>' + preset.label + '</strong><small>' +
        preset.segment + '</small></button>';
    }).join("");
  }
  function renderEditor() {
    const result = createTheme(draft);
    const theme = result.settings;
    const source = THEME_PRESETS[theme.preset];
    const chosenAccent = theme.accent || source.accent;
    const chosenBackground = theme.background || source[theme.mode];
    dialog.innerHTML =
      '<div class="appearance-dialog-inner">' +
      '<header class="appearance-head"><div><span class="appearance-eyebrow">TAPFLOW · PRÉVIA LOCAL</span>' +
      '<h2 id="appearance-title">Aparência do cardápio</h2></div>' +
      '<button type="button" class="appearance-close" data-theme-action="cancel" aria-label="Fechar e descartar alterações">×</button></header>' +
      '<p id="appearance-description" class="appearance-description">Escolha um estilo que combine com seu estabelecimento. As alterações são exibidas na hora; a opção Salvar guarda somente nesta demonstração.</p>' +
      '<section aria-labelledby="appearance-preset-heading"><h3 id="appearance-preset-heading">Temas por segmento</h3>' +
      '<div class="appearance-presets">' + presetMarkup() + '</div></section>' +
      '<fieldset class="appearance-modes"><legend>Ambiente do cardápio</legend>' +
      '<label><input type="radio" name="appearance-mode" value="light" ' + (theme.mode === 'light' ? 'checked' : '') + '> Claro</label>' +
      '<label><input type="radio" name="appearance-mode" value="dark" ' + (theme.mode === 'dark' ? 'checked' : '') + '> Escuro</label></fieldset>' +
      '<section aria-labelledby="appearance-custom-heading"><h3 id="appearance-custom-heading">Cores personalizadas</h3>' +
      '<div class="appearance-color-grid">' +
      '<label>Cor principal <span class="appearance-color-control"><input id="theme-accent" type="color" value="' + chosenAccent +
      '" aria-label="Escolher cor principal"/><output for="theme-accent">' + chosenAccent + '</output></span></label>' +
      '<label>Cor de fundo <span class="appearance-color-control"><input id="theme-background" type="color" value="' +
      chosenBackground + '" aria-label="Escolher cor de fundo"/><output for="theme-background">' + chosenBackground +
      '</output></span></label></div>' +
      '<button type="button" class="appearance-reset-colors" data-theme-action="preset-colors">Usar cores originais deste tema</button></section>' +
      '<div class="appearance-preview" style="background:' + result.tokens["--bg"] + ';color:' + result.tokens["--text"] + ';border-color:' + result.tokens["--stroke"] + '">' +
      '<span style="color:' + result.tokens["--muted"] + '">PRÉVIA DE LEITURA</span><strong>Seu estabelecimento, sua identidade.</strong>' +
      '<div class="appearance-preview-row"><small>Descrição e valor do prato</small>' +
      '<span style="background:' + result.tokens["--accent"] + ';color:' + result.tokens["--on-accent"] + '">Escolher prato</span></div></div>' +
      '<p class="appearance-contrast" role="status">' +
      (result.adjusted ? 'A cor principal foi ajustada automaticamente para preservar o contraste. ' : '') +
      'Texto: ' + result.contrast.text.toFixed(1) + ':1 · Botão: ' + result.contrast.button.toFixed(1) + ':1.</p>' +
      '<p class="appearance-local-warning">Modo demonstração: esta edição não altera cardápios de outros estabelecimentos e não publica alterações para clientes reais.</p>' +
      '<div class="appearance-actions"><button type="button" data-theme-action="reset" class="appearance-action-muted">Restaurar padrão</button>' +
      '<button type="button" data-theme-action="cancel" class="appearance-action-secondary">Cancelar</button>' +
      '<button type="button" data-theme-action="save" class="appearance-action-save">Salvar nesta prévia</button></div>' +
      '<p id="appearance-feedback" class="appearance-feedback" role="status" aria-live="polite"></p></div>';
  }

  function preview(next) {
    draft = normalizeSettings(next);
    applyTheme(root, draft);
    renderEditor();
  }
  function show() {
    committed = readSaved();
    draft = clone(committed);
    accepted = false;
    renderEditor();
    dialog.showModal();
    dialog.querySelector(".appearance-close")?.focus();
  }
  open.addEventListener("click", show);
  dialog.addEventListener("click", event => {
    const preset = event.target.closest("[data-theme-preset]");
    if (preset) {
      const id = preset.dataset.themePreset;
      const source = THEME_PRESETS[id];
      if (source) preview({preset:id,mode:source.mode,accent:null,background:null});
      return;
    }
    const action = event.target.closest("[data-theme-action]")?.dataset.themeAction;
    if (action === "cancel") { dialog.close(); return; }
    if (action === "preset-colors") {
      preview({...draft,accent:null,background:null});
      return;
    }
    if (action === "reset") {
      preview(DEFAULT_SETTINGS);
      return;
    }
    if (action === "save") {
      accepted = true;
      committed = clone(draft);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(committed));
      } catch {
        // Sem storage, o tema só permanece aplicado até a aba recarregar.
        alert("As cores foram aplicadas nesta sessão, mas seu navegador impediu o salvamento local.");
      }
      dialog.close();
      return;
    }
  });
  dialog.addEventListener("change", event => {
    if (event.target.name === "appearance-mode") {
      preview({...draft,mode:event.target.value,background:null});
      return;
    }
    if (event.target.id === "theme-accent") {
      preview({...draft,accent:event.target.value});
      return;
    }
    if (event.target.id === "theme-background") {
      preview({...draft,background:event.target.value});
    }
  });
  dialog.addEventListener("close", () => {
    if (!accepted) applyTheme(root, committed);
    accepted = false;
    open.focus();
  });
}
