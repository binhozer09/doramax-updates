/* DORAMAX access control - Supabase client-side integration.
   The publishable key is intended for client apps. Never put a service_role/secret key here. */
(() => {
  "use strict";

  const SUPABASE_URL = "https://qbwsaahlkovrejwliefv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_IUeH0RsYhkHpsBflAPo1WQ_1VVPbsAK";
  const PICPay_URL = "https://link.picpay.com/p/17945341236af66aeb27abc";
  const STORAGE_KEY = "doramax_session_v1";

  // Remove somente o aviso de teste, inclusive quando ele estiver dentro de um container.
  const TEST_BANNER_TEXT = "DORAMAX: atualização remota funcionando!";
  const normalizeBannerText = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const removeTestBanner = (root = document) => {
    const elements = [];
    if (root.nodeType === 1) elements.push(root);
    root.querySelectorAll?.("*").forEach((el) => elements.push(el));
    for (const el of elements) {
      if (!el.isConnected || !normalizeBannerText(el.textContent).includes(TEST_BANNER_TEXT)) continue;
      const childHasText = [...el.children].some((child) =>
        normalizeBannerText(child.textContent).includes(TEST_BANNER_TEXT)
      );
      if (childHasText) continue;

      let target = el;
      let parent = el.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const marker = ((parent.id || "") + " " +
          (typeof parent.className === "string" ? parent.className : "")).toLowerCase();
        if (/(banner|toast|notice|alert|message|status)/.test(marker) &&
            normalizeBannerText(parent.textContent).includes(TEST_BANNER_TEXT)) {
          target = parent;
        }
        parent = parent.parentElement;
      }
      target.remove();
    }
  };
  removeTestBanner();
  if (document.documentElement && !window.__doramaxBannerCleanup) {
    window.__doramaxBannerCleanup = new MutationObserver((records) => {
      for (const record of records) {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (target) removeTestBanner(target);
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) removeTestBanner(node);
          else if (node.parentElement) removeTestBanner(node.parentElement);
        }
      }
    });
    window.__doramaxBannerCleanup.observe(document.documentElement, {
      childList: true, characterData: true, subtree: true
    });
  }

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
      const adminRows = await api("/rest/v1/admin_users?select=user_id&user_id=eq." + encodeURIComponent(uid), { method: "GET" }, session.access_token);
      isAdmin = Array.isArray(adminRows) && adminRows.length > 0;
      if (isAdmin) {
        unlocked = true;
      } else {
        const rows = await api("/rest/v1/access_grants?select=is_unlocked&user_id=eq." + encodeURIComponent(uid), { method: "GET" }, session.access_token);
        unlocked = !!(Array.isArray(rows) && rows[0] && rows[0].is_unlocked === true);
      }
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
