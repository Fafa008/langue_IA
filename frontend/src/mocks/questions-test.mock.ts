import type { CodeLangue } from "@/types/langue";
import type { CompetenceTest, Question } from "@/types/test-diagnostic";

export interface QuestionMock extends Question {
  bonneReponse: number;
}

const q = (
  id: string,
  niveau: string,
  enonce: string,
  choix: string[],
  bonneReponse: number,
  competence: CompetenceTest = "grammaire",
  support?: string,
  audioUrl?: string,
): QuestionMock => ({
  id,
  niveau,
  competence,
  typeReponse: "choix",
  enonce,
  choix,
  support,
  audioUrl,
  bonneReponse,
});

const EN: QuestionMock[] = [
  q("en-a1-1", "A1", "She ___ a student.", ["is", "are", "am", "be"], 0),
  q("en-a1-2", "A1", "I ___ coffee every morning.", ["drinks", "drink", "am drink", "drunk"], 1),
  q("en-a2-1", "A2", "We ___ to the cinema yesterday.", ["go", "goed", "went", "gone"], 2),
  q("en-a2-2", "A2", "There isn't ___ milk left.", ["some", "any", "a", "many"], 1),
  q("en-b1-1", "B1", "If I ___ more time, I would travel more.", ["have", "had", "would have", "having"], 1),
  q("en-b1-2", "B1", "She has lived here ___ 2015.", ["for", "since", "from", "during"], 1),
  q("en-b2-1", "B2", "By the time we arrived, the film ___.", ["already started", "had already started", "has already started", "was already start"], 1),
  q("en-b2-2", "B2", "I wish I ___ the answer yesterday.", ["knew", "know", "had known", "would know"], 2),
  q("en-c1-1", "C1", "Hardly ___ the door when the phone rang.", ["he had opened", "had he opened", "did he open", "he opened"], 1),
  q("en-c1-2", "C1", "The report, ___ findings were disputed, was withdrawn.", ["which", "whose", "of which the", "that"], 1),
  q("en-c2-1", "C2", "Were it not for your help, I ___ the deadline.", ["would miss", "would have missed", "had missed", "will miss"], 1),
  q("en-c2-2", "C2", "She is widely ___ to win the prize.", ["tipped", "tipping", "tip", "tips"], 0),
  q("en-b2-read", "B2", "Why did the company change its policy?", ["To reduce costs", "To improve flexibility", "To hire more people", "To expand abroad"], 1, "lecture", "The company introduced flexible working hours after staff feedback showed that commuting affected productivity."),
  {
    ...q("en-b2-listen", "B2", "What does the speaker recommend?", ["Taking a later train", "Booking in advance", "Travelling by bus", "Working from home"], 1, "ecoute"),
    audioTexte: "For your train journey, I recommend booking your tickets in advance. Prices are usually lower, and you will have a better choice of seats.",
  },
  { ...q("en-c1-write", "C1", "In a few sentences, explain one advantage of lifelong learning.", [], 0, "ecrit"), typeReponse: "texte" },
  { ...q("en-c1-speak", "C1", "Read the sentence aloud.", [], 0, "oral"), typeReponse: "audio", enonce: "\"Continuing education is essential for professional growth.\"" },
];

const FR: QuestionMock[] = [
  q("fr-a1-1", "A1", "Je ___ étudiant.", ["suis", "es", "est", "sommes"], 0),
  q("fr-a1-2", "A1", "Nous ___ au marché le samedi.", ["vais", "allons", "allez", "vont"], 1),
  q("fr-a2-1", "A2", "Hier, elle ___ au cinéma.", ["va", "est allée", "irait", "allé"], 1),
  q("fr-a2-2", "A2", "Il n'y a plus ___ pain.", ["du", "de", "des", "le"], 1),
  q("fr-b1-1", "B1", "Si j'avais plus de temps, je ___ davantage.", ["voyagerai", "voyagerais", "voyageais", "voyagé"], 1),
  q("fr-b1-2", "B1", "Elle habite ici ___ 2015.", ["pendant", "depuis", "il y a", "dans"], 1),
  q("fr-b2-1", "B2", "Quand nous sommes arrivés, le film ___ déjà commencé.", ["avait", "a", "était", "aura"], 0),
  q("fr-b2-2", "B2", "Il faut que tu ___ patient.", ["es", "sois", "seras", "étais"], 1),
  q("fr-c1-1", "C1", "Le rapport, ___ les conclusions ont fait polémique, a été retiré.", ["dont", "que", "duquel", "où"], 0),
  q("fr-c1-2", "C1", "Bien qu'il ___ fatigué, il a continué.", ["est", "soit", "sera", "était"], 1),
  q("fr-c2-1", "C2", "Quoi qu'il en ___, nous partirons demain.", ["est", "soit", "sera", "a été"], 1),
  q("fr-c2-2", "C2", "Je doute qu'il ___ pu venir.", ["a", "ait", "aura", "avait"], 1),
  q("fr-b2-read", "B2", "Pourquoi l'entreprise a-t-elle modifié sa politique ?", ["Réduire les coûts", "Améliorer la flexibilité", "Recruter davantage", "S'installer à l'étranger"], 1, "lecture", "Après les retours des équipes, l'entreprise a introduit des horaires flexibles pour limiter l'effet des trajets sur la productivité."),
  {
    ...q("fr-b2-listen", "B2", "Que conseille la personne ?", ["Prendre un train plus tard", "Réserver à l'avance", "Voyager en bus", "Travailler de chez soi"], 1, "ecoute"),
    audioTexte: "Pour votre voyage en train, je vous conseille de réserver vos billets à l'avance. Les prix sont généralement plus bas et vous aurez davantage de choix pour votre place.",
  },
  { ...q("fr-c1-write", "C1", "En quelques phrases, expliquez un avantage de la formation continue.", [], 0, "ecrit"), typeReponse: "texte" },
  { ...q("fr-c1-speak", "C1", "Lisez la phrase à voix haute.", [], 0, "oral"), typeReponse: "audio", enonce: "« La formation continue est essentielle au développement professionnel. »" },
];

/**
 * Données serveur simulées, banque ≥ 2 par niveau (prévoir 5 pour un vrai test).
 * Mandarin, italien, allemand : à fournir par l'équipe pédagogique.
 */
export const QUESTIONS_TEST: Record<CodeLangue, QuestionMock[]> = { en: EN, fr: FR, zh: [], it: [], de: [] };