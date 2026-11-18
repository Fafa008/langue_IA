"""Tests du repli documentaire synthetique (US150-B)."""

import asyncio

import pytest

from app.core.erreurs import ErreurCorpusIndisponible
from app.prompts.variables import DescripteurRAGPrompt
from app.rag.base import PREFIXE_IDENTIFIANT_SYNTHETIQUE, RequeteRAG
from app.rag.repli import RecuperateurAvecRepli, descripteurs_repli, est_descripteur_synthetique


def requete_rag(**surcharges: object) -> RequeteRAG:
    valeurs = {
        "code_langue": "en",
        "referentiel": "CECRL",
        "niveau": "B1",
        "competences": ("grammaire", "lecture", "ecoute", "ecrit", "oral"),
        "limite": 8,
    }
    valeurs.update(surcharges)
    return RequeteRAG.model_validate(valeurs)


class RecuperateurControle:
    """Récupérateur minimal pour vérifier la délégation du decorateur."""

    nom = "controle"
    version_corpus = "correel.1"

    def __init__(self, descripteurs: tuple[DescripteurRAGPrompt, ...] = (), *, erreur: Exception | None = None):
        self.descripteurs = descripteurs
        self.erreur = erreur
        self.ferme = False
        self.requete: RequeteRAG | None = None

    async def rechercher(self, requete: RequeteRAG) -> tuple[DescripteurRAGPrompt, ...]:
        self.requete = requete
        if self.erreur is not None:
            raise self.erreur
        return self.descripteurs

    async def fermer(self) -> None:
        self.ferme = True


def descripteur_reel() -> DescripteurRAGPrompt:
    return DescripteurRAGPrompt(
        identifiant="cecrl:en:B1:ecrit",
        code_langue="en",
        referentiel="CECRL",
        niveau="B1",
        competence="ecrit",
        contenu="Peut ecrire un texte simple sur un sujet familier.",
    )


def test_descripteurs_repli_sont_synthetiques_bornes_et_non_officiels() -> None:
    descripteurs = descripteurs_repli(requete_rag(limite=3))

    assert len(descripteurs) == 3
    assert len({descripteur.identifiant for descripteur in descripteurs}) == 3
    assert all(est_descripteur_synthetique(descripteur) for descripteur in descripteurs)
    assert all(descripteur.referentiel == "CECRL" for descripteur in descripteurs)
    assert all(descripteur.niveau == "B1" for descripteur in descripteurs)
    assert all("Provenance : synthetique_fallback" in descripteur.contenu for descripteur in descripteurs)
    assert all("non officiel" in descripteur.contenu for descripteur in descripteurs)
    assert all("ne pas l'attribuer a un referentiel officiel" in descripteur.contenu for descripteur in descripteurs)


def test_aucun_repli_pour_le_hsk() -> None:
    requete = requete_rag(code_langue="zh", referentiel="HSK", niveau="HSK 2")

    assert descripteurs_repli(requete) == ()


def test_aucun_repli_pour_une_langue_sans_catalogue() -> None:
    requete = RequeteRAG.model_construct(
        code_langue="es",
        referentiel="CECRL",
        niveau="B1",
        competences=("ecrit",),
        limite=8,
    )

    assert descripteurs_repli(requete) == ()


def test_decorateur_preserve_les_descripteurs_reels_et_delegue() -> None:
    reel = descripteur_reel()
    principal = RecuperateurControle((reel,))
    decorateur = RecuperateurAvecRepli(principal)
    requete = requete_rag()

    resultat = asyncio.run(decorateur.rechercher(requete))

    assert resultat == (reel,)
    assert decorateur.version_corpus == "correel.1"
    assert principal.requete is requete
    asyncio.run(decorateur.fermer())
    assert principal.ferme is True


def test_decorateur_replie_sur_une_liste_vide() -> None:
    principal = RecuperateurControle(())
    decorateur = RecuperateurAvecRepli(principal)

    resultat = asyncio.run(decorateur.rechercher(requete_rag()))

    assert resultat == descripteurs_repli(requete_rag())
    assert all(descripteur.identifiant.startswith(PREFIXE_IDENTIFIANT_SYNTHETIQUE) for descripteur in resultat)


def test_decorateur_absorbe_un_corpus_indisponible() -> None:
    principal = RecuperateurControle((), erreur=ErreurCorpusIndisponible("Corps absent."))
    decorateur = RecuperateurAvecRepli(principal)

    resultat = asyncio.run(decorateur.rechercher(requete_rag()))

    assert len(resultat) == 5
    assert all(est_descripteur_synthetique(descripteur) for descripteur in resultat)


def test_decorateur_ne_absorbe_pas_une_autre_erreur_service() -> None:
    principal = RecuperateurControle((), erreur=ValueError("Autre panne."))
    decorateur = RecuperateurAvecRepli(principal)

    with pytest.raises(ValueError, match="Autre panne"):
        asyncio.run(decorateur.rechercher(requete_rag()))
