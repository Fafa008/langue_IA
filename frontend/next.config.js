/** @type {import('next').NextConfig} */
const path = require("path");
const webpack = require("webpack");

module.exports = {
  ...(process.env.NEXT_OUTPUT_STANDALONE === "false" ? {} : { output: "standalone" }),
  // Les tests E2E lancent leur propre `next dev` : un dossier de build séparé
  // évite qu'il écrase celui du serveur de développement (ChunkLoadError).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  webpack(config) {
    if (process.env.NEXT_PUBLIC_MODE !== "demo") {
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(
        /^@\/mocks\/test-diagnostic\.mock$/,
        path.resolve(__dirname, "src/mocks/test-diagnostic.mock.stub.ts"),
      ));
    }
    return config;
  },
};
