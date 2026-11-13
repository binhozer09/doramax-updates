/*
 * DORAMAX remote runtime.
 * UI behavior controlled by the public remote_config row in Supabase.
 */
(() => {
  "use strict";
  const previous = window.DORAMAX_REMOTE_RUNTIME;
  if (previous && typeof previous.dispose === "function") {
    try { previous.dispose(); } catch (_) {}
  }

  const runtime = {
    version: "1.0.1",
    init({ config }) {
      const id = "dmRemoteCornerIndicator";
      const old = document.getElementById(id);
      if (old) old.remove();

      const indicator = config && config.indicator;
      if (indicator && indicator.enabled === true) {
        const node = document.createElement("span");
        node.id = id;
        node.textContent = String(indicator.emoji || "🔥").slice(0, 8);
        node.setAttribute("aria-label", "Indicador remoto do DORAMAX");
        node.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:2147483647;font-size:22px;line-height:1;pointer-events:none;text-shadow:0 1px 4px #000;";
        (document.body || document.documentElement).appendChild(node);
      }

      window.dispatchEvent(new CustomEvent("doramax:remote-ready", {
        detail: { version: runtime.version, config }
      }));
    },
    dispose() {
      const node = document.getElementById("dmRemoteCornerIndicator");
      if (node) node.remove();
    }
  };

  window.DORAMAX_REMOTE_RUNTIME = runtime;
})();
