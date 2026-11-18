"""Repli documentaire synthetique de l'agent Diagnostic (US150-B)."""

from __future__ import annotations

import logging

from app.core.erreurs import ErreurCorpusIndisponible
from app.prompts.variables import DescripteurRAGPrompt
from app.rag.base import (
    PREFIXE_IDENTIFIANT_SYNTHETIQUE,
    PROVENANCE_SYNTHETIQUE,
    RecuperateurRAG,
    RequeteRAG,
)
from app.schemas.regles import Competence

logger = logging.getLogger(__name__)

# Repères pédagogiques originaux, écrits pour ce projet. Aucun texte n'est tiré d'un document CECRL/HSK.
# La clé est la compétence du contrat interne ; le niveau vient de la requête mais n'est jamais certifié ici.
_REPERES: dict[str, dict[Competence, str]] = {
    "fr": {
        "grammaire": "Repere synthetique : une production ecrite peut etre relue pour verifier l'accord sujet-verbe.",
        "lecture": "Repere synthetique : une reponse personnelle peut montrer qu'un court passage ecrit a ete compris.",
        "ecoute": "Repere synthetique : une reformulation breve peut montrer qu'un message oral court a ete percu.",
        "ecrit": "Repere synthetique : une ou deux phrases personnelles peuvent etre ecrites sur un sujet familier.",
        "oral": "Repere synthetique : une reponse orale peut employer des mots personnels plutot qu'une repetition.",
    },
    "en": {
        "grammaire": "Synthetic cue: a written production can be reviewed for subject-verb agreement.",
        "lecture": "Synthetic cue: a personal answer can show that the main idea of a short text was understood.",
        "ecoute": "Synthetic cue: a brief paraphrase can show that a short spoken message was understood.",
        "ecrit": "Synthetic cue: one or two personal sentences can be written about a familiar topic.",
        "oral": "Synthetic cue: a spoken answer can use personal wording instead of simple repetition.",
    },
    "it": {
        "grammaire": "Repere sintetico: una produzione scritta puo essere riletta per verificare l'accordo.",
        "lecture": "Repere sintetico: una risposta personale puo mostrare che un breve testo scritto e stato compreso.",
        "ecoute": "Repere sintetico: una breve parafrasi puo mostrare che un messaggio orale breve e stato compreso.",
        "ecrit": "Repere sintetico: una o due frasi personali possono essere scritte su un argomento familiare.",
        "oral": "Repere sintetico: una risposta orale puo usare parole personali invece di una semplice ripetizione.",
    },
    "de": {
        "grammaire": "Syntetischer Hinweis: Ein schriftlicher Text kann auf Kongruenz und Zeitformen geprueft werden.",
        "lecture": "Syntetischer Hinweis: Eine persoenliche Antwort kann die Hauptidee eines kurzen Textes zeigen.",
        "ecoute": "Syntetischer Hinweis: Eine kurze Paraphrase kann das Verstehen einer kurzen Nachricht zeigen.",
        "ecrit": "Syntetischer Hinweis: Ein oder zwei persoenliche Saetze koennen zu einem vertrauten Thema entstehen.",
        "oral": "Syntetischer Hinweis: Eine mundliche Antwort kann eigene Formulierungen statt Wiederholung nutzen.",
    },
}


def est_descripteur_synthetique(descripteur: DescripteurRAGPrompt) -> bool:
    """Indiquer si un descripteur provient du repli et non d'un corpus valide."""
    return descripteur.identifiant.startswith(PREFIXE_IDENTIFIANT_SYNTHETIQUE)


def descripteurs_repli(requete: RequeteRAG) -> tuple[DescripteurRAGPrompt, ...]:
    """Construire des reperes synthetiques pour une requete RAG sans resultat.

    Seul le CECRL dispose de reperes de repli. Le HSK, faute de contenu original suffisant, ne recoit rien :
    l'agent signalera alors ``A_VERIFIER`` au lieu d'inventer une reference. Les identifiants sont prefixes et
    chaque contenu rappelle explicitement qu'il n'est pas un descripteur officiel.
    """
    if requete.referentiel != "CECRL":
        return ()
    reperes = _REPERES.get(requete.code_langue)
    if not reperes:
        return ()

    resultats: list[DescripteurRAGPrompt] = []
    for competence in requete.competences[: requete.limite]:
        texte = reperes.get(competence)
        if not texte:
            continue
        contenu = (
            f"{texte} Provenance : {PROVENANCE_SYNTHETIQUE}. "
            "Repere pedagogique original, non officiel et non valide ; "
            "ne pas l'attribuer a un referentiel officiel."
        )
        resultats.append(
            DescripteurRAGPrompt(
                identifiant=f"{PREFIXE_IDENTIFIANT_SYNTHETIQUE}{requete.code_langue}:" f"{requete.niveau}:{competence}",
                code_langue=requete.code_langue,
                referentiel=requete.referentiel,
                niveau=requete.niveau,
                competence=competence,
                contenu=contenu,
            )
        )
    return tuple(resultats)


class RecuperateurAvecRepli:
    """Decorateur de ``RecuperateurRAG`` : preserve le corpus reel et ne replie que sur vide."""

    nom = "repli-synthetique"

    def __init__(self, principal: RecuperateurRAG) -> None:
        self._principal = principal

    @property
    def version_corpus(self) -> str | None:
        """Conserver l'etiquette du corpus reel tant qu'il repond."""
        return self._principal.version_corpus

    async def rechercher(self, requete: RequeteRAG) -> tuple[DescripteurRAGPrompt, ...]:
        """Retourner les descripteurs reels s'ils existent, sinon les reperes synthetiques."""
        try:
            bruts = tuple(await self._principal.rechercher(requete))
        except ErreurCorpusIndisponible:
            logger.warning("Corpus indisponible : repli synthetique (langue=%s).", requete.code_langue)
            bruts = ()
        if bruts:
            return bruts
        return descripteurs_repli(requete)

    async def fermer(self) -> None:
        """Deleguer la liberation des ressources au recuperateur wrappe."""
        await self._principal.fermer()
