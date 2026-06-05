(function () {
  const app = document.getElementById("app");
  const route = (location.hash.split("?")[0] || "#/").replace("#/", "") || "index";
  let modules = [];
  let category = "combat";
  let query = "";
  let selectedModuleName = null;
  let selectedModuleSettings = null;
  let settingsLoading = false;
  let settingsError = "";
  let saveTimer = null;
  let saving = false;
  let saveError = "";
  let lastSavedAt = 0;
  let settingRefs = new Map();
  let expandedSettingKeys = new Set();
  let openDropdownPath = null;
  let nextSettingId = 0;
  let bindingSetting = null;
  let bindCaptureCleanup = null;
  let eventSocket = null;
  let eventSocketReady = false;
  let hudSpaceSeparatedNames = true;
  let hudModules = [];
  let hudTarget = null;
  let hudTargetVisible = false;
  let hudTargetHideTimer = null;
  let hudArrayListSettings = {
    enabled: true,
    showTags: true,
    rightSide: true,
    rightAligned: true,
    descendingOrder: true,
    horizontalOffset: 10,
    verticalOffset: 10,
    style: "Classic",
    fontSize: 14,
    horizontalPadding: 8,
    verticalPadding: 5,
    gap: 3,
    outlineWidth: 1,
    backgroundColor: "rgba(7, 9, 13, 0.62)",
    textColor: "#f1f5f9",
    tagColor: "#9aa4b2",
    borderColor: "#14b8a6",
    accentColor: "#14b8a6",
    outlineColor: "#14b8a6",
    shadow: false
  };
  let hudTargetSettings = {
    enabled: true,
    horizontalOffset: 20,
    verticalOffset: 0,
    hideDelay: 1000,
    showArmor: true,
    showAbsorption: true,
    backgroundColor: "rgba(7, 9, 13, 0.745)",
    textColor: "#f1f5f9",
    dimmedTextColor: "#9aa4b2",
    healthProgressColor: "#14b8a6",
    armorPointBackgroundColor: "#404854",
    armorPointActiveColor: "#2dd4bf"
  };
  let textMeasureContext = null;
  const socketListeners = new Map();

  const api = async (path, options) => {
    const response = await fetch(`/api/v1/client${path}`, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...options
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  };

  const acknowledge = () => {
    api("/virtualScreen", {
      method: "POST",
      body: JSON.stringify({ name: route })
    }).catch(() => {});
  };

  const closeScreen = () => {
    api("/screen", { method: "DELETE" }).catch(() => {});
  };

  const resetClickGuiState = () => {
    query = "";

    if (document.getElementById("search")) {
      renderClickGui();
    }
  };

  const watchClickGuiClose = () => {
    connectEventSocket();
    addSocketListener("virtualScreen", (event) => {
      if ((event?.screenName ?? event?.type) === "clickgui" && event?.action === "close") {
        resetClickGuiState();
      }
    });
  };

  const renderHud = async () => {
    app.className = "app";
    app.innerHTML = `
      <section class="hud">
        <div class="hud-title">LiquidBounce</div>
        <div class="hud-line" id="hud-fps">FPS --</div>
        <div class="hud-line" id="hud-player">Waiting for player</div>
      </section>
      <section class="hud-arraylist" id="hud-arraylist"></section>
      <section class="targethud" id="targethud" hidden></section>
    `;
    const refresh = async () => {
      try {
        const info = await api("/info");
        const player = await api("/player").catch(() => null);
        document.getElementById("hud-fps").textContent = `FPS ${info.fps || 0}`;
        document.getElementById("hud-player").textContent = player
          ? `${player.username} ${Math.round(player.health || 0)} HP`
          : "Not in game";
      } catch (_) {
        document.getElementById("hud-fps").textContent = "FPS --";
      }
    };
    acknowledge();
    connectEventSocket();
    addSocketListener("moduleToggle", refreshHudModules);
    addSocketListener("refreshArrayList", refreshHudModules);
    addSocketListener("targetChange", handleTargetChange);
    addSocketListener("spaceSeperatedNamesChange", (event) => {
      hudSpaceSeparatedNames = event?.value ?? hudSpaceSeparatedNames;
      renderHudArrayList();
    });
    loadHudSettings().then(() => {
      renderHudArrayList();
      renderTargetHud();
    });
    refreshHudModules();
    refresh();
    setInterval(refresh, 1000);
    setInterval(refreshHudModules, 2500);
  };

  const loadHudSettings = async () => {
    try {
      const hudSettings = await api("/modules/settings?name=HUD");
      const values = hudSettings.value || [];
      const setting = values.find((entry) => entry.name === "SpaceSeperatedNames");
      const arrayList = values.find((entry) => entry.name === "ArrayList");
      const targetHud = values.find((entry) => entry.name === "TargetHud");
      const arrayListValues = arrayList?.value || [];
      const targetHudValues = targetHud?.value || [];
      const getSetting = (name, fallback) =>
        arrayListValues.find((entry) => entry.name === name)?.value ?? fallback;
      const getTargetHudSetting = (name, fallback) =>
        targetHudValues.find((entry) => entry.name === name)?.value ?? fallback;
      const styleSetting = arrayListValues.find((entry) => entry.name === "Style");
      const styleName = styleSetting?.active || "Classic";
      const styleValues = styleSetting?.choices?.[styleName]?.value || [];
      const getStyleSetting = (name, fallback) =>
        styleValues.find((entry) => entry.name === name)?.value ?? fallback;

      hudSpaceSeparatedNames = setting?.value ?? hudSpaceSeparatedNames;
      hudArrayListSettings = {
        enabled: arrayList?.value?.find?.((entry) => entry.name === "Enabled")?.value ?? arrayList?.enabled ?? true,
        showTags: getSetting("ShowTags", true),
        rightSide: getSetting("RightSide", true),
        rightAligned: getSetting("RightAligned", true),
        descendingOrder: getSetting("DescendingOrder", true),
        horizontalOffset: getSetting("HorizontalOffset", 10),
        verticalOffset: getSetting("VerticalOffset", 10),
        style: styleName,
        fontSize: getStyleSetting("FontSize", styleName === "Compact" ? 12 : 14),
        horizontalPadding: getStyleSetting("HorizontalPadding", styleName === "Minimal" ? 2 : styleName === "Compact" ? 6 : 8),
        verticalPadding: getStyleSetting("VerticalPadding", styleName === "Minimal" ? 2 : styleName === "Compact" ? 3 : 5),
        gap: getStyleSetting("Gap", styleName === "Compact" ? 2 : 3),
        outlineWidth: getStyleSetting("OutlineWidth", 1),
        backgroundColor: colorToCss(getStyleSetting("BackgroundColor", styleName === "Outline" ? 134263053 : -16441079)),
        textColor: colorToCss(getStyleSetting("TextColor", -1)),
        tagColor: colorToCss(getStyleSetting("TagColor", -6642574)),
        borderColor: colorToCss(getStyleSetting("BorderColor", -15419226)),
        accentColor: colorToCss(getStyleSetting("AccentColor", -15419226)),
        outlineColor: colorToCss(getStyleSetting("OutlineColor", -15419226)),
        shadow: getStyleSetting("Shadow", styleName === "Minimal")
      };
      hudTargetSettings = {
        enabled: targetHudValues.find((entry) => entry.name === "Enabled")?.value ?? targetHud?.enabled ?? true,
        horizontalOffset: getTargetHudSetting("HorizontalOffset", 20),
        verticalOffset: getTargetHudSetting("VerticalOffset", 0),
        hideDelay: getTargetHudSetting("HideDelay", 1000),
        showArmor: getTargetHudSetting("ShowArmor", true),
        showAbsorption: getTargetHudSetting("ShowAbsorption", true),
        backgroundColor: colorToCss(getTargetHudSetting("BackgroundColor", -1106835187)),
        textColor: colorToCss(getTargetHudSetting("TextColor", -1)),
        dimmedTextColor: colorToCss(getTargetHudSetting("DimmedTextColor", -6642574)),
        healthProgressColor: colorToCss(getTargetHudSetting("HealthProgressColor", -15419226)),
        armorPointBackgroundColor: colorToCss(getTargetHudSetting("ArmorPointBackgroundColor", -12564396)),
        armorPointActiveColor: colorToCss(getTargetHudSetting("ArmorPointActiveColor", -13773633))
      };
      renderTargetHud();
    } catch (_) {
      hudSpaceSeparatedNames = true;
    }
  };

  const refreshHudModules = async () => {
    try {
      await loadHudSettings();
      hudModules = await api("/modules");
      renderHudArrayList();
      renderTargetHud();
    } catch (_) {
      hudModules = [];
      renderHudArrayList();
      renderTargetHud();
    }
  };

  const renderHudArrayList = () => {
    const list = document.getElementById("hud-arraylist");
    if (!list) {
      return;
    }

    const settings = hudArrayListSettings;
    list.hidden = !settings.enabled;
    list.style.top = `${settings.verticalOffset}px`;
    list.style.right = settings.rightSide ? `${settings.horizontalOffset}px` : "auto";
    list.style.left = settings.rightSide ? "auto" : `${settings.horizontalOffset}px`;
    list.style.alignItems = settings.rightAligned ? "flex-end" : "flex-start";
    list.style.textAlign = settings.rightAligned ? "right" : "left";
    list.style.gap = `${settings.gap}px`;

    if (!settings.enabled) {
      list.innerHTML = "";
      return;
    }

    const activeModules = hudModules
      .filter((mod) => mod.enabled && !mod.hidden)
      .map((mod) => ({
        ...mod,
        displayName: formatHudModuleName(mod.name),
        tagText: settings.showTags && mod.tag != null && mod.tag !== "" ? String(mod.tag) : ""
      }))
      .map((mod) => ({
        ...mod,
        width: measureTextWidth(`${mod.displayName}${mod.tagText ? ` ${mod.tagText}` : ""}`)
      }))
      .sort((a, b) => {
        const widthDiff = settings.descendingOrder ? b.width - a.width : a.width - b.width;
        return widthDiff || a.displayName.localeCompare(b.displayName);
      });

    list.innerHTML = activeModules.map((mod) => `
      <div class="hud-arraylist-module hud-arraylist-${settings.style.toLowerCase()}" title="${escapeHtml(mod.name)}" style="${hudArrayListItemStyle()}">
        <span>${escapeHtml(mod.displayName)}</span>
        ${mod.tagText ? `<span class="hud-arraylist-tag" style="color: ${settings.tagColor}"> ${escapeHtml(mod.tagText)}</span>` : ""}
      </div>
    `).join("");
  };

  const handleTargetChange = (event) => {
    hudTarget = event?.target || null;
    hudTargetVisible = Boolean(hudTarget);
    clearTimeout(hudTargetHideTimer);

    if (hudTarget && hudTargetSettings.hideDelay > 0) {
      hudTargetHideTimer = setTimeout(() => {
        hudTargetVisible = false;
        renderTargetHud();
      }, hudTargetSettings.hideDelay);
    }

    renderTargetHud();
  };

  const renderTargetHud = () => {
    const element = document.getElementById("targethud");
    if (!element) {
      return;
    }

    const settings = hudTargetSettings;
    element.hidden = !settings.enabled || !hudTargetVisible || !hudTarget;
    element.style.left = `calc(50% + ${Number(settings.horizontalOffset) || 0}px)`;
    element.style.top = `calc(50% + ${Number(settings.verticalOffset) || 0}px)`;
    element.style.setProperty("--targethud-background-color", settings.backgroundColor);
    element.style.setProperty("--targethud-text-color", settings.textColor);
    element.style.setProperty("--targethud-text-dimmed-color", settings.dimmedTextColor);
    element.style.setProperty("--targethud-health-progress-color", settings.healthProgressColor);
    element.style.setProperty("--targethud-armor-point-background-color", settings.armorPointBackgroundColor);
    element.style.setProperty("--targethud-armor-point-active-color", settings.armorPointActiveColor);

    if (element.hidden) {
      element.innerHTML = "";
      return;
    }

    const target = hudTarget;
    const health = safeNumber(target.actualHealth);
    const absorption = safeNumber(target.absorption);
    const maxHealth = Math.max(1, safeNumber(target.maxHealth) + absorption);
    const totalHealth = Math.max(0, Math.min(maxHealth, health + absorption));
    const healthWidth = Math.ceil((totalHealth / maxHealth) * 100);
    const armorItems = (Array.isArray(target.armorItems) ? target.armorItems : [])
      .filter((item) => item && !item.empty && Number(item.count || 0) > 0)
      .reverse();

    element.innerHTML = `
      <div class="targethud-main">
        <div class="targethud-avatar">
          <img src="/api/v1/client/resource/skin?uuid=${encodeURIComponent(target.uuid || "")}" alt="">
        </div>
        <div class="targethud-name">${escapeHtml(target.username || "Target")}</div>
        <div class="targethud-stats">
          ${renderTargetHudStat(Math.floor(health), "health")}
          ${settings.showAbsorption && absorption > 0 ? renderTargetHudStat(Math.floor(absorption), "absorption") : ""}
          ${renderTargetHudStat(Math.floor(safeNumber(target.armor)), "armor")}
        </div>
        ${settings.showArmor ? `
          <div class="targethud-armor">
            ${armorItems.map(renderTargetHudArmorItem).join("")}
          </div>
        ` : ""}
      </div>
      <div class="targethud-health-progress">
        <div class="targethud-health-thumb" style="width: ${healthWidth}%;"></div>
      </div>
    `;
  };

  const renderTargetHudStat = (value, type) => `
    <div class="targethud-stat">
      <span>${escapeHtml(value)}</span>
      <span class="targethud-stat-icon targethud-stat-${type}" aria-hidden="true"></span>
    </div>
  `;

  const renderTargetHudArmorItem = (item) => {
    const damagePoints = armorDamagePoints(item);
    return `
      <div class="targethud-armor-item" title="${escapeHtml(item.identifier || "")}">
        <img src="${itemTextureUrl(item.identifier)}" alt="">
        <div class="targethud-durability">
          ${Array.from({ length: 10 }, (_, index) => {
            const point = 10 - index;
            return `<span class="targethud-durability-point ${point <= damagePoints ? "active" : ""}"></span>`;
          }).join("")}
        </div>
      </div>
    `;
  };

  const safeNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };

  const itemTextureUrl = (identifier) =>
    `/api/v1/client/resource/itemTexture?id=${encodeURIComponent(identifier || "minecraft:air")}`;

  const armorDamagePoints = (item) => {
    const maxDamage = safeNumber(item.maxDamage);
    if (maxDamage <= 0) {
      return 10;
    }

    return Math.max(0, Math.min(10, Math.ceil(10 - (safeNumber(item.damage) / maxDamage) * 10)));
  };

  const categories = () => Array.from(new Set(modules.map((mod) => mod.category))).sort();

  const filteredModules = () => modules.filter((mod) => {
    const text = `${mod.name} ${mod.description || ""}`.toLowerCase();
    return mod.category === category && text.includes(query.toLowerCase());
  });

  const renderClickGui = () => {
    if (selectedModuleName) {
      renderModuleSettings();
      return;
    }

    app.className = "screen";
    const cats = categories();
    const visible = filteredModules();

    app.innerHTML = `
      <header class="topbar">
        <div class="brand">
          <h1>LiquidBounce</h1>
          <p>${modules.length} modules loaded</p>
        </div>
        <input class="search" id="search" placeholder="Search modules" value="${escapeHtml(query)}">
        <button class="close" id="close" title="Close">X</button>
      </header>
      <section class="content">
        <nav class="categories">
          ${cats.map((cat) => `
            <button class="category ${cat === category ? "active" : ""}" data-category="${escapeHtml(cat)}">
              <span>${escapeHtml(title(cat))}</span>
              <span>${modules.filter((mod) => mod.category === cat).length}</span>
            </button>
          `).join("")}
        </nav>
        <section class="modules">
          <div class="grid">
            ${visible.map((mod) => `
              <article class="module" data-open-module="${escapeHtml(mod.name)}" title="Right-click to configure ${escapeHtml(mod.name)}">
                <div>
                  <h2 class="module-name">${escapeHtml(mod.name)}</h2>
                  <p class="module-desc">${escapeHtml(mod.description || mod.tag || "")}</p>
                </div>
                <button class="switch ${mod.enabled ? "enabled" : ""}" data-module="${escapeHtml(mod.name)}" title="Toggle ${escapeHtml(mod.name)}"></button>
              </article>
            `).join("") || `<div class="state">No modules found.</div>`}
          </div>
        </section>
      </section>
    `;

    document.getElementById("close").addEventListener("click", closeScreen);
    document.getElementById("search").addEventListener("input", (event) => {
      const selectionStart = event.target.selectionStart ?? event.target.value.length;
      const selectionEnd = event.target.selectionEnd ?? event.target.value.length;
      query = event.target.value;
      renderClickGui();
      const search = document.getElementById("search");
      search.focus();
      search.setSelectionRange(selectionStart, selectionEnd);
    });
    document.querySelectorAll("[data-category]").forEach((button) => {
      button.addEventListener("click", () => {
        category = button.dataset.category;
        renderClickGui();
      });
    });
    document.querySelectorAll("[data-module]").forEach((button) => {
      button.addEventListener("click", async () => {
        const name = button.dataset.module;
        const mod = modules.find((entry) => entry.name === name);
        if (!mod) return;

        await setModuleEnabled(name, !mod.enabled);
      });
    });
    document.querySelectorAll("[data-open-module]").forEach((moduleElement) => {
      moduleElement.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        openModuleSettings(moduleElement.dataset.openModule);
      });
    });
  };

  const renderModuleSettings = () => {
    app.className = "screen module-page";
    const mod = modules.find((entry) => entry.name === selectedModuleName);
    settingRefs = new Map();
    nextSettingId = 0;
    const allSettings = selectedModuleSettings?.value || [];
    const bindSetting = allSettings.find(isBindSetting);
    const visibleSettings = allSettings.filter((setting) => !isBindSetting(setting));

    if (!mod) {
      app.innerHTML = `
        <header class="topbar detail-topbar">
          <button class="back" id="back" title="Back">&lt;</button>
          <div class="brand">
            <h1>Module not found</h1>
            <p>The selected module is no longer available.</p>
          </div>
          <button class="close" id="close" title="Close">X</button>
        </header>
        <div class="state">Module not found.</div>
      `;
      bindDetailChrome();
      return;
    }

    app.innerHTML = `
      <header class="topbar detail-topbar">
        <button class="back" id="back" title="Back">&lt;</button>
        <div class="brand module-brand">
          <div class="module-copy">
            <h1>${escapeHtml(mod.name)}</h1>
            <p>${escapeHtml(mod.description || mod.tag || "Module settings")}</p>
          </div>
          ${bindSetting ? renderBindButton(bindSetting) : ""}
        </div>
        <div class="detail-actions">
          <span class="save-state">${escapeHtml(saveStatusText())}</span>
          <button class="switch detail-switch ${mod.enabled ? "enabled" : ""}" id="detail-toggle" title="Toggle ${escapeHtml(mod.name)}"></button>
          <button class="close" id="close" title="Close">X</button>
        </div>
      </header>
      <section class="settings-page">
        ${settingsLoading ? `<div class="state">Loading settings...</div>` : ""}
        ${settingsError ? `<div class="state error">${escapeHtml(settingsError)}</div>` : ""}
        ${selectedModuleSettings ? `
          <div class="settings-list">
            ${renderSettings(visibleSettings)}
          </div>
        ` : ""}
      </section>
    `;

    bindDetailChrome();
    bindSettingControls();
  };

  const bindDetailChrome = () => {
    document.getElementById("back")?.addEventListener("click", () => {
      selectedModuleName = null;
      selectedModuleSettings = null;
      settingsError = "";
      saveError = "";
      bindingSetting = null;
      expandedSettingKeys = new Set();
      openDropdownPath = null;
      stopBindCapture();
      clearTimeout(saveTimer);
      renderClickGui();
    });
    document.getElementById("close")?.addEventListener("click", closeScreen);
    document.getElementById("detail-toggle")?.addEventListener("click", async () => {
      const mod = modules.find((entry) => entry.name === selectedModuleName);
      if (!mod) return;

      await setModuleEnabled(mod.name, !mod.enabled);
    });
  };

  const openModuleSettings = async (name) => {
    if (!name) return;

    selectedModuleName = name;
    selectedModuleSettings = null;
    settingsLoading = true;
    settingsError = "";
    saveError = "";
    lastSavedAt = 0;
    expandedSettingKeys = new Set();
    openDropdownPath = null;
    renderClickGui();

    try {
      selectedModuleSettings = await api(`/modules/settings?name=${encodeURIComponent(name)}`);
    } catch (error) {
      settingsError = `Failed to load settings: ${error.message}`;
    } finally {
      settingsLoading = false;
      renderClickGui();
    }
  };

  const setModuleEnabled = async (name, enabled) => {
    const method = enabled ? "PUT" : "DELETE";
    await api("/modules/toggle", {
      method,
      body: JSON.stringify({ name })
    }).catch(() => null);
    await loadModules();
  };

  const renderSettings = (settings, parentKey = "") => {
    if (!settings.length) {
      return `<div class="state compact">No configurable settings.</div>`;
    }

    return settings.map((setting, index) => renderSetting(setting, buildSettingKey(setting, index, parentKey))).join("");
  };

  const registerSetting = (setting) => {
    const id = `setting-${nextSettingId++}`;
    settingRefs.set(id, setting);
    return id;
  };

  const buildSettingKey = (setting, index, parentKey) => {
    const name = setting.name || "Setting";
    const type = setting.valueType || "INVALID";
    const ownKey = `${index}:${type}:${name}`;
    return parentKey ? `${parentKey}/${ownKey}` : ownKey;
  };

  const renderSetting = (setting, settingKey) => {
    const type = setting.valueType || "INVALID";
    const id = registerSetting(setting);
    const name = escapeHtml(setting.name || "Setting");
    const groupClass = ["CONFIGURABLE", "TOGGLEABLE", "CHOICE"].includes(type) ? " group-setting" : "";
    const collapsible = hasNestedSettings(setting);
    const expanded = !collapsible || expandedSettingKeys.has(settingKey);
    const collapsibleClass = collapsible ? " collapsible" : "";
    const expandedClass = collapsible && expanded ? " expanded" : "";
    const description = setting.description
      ? `<p class="setting-description">${escapeHtml(setting.description)}</p>`
      : "";
    const control = expanded ? renderSettingControl(setting, id, settingKey) : "";
    const copy = `
      <div class="setting-copy">
        <div class="setting-title">
          <span>${name}</span>
          <span class="setting-type">${escapeHtml(type)}</span>
        </div>
        ${description}
      </div>
    `;
    const header = collapsible
      ? `
        <div class="setting-header">
          ${copy}
          <span class="setting-expander">${expanded ? "v" : "&gt;"}</span>
        </div>
      `
      : copy;
    const expandAttribute = collapsible ? ` data-expand-key="${escapeHtml(settingKey)}"` : "";

    return `
      <section class="setting-row${groupClass}${collapsibleClass}${expandedClass}" data-setting-path="${escapeHtml(id)}"${expandAttribute}>
        ${header}
        ${expanded ? `<div class="setting-control">${control}</div>` : ""}
      </section>
    `;
  };

  const hasNestedSettings = (setting) => {
    const type = setting.valueType || "INVALID";

    if (type === "CONFIGURABLE" || type === "TOGGLEABLE") {
      return Array.isArray(setting.value) && setting.value.length > 0;
    }

    if (type === "CHOICE") {
      return Object.values(setting.choices || {}).some((choice) => Array.isArray(choice?.value) && choice.value.length > 0);
    }

    return false;
  };

  const renderBindButton = (setting) => {
    const id = registerSetting(setting);
    const bind = normalizeBindValue(setting.value);
    const isBinding = bindingSetting === setting;

    return `
      <div class="bind-bar">
        <button
          class="bind-button ${isBinding ? "binding" : ""}"
          data-setting-action="bind"
          data-setting-path="${escapeHtml(id)}"
          title="Bind key"
          type="button"
        >
          <span class="bind-key">${escapeHtml(isBinding ? "Press key..." : formatBindKey(bind.boundKey))}</span>
          <span class="bind-action">${escapeHtml(bind.action === "Hold" ? "Hold" : "Toggle")}</span>
        </button>
      </div>
    `;
  };

  const renderSettingControl = (setting, id, settingKey) => {
    const type = setting.valueType || "INVALID";

    if (type === "BOOLEAN") {
      return `
        <button
          class="switch ${setting.value ? "enabled" : ""}"
          data-setting-action="boolean"
          data-setting-path="${escapeHtml(id)}"
          title="Toggle ${escapeHtml(setting.name)}"
        ></button>
      `;
    }

    if (type === "INT" || type === "FLOAT") {
      const value = Number(setting.value ?? 0);
      const min = Number(setting.range?.from ?? value - 100);
      const max = Number(setting.range?.to ?? value + 100);
      const step = type === "INT" ? 1 : inferFloatStep(min, max);

      return `
        <div class="number-control">
          <input
            class="range"
            type="range"
            min="${escapeHtml(min)}"
            max="${escapeHtml(max)}"
            step="${escapeHtml(step)}"
            value="${escapeHtml(value)}"
            data-setting-action="number"
            data-setting-path="${escapeHtml(id)}"
          >
          <input
            class="number-input"
            type="number"
            min="${escapeHtml(min)}"
            max="${escapeHtml(max)}"
            step="${escapeHtml(step)}"
            value="${escapeHtml(value)}"
            data-setting-action="number"
            data-setting-path="${escapeHtml(id)}"
          >
          ${setting.suffix ? `<span class="suffix">${escapeHtml(setting.suffix)}</span>` : ""}
        </div>
      `;
    }

    if (type === "INT_RANGE" || type === "FLOAT_RANGE") {
      const from = Number(setting.value?.from ?? 0);
      const to = Number(setting.value?.to ?? from);
      const min = Number(setting.range?.from ?? Math.min(from, to));
      const max = Number(setting.range?.to ?? Math.max(from, to));
      const step = type === "INT_RANGE" ? 1 : inferFloatStep(min, max);

      return `
        <div class="range-pair">
          <label>
            <span>From</span>
            <input
              class="number-input"
              type="number"
              min="${escapeHtml(min)}"
              max="${escapeHtml(max)}"
              step="${escapeHtml(step)}"
              value="${escapeHtml(from)}"
              data-setting-action="range-from"
              data-setting-path="${escapeHtml(id)}"
            >
          </label>
          <label>
            <span>To</span>
            <input
              class="number-input"
              type="number"
              min="${escapeHtml(min)}"
              max="${escapeHtml(max)}"
              step="${escapeHtml(step)}"
              value="${escapeHtml(to)}"
              data-setting-action="range-to"
              data-setting-path="${escapeHtml(id)}"
            >
          </label>
          ${setting.suffix ? `<span class="suffix">${escapeHtml(setting.suffix)}</span>` : ""}
        </div>
      `;
    }

    if (type === "TEXT" || type === "KEY" || type === "FILE") {
      return `
        <input
          class="text-input"
          value="${escapeHtml(setting.value ?? "")}"
          data-setting-action="text"
          data-setting-path="${escapeHtml(id)}"
        >
      `;
    }

    if (type === "COLOR") {
      const value = normalizeColor(setting.value);
      return `
        <div class="color-control">
          <input
            class="color-input"
            type="color"
            value="${escapeHtml(value.hex)}"
            data-setting-action="color"
            data-setting-path="${escapeHtml(id)}"
          >
          <input
            class="text-input color-text"
            value="${escapeHtml(value.hex)}"
            data-setting-action="color-text"
            data-setting-path="${escapeHtml(id)}"
          >
        </div>
      `;
    }

    if (type === "CHOOSE") {
      return renderDropdown(id, setting.value, setting.choices || [], "choose");
    }

    if (type === "MULTI_CHOOSE") {
      const active = new Set(setting.value || []);
      return `
        <div class="chips">
          ${(setting.choices || []).map((choice) => `
            <button
              class="chip ${active.has(choice) ? "active" : ""}"
              data-setting-action="multi"
              data-setting-path="${escapeHtml(id)}"
              data-choice="${escapeHtml(choice)}"
              type="button"
            >${escapeHtml(choice)}</button>
          `).join("")}
        </div>
      `;
    }

    if (type === "CONFIGURABLE" || type === "TOGGLEABLE") {
      return `
        <div class="nested-group">
          ${renderSettings(setting.value || [], settingKey)}
        </div>
      `;
    }

    if (type === "CHOICE") {
      const options = Object.keys(setting.choices || {});
      const activeChoice = setting.active || options[0] || "";
      const activeSettings = setting.choices?.[activeChoice]?.value || [];

      return `
        <div class="choice-group">
          ${renderDropdown(id, activeChoice, options, "choice")}
          ${activeSettings.length ? `
            <div class="nested-group">
              ${renderSettings(activeSettings, `${settingKey}/${activeChoice}`)}
            </div>
          ` : ""}
        </div>
      `;
    }

    if (setting.value && typeof setting.value === "object") {
      return `
        <textarea
          class="json-input"
          data-setting-action="json"
          data-setting-path="${escapeHtml(id)}"
          spellcheck="false"
        >${escapeHtml(JSON.stringify(setting.value, null, 2))}</textarea>
      `;
    }

    return `
      <input
        class="text-input"
        value="${escapeHtml(formatUnknownValue(setting.value))}"
        data-setting-action="unknown"
        data-setting-path="${escapeHtml(id)}"
      >
    `;
  };

  const renderDropdown = (id, value, options, action) => {
    const currentValue = value == null || value === "" ? "Select" : String(value);
    const open = openDropdownPath === id;

    return `
      <div class="select-menu ${open ? "open" : ""}">
        <button
          class="select-trigger"
          data-setting-action="select-toggle"
          data-setting-path="${escapeHtml(id)}"
          type="button"
        >
          <span>${escapeHtml(currentValue)}</span>
          <span class="select-arrow">${open ? "v" : "&gt;"}</span>
        </button>
        ${open ? `
          <div class="select-options">
            ${options.map((option) => `
              <button
                class="select-option ${String(option) === currentValue ? "active" : ""}"
                data-setting-action="${escapeHtml(action)}"
                data-setting-path="${escapeHtml(id)}"
                data-choice="${escapeHtml(option)}"
                type="button"
              >${escapeHtml(option)}</button>
            `).join("")}
          </div>
        ` : ""}
      </div>
    `;
  };

  const bindSettingControls = () => {
    bindSettingRows();

    document.querySelectorAll("[data-setting-action]").forEach((element) => {
      const action = element.dataset.settingAction;

      if (action === "bind") {
        element.addEventListener("click", (event) => {
          event.preventDefault();
          handleSettingChange(element, action);
        });
        element.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          handleSettingChange(element, "bind-mode", true);
        });
        return;
      }

      if (action === "select-toggle") {
        element.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openDropdownPath = openDropdownPath === element.dataset.settingPath
            ? null
            : element.dataset.settingPath;
          renderModuleSettingsPreservingScroll();
        });
        return;
      }

      if (action === "choose" || action === "choice") {
        element.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          handleSettingChange(element, action, true);
        });
        return;
      }

      const eventName = action === "boolean" || action === "multi" ? "click" : "input";

      element.addEventListener(eventName, () => {
        handleSettingChange(element, action);
      });

      if (eventName === "input") {
        element.addEventListener("change", () => {
          handleSettingChange(element, action, true);
        });
      }
    });
  };

  const bindSettingRows = () => {
    document.querySelectorAll("[data-expand-key]").forEach((row) => {
      row.addEventListener("contextmenu", (event) => {
        if (event.target.closest("[data-setting-action]")) {
          return;
        }

        if (event.target.closest("[data-expand-key]") !== row) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const key = row.dataset.expandKey;
        if (!key) {
          return;
        }

        if (expandedSettingKeys.has(key)) {
          expandedSettingKeys.delete(key);
        } else {
          expandedSettingKeys.add(key);
        }

        renderModuleSettingsPreservingScroll();
      });
    });
  };

  const renderModuleSettingsPreservingScroll = () => {
    const scrollTop = document.querySelector(".settings-page")?.scrollTop ?? 0;
    renderModuleSettings();
    restoreSettingsScroll(scrollTop);
  };

  const restoreSettingsScroll = (scrollTop) => {
    const settingsPage = document.querySelector(".settings-page");
    if (!settingsPage) {
      return;
    }

    settingsPage.scrollTop = scrollTop;
    requestAnimationFrame(() => {
      document.querySelector(".settings-page")?.scrollTo({
        top: scrollTop,
        left: 0
      });
    });
  };

  const handleSettingChange = (element, action, immediate = false) => {
    const setting = resolveSettingPath(element.dataset.settingPath);
    if (!setting) return;

    if (action === "boolean") {
      setting.value = !setting.value;
    } else if (action === "number") {
      setting.value = parseNumberForSetting(element.value, setting);
    } else if (action === "range-from" || action === "range-to") {
      const value = parseNumberForSetting(element.value, setting);
      const current = setting.value || { from: value, to: value };
      setting.value = {
        from: action === "range-from" ? Math.min(value, Number(current.to ?? value)) : current.from,
        to: action === "range-to" ? Math.max(value, Number(current.from ?? value)) : current.to
      };
    } else if (action === "text" || action === "unknown") {
      setting.value = element.value;
    } else if (action === "color") {
      setting.value = colorHexToArgb(element.value, setting.value);
    } else if (action === "color-text") {
      setting.value = colorHexToArgb(element.value, setting.value);
    } else if (action === "choose") {
      setting.value = element.dataset.choice ?? element.value;
      openDropdownPath = null;
    } else if (action === "multi") {
      toggleMultiChoice(setting, element.dataset.choice);
    } else if (action === "choice") {
      setting.active = element.dataset.choice ?? element.value;
      setting.value = setting.choices?.[setting.active]?.value || [];
      openDropdownPath = null;
    } else if (action === "bind") {
      startBindCapture(setting);
      return;
    } else if (action === "bind-mode") {
      const bind = normalizeBindValue(setting.value);
      setting.value = {
        ...bind,
        action: bind.action === "Toggle" ? "Hold" : "Toggle"
      };
    } else if (action === "json") {
      try {
        setting.value = JSON.parse(element.value);
        element.classList.remove("invalid");
      } catch (_) {
        element.classList.add("invalid");
        return;
      }
    }

    saveSettingsDebounced(immediate ? 0 : 300);

    if (["boolean", "multi", "choose", "choice", "bind-mode"].includes(action)) {
      renderModuleSettingsPreservingScroll();
    } else {
      syncSettingControl(element, setting);
    }
  };

  const resolveSettingPath = (path) => {
    if (!path) return null;

    return settingRefs.get(path) || null;
  };

  const syncSettingControl = (element, setting) => {
    const id = element.dataset.settingPath;
    if (!id) return;

    document.querySelectorAll(`[data-setting-path="${id}"]`).forEach((control) => {
      const action = control.dataset.settingAction;

      if (action === "number") {
        control.value = setting.value;
      } else if (action === "range-from") {
        control.value = setting.value?.from ?? "";
      } else if (action === "range-to") {
        control.value = setting.value?.to ?? "";
      } else if (action === "color") {
        control.value = normalizeColor(setting.value).hex;
      } else if (action === "color-text") {
        control.value = normalizeColor(setting.value).hex;
      } else if (action === "choose") {
        control.value = setting.value;
      } else if (action === "text" || action === "unknown") {
        control.value = setting.value ?? "";
      }
    });
  };

  const startBindCapture = (setting) => {
    bindingSetting = setting;
    stopBindCapture();
    renderModuleSettings();
    connectEventSocket();
    const ignoreMouseUntil = Date.now() + 250;

    setTimeout(() => {
      const onSocketKey = (event) => {
        if (event.action !== 1 || !event.key) {
          return;
        }

        applyBindKey(setting, event.key);
      };
      const onSocketMouse = (event) => {
        if (event.button === 0 && Date.now() < ignoreMouseUntil) {
          return;
        }

        if (event.action !== 1 || !event.key) {
          return;
        }

        applyBindKey(setting, event.key);
      };
      const onKeyDown = (event) => {
        const keyName = keyboardEventToMinecraftKey(event);
        if (!keyName) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        applyBindKey(setting, keyName);
      };
      const onMouseDown = (event) => {
        if (event.button === 0 && Date.now() < ignoreMouseUntil) {
          return;
        }

        const keyName = mouseEventToMinecraftKey(event);
        if (!keyName) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        applyBindKey(setting, keyName);
      };
      const onContextMenu = (event) => {
        event.preventDefault();
      };

      window.addEventListener("keydown", onKeyDown, true);
      window.addEventListener("mousedown", onMouseDown, true);
      window.addEventListener("contextmenu", onContextMenu, true);
      addSocketListener("keyboardKey", onSocketKey);
      addSocketListener("mouseButton", onSocketMouse);
      bindCaptureCleanup = () => {
        window.removeEventListener("keydown", onKeyDown, true);
        window.removeEventListener("mousedown", onMouseDown, true);
        window.removeEventListener("contextmenu", onContextMenu, true);
        removeSocketListener("keyboardKey", onSocketKey);
        removeSocketListener("mouseButton", onSocketMouse);
      };
    }, 0);
  };

  const stopBindCapture = () => {
    if (bindCaptureCleanup) {
      bindCaptureCleanup();
      bindCaptureCleanup = null;
    }
  };

  const applyBindKey = (setting, boundKey) => {
    const bind = normalizeBindValue(setting.value);
    setting.value = {
      ...bind,
      boundKey,
      modifiers: []
    };
    bindingSetting = null;
    stopBindCapture();
    saveSettingsDebounced(0);
    renderModuleSettingsPreservingScroll();
  };

  const connectEventSocket = () => {
    if (eventSocket && (eventSocket.readyState === WebSocket.OPEN || eventSocket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    eventSocket = new WebSocket(`${protocol}//${location.host}`);
    eventSocket.onopen = () => {
      eventSocketReady = true;
    };
    eventSocket.onclose = () => {
      eventSocketReady = false;
      eventSocket = null;
    };
    eventSocket.onmessage = (message) => {
      let payload;
      try {
        payload = JSON.parse(message.data);
      } catch (_) {
        return;
      }

      const listeners = socketListeners.get(payload.name);
      if (!listeners) {
        return;
      }

      [...listeners].forEach((listener) => listener(payload.event));
    };
  };

  const addSocketListener = (name, listener) => {
    if (!socketListeners.has(name)) {
      socketListeners.set(name, new Set());
    }

    socketListeners.get(name).add(listener);
  };

  const removeSocketListener = (name, listener) => {
    socketListeners.get(name)?.delete(listener);
  };

  const saveSettingsDebounced = (delay) => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSelectedModuleSettings, delay);
  };

  const saveSelectedModuleSettings = async () => {
    if (!selectedModuleName || !selectedModuleSettings) return;

    const preserveFocus = document.activeElement?.hasAttribute("data-setting-action") ?? false;
    saving = true;
    saveError = "";
    if (!preserveFocus) {
      renderModuleSettingsPreservingScroll();
    } else {
      refreshSaveState();
    }

    try {
      await api(`/modules/settings?name=${encodeURIComponent(selectedModuleName)}`, {
        method: "PUT",
        body: JSON.stringify(selectedModuleSettings)
      });
      lastSavedAt = Date.now();
    } catch (error) {
      saveError = `Save failed: ${error.message}`;
    } finally {
      saving = false;
      if (!preserveFocus) {
        renderModuleSettingsPreservingScroll();
      } else {
        refreshSaveState();
      }
    }
  };

  const refreshSaveState = () => {
    const saveState = document.querySelector(".save-state");
    if (saveState) {
      saveState.textContent = saveStatusText();
    }
  };

  const saveStatusText = () => {
    if (saveError) return saveError;
    if (saving) return "Saving...";
    if (lastSavedAt > 0) return "Saved";
    return "Auto-save";
  };

  const loadModules = async () => {
    modules = await api("/modules");
    const cats = categories();
    if (!cats.includes(category)) {
      category = cats[0] || "combat";
    }
    renderClickGui();
    acknowledge();
  };

  const inferFloatStep = (min, max) => {
    const span = Math.abs(max - min);
    if (span <= 1) return 0.01;
    if (span <= 10) return 0.1;
    return 1;
  };

  const parseNumberForSetting = (value, setting) => {
    const number = setting.valueType === "INT" || setting.valueType === "INT_RANGE"
      ? parseInt(value, 10)
      : parseFloat(value);

    if (Number.isNaN(number)) {
      return 0;
    }

    return number;
  };

  const toggleMultiChoice = (setting, choice) => {
    if (!choice) return;

    const current = Array.isArray(setting.value) ? setting.value : [];
    if (current.includes(choice)) {
      if (current.length <= 1 && setting.canBeNone === false) {
        return;
      }
      setting.value = current.filter((entry) => entry !== choice);
    } else {
      setting.value = [...current, choice];
    }
  };

  const isBindSetting = (setting) => setting?.name === "Bind" && setting?.valueType === "BIND";

  const normalizeBindValue = (value) => ({
    boundKey: value?.boundKey || "key.keyboard.unknown",
    action: value?.action === "Hold" ? "Hold" : "Toggle",
    modifiers: Array.isArray(value?.modifiers) ? value.modifiers : []
  });

  const formatBindKey = (boundKey) => {
    if (!boundKey || boundKey === "key.keyboard.unknown") {
      return "None";
    }

    return boundKey
      .replace(/^key\.keyboard\./, "")
      .replace(/^key\.mouse\./, "mouse.")
      .split(".")
      .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
      .join(" ");
  };

  const mouseEventToMinecraftKey = (event) => {
    if (event.button === 0) return "key.mouse.left";
    if (event.button === 1) return "key.mouse.middle";
    if (event.button === 2) return "key.mouse.right";
    if (event.button >= 3 && event.button <= 7) return `key.mouse.${event.button + 1}`;
    return null;
  };

  const keyboardEventToMinecraftKey = (event) => {
    const code = event.code;
    if (/^Key[A-Z]$/.test(code)) return `key.keyboard.${code.slice(3).toLowerCase()}`;
    if (/^Digit[0-9]$/.test(code)) return `key.keyboard.${code.slice(5)}`;
    if (/^F([1-9]|1[0-9]|2[0-5])$/.test(code)) return `key.keyboard.${code.toLowerCase()}`;
    if (/^Numpad[0-9]$/.test(code)) return `key.keyboard.keypad.${code.slice(6)}`;

    const keyMap = {
      Escape: "key.keyboard.escape",
      Enter: "key.keyboard.enter",
      Tab: "key.keyboard.tab",
      Space: "key.keyboard.space",
      Backspace: "key.keyboard.backspace",
      CapsLock: "key.keyboard.caps.lock",
      ShiftLeft: "key.keyboard.left.shift",
      ShiftRight: "key.keyboard.right.shift",
      ControlLeft: "key.keyboard.left.control",
      ControlRight: "key.keyboard.right.control",
      AltLeft: "key.keyboard.left.alt",
      AltRight: "key.keyboard.right.alt",
      MetaLeft: "key.keyboard.left.win",
      MetaRight: "key.keyboard.right.win",
      ContextMenu: "key.keyboard.menu",
      PrintScreen: "key.keyboard.print.screen",
      ScrollLock: "key.keyboard.scroll.lock",
      Pause: "key.keyboard.pause",
      Insert: "key.keyboard.insert",
      Delete: "key.keyboard.delete",
      Home: "key.keyboard.home",
      End: "key.keyboard.end",
      PageUp: "key.keyboard.page.up",
      PageDown: "key.keyboard.page.down",
      ArrowUp: "key.keyboard.up",
      ArrowDown: "key.keyboard.down",
      ArrowLeft: "key.keyboard.left",
      ArrowRight: "key.keyboard.right",
      NumLock: "key.keyboard.num.lock",
      NumpadAdd: "key.keyboard.keypad.add",
      NumpadSubtract: "key.keyboard.keypad.subtract",
      NumpadMultiply: "key.keyboard.keypad.multiply",
      NumpadDivide: "key.keyboard.keypad.divide",
      NumpadEnter: "key.keyboard.keypad.enter",
      NumpadDecimal: "key.keyboard.keypad.decimal",
      NumpadEqual: "key.keyboard.keypad.equal",
      Semicolon: "key.keyboard.semicolon",
      Equal: "key.keyboard.equal",
      Comma: "key.keyboard.comma",
      Minus: "key.keyboard.minus",
      Period: "key.keyboard.period",
      Slash: "key.keyboard.slash",
      Backquote: "key.keyboard.grave.accent",
      BracketLeft: "key.keyboard.left.bracket",
      Backslash: "key.keyboard.backslash",
      BracketRight: "key.keyboard.right.bracket",
      Quote: "key.keyboard.apostrophe"
    };

    return keyMap[code] || null;
  };

  const normalizeColor = (value) => {
    const number = Number(value ?? 0);
    const rgb = number & 0x00ffffff;
    return {
      hex: `#${rgb.toString(16).padStart(6, "0")}`
    };
  };

  const colorHexToArgb = (hex, previous) => {
    const normalized = String(hex).trim().replace(/^#/, "");
    if (!/^[0-9a-f]{6}$/i.test(normalized)) {
      return previous ?? 0;
    }

    const alpha = Number(previous ?? 0) & 0xff000000;
    const fallbackAlpha = alpha === 0 ? 0xff000000 : alpha;
    return (fallbackAlpha | parseInt(normalized, 16)) >> 0;
  };

  const formatUnknownValue = (value) => {
    if (value == null) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const formatHudModuleName = (name) => {
    const normalized = String(name || "");
    if (!hudSpaceSeparatedNames) {
      return normalized;
    }

    return normalized.match(/[A-Z]?[a-z]+|[0-9]+|[A-Z]+(?![a-z])/g)?.join(" ") || normalized;
  };

  const measureTextWidth = (text) => {
    if (!textMeasureContext) {
      textMeasureContext = document.createElement("canvas").getContext("2d");
      if (textMeasureContext) {
        textMeasureContext.font = `500 ${hudArrayListSettings.fontSize}px Inter, Segoe UI, Roboto, Arial, sans-serif`;
      }
    }

    if (textMeasureContext) {
      textMeasureContext.font = `500 ${hudArrayListSettings.fontSize}px Inter, Segoe UI, Roboto, Arial, sans-serif`;
    }

    return textMeasureContext?.measureText(text).width ?? String(text).length * 8;
  };

  const hudArrayListItemStyle = () => {
    const settings = hudArrayListSettings;
    const borderSide = settings.rightSide ? "border-left" : "border-right";
    const radius = settings.rightSide ? "4px 0 0 4px" : "0 4px 4px 0";
    const base = [
      `color: ${settings.textColor}`,
      `font-size: ${settings.fontSize}px`,
      `padding: ${settings.verticalPadding}px ${settings.horizontalPadding}px`,
      `text-shadow: ${settings.shadow ? "0 1px 3px rgba(0, 0, 0, 0.75)" : "none"}`
    ];

    if (settings.style === "Compact") {
      return [
        ...base,
        `background: ${settings.backgroundColor}`,
        `border-bottom: 2px solid ${settings.accentColor}`,
        "border-radius: 3px"
      ].join("; ");
    }

    if (settings.style === "Outline") {
      return [
        ...base,
        `background: ${settings.backgroundColor}`,
        `border: ${settings.outlineWidth}px solid ${settings.outlineColor}`,
        `box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05)`,
        "border-radius: 4px"
      ].join("; ");
    }

    if (settings.style === "Minimal") {
      return [
        ...base,
        "background: transparent",
        "border: 0",
        "border-radius: 0"
      ].join("; ");
    }

    return [
      ...base,
      `background: ${settings.backgroundColor}`,
      `${borderSide}: 4px solid ${settings.borderColor}`,
      `border-radius: ${radius}`
    ].join("; ");
  };

  const colorToCss = (value) => {
    const number = Number(value ?? 0);
    const unsigned = number >>> 0;
    const alpha = (unsigned >>> 24) & 255;
    const red = (unsigned >>> 16) & 255;
    const green = (unsigned >>> 8) & 255;
    const blue = unsigned & 255;

    if (alpha >= 255) {
      return `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue
        .toString(16)
        .padStart(2, "0")}`;
    }

    return `rgba(${red}, ${green}, ${blue}, ${(alpha / 255).toFixed(3)})`;
  };

  const title = (value) => `${value.slice(0, 1).toUpperCase()}${value.slice(1).toLowerCase()}`;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

  if (route === "hud") {
    renderHud();
  } else if (route === "clickgui") {
    app.className = "screen";
    app.innerHTML = `<div class="state">Loading modules...</div>`;
    watchClickGuiClose();
    loadModules().catch((error) => {
      app.innerHTML = `<div class="state">Failed to load modules: ${escapeHtml(error.message)}</div>`;
    });
  } else {
    app.className = "screen";
    app.innerHTML = "";
    acknowledge();
  }
})();
