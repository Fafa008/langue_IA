import type { CodeLangue } from "@/types/langue";
import type { Question } from "@/types/test-diagnostic";

/**
 * Exercices de démonstration du test de positionnement.
 *
 * Quatre compétences, cinq exercices chacune, soit 20 exercices par langue et une note sur 100
 * (5 points par exercice). La correction reste côté mock : elle n'est jamais exposée au composant
 * avant validation (`sansCorrection` dans `test-diagnostic.mock.ts`).
 */
export interface QuestionMock extends Question {
  /** Indice de la bonne réponse, pour les exercices à choix. */
  bonneReponse?: number;
  /** Réponse attendue, pour le texte à trous et la dictée. */
  reponseAttendue?: string;
}

const qcm = (
  id: string,
  niveau: string,
  enonce: string,
  choix: string[],
  bonneReponse: number,
  competence: "lecture" | "ecoute" = "lecture",
  support?: string,
): QuestionMock => ({
  id,
  niveau,
  competence,
  typeReponse: "choix",
  format: "qcm",
  enonce,
  choix,
  support,
  bonneReponse,
});

const vraiFaux = (id: string, niveau: string, enonce: string, vrai: boolean, support?: string): QuestionMock => ({
  ...qcm(id, niveau, enonce, ["Vrai", "Faux"], vrai ? 0 : 1, "lecture", support),
  format: "vrai_faux",
});

const ecouteQcm = (
  id: string,
  niveau: string,
  audioTexte: string,
  enonce: string,
  choix: string[],
  bonneReponse: number,
): QuestionMock => ({
  ...qcm(id, niveau, enonce, choix, bonneReponse, "ecoute"),
  audioTexte,
});

/** Dictée : la phrase est lue par la synthèse vocale, l'apprenant la réécrit. */
const dictee = (id: string, niveau: string, phrase: string): QuestionMock => ({
  id,
  niveau,
  competence: "ecoute",
  typeReponse: "texte",
  format: "dictee",
  enonce: "Écrivez la phrase que vous avez entendue.",
  audioTexte: phrase,
  reponseAttendue: phrase,
});

/** Texte à trous : les lettres (ou idéogrammes) sont mélangées. */
const trous = (id: string, niveau: string, enonce: string, mot: string, lettres: string[]): QuestionMock => ({
  id,
  niveau,
  competence: "ecrit",
  typeReponse: "texte",
  format: "texte_a_trous",
  enonce,
  lettresMelangees: lettres,
  reponseAttendue: mot,
});

/** Expression orale : la phrase cible est affichée, l'apprenant la dit au micro. */
const parler = (id: string, niveau: string, phrase: string): QuestionMock => ({
  id,
  niveau,
  competence: "oral",
  typeReponse: "audio",
  format: "parler",
  enonce: phrase,
  dureeMinimaleSecondes: 2,
  reponseAttendue: phrase,
});

const EN: QuestionMock[] = [
  // Lire — grammaire, conjugaison, lexique et compréhension
  qcm("en-lire-1", "A1", "She ___ a student.", ["is", "are", "am", "be"], 0),
  qcm("en-lire-2", "A1", "I ___ coffee every morning.", ["drinks", "drink", "am drink", "drunk"], 1),
  qcm("en-lire-3", "A2", "We ___ to the cinema yesterday.", ["go", "goed", "went", "gone"], 2),
  qcm("en-lire-4", "A2", "There isn't ___ milk left.", ["some", "any", "a", "many"], 1),
  vraiFaux("en-lire-5", "B1", "The company changed its policy to reduce costs.", false,
    "The company introduced flexible working hours after staff feedback showed that commuting affected productivity."),
  // Écouter
  ecouteQcm("en-ecouter-1", "A2",
    "Hello, this is Anna. I can't come to the meeting on Monday. Can we meet on Wednesday at ten instead?",
    "When does Anna want to meet?", ["Monday at ten", "Wednesday at ten", "Wednesday at two", "Friday at ten"], 1),
  dictee("en-ecouter-2", "A1", "I live in London."),
  ecouteQcm("en-ecouter-3", "B2",
    "For your train journey, I recommend booking your tickets in advance. Prices are usually lower.",
    "What does the speaker recommend?", ["Taking a later train", "Booking in advance", "Travelling by bus", "Working from home"], 1),
  dictee("en-ecouter-4", "B1", "She has lived here since 2015."),
  ecouteQcm("en-ecouter-5", "C1",
    "Although remote work has improved flexibility, several studies suggest that new employees miss out on informal learning from colleagues.",
    "What drawback of remote work is mentioned?", ["Higher costs", "Less informal learning", "Longer hours", "Poor equipment"], 1),
  // Écrire
  trous("en-ecrire-1", "A1", "I live in ___ .", "London", ["N", "O", "L", "D", "O", "N"]),
  trous("en-ecrire-2", "A1", "My name ___ Maria.", "is", ["S", "I"]),
  trous("en-ecrire-3", "A2", "I have two ___ .", "books", ["S", "K", "O", "B", "O"]),
  trous("en-ecrire-4", "A2", "We go to school by ___ .", "bus", ["S", "B", "U"]),
  trous("en-ecrire-5", "B1", "She has lived here ___ 2015.", "since", ["C", "E", "I", "N", "S"]),
  // Parler
  parler("en-parler-1", "A1", "I live in London."),
  parler("en-parler-2", "A1", "My name is Maria."),
  parler("en-parler-3", "A2", "I like reading books."),
  parler("en-parler-4", "A2", "I go to school by bus."),
  parler("en-parler-5", "B1", "She has lived here since 2015."),
];

const FR: QuestionMock[] = [
  qcm("fr-lire-1", "A1", "Je ___ étudiant.", ["suis", "es", "est", "sommes"], 0),
  qcm("fr-lire-2", "A1", "Nous ___ au marché le samedi.", ["vais", "allons", "allez", "vont"], 1),
  qcm("fr-lire-3", "A2", "Hier, elle ___ au cinéma.", ["va", "est allée", "irait", "allé"], 1),
  qcm("fr-lire-4", "A2", "Il n'y a plus ___ pain.", ["du", "de", "des", "le"], 1),
  vraiFaux("fr-lire-5", "B1", "L'entreprise a changé sa politique pour réduire ses coûts.", false,
    "Après les retours des équipes, l'entreprise a introduit des horaires flexibles pour limiter l'effet des trajets sur la productivité."),
  ecouteQcm("fr-ecouter-1", "A2",
    "Bonjour, c'est Anna. Je ne peux pas venir à la réunion lundi. On peut se voir mercredi à dix heures ?",
    "Quand Anna veut-elle se voir ?", ["Lundi à dix heures", "Mercredi à dix heures", "Mercredi à deux heures", "Vendredi à dix heures"], 1),
  dictee("fr-ecouter-2", "A1", "Bonjour, je m'appelle Luc."),
  ecouteQcm("fr-ecouter-3", "B2",
    "Pour votre voyage en train, je vous conseille de réserver vos billets à l'avance. Les prix sont généralement plus bas.",
    "Que conseille la personne ?", ["Prendre un train plus tard", "Réserver à l'avance", "Voyager en bus", "Travailler de chez soi"], 1),
  dictee("fr-ecouter-4", "B1", "J'habite à Paris."),
  ecouteQcm("fr-ecouter-5", "C1",
    "Si le télétravail a amélioré la flexibilité, plusieurs études montrent que les nouveaux salariés perdent l'apprentissage informel auprès de leurs collègues.",
    "Quel inconvénient du télétravail est évoqué ?", ["Des coûts plus élevés", "Moins d'apprentissage informel", "Des journées plus longues", "Du matériel insuffisant"], 1),
  trous("fr-ecrire-1", "A1", "J'habite à ___ .", "Paris", ["S", "I", "A", "R", "P"]),
  trous("fr-ecrire-2", "A1", "Je m'appelle ___ .", "Luc", ["C", "U", "L"]),
  trous("fr-ecrire-3", "A2", "Il mange une ___ .", "pomme", ["E", "M", "M", "O", "P"]),
  trous("fr-ecrire-4", "A2", "Nous allons ___ marché.", "au", ["U", "A"]),
  trous("fr-ecrire-5", "B1", "Elle habite ici ___ 2015.", "depuis", ["S", "I", "U", "P", "E", "D"]),
  parler("fr-parler-1", "A1", "Bonjour."),
  parler("fr-parler-2", "A1", "Je m'appelle Luc."),
  parler("fr-parler-3", "A2", "J'habite à Paris."),
  parler("fr-parler-4", "A2", "Il mange une pomme."),
  parler("fr-parler-5", "B1", "Elle habite ici depuis 2015."),
];

const DE: QuestionMock[] = [
  qcm("de-lire-1", "A1", "Ich ___ Student.", ["bin", "bist", "ist", "sind"], 0),
  qcm("de-lire-2", "A1", "___ heiße Maria.", ["Ich", "Du", "Er", "Wir"], 0),
  qcm("de-lire-3", "A2", "Wir ___ gestern ins Kino.", ["gehen", "gingen", "gegangen", "geht"], 1),
  qcm("de-lire-4", "A2", "Ich wohne ___ Berlin.", ["in", "zu", "bei", "mit"], 0),
  vraiFaux("de-lire-5", "B1", "Die Firma wollte die Kosten senken.", false,
    "Die Firma hat flexible Arbeitszeiten eingeführt, weil die Anfahrt die Produktivität beeinträchtigte."),
  ecouteQcm("de-ecouter-1", "A2", "Guten Morgen, ich heiße Anna.",
    "Wie heißt die Person?", ["Anna", "Maria", "Berlin", "Luc"], 0),
  dictee("de-ecouter-2", "A1", "Guten Morgen."),
  ecouteQcm("de-ecouter-3", "B1", "Ich empfehle, die Tickets im Voraus zu buchen.",
    "Was empfiehlt die Person?", ["Später fahren", "Im Voraus buchen", "Mit dem Bus fahren", "Zu Hause arbeiten"], 1),
  dictee("de-ecouter-4", "B1", "Ich wohne in Berlin."),
  ecouteQcm("de-ecouter-5", "B2",
    "Obwohl Homeoffice die Flexibilität verbessert, fehlt neuen Mitarbeitern das informelle Lernen.",
    "Welcher Nachteil wird genannt?", ["Höhere Kosten", "Weniger informelles Lernen", "Längere Arbeitszeiten", "Schlechtes Material"], 1),
  trous("de-ecrire-1", "A1", "Ich heiße ___ .", "Maria", ["A", "I", "R", "M", "A"]),
  trous("de-ecrire-2", "A1", "Ich wohne in ___ .", "Berlin", ["L", "I", "N", "B", "E", "R"]),
  trous("de-ecrire-3", "A2", "Ich bin ___ Student.", "ein", ["N", "I", "E"]),
  trous("de-ecrire-4", "A2", "Wir gehen ___ Kino.", "ins", ["S", "I", "N"]),
  trous("de-ecrire-5", "B1", "Ich habe hier ___ 2015 gewohnt.", "seit", ["T", "I", "E", "S"]),
  parler("de-parler-1", "A1", "Guten Morgen."),
  parler("de-parler-2", "A1", "Ich heiße Maria."),
  parler("de-parler-3", "A2", "Ich wohne in Berlin."),
  parler("de-parler-4", "A2", "Ich bin Student."),
  parler("de-parler-5", "B1", "Ich habe hier seit 2015 gewohnt."),
];

const IT: QuestionMock[] = [
  qcm("it-lire-1", "A1", "Io ___ studente.", ["sono", "sei", "è", "siamo"], 0),
  qcm("it-lire-2", "A1", "Mi chiamo ___ .", ["Marco", "Roma", "Libro", "Casa"], 0),
  qcm("it-lire-3", "A2", "Noi ___ al cinema ieri.", ["andiamo", "andammo", "andremo", "vada"], 1),
  qcm("it-lire-4", "A2", "Marco abita ___ Roma.", ["a", "in", "di", "con"], 0),
  vraiFaux("it-lire-5", "B1", "L'azienda voleva ridurre i costi.", false,
    "L'azienda ha introdotto orari flessibili dopo che i dipendenti hanno segnalato il problema dei tragitti."),
  ecouteQcm("it-ecouter-1", "A2", "Buongiorno, mi chiamo Anna.",
    "Come si chiama la persona?", ["Anna", "Marco", "Roma", "Lucia"], 0),
  dictee("it-ecouter-2", "A1", "Buongiorno."),
  ecouteQcm("it-ecouter-3", "B1", "Consiglio di prenotare i biglietti in anticipo.",
    "Cosa consiglia la persona?", ["Partire più tardi", "Prenotare in anticipo", "Viaggiare in bus", "Lavorare da casa"], 1),
  dictee("it-ecouter-4", "B1", "Mi chiamo Marco."),
  ecouteQcm("it-ecouter-5", "B2",
    "Benché il lavoro da casa migliori la flessibilità, i nuovi dipendenti perdono l'apprendimento informale.",
    "Quale svantaggio viene citato?", ["Costi più alti", "Meno apprendimento informale", "Giornate più lunghe", "Materiale insufficiente"], 1),
  trous("it-ecrire-1", "A1", "Mi chiamo ___ .", "Marco", ["O", "C", "R", "A", "M"]),
  trous("it-ecrire-2", "A1", "Abito a ___ .", "Roma", ["A", "M", "O", "R"]),
  trous("it-ecrire-3", "A2", "Io ___ studente.", "sono", ["O", "N", "S", "O"]),
  trous("it-ecrire-4", "A2", "Vado a scuola in ___ .", "bus", ["S", "B", "U"]),
  trous("it-ecrire-5", "B1", "Vivo qui ___ 2015.", "dal", ["L", "A", "D"]),
  parler("it-parler-1", "A1", "Buongiorno."),
  parler("it-parler-2", "A1", "Mi chiamo Marco."),
  parler("it-parler-3", "A2", "Abito a Roma."),
  parler("it-parler-4", "A2", "Vado a scuola in bus."),
  parler("it-parler-5", "B1", "Vivo qui dal 2015."),
];

const ZH: QuestionMock[] = [
  qcm("zh-lire-1", "HSK 1", "我 ___ 学生。", ["是", "在", "有", "和"], 0),
  qcm("zh-lire-2", "HSK 1", "Que signifie « 你好 » ?", ["Bonjour", "Au revoir", "Merci", "Désolé"], 0),
  qcm("zh-lire-3", "HSK 2", "我住在___ 。", ["北京", "学生", "苹果", "书"], 0),
  qcm("zh-lire-4", "HSK 2", "我 ___ 咖啡。", ["喝", "吃", "看", "听"], 0),
  vraiFaux("zh-lire-5", "HSK 3", "公司是为了降低成本才改变政策的。", false,
    "公司实行了弹性工作时间，因为通勤影响了工作效率。"),
  ecouteQcm("zh-ecouter-1", "HSK 1", "你好，我叫小明。",
    "Comment s'appelle la personne ?", ["小明", "北京", "学生", "咖啡"], 0),
  dictee("zh-ecouter-2", "HSK 1", "你好。"),
  ecouteQcm("zh-ecouter-3", "HSK 2", "我住在北京。",
    "Où habite la personne ?", ["北京", "上海", "巴黎", "伦敦"], 0),
  dictee("zh-ecouter-4", "HSK 2", "我叫小明。"),
  ecouteQcm("zh-ecouter-5", "HSK 3", "我建议你提前订票。",
    "Que conseille la personne ?", ["Réserver à l'avance", "Prendre un bus", "Travailler à la maison", "Annuler le voyage"], 0),
  trous("zh-ecrire-1", "HSK 1", "我住在___ 。", "北京", ["京", "北"]),
  trous("zh-ecrire-2", "HSK 1", "我___学生。", "是", ["是"]),
  trous("zh-ecrire-3", "HSK 2", "我叫___ 。", "小明", ["明", "小"]),
  trous("zh-ecrire-4", "HSK 2", "我喝___ 。", "咖啡", ["啡", "咖"]),
  trous("zh-ecrire-5", "HSK 3", "我学习___ 。", "中文", ["文", "中"]),
  parler("zh-parler-1", "HSK 1", "你好。"),
  parler("zh-parler-2", "HSK 1", "我叫小明。"),
  parler("zh-parler-3", "HSK 2", "我住在北京。"),
  parler("zh-parler-4", "HSK 2", "我喝咖啡。"),
  parler("zh-parler-5", "HSK 3", "我学习中文。"),
];

/** Banque simulée : 5 langues × 4 compétences × 5 exercices. */
export const QUESTIONS_TEST: Record<CodeLangue, QuestionMock[]> = {
  en: EN,
  fr: FR,
  de: DE,
  it: IT,
  zh: ZH,
};
