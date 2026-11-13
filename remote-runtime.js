/*
 * DORAMAX remote runtime.
 * This file is loaded dynamically by access.js. Edit it to add/change
 * WebView interface behavior without rebuilding the Android APK.
 *
 * Available API:
 *   app.getConfig()
 *   app.showNotice(text, "info" | "success" | "warning")
 *   app.clearNotice()
 *   app.setAccentColor("#hex")
 *
 * When changing this file, increment runtime.version in remote-config.json.
 */
(() => {
  "use strict";
  const previous = window.DORAMAX_REMOTE_RUNTIME;
  if (previous && typeof previous.dispose === "function") {
    try { previous.dispose(); } catch (_) {}
  }

  const runtime = {
    version: "1.0.0",
    init({ config, app }) {
      // Ponto de entrada para funcionalidades de interface atualizadas remotamente.
      // Exemplo: app.showNotice("Novidade disponível!", "success");
      window.dispatchEvent(new CustomEvent("doramax:remote-ready", {
        detail: { version: runtime.version, config }
      }));
    },
    dispose() {
      // Remova aqui listeners/timers adicionados por esta extensão ao substituí-la.
    }
  };

  window.DORAMAX_REMOTE_RUNTIME = runtime;
})();
