/** Scénarios de conversation proposés dans la page du chat (US73-FE). Données fictives, sans donnée d'apprenant. */
export interface ScenarioChat {
  id: string;
  libelle: string;
  sujet: string;
  messageInitial: string;
}

export const SCENARIOS_CHAT: ScenarioChat[] = [
  { id: "presentation", libelle: "Se présenter", sujet: "Se présenter", messageInitial: "Bonjour ! Comment vous appelez-vous ?" },
  { id: "restaurant", libelle: "Commander au restaurant", sujet: "Commander au restaurant", messageInitial: "Bonjour, vous êtes prêt à commander ?" },
  { id: "gare", libelle: "Demander son chemin", sujet: "Demander son chemin", messageInitial: "Bonjour, je peux vous aider à trouver votre chemin." },
];
