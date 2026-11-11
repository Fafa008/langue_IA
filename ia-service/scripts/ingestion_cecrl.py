"""Génère le corpus CECRL local (``manifeste.json`` + ``descripteurs.jsonl``) hors du dépôt.

Le corpus n'est pas versionné : ce script produit un artefact privé à partir du classeur officiel du Conseil de
l'Europe, dans un dossier monté en lecture seule par le service IA. Il refuse d'écrire dans le dépôt.

Exemple (depuis ``ia-service/``) :

    python -m scripts.ingestion_cecrl \
        --source "C:/temp/cefr-descriptors-2020.zip" \
        --sortie "C:/temp/corpus/cecrl" \
        --langue en

Le classeur officiel est distribué sous forme d'archive ZIP qui contient directement les parties d'un XLSX : le
script la renomme en ``.xlsx`` dans un dossier temporaire, sans la modifier. L'empreinte SHA256 de l'archive
téléchargée reste celle du manifeste.

Aucun contenu produit ici n'est un contenu de substitution : les descripteurs viennent du classeur, et les lignes
« No descriptors available » sont écartées plutôt que comblées.
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import tempfile
import zipfile
from collections.abc import Iterable, Sequence
from pathlib import Path

from app.core.erreurs import ErreurCorpusIndisponible
from app.rag.corpus import (
    DescripteurCorpus,
    LicenceCorpus,
    ManifesteCorpus,
    SourceOfficielle,
    composer_manifeste,
    serialiser_descripteurs,
)

RACINE_DEPOT = Path(__file__).resolve().parents[2]

FEUILLES = {"en": "English", "fr": "Francais"}

# Classeur « CEFR Descriptors 2020 » vérifié pendant l'audit PRE-08 (archive téléchargée le 2026-11-11).
EMPREINTE_DESCRIPTEURS_2020 = "7c80f798758b7c780225376f1bdedaef7a073c8f6616810f36e13b74b6f614d7"

SOURCES_CONNUES: dict[str, SourceOfficielle] = {
    EMPREINTE_DESCRIPTEURS_2020: SourceOfficielle(
        oeuvre="CEFR Descriptors 2020 (illustrative descriptors, Companion volume)",
        editeur="Conseil de l'Europe",
        annee=2020,
        url="https://rm.coe.int/cefr-descriptors-2020-/16809ed2c7",
        format="ZIP/XLSX (6 feuilles alignées EN/FR/DE/IT/ES/BG)",
        empreinte_sha256=EMPREINTE_DESCRIPTEURS_2020,
    )
}

# Échelles retenues pour le noyau P0, alignées sur les cinq compétences du contrat et sur les échelles lexicales
# transverses. Les stratégies, la médiation, l'interaction en ligne et le plurilingue restent hors noyau.
ECHELLES_PAR_COMPETENCE: dict[str, tuple[str, ...]] = {
    "ecoute": (
        "Overall oral comprehension",
        "Understanding conversation between other people",
        "Understanding as a member of a live audience",
        "Understanding announcements and instructions",
        "Understanding audio (or signed) media and recordings",
        "Watching TV, film and video",
    ),
    "lecture": (
        "Overall reading comprehension",
        "Reading correspondence",
        "Reading for orientation",
        "Reading for information and argument",
        "Reading instructions",
        "Reading as a leisure activity",
    ),
    "ecrit": (
        "Overall written production",
        "Creative writing",
        "Reports and essays",
        "Overall written interaction",
        "Correspondence",
        "Notes, messages and forms",
    ),
    "oral": (
        "Overall oral production",
        "Sustained monologue: describing experience",
        "Sustained monologue: giving information",
        "Sustained monologue: putting a case (e.g. in a debate)",
        "Public announcements",
        "Addressing audiences",
        "Overall oral interaction",
        "Understanding an interlocutor",
        "Conversation",
        "Informal discussion (with friends)",
        "Formal discussion (meetings)",
        "Goal-oriented co-operation (cooking together, discussing a document, organising an event, etc.)",
        "Obtaining goods and services",
        "Information exchange",
        "Interviewing and being interviewed",
        "Using telecommunications",
    ),
    "grammaire": ("General linguistic range", "Grammatical accuracy"),
    "lexique": ("Vocabulary range", "Vocabulary control"),
}

COMPETENCE_PAR_ECHELLE = {
    echelle: competence for competence, echelles in ECHELLES_PAR_COMPETENCE.items() for echelle in echelles
}

NIVEAUX_P0 = ("A1", "A2", "B1", "B2")
MARQUEUR_TROU = "no descriptors available"


def normaliser_niveau(brut: object) -> tuple[str, str] | None:
    """« A2+ » → (``A2``, ``A2+``) ; ``Pre-A1``, ``C1``, ``C2`` et les lignes vides sont écartées."""
    if brut is None:
        return None
    niveau = str(brut).strip()
    if not niveau or niveau == "None":
        return None
    base = niveau.rstrip("+")
    if base not in NIVEAUX_P0:
        return None
    return base, niveau


def descripteur_depuis_ligne(
    ligne: Sequence[object],
    *,
    langue: str,
    annee: int,
    avec_sous_niveaux: bool,
) -> DescripteurCorpus | None:
    """Convertir une ligne du classeur en descripteur, ou ``None`` si elle est hors noyau P0."""
    if len(ligne) < 7:
        return None
    numero, _schema, _mode, _activite, echelle, niveau_brut, contenu_brut = ligne[:7]
    if numero is None or echelle is None or contenu_brut is None:
        return None

    niveau_normalise = normaliser_niveau(niveau_brut)
    if niveau_normalise is None:
        return None
    niveau, sous_niveau = niveau_normalise
    if sous_niveau != niveau and not avec_sous_niveaux:
        return None

    echelle_propre = str(echelle).strip()
    competence = COMPETENCE_PAR_ECHELLE.get(echelle_propre)
    if competence is None:
        return None

    contenu = str(contenu_brut).strip()
    if not contenu or contenu.lower().startswith(MARQUEUR_TROU):
        return None

    return DescripteurCorpus(
        identifiant=f"cecrl:{langue}:{annee}:{int(numero):04d}",
        code_langue=langue,
        referentiel="CECRL",
        niveau=niveau,
        sous_niveau=sous_niveau,
        competence=competence,
        echelle=echelle_propre,
        contenu=contenu,
        source_no=int(numero),
    )


def collecter(
    lignes: Iterable[Sequence[object]],
    *,
    langue: str,
    annee: int,
    avec_sous_niveaux: bool = False,
) -> list[DescripteurCorpus]:
    """Extraire les descripteurs du noyau, triés par numéro de source."""
    descripteurs = [
        descripteur
        for ligne in lignes
        if (
            descripteur := descripteur_depuis_ligne(
                ligne, langue=langue, annee=annee, avec_sous_niveaux=avec_sous_niveaux
            )
        )
        is not None
    ]
    return sorted(descripteurs, key=lambda descripteur: descripteur.source_no)


def verifier_sortie_hors_depot(dossier: Path) -> Path:
    """Refuser toute écriture dans le dépôt : le corpus sous droits reste un artefact externe."""
    resolve = Path(dossier).resolve()
    if resolve == RACINE_DEPOT or resolve.is_relative_to(RACINE_DEPOT):
        raise ValueError(
            "Le corpus doit être généré hors du dépôt (par exemple dans un dossier temporaire), "
            "puis monté en lecture seule dans le conteneur."
        )
    return resolve


def empreinte_fichier(chemin: Path) -> str:
    """Empreinte SHA256 d'un fichier, en flux pour ne pas charger l'archive complète en mémoire."""
    digest = hashlib.sha256()
    with chemin.open("rb") as flux:
        for bloc in iter(lambda: flux.read(1024 * 1024), b""):
            digest.update(bloc)
    return digest.hexdigest()


def _classeur_lisible(source: Path, dossier_temporaire: Path) -> tuple[Path, str]:
    """Retourner un XLSX exploitable et l'empreinte du fichier fourni.

    L'archive officielle contient directement les parties d'un classeur : la copier sous l'extension ``.xlsx``
    suffit, sans la modifier ni la décompresser sur disque.
    """
    empreinte = empreinte_fichier(source)
    if zipfile.is_zipfile(source):
        with zipfile.ZipFile(source) as archive:
            if "xl/workbook.xml" not in archive.namelist():
                raise ValueError("L'archive fournie ne contient pas de classeur XLSX.")
        classeur = dossier_temporaire / "classeur.xlsx"
        classeur.write_bytes(source.read_bytes())
        return classeur, empreinte
    return source, empreinte


def lire_lignes(classeur: Path, langue: str) -> list[tuple[object, ...]]:
    """Lire la feuille de la langue demandée ; l'import est local pour ne pas peser sur le service."""
    try:
        from openpyxl import load_workbook
    except ImportError as exc:  # pragma: no cover - dépendance de développement documentée
        raise RuntimeError("openpyxl est requis pour l'ingestion (requirements-dev.txt).") from exc

    feuille = FEUILLES[langue]
    classeur_charge = load_workbook(classeur, read_only=True, data_only=True)
    try:
        if feuille not in classeur_charge.sheetnames:
            raise ValueError(f"Feuille « {feuille} » absente (disponibles : {', '.join(classeur_charge.sheetnames)}).")
        return [tuple(ligne) for ligne in classeur_charge[feuille].iter_rows(min_row=2, values_only=True)]
    finally:
        classeur_charge.close()


def construire_source(source: Path, empreinte: str, *, accepter_inconnue: bool) -> SourceOfficielle:
    """Retrouver la métadonnée de la source par son empreinte, ou refuser une provenance non vérifiée."""
    connue = SOURCES_CONNUES.get(empreinte)
    if connue is not None:
        return connue
    if not accepter_inconnue:
        raise ValueError(
            "Empreinte inconnue : fournir le classeur officiel vérifié pendant l'audit PRE-08 "
            f"(attendu {EMPREINTE_DESCRIPTEURS_2020}) ou passer --accepter-source-inconnue."
        )
    return SourceOfficielle(
        oeuvre=source.name,
        editeur="Source non vérifiée",
        annee=2020,
        url="https://rm.coe.int/cefr-descriptors-2020-/16809ed2c7",
        format="XLSX",
        empreinte_sha256=empreinte,
    )


def ecrire_corpus(dossier: Path, manifeste: ManifesteCorpus, descripteurs: Sequence[DescripteurCorpus]) -> None:
    """Écrire le manifeste et les descripteurs en octets, pour une empreinte reproductible."""
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / "manifeste.json").write_bytes((manifeste.model_dump_json(indent=2) + "\n").encode("utf-8"))
    (dossier / "descripteurs.jsonl").write_bytes(serialiser_descripteurs(descripteurs))


def construire_arguments() -> argparse.ArgumentParser:
    """Définir la ligne de commande du script d'ingestion."""
    analyseur = argparse.ArgumentParser(description="Génère le corpus CECRL local hors du dépôt.")
    analyseur.add_argument("--source", required=True, type=Path, help="classeur XLSX ou archive ZIP officielle")
    analyseur.add_argument("--sortie", required=True, type=Path, help="dossier de sortie, hors du dépôt")
    analyseur.add_argument("--langue", default="en", choices=sorted(FEUILLES), help="feuille à ingérer (en ou fr)")
    analyseur.add_argument("--version", default="cecrl-2020.1", help="étiquette du corpus, 32 caractères au plus")
    analyseur.add_argument(
        "--avec-sous-niveaux",
        action="store_true",
        help="inclure A2+, B1+ et B2+ (normalisés vers leur niveau de base, P1)",
    )
    analyseur.add_argument(
        "--accepter-source-inconnue",
        action="store_true",
        help="autoriser une empreinte de source non répertoriée (déconseillé)",
    )
    return analyseur


def main(argv: Sequence[str] | None = None) -> int:
    """Point d'entrée : générer le corpus et afficher un résumé sans contenu de descripteur."""
    arguments = construire_arguments().parse_args(argv)
    try:
        dossier = verifier_sortie_hors_depot(arguments.sortie)
        with tempfile.TemporaryDirectory(prefix="corpus-cecrl-") as temporaire:
            classeur, empreinte = _classeur_lisible(arguments.source, Path(temporaire))
            source = construire_source(
                arguments.source, empreinte, accepter_inconnue=arguments.accepter_source_inconnue
            )
            lignes = lire_lignes(classeur, arguments.langue)
        descripteurs = collecter(
            lignes,
            langue=arguments.langue,
            annee=source.annee,
            avec_sous_niveaux=arguments.avec_sous_niveaux,
        )
        if not descripteurs:
            raise ErreurCorpusIndisponible("Aucun descripteur du noyau P0 n'a été trouvé dans la source.")
        manifeste = composer_manifeste(
            descripteurs,
            version=arguments.version,
            edition=str(source.annee),
            source=source,
            licence=LicenceCorpus(
                statut="non_clarifiee",
                citation=f"© Conseil de l'Europe, {source.annee}",
                note=(
                    "Aucune licence de réutilisation explicite sur le classeur : corpus interne, non distribué, "
                    "usage non commercial uniquement tant que les droits ne sont pas clarifiés par écrit."
                ),
            ),
        )
        ecrire_corpus(dossier, manifeste, descripteurs)
    except (ValueError, OSError, ErreurCorpusIndisponible) as exc:
        print(f"Échec de l'ingestion : {exc}", file=sys.stderr)
        return 1

    print(f"Corpus {manifeste.version} écrit dans {dossier}")
    print(f"  descripteurs : {manifeste.comptages.total}")
    for niveau, nombre in manifeste.comptages.par_niveau.items():
        print(f"  {niveau}: {nombre}")
    for competence, nombre in manifeste.comptages.par_competence.items():
        print(f"  {competence}: {nombre}")
    print(f"  empreinte    : {manifeste.empreinte_descripteurs_sha256}")
    return 0


if __name__ == "__main__":  # pragma: no cover - point d'entrée CLI
    raise SystemExit(main())
