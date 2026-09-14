import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "optional-brand-font",
      transformIndexHtml(html) {
        if (!existsSync(resolve(__dirname, "public/assets/Gotham-Bold.woff2")))
          return html;
        return {
          html,
          tags: [
            {
              tag: "style",
              children:
                "@font-face{font-family:Gotham;src:url('./assets/Gotham-Bold.woff2') format('woff2');font-weight:700 900;font-display:swap}",
              injectTo: "head",
            },
          ],
        };
      },
    },
  ],
  base: process.env.VITE_BASE_PATH || "./",
  build: {
    target: "chrome79",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin.html"),
      },
    },
  },
});
