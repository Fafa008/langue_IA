/** @type {import('next').NextConfig} */
module.exports = {
  output: "standalone",
  // Les tests E2E lancent leur propre `next dev` : un dossier de build séparé
  // évite qu'il écrase celui du serveur de développement (ChunkLoadError).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
