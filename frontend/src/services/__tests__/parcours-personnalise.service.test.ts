import { choisirScenarioParcoursMock, scorePrononciation } from "@/mocks/parcours-personnalise.mock";
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
  it("regroupe les leçons en 8 modules de 7 leçons et donne 5 exercices par leçon atteinte", async () => {
    const parcours = await mock.enCours();
    expect(parcours.modules).toHaveLength(8);
    expect(parcours.modules[3]).toMatchObject({ numero: 4, premiereLecon: 22, derniereLecon: 28 });
    const exercices = await mock.exercices(7);
    expect(exercices).toHaveLength(23 * 5);
    expect(new Set(exercices.map((e) => e.type))).toEqual(new Set(["GRAMMAIRE", "COMPREHENSION", "VOCABULAIRE", "ECOUTE", "ORAL"]));
  });

  it("propose l'écoute, la prononciation et la conversation dans chaque leçon", async () => {
    const lecon = await mock.lecon(7, 23);
    expect(lecon.exercices.map((e) => e.contenu.format)).toEqual(["choix", "texte", "ecoute", "prononciation", "conversation"]);
  });

  it("refuse une leçon pas encore atteinte", async () => {
    await expect(mock.lecon(7, 24)).rejects.toMatchObject({ status: 403 });
  });

  it("corrige chaque forme de réponse et ouvre la leçon suivante quand la leçon du jour est finie", async () => {
    const { exercices } = await mock.lecon(7, 23);
    const [, texte, ecoute, prononciation, conversation] = exercices;

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
    });
    expect((await mock.enCours()).leconAtteinte).toBe(24);
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
    apiRequest.mockResolvedValueOnce({ statut: "REUSSI", score_obtenu: 80, commentaire: "Bien" });
    expect(await http.corriger(7, 231, { format: "prononciation", reponse: "bonjour" })).toEqual({
      statut: "REUSSI",
      scoreObtenu: 80,
      commentaire: "Bien",
      reponseAttendue: null,
    });
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/parcours/7/exercices/231/reponse", {
      method: "POST",
      body: { format: "prononciation", reponse: "bonjour" },
      timeoutMs: 45_000,
    });
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
});
