"""Corpus expérimental CARCL : adaptateur des exercices pédagogiques non officiels.

Les 27 JSON du dossier ``corpus/cecrl`` décrivent des **exercices originaux alignés sur le CECRL**, pas des
descripteurs officiels. Ils ne peuvent donc pas passer par :class:`app.rag.corpus.DescripteurCorpus` : ce schéma
exige un identifiant ``cecrl:…``, une échelle et un numéro de source, c'est-à-dire trois champs qui falsifieraient
la provenance. Ce module définit un schéma distinct, ``ExerciceExperimental``, et un chargement dédié.

Aucun PDF officiel, aucun descripteur officiel, aucune licence et aucun auteur ne sont introduits ici. Les champs
de provenance absents des JSON restent explicitement ``None`` dans le manifeste.
"""

from __future__ import annotations

import hashlib
import json
import unicodedata
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator

from app.core.erreurs import ErreurCorpusIndisponible
from app.rag.base import VERSION_CORPUS_EXPERIMENTAL
from app.schemas.base import ModeleStrict
from app.schemas.regles import CodeLangue, Competence, NiveauCecrl, Referentiel

FICHIER_MANIFESTE_EXPERIMENTAL = "manifeste-experimental.json"
TYPE_MANIFESTE = "exercices_pedagogiques_non_officiels"
SHA256 = r"^[0-9a-f]{64}$"

# Les dossiers sont ceux des 27 JSON suivis par Git. La normalisation ASCII tolère « français » sur tous les
# systèmes de fichiers. Les trois agrégats `*cefr*` sont exclus : ils dupliquent exactement les fichiers de niveau.
LANGUES_PAR_DOSSIER = {
    "anglais": "en",
    "deutsch": "de",
    "francais": "fr",
    "italian": "it",
}

GROUPES_EXERCICES: tuple[tuple[str, Literal["exercice_qa", "exercice_qcm"]], ...] = (
    ("question_answer", "exercice_qa"),
    ("mcq", "exercice_qcm"),
    ("open_questions", "exercice_qa"),
    ("multiple_choice_questions", "exercice_qcm"),
    ("multiple_choice", "exercice_qcm"),
)

_PREFIXE_NON_OFFICIEL = (
    "[Exercice pédagogique non officiel — corpus "
    f"{VERSION_CORPUS_EXPERIMENTAL} — pas un descripteur officiel du CECRL] "
)


class ExerciceExperimental(ModeleStrict):
    """Un exercice pédagogique, jamais un descripteur officiel."""

    identifiant: str = Field(
        pattern=r"^carcl:[a-z]{2}:(A1|A2|B1|B2|C1|C2):exercice_(qa|qcm):[A-Za-z0-9_-]+$",
        max_length=128,
    )
    nature: Literal["exercice_qa", "exercice_qcm"]
    code_langue: CodeLangue
    referentiel: Referentiel
    niveau: NiveauCecrl
    competence: Competence
    question: str = Field(min_length=1, max_length=1000)
    options: tuple[str, ...] = ()
    texte_bm25: str = Field(min_length=1, max_length=3000)
    contenu: str = Field(min_length=1, max_length=3000)
    source_fichier: str = Field(min_length=1, max_length=200)
    id_original: str = Field(min_length=1, max_length=64)
    non_officiel: Literal[True] = True

    @model_validator(mode="after")
    def verifier_coherence(self) -> ExerciceExperimental:
        """Le préfixe, le référentiel et l'étiquette non officielle doivent rester cohérents."""
        if not self.identifiant.startswith(f"carcl:{self.code_langue}:{self.niveau}:{self.nature}:"):
            raise ValueError("L'identifiant CARCL ne correspond pas à la langue, au niveau ou à la nature.")
        if self.referentiel != "CECRL":
            raise ValueError("Le corpus expérimental ne prend en charge que le référentiel CECRL.")
        return self


class FichierSourceExperimental(ModeleStrict):
    """Empreinte d'un fichier JSON source, relative au dossier du corpus."""

    chemin: str = Field(min_length=1, max_length=200)
    octets: int = Field(ge=1)
    sha256: str = Field(pattern=SHA256)


class ComptagesExperimental(ModeleStrict):
    """Volumétrie vérifiée à l'identique au chargement."""

    total: int = Field(ge=0)
    par_langue: dict[str, int]
    par_niveau: dict[str, int]
    par_nature: dict[str, int]

    @model_validator(mode="after")
    def verifier_totaux(self) -> ComptagesExperimental:
        """Refuser un manifeste dont les totaux ne correspondent pas au détail."""
        detail = (self.par_langue, self.par_niveau, self.par_nature)
        if any(valeur < 0 for groupe in detail for valeur in groupe.values()):
            raise ValueError("Un comptage du manifeste expérimental est négatif.")
        if any(sum(groupe.values()) != self.total for groupe in detail):
            raise ValueError("La somme des comptages diffère du total du manifeste expérimental.")
        return self


class ManifesteExperimental(ModeleStrict):
    """Métadonnées du corpus expérimental, sans droit ni origine officielle supposés."""

    type: Literal["exercices_pedagogiques_non_officiels"] = TYPE_MANIFESTE
    version: str = Field(pattern=r"^carcl-experimental-[0-9]{4}\.[0-9]+$", max_length=32)
    genere_le: date
    description: str = Field(min_length=1, max_length=500)
    licence: Literal[None] = None
    auteur: Literal[None] = None
    non_officiel: Literal[True] = True
    fichiers: tuple[FichierSourceExperimental, ...] = Field(min_length=1)
    comptages: ComptagesExperimental
    empreinte_corpus_sha256: str = Field(pattern=SHA256)


@dataclass(frozen=True, slots=True)
class CorpusExperimental:
    """Exercices chargés, version et manifeste éventuellement vérifié."""

    exercices: tuple[ExerciceExperimental, ...]
    version: str = VERSION_CORPUS_EXPERIMENTAL
    manifeste: ManifesteExperimental | None = None


def _ascii(texte: str) -> str:
    """Retirer les accents, uniquement pour la correspondance des noms de dossiers."""
    decompose = unicodedata.normalize("NFKD", texte.casefold())
    return "".join(caractere for caractere in decompose if not unicodedata.combining(caractere))


def _propre(texte: object) -> str:
    """Normaliser un champ textuel sans en changer le sens."""
    return " ".join(str(texte).split()) if texte is not None else ""


def _langue_du_dossier(chemin: Path, dossier: Path) -> CodeLangue | None:
    """Déduire le code langue du dossier, seule source stable pour l'anglais, le français et l'italien."""
    relatif = chemin.relative_to(dossier)
    if len(relatif.parts) < 2:
        return None
    return LANGUES_PAR_DOSSIER.get(_ascii(relatif.parts[0]))


def _niveau(item: Mapping[str, object], donnees: Mapping[str, object]) -> str:
    """Lire le niveau de l'item, en dernier recours celui de la racine."""
    brut = item.get("level") or item.get("cefr_level")
    if not brut:
        racine = donnees.get("metadata") or donnees.get("level_descriptor") or donnees.get("cefr_level")
        brut = racine.get("level") if isinstance(racine, Mapping) else racine
    return _propre(brut).upper()


def _options(item: Mapping[str, object]) -> tuple[str, ...]:
    """Extraire les textes d'options, quelle que soit la clé d'identifiant utilisée."""
    brutes = item.get("options")
    if not isinstance(brutes, Sequence) or isinstance(brutes, str | bytes):
        return ()
    return tuple(_propre(option.get("text")) for option in brutes if isinstance(option, Mapping) and option.get("text"))


def _texte_reponse_correcte(item: Mapping[str, object], options: Sequence[str]) -> str:
    """Résoudre ``correct_answer`` (texte ou lettre) pour ne pas indexer une lettre sans contexte."""
    brut = item.get("correct_answer")
    if not isinstance(brut, str) or not brut.strip():
        return ""
    if brut in options:
        return brut
    lettre = brut.strip().upper()
    if len(lettre) == 1 and "A" <= lettre <= "E":
        index = ord(lettre) - ord("A")
        if index < len(options):
            return options[index]
    return ""


def _competence_heuristique(nature: str, item: Mapping[str, object], texte: str) -> Competence:
    """Attribuer une compétence fermée de façon conservative et documentée.

    Les exercices ne déclarent aucune compétence CECRL. Cette heuristique sert uniquement au filtrage BM25 ; elle
    ne doit jamais être présentée comme une compétence certifiée par un référentiel officiel. ``ecoute`` n'est
    attribuée que si un indice explicite (audio, écoute, listening) est présent.
    """
    indice = " ".join((texte, _propre(item.get("skill")), _propre(item.get("task_instruction")))).casefold()
    motifs: tuple[tuple[Competence, tuple[str, ...]], ...] = (
        (
            "grammaire",
            (
                "grammar",
                "grammatical",
                "syntax",
                "tense",
                "subjonctif",
                "passe compose",
                "préposition",
                "preposition",
                "conjug",
                "completa",
                "complétez",
                "costruzione",
                "form ist korrekt",
                "accord",
            ),
        ),
        ("ecoute", ("listening", "audio", "écoute", "ecoute", "hören", "hoeren", "ascolto")),
        ("ecrit", ("write", "writing", "écrivez", "écrire", "rédigez", "scrivi", "schreiben", "composition")),
        (
            "oral",
            (
                "greeting",
                "introduce yourself",
                "conversation",
                "conversazione",
                "speaking",
                "parlez",
                "dites",
                "sprich",
                "sprechen",
                "parli",
                "dialogue",
            ),
        ),
    )
    for competence, mots_cles in motifs:
        if any(mot in indice for mot in mots_cles):
            return competence
    # Un QCM est une lecture avant d'être autre chose ; un exercice à réponse ouverte sans indice explicite
    # reste également classé en lecture plutôt que d'être deviné oral ou écrit.
    return "lecture"


def _construire_exercice(
    item: Mapping[str, object],
    *,
    nature: Literal["exercice_qa", "exercice_qcm"],
    langue: CodeLangue,
    donnees: Mapping[str, object],
    source_fichier: str,
) -> ExerciceExperimental:
    """Projeter un item JSON sur le schéma expérimental, sans inventer de provenance."""
    question = _propre(item.get("question"))
    identifiant_original = _propre(item.get("id"))
    niveau = _niveau(item, donnees)
    if not question or not identifiant_original or niveau not in {"A1", "A2", "B1", "B2", "C1", "C2"}:
        raise ErreurCorpusIndisponible("Un exercice du corpus expérimental est incomplet.")

    options = _options(item)
    morceaux = [question]
    if nature == "exercice_qa":
        morceaux.extend(filter(None, (_propre(item.get("answer")), _propre(item.get("task_instruction")))))
    else:
        morceaux.extend(options)
        morceaux.extend(filter(None, (_texte_reponse_correcte(item, options),)))
    texte_bm25 = " ".join(morceaux)[:3000]
    contenu = f"{_PREFIXE_NON_OFFICIEL}{texte_bm25}"[:3000]

    return ExerciceExperimental(
        identifiant=f"carcl:{langue}:{niveau}:{nature}:{identifiant_original}",
        nature=nature,
        code_langue=langue,
        referentiel="CECRL",
        niveau=niveau,  # type: ignore[arg-type]
        competence=_competence_heuristique(nature, item, texte_bm25),
        question=question,
        options=options,
        texte_bm25=texte_bm25,
        contenu=contenu,
        source_fichier=source_fichier,
        id_original=identifiant_original,
    )


def _cle_dedup(exercice: ExerciceExperimental) -> tuple[object, ...]:
    """Dédupliquer par énoncé exact, et par énoncé + options pour les QCM.

    La normalisation doit rester littérale : les exercices anglais comportent des « Practice variation 2…9 »
    dont le numéro disparaîtrait avec la tokenisation BM25, ce qui effacerait à tort neuf exercices sur dix.
    """
    base: tuple[object, ...] = (
        exercice.code_langue,
        exercice.niveau,
        exercice.nature,
        exercice.question.casefold(),
    )
    if exercice.nature == "exercice_qcm":
        return (*base, tuple(sorted(option.casefold() for option in exercice.options)))
    return base


def _fichiers_sources(dossier: Path) -> list[Path]:
    """Lister les 24 fichiers de niveau, hors agrégats et hors manifestes."""
    if not dossier.is_dir():
        raise ErreurCorpusIndisponible("Le dossier du corpus expérimental est absent.")
    fichiers = [
        chemin
        for chemin in sorted(dossier.rglob("*.json"))
        if not chemin.name.startswith("manifeste") and "cefr" not in chemin.name.casefold()
    ]
    if not fichiers:
        raise ErreurCorpusIndisponible("Aucun fichier d'exercice expérimental n'a été trouvé.")
    return fichiers


def empreinte_fichiers(fichiers: Sequence[FichierSourceExperimental]) -> str:
    """Empreinte déterministe de la liste des fichiers sources et de leurs empreintes."""
    canonique = "".join(f"{fichier.chemin}\0{fichier.sha256}\n" for fichier in sorted(fichiers, key=lambda f: f.chemin))
    return hashlib.sha256(canonique.encode("utf-8")).hexdigest()


def _verifier_manifeste(dossier: Path, fichiers: Sequence[Path]) -> ManifesteExperimental:
    """Refuser un corpus dont un fichier source a changé par rapport au manifeste vérifié."""
    chemin = dossier / FICHIER_MANIFESTE_EXPERIMENTAL
    try:
        manifeste = ManifesteExperimental.model_validate(json.loads(chemin.read_text(encoding="utf-8")))
    except (OSError, ValueError) as exc:
        raise ErreurCorpusIndisponible("Le manifeste du corpus expérimental est illisible.") from exc

    attendus = {fichier.chemin: fichier for fichier in manifeste.fichiers}
    trouves = {fichier.relative_to(dossier).as_posix() for fichier in fichiers}
    if set(attendus) != trouves:
        raise ErreurCorpusIndisponible("La liste des fichiers du corpus expérimental ne correspond pas au manifeste.")
    for relatif, fichier in attendus.items():
        donnees = (dossier / relatif).read_bytes()
        if len(donnees) != fichier.octets or hashlib.sha256(donnees).hexdigest() != fichier.sha256:
            raise ErreurCorpusIndisponible("Un fichier du corpus expérimental ne correspond plus à son empreinte.")
    if empreinte_fichiers(manifeste.fichiers) != manifeste.empreinte_corpus_sha256:
        raise ErreurCorpusIndisponible("L'empreinte globale du corpus expérimental est incohérente.")
    return manifeste


def charger_corpus_experimental(dossier: Path, *, verifier_empreinte: bool) -> CorpusExperimental:
    """Charger, dédupliquer et vérifier les exercices pédagogiques du dossier indiqué."""
    fichiers = _fichiers_sources(dossier)
    manifeste = _verifier_manifeste(dossier, fichiers) if verifier_empreinte else None

    exercices: list[ExerciceExperimental] = []
    vus: set[tuple[object, ...]] = set()
    for chemin in fichiers:
        langue = _langue_du_dossier(chemin, dossier)
        if langue is None:
            continue
        try:
            donnees = json.loads(chemin.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise ErreurCorpusIndisponible("Un fichier d'exercices expérimentaux est illisible.") from exc
        if not isinstance(donnees, Mapping):
            raise ErreurCorpusIndisponible("La racine d'un fichier d'exercices est invalide.")

        for cle, nature in GROUPES_EXERCICES:
            items = donnees.get(cle)
            if not isinstance(items, Sequence) or isinstance(items, str | bytes):
                continue
            for item in items:
                if not isinstance(item, Mapping):
                    raise ErreurCorpusIndisponible("Un exercice expérimental est invalide.")
                exercice = _construire_exercice(
                    item,
                    nature=nature,
                    langue=langue,
                    donnees=donnees,
                    source_fichier=chemin.relative_to(dossier).as_posix(),
                )
                cle_dedup = _cle_dedup(exercice)
                if cle_dedup in vus:
                    continue
                vus.add(cle_dedup)
                exercices.append(exercice)

    if not exercices:
        raise ErreurCorpusIndisponible("Aucun exercice exploitable n'a été trouvé dans le corpus expérimental.")
    exercices.sort(key=lambda exercice: (exercice.code_langue, exercice.niveau, exercice.nature, exercice.id_original))

    if manifeste is not None:
        langues = Counter(exercice.code_langue for exercice in exercices)
        niveaux = Counter(exercice.niveau for exercice in exercices)
        natures = Counter(exercice.nature for exercice in exercices)
        if manifeste.comptages.total != len(exercices):
            raise ErreurCorpusIndisponible("Le comptage du manifeste expérimental est incorrect.")
        if (
            dict(manifeste.comptages.par_langue) != dict(langues)
            or dict(manifeste.comptages.par_niveau) != dict(niveaux)
            or dict(manifeste.comptages.par_nature) != dict(natures)
        ):
            raise ErreurCorpusIndisponible("Les facettes du manifeste expérimental sont incorrectes.")

    version = manifeste.version if manifeste is not None else VERSION_CORPUS_EXPERIMENTAL
    return CorpusExperimental(exercices=tuple(exercices), version=version, manifeste=manifeste)
