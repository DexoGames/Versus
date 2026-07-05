import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Same strict CSP as the portfolio site, extended with the Firebase/Firestore
// hosts the online layer talks to (REST + the realtime listen channel).
const CSP =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline'; " +
  "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
  "font-src 'self' https://cdnjs.cloudflare.com; " +
  "img-src 'self' data: https:; " +
  "connect-src 'self' https://*.googleapis.com https://firestore.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com;";

function injectCspOnBuild(): Plugin {
  return {
    name: "inject-csp-on-build",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "</title>",
        `</title>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}">`,
      );
    },
  };
}

// GitHub Pages serves a custom 404 for unknown paths. Copying the built
// index.html to 404.html lets client-side routes like /gridlock resolve.
function spaFallback(): Plugin {
  return {
    name: "spa-404-fallback",
    closeBundle() {
      const dist = resolve(__dirname, "dist");
      const index = resolve(dist, "index.html");
      if (existsSync(index)) {
        copyFileSync(index, resolve(dist, "404.html"));
      }
    },
  };
}

export default defineConfig({
  base: "/",
  plugins: [react(), injectCspOnBuild(), spaFallback()],
});
