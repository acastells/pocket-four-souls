import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/",
  publicDir: "../public",
  resolve: { alias: { "@": fileURLToPath(new URL("..", import.meta.url)) } },
  build: { outDir: "../dist/client", emptyOutDir: true, target: "es2022" },
});
