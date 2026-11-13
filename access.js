/* DORAMAX access control - Supabase client-side integration.
   The publishable key is intended for client apps. Never put a service_role/secret key here. */
(() => {
  "use strict";

  // Evita que fallback local e arquivo remoto inicializem o app duas vezes.
  if (window.__doramaxAccessLoaded) return;
  window.__doramaxAccessLoaded = true;
  window.__doramaxAccessSource = "remote";
  window.__doramaxAccessVersion = "2026.11.13.1";

  const SUPABASE_URL = "https://qbwsaahlkovrejwliefv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_IUeH0RsYhkHpsBflAPo1WQ_1VVPbsAK";
  const PICPay_URL = "https://link.picpay.com/p/17945341236af66aeb27abc";
  const STORAGE_KEY = "doramax_session_v1";

  // Remove o aviso temporário de teste do topo do aplicativo.
  const TEST_BANNER_TEXT = "DORAMAX: atualização remota funcionando!";
  const cleanBannerText = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const removeTestBanner = (root = document) => {
    const elements = [];
    if (root.nodeType === 1) elements.push(root);
    root.querySelectorAll?.("*").forEach((el) => elements.push(el));
    for (const el of elements) {
      const text = cleanBannerText(el.innerText || el.textContent);
      if (!text.includes(TEST_BANNER_TEXT)) continue;
      const childContains = [...el.children].some((child) =>
        cleanBannerText(child.innerText || child.textContent).includes(TEST_BANNER_TEXT)
      );
      if (childContains) continue;
      let target = el;
      let parent = el.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const marker = ((parent.id || "") + " " +
          (typeof parent.className === "string" ? parent.className : "")).toLowerCase();
        if (/(banner|toast|notice|alert|message|status|test)/.test(marker) &&
            cleanBannerText(parent.innerText || parent.textContent).includes(TEST_BANNER_TEXT)) {
          target = parent;
        }
        parent = parent.parentElement;
      }
      target.remove();
    }
  };
  const installTestBannerCleanup = () => {
    removeTestBanner(document);
    if (!document.documentElement || window.__doramaxBannerCleanup) return;
    window.__doramaxBannerCleanup = new MutationObserver((records) => {
      removeTestBanner(document.body || document.documentElement);
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) removeTestBanner(node);
          else if (node.parentElement) removeTestBanner(node.parentElement);
        }
      }
    });
    window.__doramaxBannerCleanup.observe(document.documentElement, {
      childList: true, characterData: true, subtree: true
    });
  };
  installTestBannerCleanup();
  document.addEventListener("DOMContentLoaded", installTestBannerCleanup, { once: true });
  window.addEventListener("load", installTestBannerCleanup, { once: true });


  // Camada de atualizações remotas: configurações visuais e código de interface.
  // Este arquivo é carregado pelo index.html da APK sem reinstalação.
  const REMOTE_CONFIG_URL = "https://raw.githubusercontent.com/binhozer09/doramax-updates/main/remote-config.json";
  const REMOTE_RUNTIME_URL = "https://raw.githubusercontent.com/binhozer09/doramax-updates/main/remote-runtime.js";
  const REMOTE_POLL_MS = 5 * 60 * 1000;
  let remoteRuntimeVersion = "";
  let remoteRuntimeLoading = "";
  let remoteConfigCheck = null;
  let remoteConfig = null;

  function remoteColor(value, fallback) {
    return typeof value === "string" && (/^#[0-9a-f]{3,8}$/i.test(value) || /^rgba?\([\d.,%\s]+\)$/i.test(value))
      ? value : fallback;
  }

  function applyRemoteNotice(notice) {
    const id = "dmRemoteNotice";
    let node = document.getElementById(id);
    if (!notice || notice.enabled !== true || !String(notice.text || "").trim()) {
      if (node) node.remove();
      return;
    }
    const message = String(notice.text).slice(0, 500);
    const dismissible = notice.dismissible !== false;
    const key = "doramax_notice_dismissed_" + message;
    if (dismissible && localStorage.getItem(key) === "1") {
      if (node) node.remove();
      return;
    }
    if (!node) {
      node = document.createElement("div");
      node.id = id;
      node.setAttribute("role", "status");
      node.style.cssText = "position:relative;z-index:9998;display:flex;align-items:center;justify-content:center;gap:12px;padding:11px 14px;text-align:center;font:600 13px/1.4 Arial,sans-serif;color:#fff;background:#b42335;box-shadow:0 2px 8px #0005;";
      const host = document.body || document.documentElement;
      host.insertBefore(node, host.firstChild);
    }
    node.replaceChildren();
    const text = document.createElement("span");
    text.textContent = message;
    node.appendChild(text);
    if (dismissible) {
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "×";
      close.setAttribute("aria-label", "Fechar aviso");
      close.style.cssText = "border:0;background:transparent;color:inherit;font-size:22px;padding:0 4px;";
      close.onclick = () => { localStorage.setItem(key, "1"); node.remove(); };
      node.appendChild(close);
    }
    const kind = notice.type === "success" ? "#147a49" : notice.type === "warning" ? "#a45a08" : "#b42335";
    node.style.background = kind;
  }

  const remoteHiddenElements = new WeakMap();
  function applyRemoteConfig(config) {
    if (!config || typeof config !== "object") return;
    remoteConfig = config;
    const theme = config.theme || {};
    const accent = remoteColor(theme.accentColor, "#e62e49");
    const background = remoteColor(theme.backgroundColor, "");
    document.documentElement.style.setProperty("--dm-remote-accent", accent);
    if (background) document.body.style.backgroundColor = background;
    else document.body.style.removeProperty("background-color");
    document.querySelectorAll(".dm-btn:not(.secondary)").forEach(el => {
      if (!el.dataset.dmOriginalAccent) el.dataset.dmOriginalAccent = el.style.backgroundColor || "";
      el.style.backgroundColor = accent;
    });
    applyRemoteNotice(config.notice);
    document.querySelectorAll("[data-dm-remote-hidden='1']").forEach(el => {
      const original = remoteHiddenElements.get(el);
      if (original !== undefined) el.style.display = original;
      delete el.dataset.dmRemoteHidden;
    });
    const visibility = config.visibility || {};
    if (Array.isArray(visibility.hideSelectors)) {
      visibility.hideSelectors.slice(0, 30).forEach(selector => {
        if (typeof selector !== "string" || selector.length > 120) return;
        try {
          document.querySelectorAll(selector).forEach(el => {
            if (!el.dataset.dmRemoteHidden) remoteHiddenElements.set(el, el.style.display || "");
            el.dataset.dmRemoteHidden = "1";
            el.style.setProperty("display", "none", "important");
          });
        } catch (_) {}
      });
    }
    loadRemoteRuntime(config.runtime || {});
  }

  function loadRemoteRuntime(runtime) {
    if (runtime.enabled === false) {
      const previous = window.DORAMAX_REMOTE_RUNTIME;
      try { if (previous && typeof previous.dispose === "function") previous.dispose(); } catch (_) {}
      remoteRuntimeVersion = "";
      remoteRuntimeLoading = "";
      return;
    }
    const version = String(runtime.version || "1.0.0").slice(0, 40);
    if (version === remoteRuntimeVersion || version === remoteRuntimeLoading) return;
    remoteRuntimeLoading = version;
    const script = document.createElement("script");
    script.src = REMOTE_RUNTIME_URL + "?v=" + encodeURIComponent(version) + "&ts=" + Date.now();
    script.async = true;
    script.onload = () => {
      const api = window.DORAMAX_REMOTE_RUNTIME;
      if (!api || typeof api.init !== "function") {
        remoteRuntimeLoading = "";
        console.warn("[DORAMAX] Extensão remota carregada sem init().");
        return;
      }
      try {
        api.init({ config: remoteConfig, app: window.DORAMAX_REMOTE_API });
        remoteRuntimeVersion = version;
      } catch (error) {
        console.error("[DORAMAX] Erro ao iniciar extensão remota.", error);
      } finally {
        remoteRuntimeLoading = "";
      }
    };
    script.onerror = () => {
      remoteRuntimeLoading = "";
      console.warn("[DORAMAX] Extensão remota indisponível; mantendo o app atual.");
    };
    document.head.appendChild(script);
  }

  window.DORAMAX_REMOTE_API = {
    version: "1.0.0",
    getConfig: () => remoteConfig,
    showNotice: (text, type = "info") => applyRemoteNotice({ enabled: true, text, type, dismissible: true }),
    clearNotice: () => applyRemoteNotice({ enabled: false }),
    setAccentColor: color => document.documentElement.style.setProperty("--dm-remote-accent", remoteColor(color, "#e62e49"))
  };

  async function checkRemoteConfig() {
    if (remoteConfigCheck) return remoteConfigCheck;
    remoteConfigCheck = (async () => {
      const fetchWithTimeout = async (url, options = {}) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
          return await fetch(url, { ...options, signal: controller.signal });
        } finally {
          clearTimeout(timer);
        }
      };
      try {
        let config = null;
        try {
          const dbResponse = await fetchWithTimeout(
            SUPABASE_URL + "/rest/v1/app_settings?key=eq.remote_config&is_public=eq.true&select=value",
            { headers: { "apikey": SUPABASE_KEY }, cache: "no-store" }
          );
          if (dbResponse.ok) {
            const rows = await dbResponse.json();
            if (Array.isArray(rows) && rows[0] && rows[0].value) config = rows[0].value;
          }
        } catch (dbError) {
          console.warn("[DORAMAX] Supabase remoto indisponível; tentando configuração de reserva.", dbError);
        }
        if (!config) {
          const response = await fetchWithTimeout(REMOTE_CONFIG_URL + "?ts=" + Date.now(), { cache: "no-store" });
          if (!response.ok) throw new Error("HTTP " + response.status);
          config = await response.json();
        }
        if (!config || config.schemaVersion !== 1) throw new Error("Formato de configuração remota inválido.");
        applyRemoteConfig(config);
      } catch (error) {
        console.warn("[DORAMAX] Não foi possível consultar configurações remotas; mantendo a última interface.", error);
      } finally {
        remoteConfigCheck = null;
      }
    })();
    return remoteConfigCheck;
  }
  checkRemoteConfig();
  window.setInterval(checkRemoteConfig, REMOTE_POLL_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkRemoteConfig(); });

  const feed = document.getElementById("feed");
  let cards = [...document.querySelectorAll("#feed .video")];
  if (!feed || cards.length < 3) return;


  let session = null;
  let currentUser = null;
  let isAdmin = false;
  let unlocked = false;
  let authMode = "login";
  let paymentPoller = null;

  const apiHeaders = (token) => ({
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + (token || SUPABASE_KEY),
    "Content-Type": "application/json"
  });

  async function api(path, options = {}, token) {
    const response = await fetch(SUPABASE_URL + path, {
      ...options,
      headers: { ...apiHeaders(token), ...(options.headers || {}) }
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = raw; }
    if (!response.ok) {
      const message = data && (data.msg || data.message || data.error_description || data.error)
        ? (data.msg || data.message || data.error_description || data.error)
        : "Erro ao comunicar com o servidor (" + response.status + ").";
      throw new Error(message);
    }
    return data;
  }

  function saveSession(value) {
    session = value;
    if (value) {
      if (!value.expires_at && value.expires_in) {
        value.expires_at = Math.floor(Date.now() / 1000) + Number(value.expires_in);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    updateLoggedAs();
  }

  function updateLoggedAs() {
    let label = document.getElementById("dmLoggedAs");
    if (!label) {
      const actions = document.querySelector(".top-actions");
      if (!actions) return;
      label = document.createElement("span");
      label.id = "dmLoggedAs";
      label.className = "dm-logged-as";
      actions.insertBefore(label, actions.firstChild);
    }
    const email = currentUser && currentUser.email;
    label.textContent = email ? "Logado: " + email : "";
    label.style.display = email ? "inline-block" : "none";
    label.title = email ? "Conta conectada: " + email : "";
    const adminButton = document.getElementById("adminAccessBtn");
    if (adminButton) {
      adminButton.textContent = email ? "LOGOUT" : "LOGIN";
      adminButton.title = email ? "Sair da conta" : "Entrar na conta";
    }
    let contentButton = document.getElementById("dmContentAdminBtn");
    if (isAdmin && email) {
      if (!contentButton) {
        contentButton = document.createElement("button");
        contentButton.id = "dmContentAdminBtn";
        contentButton.type = "button";
        contentButton.textContent = "PAINEL ADM";
        contentButton.style.cssText = "border:0;border-radius:8px;padding:8px 10px;background:#159b60;color:#fff;font-size:11px;font-weight:800;margin-left:6px;";
        contentButton.addEventListener("click", openContentAdminPanel);
        const actions = document.querySelector(".top-actions");
        if (actions) actions.appendChild(contentButton);
      }
    } else if (contentButton) {
      contentButton.remove();
    }
  }

  async function refreshSessionIfNeeded() {
    if (!session || !session.refresh_token) return;
    const expiresAt = Number(session.expires_at || 0);
    if (expiresAt && expiresAt > Math.floor(Date.now() / 1000) + 60) return;
    const refreshed = await api("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    saveSession(refreshed);
  }

  function addStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .dm-cover{position:absolute;inset:0;z-index:12;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.94);text-align:center}
      .dm-cover-card{width:min(100%,340px);padding:26px 22px;border:1px solid #ffffff24;border-radius:20px;background:#151515;box-shadow:0 12px 45px #000}
      .dm-cover h2,.dm-modal h2{font-size:23px;margin:0 0 10px}
      .dm-cover p,.dm-modal p{font-size:14px;line-height:1.5;color:#ddd;margin:0 0 18px}
      .dm-btn{display:block;width:100%;border:0;border-radius:12px;padding:14px 16px;margin:9px 0;background:#e62e49;color:#fff;font-size:15px;font-weight:800}
      .dm-btn.secondary{background:#292929;border:1px solid #555}
      .dm-btn.green{background:#159b60}
      .dm-modal-backdrop{position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;padding:18px;background:#000d}
      .dm-modal{width:min(100%,420px);max-height:90dvh;overflow:auto;padding:24px 20px;border:1px solid #ffffff26;border-radius:20px;background:#141414;color:#fff;box-shadow:0 15px 60px #000}
      .dm-modal input{display:block;width:100%;padding:14px;margin:10px 0;border-radius:10px;border:1px solid #555;background:#090909;color:#fff;font-size:16px}
      .dm-modal .dm-small{font-size:12px;color:#aaa}
      .dm-modal .dm-error{color:#ff8292;min-height:18px;font-size:13px}
      .dm-close{float:right;border:0;background:transparent;color:#fff;font-size:25px;padding:0 5px}
      .dm-admin-list{margin-top:16px;text-align:left}
      .dm-payment-box{margin:14px 0;padding:14px;border:1px solid #ffffff24;border-radius:12px;background:#202020;text-align:left}.dm-payment-box h3{font-size:15px;margin:0 0 8px}.dm-payment-count{font-size:12px;color:#ffd36a;margin:0 0 10px}.dm-payment-item{padding:10px 0;border-top:1px solid #ffffff20;font-size:12px;line-height:1.45}.dm-payment-item strong{display:block;color:#fff}.dm-payment-empty{font-size:12px;color:#aaa}
      .dm-user{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid #333;font-size:13px}
      .dm-user button{border:0;border-radius:9px;padding:10px 12px;background:#159b60;color:#fff;font-size:11px;font-weight:800;white-space:normal;min-width:150px}.dm-user{align-items:flex-start}.dm-user span{flex:1;overflow-wrap:anywhere}
      .dm-user button.lock{background:#b52b3f}
      .dm-status{font-size:12px;color:#bbb;margin:8px 0}\n      .dm-logged-as{max-width:112px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;font-weight:600;color:#fff;background:#0009;border:1px solid #ffffff30;border-radius:12px;padding:4px 6px;pointer-events:none}
      
    `;
    document.head.appendChild(style);
  }

  function createModal() {
    const backdrop = document.createElement("div");
    backdrop.className = "dm-modal-backdrop";
    backdrop.id = "dmModal";
    backdrop.innerHTML = `
      <section class="dm-modal" role="dialog" aria-modal="true" aria-label="Conta DORAMAX">
        <button class="dm-close" id="dmClose" aria-label="Fechar">×</button>
        <h2 id="dmModalTitle">Entrar no DORAMAX</h2>
        <p id="dmModalDesc">Entre com sua conta para consultar seu acesso.</p>
        <form id="dmAuthForm">
          <input id="dmEmail" type="email" autocomplete="email" placeholder="Seu e-mail" required>
          <input id="dmPassword" type="password" autocomplete="current-password" placeholder="Sua senha" minlength="6" required>
          <button class="dm-btn" id="dmSubmit" type="submit">Entrar</button>
        </form>
        <button class="dm-btn secondary" id="dmSwitch" type="button">Criar uma conta</button>
        <button class="dm-btn secondary" id="dmLogout" type="button" style="display:none">Sair da conta</button>
        <div class="dm-error" id="dmError" role="status"></div>
        <div class="dm-status" id="dmStatus"></div>
        <p class="dm-small">O pagamento é conferido manualmente. Use o mesmo e-mail cadastrado no aplicativo.</p>
      </section>`;
    document.body.appendChild(backdrop);
    document.getElementById("dmClose").onclick = closeModal;
    backdrop.addEventListener("click", e => { if (e.target === backdrop) closeModal(); });
    document.getElementById("dmSwitch").onclick = () => {
      authMode = authMode === "login" ? "signup" : "login";
      updateAuthMode();
    };
    document.getElementById("dmAuthForm").addEventListener("submit", submitAuth);
    document.getElementById("dmLogout").onclick = logout;
  }

  function updateAuthMode() {
    const signup = authMode === "signup";
    document.getElementById("dmModalTitle").textContent = signup ? "Criar conta" : "Entrar no DORAMAX";
    document.getElementById("dmModalDesc").textContent = signup
      ? "Cadastre seu e-mail e crie uma senha para acompanhar sua liberação."
      : "Entre com sua conta para consultar seu acesso.";
    document.getElementById("dmSubmit").textContent = signup ? "Criar conta" : "Entrar";
    document.getElementById("dmSwitch").textContent = signup ? "Já tenho uma conta" : "Criar uma conta";
    document.getElementById("dmPassword").autocomplete = signup ? "new-password" : "current-password";
  }

  function openModal(mode = "login") {
    authMode = mode;
    updateAuthMode();
    document.getElementById("dmError").textContent = "";
    document.getElementById("dmAuthForm").style.display = "block";
    document.getElementById("dmSwitch").style.display = "block";
    document.getElementById("dmLogout").style.display = session ? "block" : "none";
    document.getElementById("dmModalTitle").textContent = mode === "signup" ? "Criar conta" : "Entrar no DORAMAX";
    document.getElementById("dmModal").style.display = "flex";
  }

  function closeModal() {
    document.getElementById("dmModal").style.display = "none";
  }

  function setError(message) {
    document.getElementById("dmError").textContent = message || "";
  }

  function makeCover(card, index) {
    if (card.querySelector(".dm-cover")) return;
    const cover = document.createElement("div");
    cover.className = "dm-cover";
    cover.innerHTML = `
      <div class="dm-cover-card">
        <h2>Continue assistindo</h2>
        <p>Os 2 primeiros vídeos são grátis. Para liberar os demais, faça seu cadastro e pague R$ 5,00 uma única vez.</p>
        <button class="dm-btn" type="button">CRIAR CONTA / ENTRAR</button>
        <button class="dm-btn green dm-pay-button" type="button" style="display:none">PAGUE 5 REAIS APENAS UMA VEZ</button>
        <p class="dm-small dm-pay-hint">Crie sua conta ou entre nela para liberar a opção de pagamento.</p>
        <p class="dm-small">Depois do pagamento, aguarde a confirmação e liberação pelo administrador.</p>
      </div>`;
    cover.querySelector(".dm-btn").onclick = () => openModal(session && currentUser ? "login" : "signup");
    const payButton = cover.querySelector(".dm-pay-button");
    const payHint = cover.querySelector(".dm-pay-hint");
    const isLoggedIn = !!(session && currentUser && currentUser.id);
    payButton.style.display = isLoggedIn ? "block" : "none";
    payHint.style.display = isLoggedIn ? "none" : "block";
    payButton.onclick = async (event) => {
      if (!session || !currentUser || !currentUser.id) {
        openModal("signup");
        return;
      }
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "Abrindo PicPay...";
      try {
        await api("/rest/v1/payment_click_notifications", {
          method: "POST",
          headers: { "Prefer": "return=minimal" },
          body: JSON.stringify({
            user_id: currentUser && currentUser.id ? currentUser.id : null,
            email: currentUser && currentUser.email ? currentUser.email : null,
            amount: 5.00
          })
        }, session && session.access_token ? session.access_token : null);
      } catch (error) {
        console.warn("Não foi possível registrar o clique de pagamento:", error);
      } finally {
        window.location.href = PICPay_URL;
      }
    };
    card.style.position = "relative";
    card.appendChild(cover);
  }

  function updateGate() {
    cards = [...document.querySelectorAll("#feed .video")];
    cards.forEach((card, index) => {
      const existing = card.querySelector(".dm-cover");
      if (card.dataset.freePreview === "true" || unlocked || isAdmin) {
        if (existing) existing.remove();
      } else {
        makeCover(card, index);
        const cover = card.querySelector(".dm-cover");
        if (cover) {
          const loggedIn = !!(session && currentUser && currentUser.id);
          const payButton = cover.querySelector(".dm-pay-button");
          const payHint = cover.querySelector(".dm-pay-hint");
          if (payButton) payButton.style.display = loggedIn ? "block" : "none";
          if (payHint) payHint.style.display = loggedIn ? "none" : "block";
        }
      }
    });
  }
  window.doramaxRefreshAccessGate = function () { updateGate(); };

  async function loadAccess() {
    if (!session || !session.access_token) {
      currentUser = null;
      isAdmin = false;
      unlocked = false;
      updateLoggedAs();
      updateGate();
      return;
    }
    try {
      await refreshSessionIfNeeded();
      currentUser = await api("/auth/v1/user", { method: "GET" }, session.access_token);
      updateLoggedAs();
      const uid = currentUser.id;
      // Busca as permissões em paralelo para reduzir a espera após o login.
      const results = await Promise.all([
        api("/rest/v1/admin_users?select=user_id&user_id=eq." + encodeURIComponent(uid), { method: "GET" }, session.access_token),
        api("/rest/v1/access_grants?select=is_unlocked&user_id=eq." + encodeURIComponent(uid), { method: "GET" }, session.access_token)
      ]);
      const adminRows = results[0];
      const grantRows = results[1];
      isAdmin = Array.isArray(adminRows) && adminRows.length > 0;
      updateLoggedAs();
      unlocked = isAdmin || !!(Array.isArray(grantRows) && grantRows[0] && grantRows[0].is_unlocked === true);
      updateGate();
      document.getElementById("dmLogout").style.display = "block";
      document.getElementById("dmStatus").textContent = unlocked
        ? "Acesso liberado. Aproveite todos os vídeos!"
        : "Conta conectada. Acesso aguardando liberação.";
    } catch (error) {
      // Keep the authenticated session so the user can see the real permission/API error.
      isAdmin = false;
      unlocked = false;
      updateGate();
      document.getElementById("dmStatus").textContent = "Não foi possível verificar as permissões: " + (error.message || "erro desconhecido");
      setError("Login realizado, mas a verificação do painel ADM falhou: " + (error.message || "erro desconhecido"));
      return false;
    }
    return true;
  }

  async function submitAuth(event) {
    event.preventDefault();
    setError("");
    const email = document.getElementById("dmEmail").value.trim().toLowerCase();
    const password = document.getElementById("dmPassword").value;
    const signup = authMode === "signup";
    const button = document.getElementById("dmSubmit");
    button.disabled = true;
    button.textContent = "Aguarde...";
    try {
      if (signup) {
        const result = await api("/auth/v1/signup", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        if (result && result.access_token) {
          saveSession(result);
          const checked = await loadAccess();
          if (checked && !isAdmin) {
            authMode = "login";
            updateAuthMode();
            document.getElementById("dmEmail").value = email;
            document.getElementById("dmStatus").textContent = "Conta criada! Sua solicitação está aguardando aprovação do administrador. Se o acesso ainda não foi liberado, os vídeos pagos continuarão bloqueados.";
            setError("");
          }
        } else {
          authMode = "login";
          updateAuthMode();
          document.getElementById("dmEmail").value = email;
          document.getElementById("dmStatus").textContent = "Cadastro recebido pelo Supabase. Se a confirmação por e-mail estiver ativada, abra o e-mail de confirmação e depois entre com esta conta. Após confirmar, sua conta ficará aguardando aprovação do administrador.";
          setError("");
        }
      } else {
        const result = await api("/auth/v1/token?grant_type=password", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        saveSession(result);
        const accessChecked = await loadAccess();
        if (!accessChecked) {
          // loadAccess already displayed the precise verification error.
        } else if (unlocked) {
          closeModal();
        } else {
          closeModal();
          openModal("login");
          document.getElementById("dmStatus").textContent = "Conta conectada. Seu acesso completo ainda aguarda aprovação do administrador.";
        }
      }
    } catch (error) {
      setError(error.message || "Não foi possível entrar. Confira e-mail e senha.");
    } finally {
      button.disabled = false;
      updateAuthMode();
    }
  }

  async function searchUser() {
    if (!isAdmin || !session) return;
    const email = document.getElementById("dmSearch").value.trim().toLowerCase();
    const target = document.getElementById("dmAdminResult");
    target.textContent = "Buscando...";
    if (!email) { target.textContent = "Digite o e-mail cadastrado."; return; }
    try {
      const profiles = await api("/rest/v1/profiles?select=user_id,email&email=ilike." + encodeURIComponent(email), { method: "GET" }, session.access_token);
      if (!profiles.length) { target.textContent = "Usuário não encontrado. Ele precisa criar uma conta no aplicativo primeiro."; return; }
      target.innerHTML = "";
      for (const profile of profiles) await renderAdminUser(profile, target);
    } catch (error) {
      target.textContent = "Erro ao buscar: " + error.message;
    }
  }

  async function renderAdminUser(profile, target) {
    const grants = await api("/rest/v1/access_grants?select=is_unlocked&user_id=eq." + encodeURIComponent(profile.user_id), { method: "GET" }, session.access_token);
    const isUnlocked = !!(grants[0] && grants[0].is_unlocked);
    const row = document.createElement("div");
    row.className = "dm-user";
    const label = document.createElement("span");
    label.textContent = profile.email + " — " + (isUnlocked ? "ACESSO COMPLETO LIBERADO" : "🔔 AGUARDANDO APROVAÇÃO");
    const button = document.createElement("button");
    button.className = isUnlocked ? "lock" : "";
    button.textContent = isUnlocked ? "BLOQUEAR ACESSO COMPLETO" : "DESBLOQUEAR ACESSO COMPLETO";
    button.onclick = async () => {
      button.disabled = true;
      try {
        await api("/rest/v1/access_grants?user_id=eq." + encodeURIComponent(profile.user_id), {
          method: "PATCH",
          headers: { "Prefer": "return=representation" },
          body: JSON.stringify({ is_unlocked: !isUnlocked })
        }, session.access_token);
        const updated = await api("/rest/v1/access_grants?select=user_id,is_unlocked&user_id=eq." + encodeURIComponent(profile.user_id), { method: "GET" }, session.access_token);
        if (!updated.length || updated[0].is_unlocked !== !isUnlocked) {
          throw new Error("Nenhum registro de acesso foi atualizado. Verifique se o usuário possui registro em access_grants.");
        }
        await listUsers();
      } catch (error) {
        button.disabled = false;
        setError("Não foi possível alterar o acesso: " + error.message);
      }
    };
    row.append(label, button);
    target.appendChild(row);
  }

  async function loadPaymentNotifications() {
    if (!isAdmin || !session) return;
    const list = document.getElementById("dmPaymentNotifications");
    const count = document.getElementById("dmPaymentCount");
    if (!list || !count) return;
    try {
      const rows = await api("/rest/v1/payment_click_notifications?select=id,email,amount,clicked_at&order=clicked_at.desc&limit=30", { method: "GET" }, session.access_token);
      count.textContent = "Exibindo " + rows.length + " clique(s) recente(s) — isso não significa pagamento confirmado.";
      list.innerHTML = "";
      if (!rows.length) {
        const empty = document.createElement("p");
        empty.className = "dm-payment-empty";
        empty.textContent = "Ainda não houve cliques no botão de pagamento.";
        list.appendChild(empty);
        return;
      }
      rows.forEach(item => {
        const line = document.createElement("div");
        line.className = "dm-payment-item";
        const who = document.createElement("strong");
        who.textContent = item.email || "Visitante sem login";
        const when = document.createElement("span");
        const date = new Date(item.clicked_at);
        when.textContent = "Clicou em pagar R$ " + Number(item.amount || 5).toFixed(2).replace(".", ",") + " — " + (Number.isNaN(date.getTime()) ? item.clicked_at : date.toLocaleString("pt-BR"));
        line.append(who, when);
        list.appendChild(line);
      });
    } catch (error) {
      count.textContent = "Não foi possível carregar os cliques.";
      list.textContent = error.message || "Verifique a tabela e as permissões no Supabase.";
    }
  }

  async function listUsers() {
    if (!isAdmin || !session) return;
    const target = document.getElementById("dmAdminResult");
    target.textContent = "Carregando usuários...";
    try {
      const profiles = await api("/rest/v1/profiles?select=user_id,email&order=created_at.desc&limit=100", { method: "GET" }, session.access_token);
      const pending = await api("/rest/v1/access_grants?select=user_id&is_unlocked=eq.false", { method: "GET" }, session.access_token);
      const notice = document.getElementById("dmPendingNotice");
      if (notice) notice.textContent = "🔔 " + pending.length + " solicitação(ões) aguardando sua aprovação.";
      await loadPaymentNotifications();
      if (!paymentPoller) paymentPoller = setInterval(loadPaymentNotifications, 20000);
      target.innerHTML = "";
      if (!profiles.length) { target.textContent = "Ainda não há usuários cadastrados."; return; }
      for (const profile of profiles) await renderAdminUser(profile, target);
    } catch (error) {
      target.textContent = "Erro ao listar: " + error.message;
    }
  }

  // Painel simples para administrar conteúdo remoto sem editar arquivos JSON.
  let contentAdminPanel = null;
  function createContentAdminPanel() {
    if (contentAdminPanel) return contentAdminPanel;
    const overlay = document.createElement("div");
    overlay.id = "dmContentAdminPanel";
    overlay.style.cssText = "display:none;position:fixed;inset:0;z-index:2147483000;background:#000d;padding:12px;overflow:auto;align-items:flex-start;justify-content:center;";
    const card = document.createElement("section");
    card.style.cssText = "width:min(100%,620px);margin:12px auto;background:#151515;color:#fff;border:1px solid #ffffff25;border-radius:18px;padding:18px;box-shadow:0 12px 40px #000;font:14px Arial,sans-serif;";
    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;";
    const title = document.createElement("h2");
    title.textContent = "Painel de conteúdo DORAMAX";
    title.style.cssText = "font-size:19px;margin:0;";
    const close = document.createElement("button");
    close.type = "button"; close.textContent = "×";
    close.style.cssText = "border:0;background:#333;color:#fff;border-radius:9px;font-size:24px;width:38px;height:38px;";
    close.onclick = () => { overlay.style.display = "none"; };
    header.append(title, close);

    const status = document.createElement("p");
    status.id = "dmContentAdminStatus";
    status.style.cssText = "color:#b9e7c9;min-height:18px;margin:8px 0;";
    const sectionTitle = (value) => {
      const el = document.createElement("h3"); el.textContent = value;
      el.style.cssText = "font-size:16px;margin:18px 0 9px;padding-top:12px;border-top:1px solid #ffffff20;";
      return el;
    };
    const fieldLabel = (value) => {
      const el = document.createElement("label"); el.textContent = value;
      el.style.cssText = "display:block;margin:10px 0 5px;color:#ddd;font-weight:700;";
      return el;
    };
    const noticeEnabled = document.createElement("input");
    noticeEnabled.type = "checkbox"; noticeEnabled.id = "dmContentNoticeEnabled";
    const noticeLabel = document.createElement("label");
    noticeLabel.style.cssText = "display:flex;align-items:center;gap:9px;margin:10px 0;";
    noticeLabel.append(noticeEnabled, document.createTextNode("Mostrar aviso no aplicativo"));
    const noticeText = document.createElement("textarea");
    noticeText.id = "dmContentNoticeText"; noticeText.rows = 3;
    noticeText.placeholder = "Digite o aviso que aparecerá no aplicativo";
    noticeText.style.cssText = "width:100%;box-sizing:border-box;background:#242424;color:#fff;border:1px solid #555;border-radius:9px;padding:11px;font:14px Arial;resize:vertical;";
    const color = document.createElement("input");
    color.type = "color"; color.id = "dmContentAccent";
    color.style.cssText = "width:64px;height:38px;background:#222;border:1px solid #555;border-radius:8px;";
    const saveConfig = document.createElement("button");
    saveConfig.type = "button"; saveConfig.textContent = "SALVAR AVISO E COR";
    saveConfig.style.cssText = "width:100%;border:0;border-radius:10px;padding:13px;background:#159b60;color:#fff;font-weight:800;margin-top:12px;";
    saveConfig.onclick = saveRemoteContentConfig;

    const search = document.createElement("input");
    search.id = "dmContentVideoSearch"; search.placeholder = "Pesquisar vídeo pelo título...";
    search.style.cssText = "width:100%;box-sizing:border-box;background:#242424;color:#fff;border:1px solid #555;border-radius:9px;padding:12px;font:14px Arial;";
    const searchButton = document.createElement("button");
    searchButton.type = "button"; searchButton.textContent = "PESQUISAR VÍDEOS";
    searchButton.style.cssText = "width:100%;border:0;border-radius:10px;padding:12px;background:#333;color:#fff;font-weight:800;margin-top:8px;";
    searchButton.onclick = searchRemoteVideos;
    search.addEventListener("keydown", event => { if (event.key === "Enter") searchRemoteVideos(); });
    const results = document.createElement("div");
    results.id = "dmContentVideoResults";
    results.style.cssText = "display:grid;gap:9px;margin-top:12px;";
    card.append(header, status, sectionTitle("Aviso e aparência"),
      noticeLabel, fieldLabel("Texto do aviso"), noticeText,
      fieldLabel("Cor principal"), color, saveConfig,
      sectionTitle("Gerenciar vídeos"), search, searchButton, results);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    contentAdminPanel = overlay;
    return overlay;
  }

  async function openContentAdminPanel() {
    if (!isAdmin || !session) return;
    const panel = createContentAdminPanel();
    panel.style.display = "flex";
    const status = document.getElementById("dmContentAdminStatus");
    status.textContent = "Carregando configurações...";
    try {
      const rows = await api("/rest/v1/app_settings?select=value&key=eq.remote_config", { method: "GET" }, session.access_token);
      const config = rows && rows[0] && rows[0].value ? rows[0].value : {};
      document.getElementById("dmContentNoticeEnabled").checked = !!(config.notice && config.notice.enabled);
      document.getElementById("dmContentNoticeText").value = config.notice && config.notice.text || "";
      document.getElementById("dmContentAccent").value = /^#[0-9a-f]{6}$/i.test(config.theme && config.theme.accentColor || "") ? config.theme.accentColor : "#e62e49";
      status.textContent = "Configurações carregadas. As alterações são publicadas na nuvem.";
    } catch (error) {
      status.textContent = "Não foi possível carregar: " + error.message;
    }
  }

  async function saveRemoteContentConfig() {
    if (!isAdmin || !session) return;
    const status = document.getElementById("dmContentAdminStatus");
    status.textContent = "Salvando...";
    try {
      const rows = await api("/rest/v1/app_settings?select=value&key=eq.remote_config", { method: "GET" }, session.access_token);
      const config = rows && rows[0] && rows[0].value ? rows[0].value : {
        schemaVersion: 1, notice: {}, theme: {}, visibility: { hideSelectors: [] }, runtime: { enabled: true, version: "1.0.0" }
      };
      config.schemaVersion = 1;
      config.updatedAt = new Date().toISOString();
      config.notice = {
        enabled: document.getElementById("dmContentNoticeEnabled").checked,
        text: document.getElementById("dmContentNoticeText").value.trim().slice(0, 500),
        type: "info", dismissible: true
      };
      config.theme = config.theme || {};
      config.theme.accentColor = document.getElementById("dmContentAccent").value;
      await api("/rest/v1/app_settings?key=eq.remote_config", {
        method: "PATCH", headers: { "Prefer": "return=minimal" },
        body: JSON.stringify({ value: config, is_public: true, updated_at: config.updatedAt })
      }, session.access_token);
      applyRemoteConfig(config);
      status.textContent = "Salvo! A alteração já foi publicada para o aplicativo.";
    } catch (error) {
      status.textContent = "Erro ao salvar: " + error.message;
    }
  }

  async function searchRemoteVideos() {
    if (!isAdmin || !session) return;
    const results = document.getElementById("dmContentVideoResults");
    const term = document.getElementById("dmContentVideoSearch").value.trim();
    results.textContent = "Pesquisando...";
    try {
      const filter = term ? "&title=ilike.*" + encodeURIComponent(term) + "*" : "";
      const rows = await api("/rest/v1/videos?select=id,title,is_active,position,manual_override&order=position.asc&limit=40" + filter, { method: "GET" }, session.access_token);
      results.innerHTML = "";
      if (!rows.length) { results.textContent = "Nenhum vídeo encontrado."; return; }
      rows.forEach(video => {
        const item = document.createElement("div");
        item.style.cssText = "background:#222;border:1px solid #ffffff20;border-radius:11px;padding:11px;display:grid;gap:8px;";
        const name = document.createElement("input");
        name.value = video.title || ""; name.setAttribute("aria-label", "Título do vídeo");
        name.style.cssText = "width:100%;box-sizing:border-box;background:#151515;color:#fff;border:1px solid #555;border-radius:8px;padding:10px;";
        const line = document.createElement("div");
        line.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:10px;";
        const visibleLabel = document.createElement("label");
        visibleLabel.style.cssText = "display:flex;align-items:center;gap:7px;color:#ddd;";
        const visible = document.createElement("input"); visible.type = "checkbox"; visible.checked = video.is_active === true;
        visibleLabel.append(visible, document.createTextNode("Mostrar no app"));
        const save = document.createElement("button");
        save.type = "button"; save.textContent = "SALVAR";
        save.style.cssText = "border:0;border-radius:8px;padding:9px 14px;background:#159b60;color:#fff;font-weight:800;";
        save.onclick = async () => {
          save.disabled = true; save.textContent = "SALVANDO...";
          try {
            await api("/rest/v1/videos?id=eq." + encodeURIComponent(video.id), {
              method: "PATCH", headers: { "Prefer": "return=minimal" },
              body: JSON.stringify({
                title: name.value.trim() || video.title,
                is_active: visible.checked,
                manual_override: true,
                updated_at: new Date().toISOString()
              })
            }, session.access_token);
            save.textContent = "SALVO";
            const status = document.getElementById("dmContentAdminStatus");
            status.textContent = "Vídeo atualizado. O feed muda na próxima atualização automática (até 15 min) ou ao reabrir o app.";
          } catch (error) {
            save.disabled = false; save.textContent = "SALVAR";
            document.getElementById("dmContentAdminStatus").textContent = "Erro ao salvar vídeo: " + error.message;
          }
        };
        line.append(visibleLabel, save);
        item.append(name, line);
        results.appendChild(item);
      });
    } catch (error) {
      results.textContent = "Erro ao pesquisar vídeos: " + error.message;
    }
  }

  async function logout() {
    try {
      if (session && session.access_token) {
        await api("/auth/v1/logout", { method: "POST" }, session.access_token);
      }
    } catch (_) {}
    saveSession(null);
    currentUser = null;
    isAdmin = false;
    unlocked = false;
    updateLoggedAs();
    document.getElementById("dmAuthForm").style.display = "block";
    document.getElementById("dmSwitch").style.display = "block";
    document.getElementById("dmLogout").style.display = "none";
    updateGate();
    closeModal();
  }

  function installAdminEntry() {
    const adminButton = document.getElementById("adminAccessBtn");
    if (adminButton) adminButton.addEventListener("click", () => {
      if (session && currentUser) logout();
      else openModal("login");
    });
  }

  addStyles();
  createModal();
  installAdminEntry();
  updateGate();

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) saveSession(JSON.parse(saved));
  } catch (_) { saveSession(null); }

  loadAccess();
  // Refresh access when the app returns to foreground.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && session) loadAccess();
  });
})();
