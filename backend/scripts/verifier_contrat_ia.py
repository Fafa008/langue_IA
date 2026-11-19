"""Vérification réelle du contrat backend → service IA (US157-QA), sur la stack démarrée.

Lancé par la CI à chaque PR (job Docker) : ``docker compose exec -T backend python -m scripts.verifier_contrat_ia``.
Le backend envoie de vraies requêtes au service IA (fournisseur ``factice``, scénario ``demonstration``) avec son
propre client et ses propres schémas, puis vérifie les réponses. Aucune donnée n'est écrite en base.

Code de sortie 0 si tout est conforme, 1 sinon (le détail est affiché, sans contenu sensible).
"""

import sys
from uuid import uuid4

import httpx

from app.core.config import get_settings
from app.schemas.ia import ContexteApprenantIA, EntreeCorrectionIA, RequeteCorrectionIA
from app.services.correction_exercice import verifier_feedback
from app.services.ia import CHEMIN_CORRECTION, ErreurServiceIA, corriger_reponse_libre
from app.services.phase_parcours import phase_parcours

# Réponse fictive avec des erreurs visibles même sans LLM (majuscule initiale, point final absents).
REPONSE = "yesterday I go to the market with my sister and we buy apples"
LECONS = (1, 49, 50, 56)  # bornes de la règle de phase (US155) et une leçon de révision


def requete(lecon: int) -> RequeteCorrectionIA:
    return RequeteCorrectionIA(
        request_id=uuid4(),
        contexte=ContexteApprenantIA(
            code_langue="en", referentiel="CECRL", niveau_preliminaire="B1", lecon_atteinte=lecon
        ),
        entree=EntreeCorrectionIA(
            consigne="Write a short message to a friend.",
            enonce="Tell your friend what you did yesterday.",
            mots_minimum=10,
            reponse=REPONSE,
        ),
    )


def verifier_lecon(lecon: int) -> str | None:
    """Une correction conforme pour cette leçon, ou la raison de l'échec."""
    demande = requete(lecon)
    try:
        enveloppe = corriger_reponse_libre(demande)
    except ErreurServiceIA as erreur:
        return f"appel refusé ou réponse hors contrat ({erreur.code})"
    resultat = enveloppe.resultat
    attendue = phase_parcours(lecon).value
    if resultat.phase != attendue:
        return f"phase {resultat.phase}, attendue {attendue}"
    if not verifier_feedback(resultat, demande):
        return "feedback incohérent (leçon ou extrait)"
    if enveloppe.request_id != demande.request_id:
        return "request_id différent de celui envoyé"
    print(
        f"OK  leçon {lecon:>2} : {resultat.phase:<7} {len(resultat.erreurs)} erreur(s), "
        f"version corrigée {'oui' if resultat.reformulation else 'non'} ({enveloppe.version_prompt})"
    )
    return None


def verifier_refus_sans_lecon() -> str | None:
    """Le service IA refuse une correction sans leçon atteinte (le backend ne l'enverrait jamais)."""
    corps = requete(23).model_dump(mode="json", exclude_none=True)
    del corps["contexte"]["lecon_atteinte"]
    base = get_settings().ia_service_url.rstrip("/")
    try:
        reponse = httpx.post(f"{base}{CHEMIN_CORRECTION}", json=corps, timeout=10)
    except httpx.HTTPError as erreur:
        return f"service IA injoignable ({type(erreur).__name__})"
    code = reponse.json().get("erreur", {}).get("code") if reponse.status_code == 422 else None
    if code != "ENTREE_INVALIDE":
        return f"statut {reponse.status_code}, attendu 422 ENTREE_INVALIDE"
    print("OK  sans leçon atteinte : 422 ENTREE_INVALIDE")
    return None


def main() -> int:
    if not get_settings().ia_service_url.strip():
        print("ÉCHEC IA_SERVICE_URL n'est pas configurée dans le conteneur backend.")
        return 1
    echecs = [f"leçon {lecon} : {raison}" for lecon in LECONS if (raison := verifier_lecon(lecon))]
    if raison := verifier_refus_sans_lecon():
        echecs.append(f"sans leçon : {raison}")
    for echec in echecs:
        print(f"ÉCHEC {echec}")
    print(
        "Contrat backend ↔ service IA (correction des réponses libres) : " + ("non conforme" if echecs else "conforme")
    )
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())
