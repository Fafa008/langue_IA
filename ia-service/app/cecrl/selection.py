"""Sélection du descripteur CECRL/HSK injecté dans le prompt du tuteur.

Le récupérateur documentaire existant est réutilisé : on construit une requête déterministe filtrée par langue,
niveau et compétence. S'il ne renvoie rien ou lève ``ErreurCorpusIndisponible``, le repli synthétique déjà étiqueté
``synthetique_fallback`` / ``A_VERIFIER`` est utilisé, sans jamais attribuer de descripteur officiel inventé.
"""

from __future__ import annotations

from app.core.erreurs import ErreurCorpusIndisponible
from app.prompts.variables import DescripteurRAGPrompt
from app.rag.base import RecuperateurRAG, RequeteRAG
from app.rag.repli import descripteurs_repli
from app.schemas.regles import CodeLangue, CodeNiveau, Competence, Referentiel


async def selectionner_descripteurs(
    recuperateur: RecuperateurRAG,
    *,
    code_langue: CodeLangue,
    referentiel: Referentiel,
    niveau: CodeNiveau,
    competence: Competence = "grammaire",
    texte: str = "",
    limite: int = 1,
) -> tuple[DescripteurRAGPrompt, ...]:
    """Retourner au plus ``limite`` descripteurs du niveau, avec repli prudent."""
    requete = RequeteRAG(
        code_langue=code_langue,
        referentiel=referentiel,
        niveau=niveau,
        competences=(competence,),
        texte=texte or f"niveau {niveau} competence {competence}",
        limite=limite,
    )
    try:
        trouves = tuple(await recuperateur.rechercher(requete))
    except ErreurCorpusIndisponible:
        trouves = ()
    if trouves:
        return trouves[:limite]
    return descripteurs_repli(requete)[:limite]
