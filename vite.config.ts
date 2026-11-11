import { defineConfig } from "vite";

// GitHub Pages: https://leoqoqwoq.github.io/wizard-legend/
export default defineConfig({
  base: process.env.GITHUB_PAGES === "1" ? "/wizard-legend/" : "/",
  server: {
    watch: {
      ignored: ["**/_tmp_icons/**", "**/tmp_dl/**", "**/assets/raw/**"]
    }
  }
});
