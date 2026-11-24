import fs from "node:fs";
import path from "node:path";
import { DELAI_IA_MS } from "@/services/parcours-personnalise.service";
import { TIMEOUT_ANALYSE_MS } from "@/services/test-diagnostic.service";

// F-03 : chaîne des délais, du plus court au plus long : 30 s < 45 s < 55 s < 60 s.
// Les deux valeurs côté serveur sont lues dans leurs fichiers de configuration, pour qu'un changement
// dans l'un des services casse ce test au lieu de désaligner silencieusement les délais.
const RACINE_DEPOT = path.resolve(__dirname, "../../../..");

function valeurDans(fichier: string, motif: RegExp): number {
  const texte = fs.readFileSync(path.join(RACINE_DEPOT, fichier), "utf8");
  const trouve = texte.match(motif);
  if (!trouve) throw new Error(`Valeur introuvable dans ${fichier}`);
  return Number(trouve[1]);
}

describe("F-03 — chaîne des délais", () => {
  const budgetIa = valeurDans("ia-service/app/core/config.py", /budget_total_s: float = Field\(default=([\d.]+)/);
  const delaiBackendIa = valeurDans("backend/app/core/config.py", /ia_service_timeout_s: float = ([\d.]+)/);

  it("le budget du service IA (30 s) est inférieur au délai de correction du parcours (45 s)", () => {
    expect(budgetIa).toBe(30);
    expect(budgetIa * 1000).toBeLessThan(DELAI_IA_MS);
  });

  it("le délai de correction du parcours (45 s) est inférieur au délai backend vers le service IA (55 s)", () => {
    expect(delaiBackendIa).toBe(55);
    expect(DELAI_IA_MS).toBeLessThan(delaiBackendIa * 1000);
  });

  it("le délai backend vers le service IA (55 s) est inférieur à la clôture du test côté frontend (60 s)", () => {
    expect(TIMEOUT_ANALYSE_MS).toBe(60_000);
    expect(delaiBackendIa * 1000).toBeLessThan(TIMEOUT_ANALYSE_MS);
  });
});
