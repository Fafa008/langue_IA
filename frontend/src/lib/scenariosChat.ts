/** Scénarios de conversation proposés dans la page du chat (US73-FE). Données fictives, sans donnée d'apprenant. */
export interface ScenarioChat {
  id: string;
  libelle: string;
  sujet: string;
  /** Message d'ouverture du tuteur, dans chaque langue de parcours prise en charge. */
  messagesInitiaux: Record<string, string>;
}

export const SCENARIOS_CHAT: ScenarioChat[] = [
  {
    id: "presentation",
    libelle: "Se présenter",
    sujet: "Se présenter",
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
    libelle: "Commander au restaurant",
    sujet: "Commander au restaurant",
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
    libelle: "Demander son chemin",
    sujet: "Demander son chemin",
    messagesInitiaux: {
      fr: "Bonjour, je peux vous aider à trouver votre chemin.",
      en: "Hello, can I help you find your way?",
      it: "Buongiorno, posso aiutarla a trovare la strada?",
      de: "Hallo, kann ich Ihnen den Weg zeigen?",
      zh: "您好，我可以帮您指路。",
    },
  },
];

/** Le tuteur ouvre la conversation dans la langue du parcours ; le français sert de repli. */
export const messageInitialChat = (scenario: ScenarioChat, langue: string): string =>
  scenario.messagesInitiaux[langue] ?? scenario.messagesInitiaux.fr;
