import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Uso normal (`npm run build`): build estándar de Vite, ideal para Vercel/Netlify
// (assets con hash, cacheables por CDN).
// Uso con SINGLEFILE=1 (`npm run build:single`): todo el CSS y JS se inyecta
// inline en un único index.html, útil para distribuir la página como un solo
// archivo autocontenido.
const singleFile = process.env.SINGLEFILE === "1";

export default defineConfig({
  plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
  build: {
    target: "es2018",
    cssCodeSplit: !singleFile,
    assetsInlineLimit: singleFile ? 100000000 : 4096,
  },
});
