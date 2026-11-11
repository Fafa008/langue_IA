"""Corpus documentaire CECRL (PRE-08) : manifeste, descripteurs et chargement local.

Le corpus est un **artefact généré**, séparé du code : les descripteurs officiels du Conseil de l'Europe ne sont
pas versionnés tant que leurs droits de réutilisation ne sont pas clarifiés par écrit. Le dépôt ne contient que le
manifeste (métadonnées, comptages, empreintes) ; le fichier ``descripteurs.jsonl`` est produit par
``scripts/ingestion_cecrl.py`` dans un dossier hors dépôt, puis monté en lecture seule dans le conteneur.

Deux règles structurent ce module :

- le manifeste est la source de vérité du corpus : version, source, licence et comptages y sont vérifiés au
  chargement, et une incohérence lève ``ErreurCorpusIndisponible`` plutôt que de servir un index partiel ;
- le niveau exposé au prompt reste un niveau de base (``A1`` à ``C2``) : un descripteur étiqueté ``A2+`` conserve
  son étiquette d'origine dans ``sous_niveau`` mais est indexé sous ``A2``, conformément au contrat public.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import Field, ValidationError, model_validator

from app.core.erreurs import ErreurCorpusIndisponible
from app.schemas.base import ModeleStrict
from app.schemas.regles import CodeLangue, NiveauCecrl, Referentiel, erreur, referentiel_pour_langue

FICHIER_MANIFESTE = "manifeste.json"
FICHIER_DESCRIPTEURS = "descripteurs.jsonl"

# Le contrat ``Competence`` ne connaît que cinq valeurs. Le corpus distingue en plus les échelles lexicales, qui
# restent rattachées à la compétence linguistique transverse et n'ont donc pas de valeur propre côté API.
CompetenceCorpus = Literal["ecoute", "lecture", "ecrit", "oral", "grammaire", "lexique"]
COMPETENCES_CORPUS: tuple[CompetenceCorpus, ...] = ("ecoute", "lecture", "ecrit", "oral", "grammaire", "lexique")

VERSION_MAX = 32
SHA256 = r"^[0-9a-f]{64}$"


class SourceOfficielle(ModeleStrict):
    """Document officiel dont le corpus est extrait, avec son empreinte vérifiable."""

    oeuvre: str = Field(min_length=1, max_length=200)
    editeur: str = Field(min_length=1, max_length=120)
    annee: int = Field(ge=2001, le=2100)
    url: str = Field(pattern=r"^https://")
    format: str = Field(min_length=1, max_length=120)
    empreinte_sha256: str = Field(pattern=SHA256)


class LicenceCorpus(ModeleStrict):
    """Statut juridique du corpus : aucune réutilisation n'est supposée acquise par défaut.

    ``statut`` reste ``non_clarifiee`` tant qu'aucune autorisation écrite n'a été obtenue. ``citation`` reprend la
    mention exigée par l'éditeur, même lorsque le corpus n'est utilisé qu'en interne.
    """

    statut: Literal["non_clarifiee", "extraits_non_commercial", "accord_ecrit"]
    citation: str = Field(min_length=1, max_length=200)
    note: str = Field(default="", max_length=500)


class Comptages(ModeleStrict):
    """Volumétrie du corpus, vérifiée à l'identique au chargement."""

    total: int = Field(ge=0)
    par_niveau: dict[str, int]
    par_competence: dict[str, int]

    @model_validator(mode="after")
    def verifier_totaux(self) -> Comptages:
        """Refuser un manifeste dont les totaux ne correspondent pas au détail."""
        if any(valeur < 0 for valeur in (*self.par_niveau.values(), *self.par_competence.values())):
            raise erreur("Un comptage du manifeste est négatif.")
        if sum(self.par_niveau.values()) != self.total:
            raise erreur("La somme des comptages par niveau diffère du total du manifeste.")
        if sum(self.par_competence.values()) != self.total:
            raise erreur("La somme des comptages par compétence diffère du total du manifeste.")
        return self


class ManifesteCorpus(ModeleStrict):
    """Métadonnées du corpus : aucune donnée textuelle sous droits n'y figure."""

    version: str = Field(min_length=3, max_length=VERSION_MAX, pattern=r"^[a-z0-9][a-z0-9._-]*$")
    edition: str = Field(min_length=4, max_length=32)
    genere_le: date
    source: SourceOfficielle
    licence: LicenceCorpus
    langues: tuple[CodeLangue, ...] = Field(min_length=1)
    niveaux: tuple[NiveauCecrl, ...] = Field(min_length=1)
    competences: tuple[CompetenceCorpus, ...] = Field(min_length=1)
    comptages: Comptages
    empreinte_descripteurs_sha256: str = Field(pattern=SHA256)


class DescripteurCorpus(ModeleStrict):
    """Un descripteur officiel, avec sa provenance et son niveau d'origine.

    ``niveau`` est toujours un niveau de base ; ``sous_niveau`` conserve l'étiquette publiée (``A2+``, ``B1+``…)
    afin de ne pas perdre l'information d'origine lors de la normalisation.
    """

    identifiant: str = Field(pattern=r"^cecrl:[a-z]{2}:[0-9]{4}:[0-9]{4}$", max_length=64)
    code_langue: CodeLangue
    referentiel: Referentiel
    niveau: NiveauCecrl
    sous_niveau: str = Field(pattern=r"^(A1|A2|B1|B2|C1|C2)\+?$")
    competence: CompetenceCorpus
    echelle: str = Field(min_length=1, max_length=120)
    contenu: str = Field(min_length=1, max_length=3000)
    source_no: int = Field(ge=1, le=9999)

    @model_validator(mode="after")
    def verifier_coherence(self) -> DescripteurCorpus:
        """Le référentiel suit la langue et le sous-niveau se projette exactement sur le niveau."""
        if self.referentiel != referentiel_pour_langue(self.code_langue):
            raise erreur("Le référentiel du descripteur ne correspond pas à sa langue.")
        if self.sous_niveau.rstrip("+") != self.niveau:
            raise erreur("Le sous-niveau du descripteur ne se projette pas sur son niveau.")
        return self


def serialiser_descripteurs(descripteurs: Sequence[DescripteurCorpus]) -> bytes:
    """Sérialiser les descripteurs en JSONL UTF-8 à fins de ligne LF, dans l'ordre fourni.

    L'écriture se fait en octets : ``Path.write_text`` traduirait les sauts de ligne sous Windows et l'empreinte du
    fichier ne serait plus reproductible d'un système à l'autre.
    """
    lignes = [descripteur.model_dump_json() for descripteur in descripteurs]
    return ("\n".join(lignes) + ("\n" if lignes else "")).encode("utf-8")


def compter(descripteurs: Iterable[DescripteurCorpus]) -> Comptages:
    """Calculer la volumétrie du corpus, utilisée à la génération puis vérifiée au chargement."""
    par_niveau: dict[str, int] = {}
    par_competence: dict[str, int] = {}
    total = 0
    for descripteur in descripteurs:
        total += 1
        par_niveau[descripteur.niveau] = par_niveau.get(descripteur.niveau, 0) + 1
        par_competence[descripteur.competence] = par_competence.get(descripteur.competence, 0) + 1
    return Comptages(
        total=total,
        par_niveau=dict(sorted(par_niveau.items())),
        par_competence=dict(sorted(par_competence.items())),
    )


def composer_manifeste(
    descripteurs: Sequence[DescripteurCorpus],
    *,
    version: str,
    edition: str,
    source: SourceOfficielle,
    licence: LicenceCorpus,
    genere_le: date | None = None,
) -> ManifesteCorpus:
    """Assembler le manifeste d'un corpus : langues, niveaux, compétences et comptages sont déduits.

    L'empreinte porte sur les octets exacts du JSONL produit par :func:`serialiser_descripteurs` : elle permet au
    service de refuser un fichier privé qui ne correspond pas au manifeste.
    """
    if not descripteurs:
        raise ErreurCorpusIndisponible("Un corpus vide ne peut pas être publié.")
    empreinte = hashlib.sha256(serialiser_descripteurs(descripteurs)).hexdigest()
    return ManifesteCorpus(
        version=version,
        edition=edition,
        genere_le=genere_le or date.today(),
        source=source,
        licence=licence,
        langues=tuple(sorted({descripteur.code_langue for descripteur in descripteurs})),
        niveaux=tuple(sorted({descripteur.niveau for descripteur in descripteurs})),
        competences=tuple(
            competence for competence in COMPETENCES_CORPUS if any(d.competence == competence for d in descripteurs)
        ),
        comptages=compter(descripteurs),
        empreinte_descripteurs_sha256=empreinte,
    )


def _erreur_chargement(detail: str) -> ErreurCorpusIndisponible:
    """Erreur de corpus sans contenu de descripteur : seuls le fichier et la ligne sont cités."""
    return ErreurCorpusIndisponible(f"Corpus CECRL invalide : {detail}.")


@dataclass(frozen=True, slots=True)
class CorpusCecrl:
    """Corpus chargé et déjà vérifié, prêt à être indexé par un récupérateur."""

    manifeste: ManifesteCorpus
    descripteurs: tuple[DescripteurCorpus, ...]

    @classmethod
    def charger(cls, dossier: Path, *, verifier_empreinte: bool = True) -> CorpusCecrl:
        """Lire ``manifeste.json`` et ``descripteurs.jsonl`` puis vérifier leur cohérence.

        Toute anomalie (fichier absent, JSON invalide, empreinte différente, comptage divergent, identifiant en
        double) lève ``ErreurCorpusIndisponible`` : mieux vaut un récupérateur vide qu'un index partiel.
        """
        dossier = Path(dossier)
        if not dossier.is_dir():
            raise _erreur_chargement(f"dossier absent ({dossier.name})")

        manifeste = cls._lire_manifeste(dossier / FICHIER_MANIFESTE)
        chemin_descripteurs = dossier / FICHIER_DESCRIPTEURS
        try:
            octets = chemin_descripteurs.read_bytes()
        except OSError as exc:
            raise _erreur_chargement(f"{FICHIER_DESCRIPTEURS} illisible") from exc

        if verifier_empreinte:
            empreinte = hashlib.sha256(octets).hexdigest()
            if empreinte != manifeste.empreinte_descripteurs_sha256:
                raise _erreur_chargement("empreinte du fichier de descripteurs différente du manifeste")

        descripteurs = cls._lire_descripteurs(octets, manifeste)
        cls._verifier_comptages(descripteurs, manifeste)
        return cls(manifeste=manifeste, descripteurs=descripteurs)

    @staticmethod
    def _lire_manifeste(chemin: Path) -> ManifesteCorpus:
        try:
            contenu = chemin.read_text(encoding="utf-8")
        except OSError as exc:
            raise _erreur_chargement(f"{FICHIER_MANIFESTE} illisible") from exc
        try:
            return ManifesteCorpus.model_validate_json(contenu)
        except ValidationError as exc:
            champs = sorted({".".join(str(partie) for partie in erreur["loc"]) for erreur in exc.errors()})
            raise _erreur_chargement(f"{FICHIER_MANIFESTE} non conforme ({', '.join(champs[:5])})") from None

    @staticmethod
    def _lire_descripteurs(octets: bytes, manifeste: ManifesteCorpus) -> tuple[DescripteurCorpus, ...]:
        try:
            texte = octets.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise _erreur_chargement(f"{FICHIER_DESCRIPTEURS} n'est pas en UTF-8") from exc

        descripteurs: list[DescripteurCorpus] = []
        vus: set[str] = set()
        for numero, ligne in enumerate(texte.splitlines(), start=1):
            if not ligne.strip():
                continue
            try:
                descripteur = DescripteurCorpus.model_validate(json.loads(ligne))
            except (json.JSONDecodeError, ValidationError):
                raise _erreur_chargement(f"{FICHIER_DESCRIPTEURS} ligne {numero} invalide") from None
            if descripteur.identifiant in vus:
                raise _erreur_chargement(f"identifiant en double ligne {numero}")
            if descripteur.code_langue not in manifeste.langues:
                raise _erreur_chargement(f"langue hors manifeste ligne {numero}")
            if descripteur.niveau not in manifeste.niveaux:
                raise _erreur_chargement(f"niveau hors manifeste ligne {numero}")
            if descripteur.competence not in manifeste.competences:
                raise _erreur_chargement(f"compétence hors manifeste ligne {numero}")
            vus.add(descripteur.identifiant)
            descripteurs.append(descripteur)

        if not descripteurs:
            raise _erreur_chargement(f"{FICHIER_DESCRIPTEURS} ne contient aucun descripteur")
        return tuple(descripteurs)

    @staticmethod
    def _verifier_comptages(descripteurs: tuple[DescripteurCorpus, ...], manifeste: ManifesteCorpus) -> None:
        attendus = manifeste.comptages
        constates = compter(descripteurs)
        if constates.total != attendus.total:
            raise _erreur_chargement(f"{constates.total} descripteurs au lieu de {attendus.total}")
        if constates.par_niveau != attendus.par_niveau:
            raise _erreur_chargement("comptage par niveau différent du manifeste")
        if constates.par_competence != attendus.par_competence:
            raise _erreur_chargement("comptage par compétence différent du manifeste")

    @property
    def version(self) -> str:
        """Étiquette courte reprise dans ``MetaExecution``."""
        return self.manifeste.version
