"""Corpus CECRL extrait des PDF du volume complémentaire (US150-C) : manifeste, descripteurs et chargement.

Le corpus est un **artefact généré hors du dépôt** par ``scripts/ingestion_pdf_cecrl.py`` à partir des éditions PDF
du *CECR — Volume complémentaire* (Conseil de l'Europe), puis monté en lecture seule dans le conteneur. Les PDF et
le fichier ``descripteurs.jsonl`` ne sont jamais versionnés : leurs droits de réutilisation ne sont pas clarifiés par
écrit (voir ``docs/US150_A_AUDIT_PDF_CECRL.md``). Le service ne le charge qu'avec ``RAG_CORPUS_OFFICIEL_AUTORISE``.

Différences avec le corpus du classeur (:mod:`app.rag.corpus`) :

- la provenance d'un descripteur est sa **page PDF** et sa **section**, pas une ligne de classeur ;
- un même corpus peut contenir plusieurs éditions (français, italien, allemand, anglais) : la langue d'un
  descripteur est celle du **document**, distincte de la langue apprise. Un descripteur CECRL décrit une capacité
  valable pour toute langue ; le récupérateur choisit l'édition la plus proche de la langue de l'apprenant.

Comme pour le corpus officiel, le manifeste fait foi : une empreinte, un comptage ou une référence de document
incohérents lèvent ``ErreurCorpusIndisponible`` plutôt que de servir un index partiel.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import Field, ValidationError, model_validator

from app.core.erreurs import ErreurCorpusIndisponible
from app.rag.corpus import SHA256, VERSION_MAX, CompetenceCorpus, Comptages, LicenceCorpus
from app.schemas.base import ModeleStrict
from app.schemas.regles import NiveauCecrl, erreur

FICHIER_MANIFESTE = "manifeste.json"
FICHIER_DESCRIPTEURS = "descripteurs.jsonl"
TYPE_CORPUS_PDF = "cecrl-pdf"
PREFIXE_IDENTIFIANT_PDF = "cecrlpdf:"

# Éditions du CECR dont la langue est une langue CECRL du service ; le mandarin relève du HSK.
LangueDocument = Literal["fr", "en", "it", "de"]
LANGUES_DOCUMENT: tuple[LangueDocument, ...] = ("fr", "en", "it", "de")


class DocumentPdf(ModeleStrict):
    """Un PDF source, identifié par son empreinte : le manifeste ne contient aucun texte sous droits."""

    identifiant: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{0,39}$")
    titre: str = Field(min_length=1, max_length=200)
    fichier: str = Field(min_length=1, max_length=200)
    langue: LangueDocument
    pages: int = Field(ge=1, le=5000)
    empreinte_sha256: str = Field(pattern=SHA256)


class DescripteurPdf(ModeleStrict):
    """Un descripteur extrait d'une grille de niveaux, avec sa provenance exacte (document, page, section)."""

    identifiant: str = Field(pattern=r"^cecrlpdf:(fr|en|it|de):[0-9]{5}$", max_length=32)
    langue_document: LangueDocument
    document: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{0,39}$")
    niveau: NiveauCecrl
    sous_niveau: str = Field(pattern=r"^(A1|A2|B1|B2|C1|C2)\+?$")
    competence: CompetenceCorpus
    section: str = Field(pattern=r"^[0-9]{1,2}(\.[0-9]{1,2}){1,4}$")
    echelle: str = Field(min_length=1, max_length=160)
    contenu: str = Field(min_length=1, max_length=3000)
    page: int = Field(ge=1, le=5000)

    @model_validator(mode="after")
    def verifier_coherence(self) -> DescripteurPdf:
        """L'identifiant porte la langue du document et le sous-niveau se projette sur le niveau."""
        if self.identifiant.split(":")[1] != self.langue_document:
            raise erreur("L'identifiant du descripteur ne correspond pas à la langue de son document.")
        if self.sous_niveau.rstrip("+") != self.niveau:
            raise erreur("Le sous-niveau du descripteur ne se projette pas sur son niveau.")
        return self


class ManifestePdf(ModeleStrict):
    """Métadonnées du corpus PDF : documents sources, licence, comptages et empreinte des descripteurs."""

    version: str = Field(min_length=3, max_length=VERSION_MAX, pattern=r"^[a-z0-9][a-z0-9._-]*$")
    type: Literal["cecrl-pdf"] = TYPE_CORPUS_PDF
    genere_le: date
    documents: tuple[DocumentPdf, ...] = Field(min_length=1)
    licence: LicenceCorpus
    langues: tuple[LangueDocument, ...] = Field(min_length=1)
    comptages: Comptages
    empreinte_descripteurs_sha256: str = Field(pattern=SHA256)

    @model_validator(mode="after")
    def verifier_documents(self) -> ManifestePdf:
        """Identifiants de documents uniques et langues déclarées couvertes par au moins un document."""
        identifiants = [document.identifiant for document in self.documents]
        if len(set(identifiants)) != len(identifiants):
            raise erreur("Deux documents du manifeste portent le même identifiant.")
        if set(self.langues) - {document.langue for document in self.documents}:
            raise erreur("Une langue du manifeste n'est couverte par aucun document.")
        return self


def serialiser_descripteurs(descripteurs: Sequence[DescripteurPdf]) -> bytes:
    """JSONL UTF-8 à fins de ligne LF, dans l'ordre fourni : l'empreinte est reproductible."""
    return "".join(
        json.dumps(d.model_dump(), ensure_ascii=False, separators=(",", ":")) + "\n" for d in descripteurs
    ).encode("utf-8")


def compter(descripteurs: Iterable[DescripteurPdf]) -> Comptages:
    """Comptages par niveau et par compétence, dans un ordre stable."""
    liste = tuple(descripteurs)
    par_niveau = Counter(d.niveau for d in liste)
    par_competence = Counter(d.competence for d in liste)
    return Comptages(
        total=len(liste),
        par_niveau=dict(sorted(par_niveau.items())),
        par_competence=dict(sorted(par_competence.items())),
    )


def composer_manifeste(
    descripteurs: Sequence[DescripteurPdf],
    *,
    version: str,
    documents: Sequence[DocumentPdf],
    licence: LicenceCorpus,
    genere_le: date | None = None,
) -> ManifestePdf:
    """Construire le manifeste d'un ensemble de descripteurs déjà validés."""
    langues = tuple(langue for langue in LANGUES_DOCUMENT if any(d.langue_document == langue for d in descripteurs))
    return ManifestePdf(
        version=version,
        genere_le=genere_le or date.today(),
        documents=tuple(documents),
        licence=licence,
        langues=langues or tuple(dict.fromkeys(document.langue for document in documents)),
        comptages=compter(descripteurs),
        empreinte_descripteurs_sha256=hashlib.sha256(serialiser_descripteurs(descripteurs)).hexdigest(),
    )


def _erreur(detail: str) -> ErreurCorpusIndisponible:
    """Message technique sans contenu de descripteur : il peut être journalisé."""
    return ErreurCorpusIndisponible(f"Corpus CECRL PDF invalide : {detail}")


@dataclass(frozen=True, slots=True)
class CorpusPdf:
    """Corpus PDF chargé et validé, prêt à être indexé."""

    manifeste: ManifestePdf
    descripteurs: tuple[DescripteurPdf, ...]

    @property
    def version(self) -> str:
        return self.manifeste.version

    def document(self, identifiant: str) -> DocumentPdf:
        """Document source d'un descripteur (toujours présent : vérifié au chargement)."""
        return next(document for document in self.manifeste.documents if document.identifiant == identifiant)

    @classmethod
    def charger(cls, dossier: Path, *, verifier_empreinte: bool = True) -> CorpusPdf:
        """Lire et valider ``manifeste.json`` puis ``descripteurs.jsonl``.

        ``verifier_empreinte=False`` ne désactive que le contrôle d'intégrité du fichier : la structure, les
        références de documents et les comptages restent vérifiés.
        """
        chemin_manifeste = Path(dossier) / FICHIER_MANIFESTE
        chemin_descripteurs = Path(dossier) / FICHIER_DESCRIPTEURS
        if not chemin_manifeste.is_file() or not chemin_descripteurs.is_file():
            raise _erreur("manifeste.json ou descripteurs.jsonl absent du dossier du corpus.")
        try:
            manifeste = ManifestePdf.model_validate_json(chemin_manifeste.read_bytes())
        except ValidationError:
            raise _erreur("manifeste.json ne respecte pas le schéma du corpus PDF.") from None

        octets = chemin_descripteurs.read_bytes()
        if verifier_empreinte and hashlib.sha256(octets).hexdigest() != manifeste.empreinte_descripteurs_sha256:
            raise _erreur("l'empreinte de descripteurs.jsonl diffère de celle du manifeste.")

        descripteurs: list[DescripteurPdf] = []
        for numero, ligne in enumerate(octets.decode("utf-8").splitlines(), start=1):
            if not ligne.strip():
                continue
            try:
                descripteurs.append(DescripteurPdf.model_validate_json(ligne))
            except ValidationError:
                raise _erreur(f"ligne {numero} invalide.") from None

        documents = {document.identifiant: document for document in manifeste.documents}
        identifiants: set[str] = set()
        for descripteur in descripteurs:
            document = documents.get(descripteur.document)
            if document is None:
                raise _erreur(f"{descripteur.identifiant} référence un document absent du manifeste.")
            if document.langue != descripteur.langue_document:
                raise _erreur(f"{descripteur.identifiant} n'a pas la langue de son document.")
            if descripteur.page > document.pages:
                raise _erreur(f"{descripteur.identifiant} cite une page hors du document.")
            if descripteur.identifiant in identifiants:
                raise _erreur(f"identifiant dupliqué {descripteur.identifiant}.")
            identifiants.add(descripteur.identifiant)

        if compter(descripteurs) != manifeste.comptages:
            raise _erreur("les comptages diffèrent de ceux du manifeste.")
        if not descripteurs:
            raise _erreur("aucun descripteur.")
        return cls(manifeste=manifeste, descripteurs=tuple(descripteurs))
