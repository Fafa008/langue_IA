/** Scénarios de conversation proposés dans la page du chat (US73-FE). Données fictives, sans donnée d'apprenant. */
export interface ScenarioChat {
  id: string;
  /** Intitulé du scénario (affiché comme contexte et comme sujet), dans chaque langue de parcours prise en charge. */
  libelles: Record<string, string>;
  /** Message d'ouverture du tuteur, dans chaque langue de parcours prise en charge. */
  messagesInitiaux: Record<string, string>;
}

export const SCENARIOS_CHAT: ScenarioChat[] = [
  {
    id: "presentation",
    libelles: {
      fr: "Se présenter",
      en: "Introducing yourself",
      it: "Presentarsi",
      de: "Sich vorstellen",
      zh: "自我介绍",
    },
    messagesInitiaux: {
      fr: "Bonjour ! Comment vous appelez-vous ?",
      en: "Hello! What is your name?",
      it: "Ciao! Come ti chiami?",
      de: "Hallo! Wie heißt du?",
      zh: "你好！你叫什么名字？",
    },
  },
  {
    id: "restaurant",
    libelles: {
      fr: "Commander au restaurant",
      en: "Ordering at a restaurant",
      it: "Ordinare al ristorante",
      de: "Im Restaurant bestellen",
      zh: "在餐厅点餐",
    },
    messagesInitiaux: {
      fr: "Bonjour, vous êtes prêt à commander ?",
      en: "Hello, are you ready to order?",
      it: "Buongiorno, è pronto a ordinare?",
      de: "Hallo, sind Sie bereit zu bestellen?",
      zh: "您好，您准备好点餐了吗？",
    },
  },
  {
    id: "gare",
    libelles: {
      fr: "Demander son chemin",
      en: "Asking for directions",
      it: "Chiedere indicazioni",
      de: "Nach dem Weg fragen",
      zh: "问路",
    },
    messagesInitiaux: {
      fr: "Bonjour, je peux vous aider à trouver votre chemin.",
      en: "Hello, can I help you find your way?",
      it: "Buongiorno, posso aiutarla a trovare la strada?",
      de: "Hallo, kann ich Ihnen den Weg zeigen?",
      zh: "您好，我可以帮您指路。",
    },
  },
];

/** Intitulé du scénario dans la langue du parcours ; le français sert de repli. */
export const libelleScenario = (scenario: ScenarioChat, langue: string): string =>
  scenario.libelles[langue] ?? scenario.libelles.fr;

/** Le tuteur ouvre la conversation dans la langue du parcours ; le français sert de repli. */
export const messageInitialChat = (scenario: ScenarioChat, langue: string): string =>
  scenario.messagesInitiaux[langue] ?? scenario.messagesInitiaux.fr;
