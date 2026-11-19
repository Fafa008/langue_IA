import {
  choisirScenarioParcoursMock,
  corrigerRedaction,
  ERREURS_MAX_PHASE_PASSIVE,
  scorePrononciation,
} from "@/mocks/parcours-personnalise.mock";
import {
  toContenuExercice,
  toExerciceParcours,
  toParcoursPersonnalise,
  type ExerciceParcoursDto,
  type ParcoursPersonnaliseDto,
} from "@/services/parcours-personnalise.mapper";
import {
  HISTORIQUE_CHATBOT_MAX,
  httpParcoursPersonnaliseService as http,
  mockParcoursPersonnaliseService as mock,
} from "@/services/parcours-personnalise.service";

jest.mock("@/mocks/delay", () => ({ delay: () => Promise.resolve() }));
const apiRequest = jest.fn();
jest.mock("@/lib/api-client", () => ({
  ...jest.requireActual("@/lib/api-client"),
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

const exerciceDto = (surcharge: Partial<ExerciceParcoursDto> = {}): ExerciceParcoursDto => ({
  id_parcours_exercice: 1,
  id_exercice: 501,
  numero_lecon: 1,
  type: "GRAMMAIRE",
  difficulte: 2,
  intitule: "Le présent",
  statut: "A_FAIRE",
  score_obtenu: null,
  ...surcharge,
});

const parcoursDto = (surcharge: Partial<ParcoursPersonnaliseDto> = {}): ParcoursPersonnaliseDto => ({
  id_parcours: 3,
  statut: "EN_COURS",
  date_creation: "2026-10-02T09:30:00Z",
  code_langue: "en",
  libelle_langue: "Anglais",
  cadre: "CECRL",
  niveaux_cadre: ["A1", "A2"],
  niveau_vise: "A2",
  lecon_atteinte: 4,
  phase: "PASSIVE",
  est_lecon_de_revision: false,
  modules: [],
  ...surcharge,
});

beforeEach(() => {
  choisirScenarioParcoursMock("passif");
  apiRequest.mockReset();
});

describe("conversion du contrat d'API", () => {
  it("convertit le parcours et trie ses modules", () => {
    const parcours = toParcoursPersonnalise(
      parcoursDto({
        modules: [
          { numero: 2, titre: "B", description: "", premiere_lecon: 8, derniere_lecon: 14 },
          { numero: 1, titre: "A", description: "", premiere_lecon: 1, derniere_lecon: 7 },
        ],
      }),
    );
    expect(parcours).toMatchObject({ idParcours: 3, niveauDepart: null, phase: "PASSIVE" });
    expect(parcours.modules.map((m) => [m.numero, m.premiereLecon])).toEqual([[1, 1], [2, 8]]);
  });

  it("accepte les énumérations en minuscules et vide un intitulé blanc", () => {
    expect(toExerciceParcours(exerciceDto({ type: "oral", statut: "a_revoir", intitule: "  " }))).toMatchObject({
      type: "ORAL",
      statut: "A_REVOIR",
      intitule: null,
    });
  });

  it("rejette une valeur inconnue plutôt que d'afficher un statut faux", () => {
    expect(() => toExerciceParcours(exerciceDto({ statut: "EN_COURS" }))).toThrow("Statut d'exercice non reconnu : EN_COURS");
    expect(() => toParcoursPersonnalise(parcoursDto({ phase: "MIXTE" }))).toThrow("Phase de parcours non reconnu : MIXTE");
  });

  it("lit le contenu JSON de chaque forme d'exercice", () => {
    expect(toContenuExercice('{"format":"ecoute","consigne":"Écoutez","question":"Q ?","choix":["a"],"texte_audio":"Bonjour"}')).toEqual({
      format: "ecoute",
      consigne: "Écoutez",
      question: "Q ?",
      choix: ["a"],
      audioUrl: null,
      texteAudio: "Bonjour",
    });
    expect(toContenuExercice('{"format":"conversation","consigne":"c","sujet":"s","message_initial":"Bonjour"}')).toMatchObject({
      echangesMinimum: 3,
    });
    expect(() => toContenuExercice('{"format":"prononciation","consigne":"c"}')).toThrow("Contenu d'exercice incomplet : phrase");
    expect(() => toContenuExercice('{"format":"dessin","consigne":"c"}')).toThrow("Format d'exercice non reconnu : dessin");
  });
});

describe("parcours simulé (démo sans backend)", () => {
  it("regroupe les leçons en 8 modules de 7 leçons et donne 6 exercices par leçon atteinte", async () => {
    const parcours = await mock.enCours();
    expect(parcours.modules).toHaveLength(8);
    expect(parcours.modules[3]).toMatchObject({ numero: 4, premiereLecon: 22, derniereLecon: 28 });
    const exercices = await mock.exercices(7);
    expect(exercices).toHaveLength(23 * 6);
    expect(new Set(exercices.map((e) => e.type))).toEqual(new Set(["GRAMMAIRE", "COMPREHENSION", "VOCABULAIRE", "ECOUTE", "ORAL"]));
  });

  it("propose QCM, phrase à compléter, écoute, prononciation, conversation et rédaction dans chaque leçon", async () => {
    const lecon = await mock.lecon(7, 23);
    expect(lecon.exercices.map((e) => e.contenu.format)).toEqual(["choix", "texte", "ecoute", "prononciation", "conversation", "redaction"]);
  });

  it("refuse une leçon pas encore atteinte", async () => {
    await expect(mock.lecon(7, 24)).rejects.toMatchObject({ status: 403 });
  });

  it("corrige chaque forme de réponse et ouvre la leçon suivante quand la leçon du jour est finie", async () => {
    const { exercices } = await mock.lecon(7, 23);
    const [, texte, ecoute, prononciation, conversation, redaction] = exercices;

    expect(await mock.corriger(7, texte.idParcoursExercice, { format: "texte", reponse: "mauvais" })).toMatchObject({
      statut: "A_REVOIR",
      scoreObtenu: 0,
    });
    const reponseEcoute = ecoute.contenu.format === "ecoute" ? ecoute.contenu.choix[1] : "";
    await mock.corriger(7, ecoute.idParcoursExercice, { format: "ecoute", reponse: reponseEcoute });
    const phrase = prononciation.contenu.format === "prononciation" ? prononciation.contenu.phrase : "";
    expect(await mock.corriger(7, prononciation.idParcoursExercice, { format: "prononciation", reponse: phrase })).toMatchObject({
      statut: "REUSSI",
      scoreObtenu: 100,
    });
    expect((await mock.enCours()).leconAtteinte).toBe(23);

    const messages = [1, 2, 3].map(() => ({ role: "apprenant" as const, contenu: "Je m'appelle Rova" }));
    expect(await mock.corriger(7, conversation.idParcoursExercice, { format: "conversation", messages })).toMatchObject({
      statut: "REUSSI",
      scoreObtenu: 100,
      mode: "IA",
    });
    expect((await mock.enCours()).leconAtteinte).toBe(23);
    await mock.corriger(7, redaction.idParcoursExercice, { format: "redaction", reponse: "Samedi, je suis allé au marché." });
    expect((await mock.enCours()).leconAtteinte).toBe(24);
  });

  it("corrige le QCM de façon déterministe : bonne réponse et explication seulement après la réponse", async () => {
    const { exercices } = await mock.lecon(7, 22);
    const qcm = exercices[0];
    if (qcm.contenu.format !== "choix") throw new Error("QCM attendu");
    expect(JSON.stringify(qcm.contenu)).not.toMatch(/reponse|explication/);

    const faux = await mock.corriger(7, qcm.idParcoursExercice, { format: "choix", reponse: "réponse fausse" });
    expect(faux).toMatchObject({ statut: "A_REVOIR", scoreObtenu: 0, mode: "AUTOMATIQUE" });
    expect(faux.reponseAttendue).toBeTruthy();
    expect(faux.explication).toBeTruthy();
    // Même réponse, même correction
    expect(await mock.corriger(7, qcm.idParcoursExercice, { format: "choix", reponse: faux.reponseAttendue! })).toMatchObject({
      statut: "REUSSI",
      scoreObtenu: 100,
      reponseAttendue: null,
    });
  });

  it("fait corriger une rédaction par le professeur IA : erreurs, points forts et conseil", () => {
    const correction = corrigerRedaction("samedi j'ai allé au marché avec ma sœur mais il pleuvait", 25, 23);
    expect(correction).toMatchObject({ mode_correction: "IA", phase: "PASSIVE", lecon_atteinte: 23, reformulation: null });
    expect(correction.erreurs?.map((e) => e.correction)).toEqual(["je suis allé(e)", "Samedi", "pleuvait."]);
    expect(correction.points_forts).toContain("Vous reliez vos idées avec des connecteurs (mais, parce que, ensuite…).");
    expect(correction.conseil).toMatch(/au moins 25 mots/);
    expect(correction.score_obtenu).toBeLessThan(50);

    const bon = corrigerRedaction(
      "Samedi, je suis allée au marché avec ma sœur. Nous avons acheté des fruits, puis nous avons pris un café parce qu'il faisait froid. Le soir, nous avons regardé un film à la maison.",
      25,
      23,
    );
    expect(bon).toMatchObject({ score_obtenu: 100, erreurs: [] });
    expect(bon.points_forts).toContain("Vous employez le passé composé.");
  });

  it("US157 — adapte le retour de l'IA à la phase de la leçon atteinte, sans changer le score", () => {
    const texte = "salut, samedi j'ai allé au cinéma mais il faut que je vais au marché";
    const passive = corrigerRedaction(texte, 25, 49);
    const active = corrigerRedaction(texte, 25, 50);

    // Bornes de la règle de phase (US155) : leçon 49 passive, leçon 50 active
    expect(passive).toMatchObject({ phase: "PASSIVE", lecon_atteinte: 49, reformulation: null });
    expect(passive.erreurs).toHaveLength(ERREURS_MAX_PHASE_PASSIVE);
    expect(passive.conseil).toMatch(/au moins 25 mots/);
    expect(active).toMatchObject({ phase: "ACTIVE", lecon_atteinte: 50 });
    expect(active.erreurs).toHaveLength(4);
    expect(active.reformulation).toBe("Salut, samedi je suis allé(e) au cinéma mais il faut que j'aille au marché.");
    // Le score ne dépend que du texte
    expect(active.score_obtenu).toBe(passive.score_obtenu);
  });

  it("note la prononciation sur les mots reconnus, sans accents ni ponctuation", () => {
    expect(scorePrononciation("Où se trouve la gare ?", "ou se trouve la gare")).toBe(100);
    expect(scorePrononciation("Où se trouve la gare ?", "la gare")).toBe(40);
  });

  it("fait réagir le professeur IA puis relancer la conversation", async () => {
    const historique = [{ role: "assistant" as const, contenu: "Bonjour ! Je suis votre professeur IA. Comment vous appelez-vous ?" }];
    expect(await mock.chatbot("Je m'appelle Rova", historique)).toBe("Très bien ! Enchanté ! D'où venez-vous ?");
    expect(await mock.chatbot("Rova", historique)).toMatch(/phrase complète/);
  });

  it("répond 404 quand l'apprenant n'a pas de parcours", async () => {
    choisirScenarioParcoursMock("sans-parcours");
    await expect(mock.enCours()).rejects.toMatchObject({ status: 404 });
  });
});

describe("service HTTP (prêt pour le backend)", () => {
  it("appelle les routes du parcours", async () => {
    apiRequest.mockResolvedValueOnce(parcoursDto());
    await http.enCours();
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/parcours/en-cours");

    apiRequest.mockResolvedValueOnce([exerciceDto({ id_parcours_exercice: 30, numero_lecon: 3 }), exerciceDto({ id_parcours_exercice: 10 })]);
    expect((await http.exercices(7)).map((e) => e.numeroLecon)).toEqual([1, 3]);
    expect(apiRequest).toHaveBeenLastCalledWith("/api/v1/parcours/7/exercices");
  });

  it("envoie une réponse à corriger avec un délai adapté à l'IA", async () => {
    apiRequest.mockResolvedValueOnce({ statut: "REUSSI", score_obtenu: 80, mode_correction: "automatique", commentaire: "Bien" });
    expect(await http.corriger(7, 231, { format: "prononciation", reponse: "bonjour" })).toEqual({
      statut: "REUSSI",
      scoreObtenu: 80,
      mode: "AUTOMATIQUE",
      commentaire: "Bien",
      reponseAttendue: null,
      explication: null,
      pointsForts: [],
      erreurs: [],
      conseil: null,
      phase: null,
      leconAtteinte: null,
      reformulation: null,
    });
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/parcours/7/exercices/231/reponse", {
      method: "POST",
      body: { format: "prononciation", reponse: "bonjour" },
      timeoutMs: 45_000,
    });
  });

  it("US157 — lit le contrat v2 d'une correction par l'IA : phase et leçon obligatoires", async () => {
    const ia = { statut: "A_REVOIR", score_obtenu: 40, mode_correction: "IA", commentaire: "À reprendre" };
    apiRequest.mockResolvedValueOnce({ ...ia, phase: "active", lecon_atteinte: 56, reformulation: "  Je suis allé au marché.  " });
    expect(await http.corriger(7, 566, { format: "redaction", reponse: "j'ai allé au marché" })).toMatchObject({
      mode: "IA",
      phase: "ACTIVE",
      leconAtteinte: 56,
      reformulation: "Je suis allé au marché.",
    });

    apiRequest.mockResolvedValueOnce(ia);
    await expect(http.corriger(7, 566, { format: "redaction", reponse: "…" })).rejects.toThrow(
      "Correction IA incomplète : phase et lecon_atteinte sont obligatoires",
    );
    apiRequest.mockResolvedValueOnce({ ...ia, phase: "MIXTE", lecon_atteinte: 56 });
    await expect(http.corriger(7, 566, { format: "redaction", reponse: "…" })).rejects.toThrow("Phase de correction non reconnu : MIXTE");
  });

  it("relaie le chatbot avec un historique borné comme le service IA", async () => {
    apiRequest.mockResolvedValueOnce({ reponse: "Bonjour !" });
    const historique = Array.from({ length: 25 }, (_, i) => ({ role: "apprenant" as const, contenu: `m${i}` }));
    expect(await http.chatbot("Salut", historique)).toBe("Bonjour !");
    const [route, options] = apiRequest.mock.calls[0];
    expect(route).toBe("/api/v1/chatbot/message");
    expect(options.body.historique).toHaveLength(HISTORIQUE_CHATBOT_MAX);
    expect(options.body.historique[0].contenu).toBe("m5");
  });

  it("n'envoie au service IA que le rôle et le contenu : pas de corrections en marge (US74-FE)", async () => {
    apiRequest.mockResolvedValueOnce({ reponse: "D'accord." });
    const historique = [{ role: "apprenant" as const, contenu: "j'ai allé", corrections: [{ extrait: "j'ai allé", correction: "je suis allé(e)", explication: "x" }] }];
    await http.chatbot("Salut", historique as never);
    const [, options] = apiRequest.mock.calls[0];
    expect(options.body.historique).toEqual([{ role: "apprenant", contenu: "j'ai allé" }]);
  });
});
