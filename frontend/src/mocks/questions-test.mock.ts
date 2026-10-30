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

/** Extrait de compréhension orale : lu par la synthèse vocale du navigateur en mode démonstration. */
const ecoute = (id: string, niveau: string, audioTexte: string, enonce: string, choix: string[], bonneReponse: number) =>
  ({ ...q(id, niveau, enonce, choix, bonneReponse, "ecoute"), audioTexte });

/** Sujet d'expression orale (enregistrement d'au moins 30 secondes). */
const oral = (id: string, niveau: string, enonce: string): QuestionMock =>
  ({ ...q(id, niveau, enonce, [], 0, "oral"), typeReponse: "audio", dureeMinimaleSecondes: 30 });

/** Sujet d'expression écrite, avec un nombre de mots attendu selon le niveau. */
const ecrit = (id: string, niveau: string, enonce: string, motsMinimum: number): QuestionMock =>
  ({ ...q(id, niveau, enonce, [], 0, "ecrit"), typeReponse: "texte", motsMinimum });

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
  q("en-a2-lex", "A2", "Choose the opposite of \"cheap\".", ["expensive", "small", "easy", "early"], 0),
  q("en-b1-lex", "B1", "I'm looking ___ my keys. Have you seen them?", ["at", "for", "after", "into"], 1),
  q("en-c1-lex", "C1", "The new policy had a ___ effect on sales.", ["profound", "deep-seated", "heavy", "tall"], 0),
  ecoute(
    "en-a2-listen", "A2",
    "Hello, this is Anna. I can't come to the meeting on Monday. Can we meet on Wednesday at ten instead?",
    "When does Anna want to meet?", ["Monday at ten", "Wednesday at ten", "Wednesday at two", "Friday at ten"], 1,
  ),
  ecoute(
    "en-c1-listen", "C1",
    "Although remote work has improved flexibility, several studies suggest that new employees miss out on informal learning from colleagues.",
    "What drawback of remote work is mentioned?", ["Higher costs", "Less informal learning", "Longer hours", "Poor equipment"], 1,
  ),
  oral("en-a2-speak", "A2", "Describe your favourite activity and explain why you like it."),
  oral("en-b2-speak", "B2", "Talk about a change in your town or city. Is it positive or negative? Why?"),
  oral("en-c1-speak", "C1", "Some people say technology makes us less social. Do you agree? Give examples."),
  ecrit("en-a2-write", "A2", "Write a short message to a friend to invite them to your birthday party.", 25),
  ecrit("en-b2-write", "B2", "Write an email to your manager asking to work from home one day a week. Give your reasons.", 50),
  ecrit("en-c1-write", "C1", "In a short paragraph, explain one advantage and one limit of lifelong learning.", 70),
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
  q("fr-a2-lex", "A2", "Quel est le contraire de « cher » ?", ["bon marché", "petit", "facile", "tôt"], 0),
  q("fr-b1-lex", "B1", "Je ___ mes clés. Tu les as vues ?", ["cherche", "regarde", "trouve", "attends"], 0),
  q("fr-c1-lex", "C1", "Cette mesure a eu un effet ___ sur les ventes.", ["considérable", "lourd", "haut", "épais"], 0),
  ecoute(
    "fr-a2-listen", "A2",
    "Bonjour, c'est Anna. Je ne peux pas venir à la réunion lundi. On peut se voir mercredi à dix heures ?",
    "Quand Anna veut-elle se voir ?", ["Lundi à dix heures", "Mercredi à dix heures", "Mercredi à deux heures", "Vendredi à dix heures"], 1,
  ),
  ecoute(
    "fr-c1-listen", "C1",
    "Si le télétravail a amélioré la flexibilité, plusieurs études montrent que les nouveaux salariés perdent l'apprentissage informel auprès de leurs collègues.",
    "Quel inconvénient du télétravail est évoqué ?", ["Des coûts plus élevés", "Moins d'apprentissage informel", "Des journées plus longues", "Du matériel insuffisant"], 1,
  ),
  oral("fr-a2-speak", "A2", "Décrivez votre activité préférée et expliquez pourquoi vous l'aimez."),
  oral("fr-b2-speak", "B2", "Parlez d'un changement dans votre ville. Est-il positif ou négatif ? Pourquoi ?"),
  oral("fr-c1-speak", "C1", "Certains disent que la technologie nous rend moins sociables. Êtes-vous d'accord ? Donnez des exemples."),
  ecrit("fr-a2-write", "A2", "Écrivez un court message à un ami pour l'inviter à votre anniversaire.", 25),
  ecrit("fr-b2-write", "B2", "Écrivez un courriel à votre responsable pour demander une journée de télétravail par semaine. Justifiez votre demande.", 50),
  ecrit("fr-c1-write", "C1", "En un court paragraphe, expliquez un avantage et une limite de la formation continue.", 70),
];

/**
 * Données serveur simulées : QCM (≥ 2 par niveau), extraits à écouter et sujets d'expression par tranche de niveau.
 * Mandarin, italien, allemand : à fournir par l'équipe pédagogique.
 */
export const QUESTIONS_TEST: Record<CodeLangue, QuestionMock[]> = { en: EN, fr: FR, zh: [], it: [], de: [] };