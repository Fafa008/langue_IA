"""Réponses de démonstration du fournisseur ``factice`` (tâche I-01).

Sans clé LLM, ``LLM_FOURNISSEUR=factice`` échouait à chaque diagnostic (aucun scénario) : la démonstration
retombait toujours en « résultat partiel ». Avec ``LLM_FACTICE_SCENARIO=demonstration``, le faux client répond au
prompt d'évaluation diagnostic par un résultat **valide au sens du schéma**, **déterministe** (mêmes entrées, même
sortie) et **sans appel réseau**, calculé à partir des données que le prompt transmet.

Le résultat ne prétend pas être une analyse : chaque point faible annonce qu'il vient d'une démonstration, à
confirmer avec un vrai fournisseur. Le factice reste interdit en production (``ConfigLLM``).

US157 : le prompt de correction d'une réponse libre reçoit de la même façon un feedback de démonstration, conforme
au contrat v2 (phase passive ou active), qui ne vérifie que la majuscule initiale, la ponctuation finale et la
longueur, et le dit dans son commentaire.

US74 : le chat reçoit aussi une réponse de démonstration déterministe avec au plus trois corrections en marge,
uniquement sur des règles visibles (majuscule, ponctuation, espaces) ; elle annonce toujours son origine.
"""

import json
import math
from collections.abc import Sequence

from pydantic import BaseModel

from app.llm.base import MessageLLM
from app.schemas.chatbot import (
    CORRECTIONS_CHATBOT_MAX,
    EXPLICATION_CORRECTION_MAX,
    EXTRAIT_CORRECTION_MAX,
    CorrectionChatbot,
    ResultatChatbot,
)
from app.schemas.correction import EXTRAIT_MAX, ErreurRelevee, ResultatCorrection
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
BALISE_CORRECTION = "donnees_correction_non_fiables"
BALISE_CONVERSATION = "donnees_conversation_non_fiables"

SCORE_NIVEAU_SUPERIEUR = 85.0
SCORE_NIVEAU_INFERIEUR = 30.0
SCORE_ACTIVATION = 60.0
SCORE_CONFIANCE = 0.5
POINTS_FAIBLES_MAX = 2
PONCTUATION_FINALE = ".!?…。！？"

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


def _donnees_diagnostic(
    messages: Sequence[MessageLLM],
    ouvrante: str = BALISE_OUVRANTE,
    fermante: str = BALISE_FERMANTE,
) -> dict | None:
    """Relire le bloc JSON des données du prompt dans le message utilisateur, ou ``None`` s'il est absent."""
    for message in messages:
        if message.role != "user":
            continue
        debut = message.contenu.find(ouvrante)
        fin = message.contenu.find(fermante)
        if debut == -1 or fin == -1:
            continue
        try:
            donnees = json.loads(message.contenu[debut + len(ouvrante) : fin])
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


COMMENTAIRE_CORRECTION = (
    "Correction de démonstration sans modèle de langue (fournisseur factice) : seules la majuscule, la "
    "ponctuation finale et la longueur sont vérifiées."
)
CONSEIL_CORRECTION = {
    "PASSIVE": "Relisez la leçon du jour à voix haute en repérant les formes corrigées.",
    "ACTIVE": "Comparez votre texte à la version corrigée, puis réécrivez-le sans la regarder.",
}


def resultat_correction_demonstration(messages: Sequence[MessageLLM]) -> ResultatCorrection | None:
    """Feedback de démonstration d'une réponse libre, ou ``None`` s'il ne s'agit pas d'une correction (US157)."""
    donnees = _donnees_diagnostic(messages, f"<{BALISE_CORRECTION}>", f"</{BALISE_CORRECTION}>")
    if donnees is None:
        return None
    phase = donnees["phase"]
    exercice = donnees["exercice"]
    texte = " ".join(exercice["reponse"].split())
    mots = texte.split(" ")
    mots_minimum = exercice["mots_minimum"]

    erreurs: list[ErreurRelevee] = []
    if texte[0].isalpha() and texte[0].islower() and len(mots[0]) <= EXTRAIT_MAX:
        erreurs.append(
            ErreurRelevee(
                extrait=mots[0],
                correction=mots[0][0].upper() + mots[0][1:],
                explication="Une phrase commence par une majuscule.",
            )
        )
    dernier = mots[-1]
    deja_releve = any(e.extrait.casefold() == dernier.casefold() for e in erreurs)
    if texte[-1] not in PONCTUATION_FINALE and len(dernier) < EXTRAIT_MAX and not deja_releve:
        erreurs.append(
            ErreurRelevee(extrait=dernier, correction=f"{dernier}.", explication="Terminez la phrase par un point.")
        )

    manque = max(0, mots_minimum - len(mots))
    score = max(0, min(100, 100 - 15 * len(erreurs) - math.ceil(manque / mots_minimum * 50)))
    reformulation = None
    if phase == "ACTIVE" and erreurs:
        reformulation = texte[0].upper() + texte[1:]
        if reformulation[-1] not in PONCTUATION_FINALE:
            reformulation += "."

    return ResultatCorrection(
        phase=phase,
        lecon_atteinte=donnees["contexte_apprenant"]["lecon_atteinte"],
        score=score,
        commentaire=COMMENTAIRE_CORRECTION,
        points_forts=[f"Réponse assez développée ({len(mots)} mots)."] if manque == 0 else [],
        erreurs=erreurs,
        reformulation=reformulation,
        conseil=(
            f"Développez votre réponse : au moins {mots_minimum} mots (il en manque {manque})."
            if manque
            else CONSEIL_CORRECTION[phase]
        ),
    )


COMMENTAIRE_CHATBOT = "Réponse de démonstration sans modèle de langue (fournisseur factice)."
EXPLICATION_CORRECTION_CHATBOT = (
    "Vérification simple de démonstration : un modèle de langue confirmerait cette correction."
)


def _ajouter_correction(
    corrections: list[CorrectionChatbot],
    extrait: str,
    correction: str,
    explication: str = EXPLICATION_CORRECTION_CHATBOT,
) -> None:
    """Ajouter une correction visible si elle tient dans le contrat et si la limite n'est pas atteinte."""
    if len(corrections) >= CORRECTIONS_CHATBOT_MAX:
        return
    if not extrait.strip() or not correction.strip():
        return
    corrections.append(
        CorrectionChatbot(
            extrait=extrait[:EXTRAIT_CORRECTION_MAX],
            correction=correction[:EXTRAIT_CORRECTION_MAX],
            explication=explication[:EXPLICATION_CORRECTION_MAX],
        )
    )


def resultat_chatbot_demonstration(messages: Sequence[MessageLLM]) -> ResultatChatbot | None:
    """Réponse et corrections de démonstration du chat (US74), ou ``None`` hors prompt de conversation."""
    donnees = _donnees_diagnostic(messages, f"<{BALISE_CONVERSATION}>", f"</{BALISE_CONVERSATION}>")
    if donnees is None:
        return None
    texte = " ".join(str(donnees["message"]).split())
    corrections: list[CorrectionChatbot] = []

    if texte[:1].isalpha() and texte[:1].islower():
        premier = texte.split(" ")[0]
        _ajouter_correction(corrections, premier, premier[0].upper() + premier[1:])

    if texte and texte[-1] not in PONCTUATION_FINALE:
        dernier = texte.split(" ")[-1]
        _ajouter_correction(corrections, dernier, f"{dernier}.")

    brut = str(donnees["message"])
    if "  " in brut:
        _ajouter_correction(
            corrections,
            brut[:EXTRAIT_CORRECTION_MAX],
            texte[:EXTRAIT_CORRECTION_MAX],
            "Un seul espace suffit entre deux mots.",
        )

    propositions = ", ".join(correction.correction for correction in corrections)
    reponse = COMMENTAIRE_CHATBOT
    if propositions:
        reponse += f" Forme(s) proposée(s) : {propositions}."
    reponse += " Réessayez avec la forme corrigée ; la conversation continue normalement."

    return ResultatChatbot(reponse=reponse, corrections=corrections)


def repondre_demonstration(messages: Sequence[MessageLLM], schema: type[BaseModel]) -> BaseModel | None:
    """Répondeur du faux client : diagnostic, correction libre et chat ont une démonstration."""
    if schema is ResultatDiagnostic:
        return resultat_diagnostic_demonstration(messages)
    if schema is ResultatCorrection:
        return resultat_correction_demonstration(messages)
    if schema is ResultatChatbot:
        return resultat_chatbot_demonstration(messages)
    return None
