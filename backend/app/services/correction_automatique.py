"""Correction déterministe des exercices à réponse courte : QCM, texte à trous, écoute, prononciation (US43-BE).

Module pur, sans base de données ni appel à l'IA. Même réponse, même résultat : la réponse de l'apprenant est comparée
aux ``reponses`` acceptées du ``contenu`` de l'exercice, sans tenir compte de la casse, des accents, de la ponctuation
ni des espaces. Le contrat est décrit dans docs/api/contrat-frontend.md (section « Parcours personnalisé »).
"""

import unicodedata
from typing import Any

from app.schemas.parcours import CorrectionExerciceOut

# Formats corrigés sans l'IA. La conversation et la rédaction restent du ressort du service IA.
FORMATS_AUTOMATIQUES = frozenset({"choix", "texte", "ecoute", "prononciation"})

# Score d'une correction déterministe : une réponse acceptée vaut 100, sinon 0 (pas de notion intermédiaire).
SCORE_JUSTE = 100
SCORE_FAUX = 0


def normaliser(texte: str) -> str:
    """Forme comparable d'une réponse : sans accents, sans ponctuation, en minuscules, espaces réduits.

    La ponctuation est supprimée (et non remplacée par un espace) : « j'ai » et « jai » sont alors équivalents.
    """
    decompose = unicodedata.normalize("NFKD", texte)
    sans_accents = "".join(caractere for caractere in decompose if not unicodedata.combining(caractere))
    sans_ponctuation = "".join(c for c in sans_accents if not unicodedata.category(c).startswith("P"))
    return " ".join(sans_ponctuation.casefold().split())


def reponses_acceptees(contenu: dict[str, Any]) -> list[str]:
    """Les réponses acceptées, dans l'ordre du contenu. Lève ``ValueError`` si elles manquent ou sont invalides."""
    reponses = contenu.get("reponses")
    if not isinstance(reponses, list) or not reponses:
        raise ValueError("reponses absentes")
    if not all(isinstance(reponse, str) and normaliser(reponse) for reponse in reponses):
        raise ValueError("reponses invalides")
    return reponses


def corriger_automatiquement(contenu: dict[str, Any], reponse: str) -> CorrectionExerciceOut:
    """Corrige une réponse sans l'IA. Lève ``ValueError`` si le contenu ne contient pas de réponses acceptées.

    Champs propres à la phase et à l'IA (``phase``, ``lecon_atteinte``, ``reformulation``) : absents, la correction
    automatique ne les produit pas. ``reponse_attendue`` n'est renvoyée que si la réponse est fausse.
    """
    acceptees = reponses_acceptees(contenu)
    juste = normaliser(reponse) in {normaliser(acceptee) for acceptee in acceptees}
    explication = contenu.get("explication")
    return CorrectionExerciceOut(
        statut="REUSSI" if juste else "A_REVOIR",
        score_obtenu=SCORE_JUSTE if juste else SCORE_FAUX,
        mode_correction="AUTOMATIQUE",
        commentaire="Bonne réponse." if juste else "Ce n'est pas la bonne réponse.",
        reponse_attendue=None if juste else acceptees[0],
        explication=explication if isinstance(explication, str) else None,
    )
