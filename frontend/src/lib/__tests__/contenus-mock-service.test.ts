import { AUTEUR_SESSION, CONSIGNE_A_REDIGER, TEXTE_A_REDIGER } from "@/lib/contenus/mock-service";
import { ErreurContenus } from "@/lib/contenus/service";
import { nouveauService } from "@/test/contenus";

// USPxx : données de démonstration et comportement du service simulé (règles revalidées, RG-GP-10).

describe("service de contenus simulé", () => {
  it("liste les six langues ; contenus de démonstration pour l'anglais et le mandarin uniquement", async () => {
    const langues = await nouveauService().listLangues();
    expect(langues.map((l) => l.libelle)).toEqual(["Français", "Anglais", "Mandarin", "Italien", "Allemand", "Espagnol"]);
    const niveaux = Object.fromEntries(langues.map((l) => [l.code, l.niveaux.map((n) => n.code)]));
    expect(niveaux).toEqual({
      fr: ["A1", "A2", "B1", "B2", "C1", "C2"],
      en: ["A1", "A2", "B1", "B2", "C1", "C2"],
      zh: ["HSK 1", "HSK 2"],
      it: ["A1", "A2", "B1", "B2", "C1", "C2"],
      de: ["A1", "A2", "B1", "B2"],
      es: [],
    });
    for (const l of langues) {
      const attendu = l.code === "en" || l.code === "zh" ? { modules: 1, lecons: 8, activites: 48, parcours: 1 } : { modules: 0, lecons: 0, activites: 0, parcours: 0 };
      expect(l.compteurs).toEqual(attendu);
    }
  });

  it("chaque leçon de démonstration a six activités de six types différents, au contenu d'espace réservé", async () => {
    const service = nouveauService();
    for (const code of ["en", "zh"]) {
      const lecons = await service.listLecons(code);
      for (const l of lecons) {
        const activites = await service.listActivites(code, { idLecon: l.id });
        expect(new Set(activites.map((a) => a.type)).size).toBe(6);
        for (const a of activites) {
          expect(a.contenu).toBe(TEXTE_A_REDIGER);
          expect(a.consigne).toBe(CONSIGNE_A_REDIGER);
        }
      }
    }
  });

  it("filtre par titre (sans tenir compte des accents) et par statut", async () => {
    const service = nouveauService();
    expect((await service.listLecons("en", { recherche: "lecon 8" })).map((l) => l.titre)).toEqual(["Leçon 8"]);
    expect(await service.listLecons("en", { statut: "BROUILLON" })).toHaveLength(1);
  });

  it("revalide les règles et enregistre l'auteur et la date (RG-GP-10)", async () => {
    const service = nouveauService();
    await expect(service.create("module", "en", { titre: "Doublon", ordre: "1", statut: "BROUILLON" })).rejects.toBeInstanceOf(ErreurContenus);
    await expect(service.create("module", "es", { titre: "Module", ordre: "1", statut: "BROUILLON" })).rejects.toThrow("Ajoutez d'abord des niveaux pour cette langue.");

    const cree = await service.create("module", "en", { titre: "  Module 2 ", ordre: "2", statut: "BROUILLON" });
    expect(cree).toMatchObject({ titre: "Module 2", ordre: 2, creePar: AUTEUR_SESSION, modifieLe: "2026-11-24T10:00:00.000Z" });
  });

  it("archive une leçon utilisée mais refuse de la supprimer (RG-GP-08), supprime un parcours (RG-GP-09)", async () => {
    const service = nouveauService();
    await expect(service.remove("lecon", "en-lec-1")).rejects.toThrow("seulement archivé");
    await service.archive("lecon", "en-lec-1");
    expect((await service.get("lecon", "en-lec-1"))?.statut).toBe("ARCHIVE");
    await service.remove("parcours", "en-par-1");
    expect(await service.listParcours("en")).toEqual([]);
  });

  it("n'enregistre les champs mandarin que pour la langue ZH", async () => {
    const service = nouveauService();
    const saisie = {
      idLecon: "",
      type: "PRODUCTION_LIBRE" as const,
      competence: "ORAL" as const,
      difficulte: "2",
      consigne: "Consigne",
      contenu: "",
      critereCorrection: "Critère",
      emplacementMedia: "",
      caracteres: "你好",
      pinyin: "nǐ hǎo",
      tonsAttendus: "3 3",
      statut: "BROUILLON" as const,
    };
    const zh = await service.create("activite", "zh", { ...saisie, idLecon: "zh-lec-1" });
    expect(zh).toMatchObject({ caracteres: "你好", pinyin: "nǐ hǎo", tonsAttendus: "3 3" });
    const en = await service.create("activite", "en", { ...saisie, idLecon: "en-lec-1" });
    expect(en).toMatchObject({ caracteres: "", pinyin: "", tonsAttendus: "" });
  });
});
