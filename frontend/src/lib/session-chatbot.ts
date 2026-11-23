/*
 * Identifiant de session du chat. Le backend conserve l'historique et le quota par session : le frontend doit
 * en ouvrir une nouvelle à chaque conversation, et fermer l'ancienne quand l'apprenant termine ou change de contexte.
 * Cette valeur n'est pas un secret et n'est pas restaurée d'une visite à l'autre.
 */

const creerIdentifiant = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

let identifiantCourant = creerIdentifiant();

/** Identifiant utilisé par la conversation en cours. */
export function sessionChatbotCourante(): string {
  return identifiantCourant;
}

/** Ouvre une nouvelle session et renvoie son identifiant. */
export function nouvelleSessionChatbot(): string {
  identifiantCourant = creerIdentifiant();
  return identifiantCourant;
}

/**
 * Identifiant d'un message du tuteur, utilisé comme clé de cache de la traduction côté service IA.
 * Il doit être généré une seule fois par réponse, puis réutilisé si la traduction est demandée à nouveau.
 */
export function creerIdentifiantMessage(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Repli pour les navigateurs sans Web Crypto : la forme UUID est exigée par le contrat backend.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (caractere) => {
    const hasard = (Math.random() * 16) | 0;
    return (caractere === "x" ? hasard : (hasard & 0x3) | 0x8).toString(16);
  });
}
