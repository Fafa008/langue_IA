import fs from "node:fs";
import path from "node:path";

// F-06 : le navigateur ne parle jamais au service IA. Aucune variable NEXT_PUBLIC_IA_URL ne doit exister
// dans le code du frontend ni dans les fichiers d'environnement versionnés.
const VARIABLE_INTERDITE = "NEXT_PUBLIC_IA_URL";
const RACINE_FRONTEND = path.resolve(__dirname, "../../..");
const RACINE_DEPOT = path.resolve(RACINE_FRONTEND, "..");

function fichiersDe(dossier: string): string[] {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = path.join(dossier, entree.name);
    if (entree.isDirectory()) return entree.name === "node_modules" || entree.name === ".next" ? [] : fichiersDe(chemin);
    return [chemin];
  });
}

describe("F-06 — garde : le navigateur ne parle jamais au service IA", () => {
  it("aucun fichier de src/ ne lit NEXT_PUBLIC_IA_URL", () => {
    const fautifs = fichiersDe(path.join(RACINE_FRONTEND, "src"))
      .filter((fichier) => path.basename(fichier) !== path.basename(__filename))
      .filter((fichier) => fs.readFileSync(fichier, "utf8").includes(VARIABLE_INTERDITE))
      .map((fichier) => path.relative(RACINE_DEPOT, fichier));
    expect(fautifs).toEqual([]);
  });

  it("la variable n'est déclarée dans aucun fichier d'environnement versionné", () => {
    const fichiersEnv = [
      path.join(RACINE_DEPOT, ".env.example"),
      path.join(RACINE_FRONTEND, ".env.development"),
      path.join(RACINE_FRONTEND, ".env.example"),
    ].filter((fichier) => fs.existsSync(fichier));
    const fautifs = fichiersEnv
      .filter((fichier) => fs.readFileSync(fichier, "utf8").includes(VARIABLE_INTERDITE))
      .map((fichier) => path.relative(RACINE_DEPOT, fichier));
    expect(fautifs).toEqual([]);
  });
});
