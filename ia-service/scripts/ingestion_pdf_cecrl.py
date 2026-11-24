"""Génère le corpus CECRL PDF (``manifeste.json`` + ``descripteurs.jsonl``) hors du dépôt (US150-C).

Source : les éditions PDF du *CECR — Volume complémentaire* (Conseil de l'Europe), par exemple
``CEFR Companion volume_fra.pdf``, ``CEFR Companion Volume_ita.pdf``, ``CEFR CV 2018_German.pdf`` (voir
``docs/US150_A_AUDIT_PDF_CECRL.md``). Ces fichiers et le corpus produit restent hors du dépôt : leurs droits de
réutilisation ne sont pas clarifiés par écrit, et le service ne charge ce corpus qu'avec
``RAG_CORPUS_OFFICIEL_AUTORISE=true``.

Exemple (depuis ``ia-service/``) :

    python -m scripts.ingestion_pdf_cecrl \\
        --source "/chemin/hors/depot/pdf" \\
        --sortie "/chemin/hors/depot/corpus-pdf"

Étapes :

1. extraction du texte page par page en conservant la mise en page (``pdftotext -layout`` si disponible, sinon
   ``pypdf`` en mode « layout ») ;
2. nettoyage des artefacts relevés par l'audit : glyphes de police en zone privée, puces, césures, en-têtes et pieds
   de page répétés ;
3. lecture des **grilles de niveaux** : une ligne qui commence par ``A1`` à ``C2`` (éventuellement ``+``) ouvre une
   cellule, les lignes suivantes la complètent ; les titres numérotés (``3.1.1``…) donnent la section, et le titre
   en capitales qui précède une grille donne l'échelle ;
4. projection des sections sur les compétences du chargeur, à partir de la numérotation (réception, production,
   interaction, compétence linguistique) et de mots-clés du titre en français, anglais, italien et allemand ; la
   médiation, les stratégies et les compétences socio-linguistique, pragmatique et plurilingue sont écartées.

Aucun texte n'est inventé ni complété : une cellule « pas de descripteur disponible » est écartée. L'extraction est
heuristique (la mise en page varie selon les éditions) : le rapport affiché, sans aucun texte de descripteur, permet
de contrôler les comptages par section avant d'activer le corpus.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import shutil
import subprocess
import sys
import unicodedata
from collections import Counter
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from pathlib import Path

from app.rag.corpus import LicenceCorpus
from app.rag.corpus_pdf import (
    FICHIER_DESCRIPTEURS,
    FICHIER_MANIFESTE,
    LANGUES_DOCUMENT,
    DescripteurPdf,
    DocumentPdf,
    ManifestePdf,
    composer_manifeste,
    serialiser_descripteurs,
)
from scripts._depot import RACINE_DEPOT

VERSION_PAR_DEFAUT = "cecrl-pdf-2020.1"
CONTENU_MAX = 3000

# ---------------------------------------------------------------------------------------------------------------
# Nettoyage
# ---------------------------------------------------------------------------------------------------------------

# Glyphes de police en zone privée (U+E000–U+F8FF : puces U+F02D, cases U+F0FC…) et flèches d'en-tête.
_ZONE_PRIVEE = re.compile("[-]")
_PUCE_DEBUT = re.compile(r"^(\s*)(?:[•▪►◦■□✓]|f(?=\s{1,3}\S))\s+")
# Césure dans une ligne : « auto- risée ». On épargne les ellipses de composés : « Lese- und Hörverstehen ».
_MOTS_COORDINATION = "und|oder|bzw|sowie|et|ou|and|or|e|o|ed|od"
_CESURE = re.compile(rf"(?<=[a-zà-öø-ÿß])- (?!(?:{_MOTS_COORDINATION})\b)(?=[a-zà-öø-ÿß])")
_NUMERO_PAGE = re.compile(r"^\s*(?:page|pagina|seite|p\.)?\s*\d{1,4}\s*$", re.IGNORECASE)


def nettoyer_ligne(ligne: str) -> str:
    """Retirer glyphes privés, puces et césures internes, sans toucher à l'indentation utile aux grilles."""
    ligne = _ZONE_PRIVEE.sub(" ", ligne.replace("­", "")).replace("►", " ").rstrip()
    ligne = _PUCE_DEBUT.sub(r"\1", ligne)
    return _CESURE.sub("", ligne)


def _empreinte_ligne(ligne: str) -> str:
    """Forme comparable d'une ligne d'en-tête : sans chiffres ni espaces multiples."""
    return re.sub(r"\s+", " ", re.sub(r"\d+", "#", ligne)).strip().lower()


LIGNES_DE_BORD = 3


def lignes_repetees(
    pages: Sequence[str], *, seuil: float = 0.3, seuil_bord: float = 0.05, minimum: int = 5
) -> frozenset[str]:
    """En-têtes et pieds de page (chiffres masqués).

    Deux règles : une ligne présente sur au moins ``seuil`` des pages, n'importe où ; ou une ligne placée dans les
    trois premières ou dernières lignes d'une page et présente sur au moins ``seuil_bord`` des pages. La seconde
    capte le titre courant d'un seul chapitre (« Échelles de descripteurs du CECR : activités langagières,
    stratégies et compétences ») et les pieds de page dont le texte varie (« Page 74 3 CEFR – Companion volume »).
    """
    partout = Counter[str]()
    bords = Counter[str]()
    for page in pages:
        lignes = [_empreinte_ligne(ligne) for ligne in page.splitlines() if ligne.strip()]
        partout.update(set(lignes))
        bords.update(set(lignes[:LIGNES_DE_BORD] + lignes[-LIGNES_DE_BORD:]))
    limite = max(minimum, int(len(pages) * seuil))
    limite_bord = max(minimum, int(len(pages) * seuil_bord))
    return frozenset(cle for cle in partout if len(cle) > 1 and (partout[cle] >= limite or bords[cle] >= limite_bord))


def joindre(morceaux: Iterable[str]) -> str:
    """Recomposer une cellule : césure en fin de ligne recollée, espaces normalisés."""
    texte = ""
    for morceau in (m.strip() for m in morceaux):
        if not morceau:
            continue
        if (
            texte.endswith("-")
            and re.match(r"[a-zà-öø-ÿß]", morceau)
            and not re.match(rf"(?:{_MOTS_COORDINATION})\b", morceau)
        ):
            texte = texte[:-1] + morceau
        else:
            texte = f"{texte} {morceau}" if texte else morceau
    return re.sub(r"\s+", " ", texte).strip()


# ---------------------------------------------------------------------------------------------------------------
# Langue d'un document
# ---------------------------------------------------------------------------------------------------------------

_MOTS_TEMOINS: dict[str, frozenset[str]] = {
    "fr": frozenset("les des est une dans pour que qui sur avec peut".split()),
    "en": frozenset("the and of to is can with that for are".split()),
    "it": frozenset("della delle sono può nella degli che per con gli".split()),
    "de": frozenset("und der die das ist kann mit von den sich".split()),
}


def detecter_langue(texte: str) -> str:
    """Langue majoritaire d'après des mots-outils (une page de titre dans une autre langue ne suffit pas)."""
    mots = Counter(re.findall(r"[a-zàâçéèêëîïôûùüÿñæœäöß']+", texte.lower()))
    scores = {langue: sum(mots[mot] for mot in temoins) for langue, temoins in _MOTS_TEMOINS.items()}
    return max(scores, key=lambda langue: (scores[langue], -LANGUES_DOCUMENT.index(langue)))


# ---------------------------------------------------------------------------------------------------------------
# Sections → compétences
# ---------------------------------------------------------------------------------------------------------------


def _sans_accents(texte: str) -> str:
    decompose = unicodedata.normalize("NFKD", texte.lower())
    return "".join(c for c in decompose if not unicodedata.combining(c))


_STRATEGIES = re.compile(r"strat[eé]g")
_ORAL = re.compile(
    r"\b(oral|orale|l'oral|orali|mundlich\w*|spoken|speaking|listening|ascolt\w*|hor\w*|audio\w*|ecoute)\b"
)
_ECRIT = re.compile(
    r"\b(ecrit\w*|lecture|lettura|lese\w*|reading|written|writing|scritt\w*|schriftlich\w*"
    r"|en ligne|online|on line|on-line)\b"
)
_LEXIQUE = re.compile(r"(vocabula|lessic|wortschatz|lexi|etendue|range|gamma|spektrum)")
_GRAMMAIRE = re.compile(r"(grammat|correction|korrektheit|accuracy|correttezza)")
_PHONOLOGIE = re.compile(r"(phonolog|fonolog|aussprache|prononc|pronunc)")
_ORTHOGRAPHE = re.compile(r"(orthogra|ortogra|rechtschreib|spelling)")


def competence_pour(section: str, titres: Sequence[str]) -> str | None:
    """Compétence du chargeur pour une échelle, ou ``None`` si la section est hors du périmètre du prompt.

    ``titres`` contient les titres de la hiérarchie (du chapitre à l'échelle), dans n'importe quelle langue.
    """
    texte = _sans_accents(" ".join(titres))
    parties = section.split(".")
    chapitre = ".".join(parties[:2])
    if _STRATEGIES.search(texte):
        return None
    if chapitre == "3.1":  # réception
        if _ORAL.search(texte):
            return "ecoute"
        if _ECRIT.search(texte):
            return "lecture"
        return None
    if chapitre in ("3.2", "3.3"):  # production, interaction
        if _ORAL.search(texte):
            return "oral"
        if _ECRIT.search(texte):
            return "ecrit"
        return None
    if chapitre == "5.1":  # compétence linguistique
        if _PHONOLOGIE.search(texte):
            return "oral"
        if _ORTHOGRAPHE.search(texte):
            return "ecrit"
        if _GRAMMAIRE.search(texte):
            return "grammaire"
        return "lexique"
    return None


# ---------------------------------------------------------------------------------------------------------------
# Lecture des grilles
# ---------------------------------------------------------------------------------------------------------------

# Titre numéroté : « 3.1.1.2. Compréhension… ». Le titre commence par une majuscule, ce qui écarte une ligne de prose
# comme « 5.2.1.4 del QCER 2001 è chiara… ».
_TITRE_NUMEROTE = re.compile(r"^\s{0,10}(\d{1,2}(?:\.\d{1,2}){1,4})\.?\s+([A-ZÀ-ÖØ-Þ«“\"].{1,150}?)\s*$")
# Chapitre (« CHAPITRE 6 : … ») et annexes : ils ferment la section en cours (langue des signes, annexes).
_TITRE_CHAPITRE = re.compile(r"^\s{0,10}(?:CHAPITRE|CHAPTER|CAPITOLO|KAPITEL)\s+(\d{1,2})\b\s*:?\s*(.*)$")
_TITRE_ANNEXE = re.compile(
    r"^\s{0,10}(?:ANNEXES?|APPENDIX|APPENDICES|APPENDICE|APPENDICI|ANHANG|ANHÄNGE|ALLEGATO)\b"
    r"|^\s{0,10}(?:Annexe|Appendix|Appendice|Anhang|Allegato)\s+\d{1,2}\s*$"
)
_ENTREE_SOMMAIRE = re.compile(r"(\.{4,}|_{4,}|\s\d{1,3})\s*$")
_LIGNE_NIVEAU = re.compile(r"^\s{0,14}(Pre-A1|Pré-A1|A1|A2|B1|B2|C1|C2)(\+?)(?:\s{2,}(\S.*))?\s*$")
_SANS_DESCRIPTEUR = re.compile(
    r"(pas de descripteur|aucun descripteur|no descriptors? available|nessun descrittore|keine deskriptoren)",
    re.IGNORECASE,
)
# Une légende d'échelle peut finir par une parenthèse : « Discussion informelle (entre amis) ».
_FIN_DE_PHRASE = re.compile(r"[.!?;:…»\"”]\s*$")
# Une ligne de prose commence dans la marge ; le texte d'une grille est décalé par la colonne des niveaux.
INDENTATION_GRILLE_MIN = 4
# Une légende d'échelle est centrée au-dessus de sa grille ; le texte d'une cellule commence vers la colonne 12-15.
INDENTATION_LEGENDE_MIN = 20
# Écart d'index ajouté à chaque saut de page : un paragraphe se rattache de préférence à un niveau de sa page.
ECART_PAGE = 6


def est_legende(ligne: str) -> bool:
    """Titre d'échelle probable : ligne courte, majoritairement en capitales, sans être une ligne de niveau."""
    texte = ligne.strip()
    lettres = [c for c in texte if c.isalpha()]
    return 4 <= len(texte) <= 120 and len(lettres) >= 4 and sum(c.isupper() for c in lettres) / len(lettres) >= 0.8


@dataclass
class Etiquette:
    """Code de niveau lu dans la colonne de gauche d'une grille."""

    index: int
    niveau: str
    plus: str
    page: int


@dataclass
class Paragraphe:
    """Bloc de lignes consécutives (sans ligne vide), avec les codes de niveau qu'il contient."""

    lignes: list[tuple[int, str]] = field(default_factory=list)
    etiquettes: list[Etiquette] = field(default_factory=list)
    indentation: int = 1_000

    def ajouter(self, index: int, texte: str, indentation: int) -> None:
        self.lignes.append((index, texte))
        self.indentation = min(self.indentation, indentation)


@dataclass(frozen=True)
class Brut:
    """Descripteur extrait, avant numérotation et validation."""

    niveau: str
    sous_niveau: str
    competence: str
    section: str
    echelle: str
    contenu: str
    page: int


@dataclass
class Rapport:
    """Comptages de contrôle, sans aucun texte de descripteur."""

    par_section: Counter[str] = field(default_factory=Counter)
    ecartees_hors_perimetre: Counter[str] = field(default_factory=Counter)
    ecartees_sans_descripteur: int = 0
    ecartees_pre_a1: int = 0
    ecartees_sans_section: int = 0
    doublons: int = 0


def _plus_proche(index: float, etiquettes: Sequence[Etiquette]) -> Etiquette:
    """Étiquette la plus proche verticalement ; à égalité, la précédente (le texte suit son niveau)."""
    return min(etiquettes, key=lambda e: (abs(e.index - index), e.index > index))


_FIN_DESCRIPTEUR = re.compile(r"[.!?…]\s*$")


def _blocs(lignes: Sequence[tuple[int, str]]) -> list[list[tuple[int, str]]]:
    """Découper un paragraphe en phrases-descripteurs : un bloc se termine par une ponctuation finale."""
    blocs: list[list[tuple[int, str]]] = [[]]
    for index, texte in lignes:
        blocs[-1].append((index, texte))
        if _FIN_DESCRIPTEUR.search(texte):
            blocs.append([])
    return [bloc for bloc in blocs if bloc]


def affecter_paragraphes(paragraphes: Sequence[Paragraphe]) -> list[tuple[Etiquette, list[str]]]:
    """Répartir le texte d'une grille entre ses codes de niveau.

    Dans les grilles du volume complémentaire, le code de niveau est **centré verticalement** dans sa cellule : les
    premières lignes d'un descripteur précèdent souvent la ligne qui porte le code. Selon l'édition, deux cellules
    sont séparées par une simple ligne vide (comme deux descripteurs d'une même cellule) ou ne le sont pas du tout.
    L'unité rattachée est donc la **phrase** (un descripteur finit par un point), jamais la ligne, pour ne pas couper
    un descripteur entre deux niveaux :

    - une phrase qui s'étend sur la ligne d'un code lui revient ;
    - sinon, elle va au code le plus proche de son centre, d'abord parmi ceux de son paragraphe, puis dans la grille.
    """
    etiquettes = [e for p in paragraphes for e in p.etiquettes]
    if not etiquettes:
        return []
    cellules: dict[int, list[str]] = {e.index: [] for e in etiquettes}
    for paragraphe in paragraphes:
        candidates = paragraphe.etiquettes or etiquettes
        for bloc in _blocs(paragraphe.lignes):
            premier, dernier = bloc[0][0], bloc[-1][0]
            centre = (premier + dernier) / 2
            couvertes = [e for e in paragraphe.etiquettes if premier <= e.index <= dernier]
            cible = _plus_proche(centre, couvertes or candidates)
            cellules[cible.index].extend(texte for _, texte in bloc)
    return [(e, cellules[e.index]) for e in etiquettes]


def lire_grilles(pages: Sequence[str], rapport: Rapport | None = None) -> list[Brut]:
    """Extraire les cellules de niveau de toutes les pages d'un document (pages numérotées à partir de 1)."""
    rapport = rapport if rapport is not None else Rapport()
    repetees = lignes_repetees(pages)
    resultats: list[Brut] = []
    hierarchie: dict[int, tuple[str, str]] = {}  # profondeur → (numéro, titre)
    legende = ""
    grille: list[Paragraphe] = []
    courant = Paragraphe()
    index = 0

    def section_courante() -> tuple[str, tuple[str, ...]]:
        if not hierarchie:
            return "", ()
        profondeur = max(hierarchie)
        return hierarchie[profondeur][0], tuple(hierarchie[p][1] for p in sorted(hierarchie))

    def vider_grille() -> None:
        """Transformer la grille accumulée en descripteurs, avec la section et l'échelle en cours."""
        nonlocal grille
        section, titres = section_courante()
        echelle = legende or (titres[-1] if titres else section)
        for etiquette, lignes in affecter_paragraphes(grille):
            if etiquette.niveau.startswith("Pr"):
                rapport.ecartees_pre_a1 += 1
                continue
            if not section or "." not in section:
                rapport.ecartees_sans_section += 1
                continue
            contenu = joindre(lignes)[:CONTENU_MAX]
            if not contenu or _SANS_DESCRIPTEUR.search(contenu):
                rapport.ecartees_sans_descripteur += 1
                continue
            competence = competence_pour(section, (*titres, echelle))
            if competence is None:
                rapport.ecartees_hors_perimetre[section] += 1
                continue
            rapport.par_section[section] += 1
            resultats.append(
                Brut(
                    niveau=etiquette.niveau,
                    sous_niveau=f"{etiquette.niveau}{etiquette.plus}",
                    competence=competence,
                    section=section,
                    echelle=echelle[:160],
                    contenu=contenu,
                    page=etiquette.page,
                )
            )
        grille = []

    def clore_paragraphe() -> None:
        """Ranger le paragraphe courant : légende d'échelle, prose (fin de grille) ou morceau de grille."""
        nonlocal courant, legende
        paragraphe, courant = courant, Paragraphe()
        if not paragraphe.lignes:
            return
        if not paragraphe.etiquettes:
            texte = joindre(t for _, t in paragraphe.lignes)
            if len(paragraphe.lignes) == 1 and len(texte) <= 120 and not _FIN_DE_PHRASE.search(texte):
                vider_grille()
                legende = texte
                return
            if paragraphe.indentation < INDENTATION_GRILLE_MIN:
                vider_grille()
                return
        grille.append(paragraphe)

    def changer_de_section() -> None:
        clore_paragraphe()
        vider_grille()

    for numero_page, page in enumerate(pages, start=1):
        clore_paragraphe()
        index += ECART_PAGE
        for brute in page.splitlines():
            index += 1
            ligne = nettoyer_ligne(brute)
            if not ligne.strip():
                clore_paragraphe()
                continue
            niveau = _LIGNE_NIVEAU.match(ligne)
            # Un code de niveau seul (« B2 ») revient sur de nombreuses pages : ce n'est pas un en-tête.
            if _NUMERO_PAGE.match(ligne) or (_empreinte_ligne(ligne) in repetees and not niveau):
                continue

            chapitre = _TITRE_CHAPITRE.match(ligne)
            if chapitre and not _ENTREE_SOMMAIRE.search(ligne):
                changer_de_section()
                hierarchie = {0: (chapitre.group(1), chapitre.group(2).strip() or chapitre.group(1))}
                legende = ""
                continue
            if _TITRE_ANNEXE.match(ligne) and not _ENTREE_SOMMAIRE.search(ligne):
                changer_de_section()
                hierarchie = {}
                legende = ""
                continue
            titre = _TITRE_NUMEROTE.match(ligne)
            if titre and not _ENTREE_SOMMAIRE.search(ligne) and not niveau:
                changer_de_section()
                numero, intitule = titre.group(1), titre.group(2).strip()
                profondeur = numero.count(".")
                hierarchie = {p: v for p, v in hierarchie.items() if p < profondeur}
                hierarchie[profondeur] = (numero, intitule)
                legende = ""
                continue

            if niveau:
                code, plus, reste = niveau.group(1), niveau.group(2), niveau.group(3)
                courant.etiquettes.append(Etiquette(index=index, niveau=code, plus=plus, page=numero_page))
                if reste:
                    courant.ajouter(index, reste, niveau.start(3))
                continue

            # Légende centrée collée à la grille (édition anglaise) : très indentée, courte, sans ponctuation finale.
            indentation = len(ligne) - len(ligne.lstrip())
            if (
                indentation >= INDENTATION_LEGENDE_MIN
                and len(ligne.strip()) <= 100
                and not _FIN_DE_PHRASE.search(ligne)
                and not courant.lignes
                or (est_legende(ligne) and not courant.etiquettes)
            ):
                clore_paragraphe()
                vider_grille()
                legende = ligne.strip()
                continue

            courant.ajouter(index, ligne.strip(), indentation)
    changer_de_section()
    return resultats


def dedoublonner(bruts: Iterable[Brut], rapport: Rapport) -> list[Brut]:
    """Une même cellule répétée (sommaire, annexe récapitulative) n'est gardée qu'une fois."""
    vus: set[tuple[str, str]] = set()
    uniques: list[Brut] = []
    for brut in bruts:
        cle = (brut.niveau, re.sub(r"\W+", " ", brut.contenu.lower()).strip())
        if cle in vus:
            rapport.doublons += 1
            continue
        vus.add(cle)
        uniques.append(brut)
    return uniques


def numeroter(bruts: Sequence[Brut], *, langue: str, document: str, depart: int = 1) -> list[DescripteurPdf]:
    """Attribuer les identifiants ``cecrlpdf:<langue>:<NNNNN>`` dans l'ordre du document, puis valider."""
    return [
        DescripteurPdf(
            identifiant=f"cecrlpdf:{langue}:{depart + rang:05d}",
            langue_document=langue,
            document=document,
            niveau=brut.niveau,
            sous_niveau=brut.sous_niveau,
            competence=brut.competence,
            section=brut.section,
            echelle=brut.echelle,
            contenu=brut.contenu,
            page=brut.page,
        )
        for rang, brut in enumerate(bruts)
    ]


# ---------------------------------------------------------------------------------------------------------------
# Fichiers
# ---------------------------------------------------------------------------------------------------------------


def verifier_sortie_hors_depot(dossier: Path) -> Path:
    """Refuser toute écriture dans le dépôt : le corpus sous droits reste un artefact externe."""
    resolu = Path(dossier).resolve()
    if resolu == RACINE_DEPOT or resolu.is_relative_to(RACINE_DEPOT):
        raise ValueError(
            "Le corpus doit être généré hors du dépôt, puis monté en lecture seule dans le conteneur "
            "(RAG_CORPUS_HOTE, voir ia-service/corpus/README.md)."
        )
    return resolu


def empreinte_fichier(chemin: Path) -> str:
    """SHA256 d'un fichier, lu par blocs."""
    digest = hashlib.sha256()
    with chemin.open("rb") as flux:
        for bloc in iter(lambda: flux.read(1024 * 1024), b""):
            digest.update(bloc)
    return digest.hexdigest()


def lister_pdf(sources: Sequence[Path]) -> list[Path]:
    """PDF fournis directement ou contenus dans les dossiers donnés, dans un ordre stable."""
    fichiers: list[Path] = []
    for source in sources:
        if source.is_dir():
            fichiers.extend(sorted(p for p in source.iterdir() if p.suffix.lower() == ".pdf"))
        elif source.suffix.lower() == ".pdf" and source.is_file():
            fichiers.append(source)
        else:
            raise ValueError(f"Source introuvable ou non PDF : {source}")
    if not fichiers:
        raise ValueError("Aucun PDF trouvé dans les sources indiquées.")
    return list(dict.fromkeys(fichiers))


def extraire_pages(chemin: Path, extracteur: str = "auto") -> list[str]:
    """Texte de chaque page, mise en page conservée (colonnes des grilles)."""
    if extracteur == "auto":
        extracteur = "pdftotext" if shutil.which("pdftotext") else "pypdf"
    if extracteur == "pdftotext":
        sortie = subprocess.run(
            ["pdftotext", "-layout", "-enc", "UTF-8", str(chemin), "-"], check=True, capture_output=True
        ).stdout.decode("utf-8", errors="replace")
        pages = sortie.split("\f")
        return pages[:-1] if pages and not pages[-1].strip() else pages
    try:
        from pypdf import PdfReader
    except ImportError as exc:  # pragma: no cover - dépendance de développement documentée
        raise RuntimeError("pypdf est requis sans pdftotext (requirements-dev.txt).") from exc
    lecteur = PdfReader(str(chemin))
    return [page.extract_text(extraction_mode="layout") or "" for page in lecteur.pages]


def identifiant_document(chemin: Path, langue: str, deja: set[str]) -> str:
    """Identifiant court et stable : ``cv-fr``, puis ``cv-fr-2``… si plusieurs PDF d'une même langue."""
    base = f"cv-{langue}"
    candidat, rang = base, 1
    while candidat in deja:
        rang += 1
        candidat = f"{base}-{rang}"
    deja.add(candidat)
    return candidat


def ingerer(
    sources: Sequence[Path],
    *,
    version: str = VERSION_PAR_DEFAUT,
    langues_forcees: dict[str, str] | None = None,
    extracteur: str = "auto",
) -> tuple[ManifestePdf, list[DescripteurPdf], dict[str, Rapport]]:
    """Extraire tous les PDF et composer le corpus (sans rien écrire)."""
    langues_forcees = langues_forcees or {}
    documents: list[DocumentPdf] = []
    descripteurs: list[DescripteurPdf] = []
    rapports: dict[str, Rapport] = {}
    identifiants: set[str] = set()
    suivants: Counter[str] = Counter()

    for chemin in lister_pdf(sources):
        pages = extraire_pages(chemin, extracteur)
        langue = langues_forcees.get(chemin.name) or detecter_langue("\n".join(pages))
        if langue not in LANGUES_DOCUMENT:
            raise ValueError(f"Langue « {langue} » non prise en charge pour {chemin.name}.")
        identifiant = identifiant_document(chemin, langue, identifiants)
        rapport = Rapport()
        bruts = dedoublonner(lire_grilles(pages, rapport), rapport)
        numerotes = numeroter(bruts, langue=langue, document=identifiant, depart=suivants[langue] + 1)
        suivants[langue] += len(numerotes)
        descripteurs.extend(numerotes)
        rapports[chemin.name] = rapport
        documents.append(
            DocumentPdf(
                identifiant=identifiant,
                titre="CECR — Volume complémentaire (Conseil de l'Europe)",
                fichier=chemin.name[:200],
                langue=langue,
                pages=max(1, len(pages)),
                empreinte_sha256=empreinte_fichier(chemin),
            )
        )

    if not descripteurs:
        raise ValueError("Aucun descripteur n'a pu être extrait : vérifier les sources (PDF scanné ? mise en page ?).")
    manifeste = composer_manifeste(
        descripteurs,
        version=version,
        documents=documents,
        licence=LicenceCorpus(
            statut="non_clarifiee",
            citation="© Conseil de l'Europe, 2020",
            note=(
                "Extraction automatisée de PDF sous droits : corpus interne, non distribué, non commercial, "
                "à n'activer qu'avec une autorisation écrite (RAG_CORPUS_OFFICIEL_AUTORISE=true)."
            ),
        ),
    )
    return manifeste, descripteurs, rapports


def ecrire_corpus(dossier: Path, manifeste: ManifestePdf, descripteurs: Sequence[DescripteurPdf]) -> None:
    """Écrire le manifeste et les descripteurs en octets, pour une empreinte reproductible."""
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / FICHIER_MANIFESTE).write_bytes((manifeste.model_dump_json(indent=2) + "\n").encode("utf-8"))
    (dossier / FICHIER_DESCRIPTEURS).write_bytes(serialiser_descripteurs(descripteurs))


def construire_arguments() -> argparse.ArgumentParser:
    analyseur = argparse.ArgumentParser(description="Génère le corpus CECRL depuis les PDF, hors du dépôt.")
    analyseur.add_argument(
        "--source", required=True, type=Path, action="append", help="PDF ou dossier de PDF (répétable)"
    )
    analyseur.add_argument("--sortie", required=True, type=Path, help="dossier de sortie, hors du dépôt")
    analyseur.add_argument("--version", default=VERSION_PAR_DEFAUT, help="étiquette du corpus, 32 caractères au plus")
    analyseur.add_argument(
        "--langue",
        action="append",
        default=[],
        metavar="FICHIER=LANGUE",
        help="forcer la langue d'un PDF (fr, en, it, de) si la détection automatique se trompe",
    )
    analyseur.add_argument("--extracteur", choices=("auto", "pdftotext", "pypdf"), default="auto")
    return analyseur


def main(argv: Sequence[str] | None = None) -> int:
    """Générer le corpus et afficher un rapport chiffré, sans aucun texte de descripteur."""
    arguments = construire_arguments().parse_args(argv)
    try:
        dossier = verifier_sortie_hors_depot(arguments.sortie)
        forcees = dict(valeur.split("=", 1) for valeur in arguments.langue)
        manifeste, descripteurs, rapports = ingerer(
            arguments.source, version=arguments.version, langues_forcees=forcees, extracteur=arguments.extracteur
        )
        ecrire_corpus(dossier, manifeste, descripteurs)
    except (ValueError, OSError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"Échec de l'ingestion : {exc}", file=sys.stderr)
        return 1

    print(f"Corpus {manifeste.version} écrit dans {dossier}")
    for document in manifeste.documents:
        rapport = rapports[document.fichier]
        print(f"- {document.fichier} [{document.identifiant}, {document.langue}, {document.pages} pages]")
        print(f"    retenus par section : {dict(sorted(rapport.par_section.items()))}")
        print(f"    écartés hors périmètre (médiation, stratégies…) : {sum(rapport.ecartees_hors_perimetre.values())}")
        print(
            f"    écartés : sans descripteur {rapport.ecartees_sans_descripteur}, pré-A1 {rapport.ecartees_pre_a1}, "
            f"hors section {rapport.ecartees_sans_section}, doublons {rapport.doublons}"
        )
    print(f"  total : {manifeste.comptages.total}")
    print(f"  par niveau : {manifeste.comptages.par_niveau}")
    print(f"  par compétence : {manifeste.comptages.par_competence}")
    print(f"  empreinte : {manifeste.empreinte_descripteurs_sha256}")
    print("Rappel : activer seulement avec une autorisation écrite (RAG_CORPUS_OFFICIEL_AUTORISE=true).")
    return 0


if __name__ == "__main__":  # pragma: no cover - point d'entrée CLI
    raise SystemExit(main())
