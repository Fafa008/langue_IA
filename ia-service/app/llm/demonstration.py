"""Réponses de démonstration du fournisseur ``factice`` (tâche I-01).

Sans clé LLM, ``LLM_FOURNISSEUR=factice`` échouait à chaque diagnostic (aucun scénario) : la démonstration
retombait toujours en « résultat partiel ». Avec ``LLM_FACTICE_SCENARIO=demonstration``, le faux client répond au
prompt d'évaluation diagnostic par un résultat **valide au sens du schéma**, **déterministe** (mêmes entrées, même
sortie) et **sans appel réseau**, calculé à partir des données que le prompt transmet.

Le résultat ne prétend pas être une analyse : chaque point faible annonce qu'il vient d'une démonstration, à
confirmer avec un vrai fournisseur. Le factice reste interdit en production (``ConfigLLM``).
"""

import json
from collections.abc import Sequence

from pydantic import BaseModel

from app.llm.base import MessageLLM
from app.schemas.diagnostic import (
    PhaseAssimil,
    PointFaible,
    PreuveReponse,
    ResultatDiagnostic,
    calculer_ecart,
    preuve_directe,
)
from app.schemas.regles import niveaux_du_referentiel

BALISE_OUVRANTE = "<donnees_diagnostic_non_fiables>"
BALISE_FERMANTE = "</donnees_diagnostic_non_fiables>"

SCORE_NIVEAU_SUPERIEUR = 85.0
SCORE_NIVEAU_INFERIEUR = 30.0
SCORE_ACTIVATION = 60.0
SCORE_CONFIANCE = 0.5
POINTS_FAIBLES_MAX = 2

# Domaine de faiblesse observable sur une production libre, selon la compétence de la question.
_DOMAINE_PAR_COMPETENCE = {
    "ecrit": "expression_ecrite",
    "oral": "expression_orale",
    "lecture": "comprehension_ecrite",
    "ecoute": "comprehension_orale",
    "grammaire": "grammaire",
}

OBSERVATION = "Production libre retenue pour la démonstration (question {id_question})."
JUSTIFICATION = (
    "Analyse de démonstration sans modèle de langue (fournisseur factice) : "
    "ce point est à confirmer avec un vrai fournisseur LLM."
)


def _donnees_diagnostic(messages: Sequence[MessageLLM]) -> dict | None:
    """Relire le bloc JSON des données du diagnostic dans le message utilisateur, ou ``None`` s'il est absent."""
    for message in messages:
        if message.role != "user":
            continue
        debut = message.contenu.find(BALISE_OUVRANTE)
        fin = message.contenu.find(BALISE_FERMANTE)
        if debut == -1 or fin == -1:
            continue
        try:
            donnees = json.loads(message.contenu[debut + len(BALISE_OUVRANTE) : fin])
        except ValueError:
            return None
        return donnees if isinstance(donnees, dict) else None
    return None


def _niveau_estime(referentiel: str, niveau_preliminaire: str, score: float) -> str:
    """Un niveau au-dessus pour un score très haut, un niveau en dessous pour un score très bas, sinon le même."""
    niveaux = niveaux_du_referentiel(referentiel)
    position = niveaux.index(niveau_preliminaire)
    if score >= SCORE_NIVEAU_SUPERIEUR and position + 1 < len(niveaux):
        return niveaux[position + 1]
    if score < SCORE_NIVEAU_INFERIEUR and position > 0:
        return niveaux[position - 1]
    return niveau_preliminaire


def _points_faibles(preuves: list[PreuveReponse]) -> list[PointFaible]:
    """Au plus deux domaines distincts, chacun cité sur une réponse qui en est une preuve directe."""
    points: list[PointFaible] = []
    for preuve in preuves:
        domaine = _DOMAINE_PAR_COMPETENCE.get(preuve.competence)
        if domaine is None or not preuve_directe(domaine, preuve) or any(p.domaine == domaine for p in points):
            continue
        points.append(
            PointFaible(
                domaine=domaine,
                id_question=preuve.id_question,
                observation=OBSERVATION.format(id_question=preuve.id_question),
                justification=JUSTIFICATION,
            )
        )
        if len(points) == POINTS_FAIBLES_MAX:
            break
    return points


def resultat_diagnostic_demonstration(messages: Sequence[MessageLLM]) -> ResultatDiagnostic | None:
    """Construire le résultat de démonstration à partir du prompt, ou ``None`` s'il ne s'agit pas d'un diagnostic."""
    donnees = _donnees_diagnostic(messages)
    if donnees is None:
        return None
    contexte = donnees["contexte_apprenant"]
    referentiel = contexte["referentiel"]
    niveau_preliminaire = contexte["niveau_preliminaire"]
    score = float(donnees["score_preliminaire"])
    preuves = [
        PreuveReponse(id_question=r["id_question"], competence=r["competence"], type_reponse=r["type_reponse"])
        for r in donnees["reponses"]
    ]
    production = any(preuve.type_reponse in ("texte", "audio") for preuve in preuves)
    niveau_estime = _niveau_estime(referentiel, niveau_preliminaire, score)
    # Comme le schéma l'exige, l'activation suppose au moins une production libre
    phase = PhaseAssimil.ACTIVATION if production and score >= SCORE_ACTIVATION else PhaseAssimil.IMPREGNATION

    return ResultatDiagnostic(
        code_langue=contexte["code_langue"],
        referentiel=referentiel,
        niveau_estime=niveau_estime,
        phase_assimil=phase,
        points_faibles=_points_faibles(preuves),
        score_confiance=SCORE_CONFIANCE,
        niveau_preliminaire=niveau_preliminaire,
        ecart_avec_niveau_preliminaire=calculer_ecart(referentiel, niveau_preliminaire, niveau_estime),
    )


def repondre_demonstration(messages: Sequence[MessageLLM], schema: type[BaseModel]) -> BaseModel | None:
    """Répondeur du faux client : seul le schéma ``ResultatDiagnostic`` a une réponse de démonstration."""
    if schema is not ResultatDiagnostic:
        return None
    return resultat_diagnostic_demonstration(messages)
