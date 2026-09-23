import { defineConfig, mergeConfig } from "vite";
import webConfig from "./vite.config";
export default mergeConfig(
  webConfig,
  defineConfig({
    base: "/pocket-native/",
    publicDir: false,
    build: { outDir: "../android/web" },
  }),
);
