/*
 * Parcours personnalisé simulé (NEXT_PUBLIC_API_MOCK=true), au format des réponses attendues du backend.
 * Démo sans backend : l'avancement est gardé en mémoire le temps de la session (répondre aux exercices
 * de la leçon du jour fait avancer la leçon atteinte), et le chatbot répond par des règles simples.
 * Scénario de départ : NEXT_PUBLIC_PARCOURS_MOCK_SCENARIO (par défaut « passif »).
 */
import { ApiError } from "@/lib/api-client";
import { delay } from "@/mocks/delay";
import type {
  CorrectionExerciceDto,
  ExerciceParcoursDto,
  LeconParcoursDto,
  MessageChatbotDto,
  ModuleParcoursDto,
  ParcoursPersonnaliseDto,
  ReponseChatbotDto,
} from "@/services/parcours-personnalise.mapper";
import type { ReponseExercice } from "@/types/parcours-personnalise";

export type ScenarioParcoursMock =
  | "passif" // leçon 23, phase passive
  | "actif" // leçon 56, phase active, leçon de révision
  | "sans-parcours" // 404 : test de positionnement pas encore passé
  | "exercices-indisponibles" // le parcours se charge, les exercices échouent
  | "erreur-serveur";

const SCENARIOS: ScenarioParcoursMock[] = ["passif", "actif", "sans-parcours", "exercices-indisponibles", "erreur-serveur"];

const scenarioConfigure = process.env.NEXT_PUBLIC_PARCOURS_MOCK_SCENARIO;
if (scenarioConfigure && !SCENARIOS.includes(scenarioConfigure as ScenarioParcoursMock)) {
  throw new Error(`Scénario de parcours simulé inconnu : ${scenarioConfigure}`);
}

const ID_PARCOURS = 7;
/** Même seuil que celui proposé au backend pour déduire le statut du score. */
const SEUIL_REUSSITE = 50;
const LECONS_PAR_MODULE = 7;

const MODULES: Omit<ModuleParcoursDto, "numero" | "premiere_lecon" | "derniere_lecon">[] = [
  { titre: "Premiers contacts", description: "Saluer, se présenter, épeler son nom." },
  { titre: "Vie quotidienne", description: "Parler de sa journée, de sa famille et de son logement." },
  { titre: "Se déplacer et s'orienter", description: "Demander son chemin, prendre les transports." },
  { titre: "Loisirs et goûts", description: "Exprimer ses goûts, proposer une sortie." },
  { titre: "Travail et études", description: "Parler de son métier, de sa formation et de ses projets." },
  { titre: "Santé et bien-être", description: "Décrire un symptôme, prendre rendez-vous." },
  { titre: "Société et actualité", description: "Comprendre une information et réagir." },
  { titre: "S'exprimer et argumenter", description: "Donner son opinion, nuancer, convaincre." },
];
const DERNIERE_LECON = MODULES.length * LECONS_PAR_MODULE;

/* ---------- Banque de contenus (exercice.contenu), choisie selon le numéro de leçon ---------- */

const CHOIX = [
  { type: "GRAMMAIRE", intitule: "Le passé composé", consigne: "Choisissez la bonne forme.", enonce: "Hier, je ___ au cinéma.", choix: ["vais", "suis allé", "irai"], reponse: "suis allé" },
  { type: "GRAMMAIRE", intitule: "Le futur proche", consigne: "Choisissez la bonne forme.", enonce: "Ce soir, nous ___ dîner chez des amis.", choix: ["allons", "sommes allés", "allions"], reponse: "allons" },
  { type: "COMPREHENSION", intitule: "Lire une annonce", consigne: "« Le musée est ouvert du mardi au dimanche, de 10 h à 18 h. »", enonce: "Peut-on visiter le musée le lundi ?", choix: ["Oui", "Non", "Seulement le matin"], reponse: "Non" },
  { type: "COMPREHENSION", intitule: "Comprendre un message", consigne: "« Rendez-vous devant la gare à 9 h, ne sois pas en retard ! »", enonce: "Où est le rendez-vous ?", choix: ["À la gare", "Au café", "À l'école"], reponse: "À la gare" },
] as const;

const TEXTES = [
  { intitule: "Les salutations", consigne: "Complétez la phrase.", enonce: "___, je m'appelle Marie.", reponses: ["Bonjour", "Bonsoir", "Salut"] },
  { intitule: "Prendre rendez-vous", consigne: "Complétez avec le bon verbe.", enonce: "Je voudrais ___ un rendez-vous chez le médecin.", reponses: ["prendre"] },
  { intitule: "Demander poliment", consigne: "Complétez avec « pouvoir » au conditionnel.", enonce: "___-vous m'indiquer la gare, s'il vous plaît ?", reponses: ["Pourriez"] },
  { intitule: "Au restaurant", consigne: "Complétez la commande.", enonce: "Je ___ un café, s'il vous plaît.", reponses: ["voudrais", "veux", "prends"] },
];

const ECOUTES = [
  { intitule: "Un message vocal", texte: "Bonjour, c'est Paul. Je serai en retard de dix minutes. À tout à l'heure !", question: "Que dit Paul ?", choix: ["Il annule le rendez-vous", "Il sera en retard", "Il est déjà arrivé"], reponse: "Il sera en retard" },
  { intitule: "À la gare", texte: "Le train pour Lyon partira du quai numéro trois à quatorze heures.", question: "De quel quai part le train ?", choix: ["Quai 1", "Quai 3", "Quai 14"], reponse: "Quai 3" },
  { intitule: "La météo", texte: "Demain, il pleuvra le matin, puis le soleil reviendra l'après-midi.", question: "Quel temps fera-t-il demain après-midi ?", choix: ["Pluie", "Soleil", "Neige"], reponse: "Soleil" },
];

const PRONONCIATIONS = [
  { intitule: "Se présenter", phrase: "Bonjour, je m'appelle Marie et j'habite à Paris." },
  { intitule: "Commander", phrase: "Je voudrais un café et un croissant, s'il vous plaît." },
  { intitule: "Demander son chemin", phrase: "Excusez-moi, où se trouve la gare ?" },
];

const CONVERSATIONS = [
  {
    intitule: "Faire connaissance",
    sujet: "Se présenter",
    message_initial: "Bonjour ! Je suis votre professeur IA. Comment vous appelez-vous ?",
    relances: ["Enchanté ! D'où venez-vous ?", "Et que faites-vous dans la vie ?", "Qu'aimez-vous faire le week-end ?"],
  },
  {
    intitule: "Au restaurant",
    sujet: "Commander un repas",
    message_initial: "Bonsoir et bienvenue ! Vous avez choisi votre plat ?",
    relances: ["Très bon choix. Et comme boisson ?", "Vous prendrez un dessert ?", "Parfait. Vous payez par carte ou en espèces ?"],
  },
  {
    intitule: "Organiser une sortie",
    sujet: "Proposer une activité",
    message_initial: "Salut ! On sort ce week-end ? Qu'est-ce que tu proposes ?",
    relances: ["Bonne idée ! Quel jour te convient ?", "À quelle heure on se retrouve ?", "Où est-ce qu'on se donne rendez-vous ?"],
  },
];

const RANGS = ["choix", "texte", "ecoute", "prononciation", "conversation"] as const;

interface ExerciceMock {
  ligne: Omit<ExerciceParcoursDto, "statut" | "score_obtenu">;
  contenu: Record<string, unknown>;
  /** Réponses acceptées (formats choix, texte, écoute) ou phrase attendue (prononciation). */
  attendu: string[];
}

function exerciceMock(lecon: number, rang: number): ExerciceMock {
  const id = lecon * 10 + rang + 1;
  const pick = <T,>(liste: readonly T[]) => liste[(lecon + rang) % liste.length];
  const base = { id_parcours_exercice: id, id_exercice: 1000 + id, numero_lecon: lecon, difficulte: Math.min(5, 1 + Math.floor(lecon / 12)) };
  switch (RANGS[rang]) {
    case "choix": {
      const c = pick(CHOIX);
      return { ligne: { ...base, type: c.type, intitule: c.intitule }, contenu: { format: "choix", consigne: c.consigne, enonce: c.enonce, choix: c.choix }, attendu: [c.reponse] };
    }
    case "texte": {
      const t = pick(TEXTES);
      return { ligne: { ...base, type: "VOCABULAIRE", intitule: t.intitule }, contenu: { format: "texte", consigne: t.consigne, enonce: t.enonce }, attendu: t.reponses };
    }
    case "ecoute": {
      const e = pick(ECOUTES);
      return {
        ligne: { ...base, type: "ECOUTE", intitule: e.intitule },
        contenu: { format: "ecoute", consigne: "Écoutez l'extrait, puis répondez.", question: e.question, choix: e.choix, audio_url: null, texte_audio: e.texte },
        attendu: [e.reponse],
      };
    }
    case "prononciation": {
      const p = pick(PRONONCIATIONS);
      return { ligne: { ...base, type: "ORAL", intitule: p.intitule }, contenu: { format: "prononciation", consigne: "Lisez la phrase à voix haute.", phrase: p.phrase }, attendu: [p.phrase] };
    }
    default: {
      const c = pick(CONVERSATIONS);
      return {
        ligne: { ...base, type: "ORAL", intitule: c.intitule },
        contenu: { format: "conversation", consigne: "Discutez avec le professeur IA, à l'écrit ou à la voix.", sujet: c.sujet, message_initial: c.message_initial, echanges_minimum: 3 },
        attendu: [],
      };
    }
  }
}

/* ---------- Avancement (en mémoire) ---------- */

let scenario: ScenarioParcoursMock = (scenarioConfigure as ScenarioParcoursMock | undefined) ?? "passif";
let leconAtteinte = 0;
const scores = new Map<number, number>();

function initialiser() {
  leconAtteinte = scenario === "actif" ? 56 : 23;
  scores.clear();
  for (let lecon = 1; lecon <= leconAtteinte; lecon++) {
    for (let rang = 0; rang < RANGS.length; rang++) {
      const id = lecon * 10 + rang + 1;
      // Leçons passées : tout est fait, quelques exercices à revoir ; leçon du jour : seul le premier est fait
      if (lecon < leconAtteinte) scores.set(id, lecon % 4 === 0 && rang === 1 ? 40 : 60 + ((lecon + rang) % 5) * 10);
      else if (rang === 0) scores.set(id, 90);
    }
  }
}
initialiser();

/** Change de scénario et remet l'avancement à zéro (tests, démonstration). */
export function choisirScenarioParcoursMock(choix: ScenarioParcoursMock) {
  scenario = choix;
  initialiser();
}

const statutDe = (score: number | undefined) => (score === undefined ? "A_FAIRE" : score >= SEUIL_REUSSITE ? "REUSSI" : "A_REVOIR");

function ligneAvecStatut({ ligne }: ExerciceMock): ExerciceParcoursDto {
  const score = scores.get(ligne.id_parcours_exercice);
  return { ...ligne, statut: statutDe(score), score_obtenu: score ?? null };
}

async function repondre() {
  await delay(300);
  if (scenario === "sans-parcours") throw new ApiError(404, "Aucun parcours", "Aucun parcours en cours.");
  if (scenario === "erreur-serveur") throw new ApiError(500, "Erreur serveur");
}

async function repondreExercices(idParcours: number) {
  await repondre();
  if (scenario === "exercices-indisponibles") throw new ApiError(503, "Service indisponible");
  if (idParcours !== ID_PARCOURS) throw new ApiError(404, "Parcours introuvable");
}

/** Compare sans accents, majuscules, apostrophes ni ponctuation. */
export function normaliserReponse(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Part des mots de la phrase attendue retrouvés dans la transcription, en pourcentage. */
export function scorePrononciation(attendue: string, dite: string): number {
  const mots = normaliserReponse(attendue).split(" ");
  const dits = new Set(normaliserReponse(dite).split(" "));
  return Math.round((mots.filter((m) => dits.has(m)).length / mots.length) * 100);
}

export const parcoursPersonnaliseMock = {
  async enCours(): Promise<ParcoursPersonnaliseDto> {
    await repondre();
    return {
      id_parcours: ID_PARCOURS,
      statut: "EN_COURS",
      date_creation: "2026-10-02T09:30:00Z",
      code_langue: "fr",
      libelle_langue: "Français",
      cadre: "CECRL",
      niveaux_cadre: ["A1", "A2", "B1", "B2", "C1", "C2"],
      niveau_depart: "A2",
      niveau_vise: "B1",
      lecon_atteinte: leconAtteinte,
      // Mêmes règles que backend/app/services/phase_parcours.py
      phase: leconAtteinte < 50 ? "PASSIVE" : "ACTIVE",
      est_lecon_de_revision: leconAtteinte >= 50 && leconAtteinte % 7 === 0,
      modules: MODULES.map((m, i) => ({
        ...m,
        numero: i + 1,
        premiere_lecon: i * LECONS_PAR_MODULE + 1,
        derniere_lecon: (i + 1) * LECONS_PAR_MODULE,
      })),
    };
  },

  async exercices(idParcours: number): Promise<ExerciceParcoursDto[]> {
    await repondreExercices(idParcours);
    return Array.from({ length: leconAtteinte }, (_, l) => RANGS.map((__, rang) => ligneAvecStatut(exerciceMock(l + 1, rang)))).flat();
  },

  async lecon(idParcours: number, numero: number): Promise<LeconParcoursDto> {
    await repondreExercices(idParcours);
    if (numero < 1 || numero > DERNIERE_LECON) throw new ApiError(404, "Leçon introuvable", "Cette leçon n'existe pas.");
    if (numero > leconAtteinte) {
      throw new ApiError(403, "Leçon à venir", "Cette leçon s'ouvrira quand vous aurez terminé les leçons précédentes.");
    }
    return {
      numero_lecon: numero,
      est_lecon_de_revision: numero >= 50 && numero % 7 === 0,
      code_langue: "fr",
      exercices: RANGS.map((_, rang) => {
        const exercice = exerciceMock(numero, rang);
        return { ...ligneAvecStatut(exercice), contenu: JSON.stringify(exercice.contenu) };
      }),
    };
  },

  async corriger(idParcours: number, idParcoursExercice: number, reponse: ReponseExercice): Promise<CorrectionExerciceDto> {
    await repondreExercices(idParcours);
    const lecon = Math.floor(idParcoursExercice / 10);
    const rang = (idParcoursExercice % 10) - 1;
    if (lecon > leconAtteinte || !RANGS[rang]) throw new ApiError(403, "Exercice indisponible");
    const exercice = exerciceMock(lecon, rang);

    let score: number;
    let commentaire: string;
    if (reponse.format === "conversation") {
      const contenu = exercice.contenu as { echanges_minimum: number };
      const tours = reponse.messages.filter((m) => m.role === "apprenant").length;
      score = Math.min(100, Math.round((tours / contenu.echanges_minimum) * 100));
      commentaire =
        score >= SEUIL_REUSSITE
          ? "Belle conversation ! Vos réponses étaient claires et adaptées."
          : "Continuez l'échange : répondez à au moins trois questions du professeur.";
    } else if (reponse.format === "prononciation") {
      score = scorePrononciation(exercice.attendu[0], reponse.reponse);
      commentaire = score >= 80 ? "Très bonne prononciation !" : score >= SEUIL_REUSSITE ? "Bien ! Quelques mots ne sont pas reconnus." : "Réessayez en articulant chaque mot.";
    } else {
      const juste = exercice.attendu.some((a) => normaliserReponse(a) === normaliserReponse(reponse.reponse));
      score = juste ? 100 : 0;
      commentaire = juste ? "Bonne réponse !" : "Ce n'est pas la bonne réponse.";
    }

    scores.set(idParcoursExercice, score);
    // Leçon du jour terminée (tous les exercices ont une réponse) : la leçon suivante s'ouvre
    const tousFaits = RANGS.every((_, r) => scores.has(lecon * 10 + r + 1));
    if (lecon === leconAtteinte && tousFaits && leconAtteinte < DERNIERE_LECON) leconAtteinte += 1;

    const statut = statutDe(score);
    return {
      statut,
      score_obtenu: score,
      commentaire,
      reponse_attendue: statut === "A_REVOIR" && reponse.format !== "conversation" ? exercice.attendu[0] : null,
    };
  },

  /** Professeur IA simulé : réagit puis relance avec une question liée au sujet de la conversation. */
  async chatbot({ message, historique }: MessageChatbotDto): Promise<ReponseChatbotDto> {
    await delay(500);
    const conversation = CONVERSATIONS.find((c) => c.message_initial === historique[0]?.contenu) ?? CONVERSATIONS[0];
    const tour = historique.filter((m) => m.role === "apprenant").length;
    if (normaliserReponse(message).split(" ").length < 2) {
      return { reponse: "Pouvez-vous répondre avec une phrase complète ? Par exemple : « Je m'appelle… »." };
    }
    const reaction = ["Très bien !", "D'accord, merci.", "Intéressant !"][tour % 3];
    const relance = conversation.relances[tour] ?? "Merci pour cet échange, vous pouvez terminer la conversation.";
    return { reponse: `${reaction} ${relance}` };
  },
};
