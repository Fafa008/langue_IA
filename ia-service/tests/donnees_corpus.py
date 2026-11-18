"""Corpus CECRL synthétique pour les tests : aucun descripteur officiel n'est recopié.

Les textes sont inventés et volontairement distincts lexicalement, afin de vérifier le classement, le filtrage et
les projections de contrat sans dépendre d'un document sous droits.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date
from pathlib import Path

from app.rag.corpus import (
    DescripteurCorpus,
    LicenceCorpus,
    ManifesteCorpus,
    SourceOfficielle,
    composer_manifeste,
    serialiser_descripteurs,
)

SOURCE_SYNTHETIQUE = SourceOfficielle(
    oeuvre="Corpus synthétique de test",
    editeur="Tests PRE-08",
    annee=2020,
    url="https://example.test/corpus",
    format="JSONL",
    empreinte_sha256="0" * 64,
)

LICENCE_SYNTHETIQUE = LicenceCorpus(
    statut="non_clarifiee",
    citation="© Conseil de l'Europe, 2020",
    note="Données de test, aucun contenu officiel.",
)


def descripteur(
    source_no: int,
    *,
    contenu: str,
    echelle: str = "Conversation",
    competence: str = "oral",
    niveau: str = "B1",
    sous_niveau: str | None = None,
    langue: str = "en",
) -> DescripteurCorpus:
    """Construire un descripteur synthétique cohérent."""
    return DescripteurCorpus(
        identifiant=f"cecrl:{langue}:2020:{source_no:04d}",
        code_langue=langue,
        referentiel="CECRL",
        niveau=niveau,
        sous_niveau=sous_niveau or niveau,
        competence=competence,
        echelle=echelle,
        contenu=contenu,
        source_no=source_no,
    )


def corpus_synthetique() -> tuple[DescripteurCorpus, ...]:
    """Jeu de descripteurs couvrant langues, niveaux, compétences et sous-niveau."""
    return (
        descripteur(10, contenu="Can talk about holidays and travel plans with friends."),
        descripteur(11, contenu="Can describe daily routines and habits."),
        descripteur(
            12,
            contenu="Can understand short articles about holidays and travel.",
            echelle="Reading for information and argument",
            competence="lecture",
        ),
        descripteur(
            13,
            contenu="Can write a short email about travel.",
            echelle="Correspondence",
            competence="ecrit",
        ),
        descripteur(
            14,
            contenu="Uses past tense forms with reasonable accuracy.",
            echelle="Grammatical accuracy",
            competence="grammaire",
        ),
        descripteur(
            15,
            contenu="Has a good range of vocabulary about holidays and travel.",
            echelle="Vocabulary range",
            competence="lexique",
        ),
        descripteur(
            16,
            contenu="Can greet people and introduce myself.",
            niveau="A2",
        ),
        descripteur(
            17,
            contenu="Can take part in a conversation about holidays.",
            sous_niveau="B1+",
        ),
        descripteur(
            18,
            contenu="Peut raconter un voyage en détail.",
            niveau="B2",
            langue="fr",
        ),
    )


def manifeste(
    descripteurs: Sequence[DescripteurCorpus],
    *,
    version: str = "cecrl-test.1",
) -> ManifesteCorpus:
    """Manifeste cohérent avec les descripteurs fournis."""
    return composer_manifeste(
        descripteurs,
        version=version,
        edition="2020",
        source=SOURCE_SYNTHETIQUE,
        licence=LICENCE_SYNTHETIQUE,
        genere_le=date(2026, 11, 11),
    )


def ecrire(
    dossier: Path,
    descripteurs: Sequence[DescripteurCorpus],
    *,
    manifeste_corpus: ManifesteCorpus | None = None,
) -> ManifesteCorpus:
    """Écrire un corpus complet dans ``dossier``, au format exact attendu par le chargeur."""
    manifeste_final = manifeste_corpus or manifeste(descripteurs)
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / "manifeste.json").write_bytes((manifeste_final.model_dump_json(indent=2) + "\n").encode("utf-8"))
    (dossier / "descripteurs.jsonl").write_bytes(serialiser_descripteurs(descripteurs))
    return manifeste_final
