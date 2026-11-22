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
