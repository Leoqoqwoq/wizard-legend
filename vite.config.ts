import { defineConfig } from "vite";

// GitHub Pages: https://leoqoqwoq.github.io/wizard-legend/
export default defineConfig({
  base: process.env.GITHUB_PAGES === "1" ? "/wizard-legend/" : "/"
});
