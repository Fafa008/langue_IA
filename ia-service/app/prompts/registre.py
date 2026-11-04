"""Chargement, validation, versionnement et rendu des prompts partagés."""

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from string import Template

from app.core.erreurs import ErreurPromptIntrouvable, ErreurRegistre
from app.llm.base import MessageLLM
from app.prompts.bibliotheque_few_shot import BibliothequeFewShot
from app.prompts.variables import ExempleFewShot, VariablesEvaluationDiagnostic

VERSION_EVALUATION_DIAGNOSTIC = "1.1.0"
_VARIABLES_TEMPLATE = frozenset(
    {
        "code_langue",
        "referentiel",
        "reponses",
        "score_preliminaire",
        "contexte_apprenant",
        "descripteurs_rag",
        "exemples_few_shot",
    }
)
_NOMBRE_EXEMPLES_MAX = 3


@dataclass(frozen=True, slots=True)
class PromptRendu:
    """Messages prêts pour le client LLM et métadonnées d'audit du prompt."""

    messages: tuple[MessageLLM, MessageLLM]
    version_prompt: str
    empreinte_prompt: str
    temperature: float
    max_tokens: int


@dataclass(frozen=True, slots=True)
class _DefinitionPrompt:
    """Ressources immuables chargées et validées une fois par registre."""

    version_prompt: str
    systeme: str
    template_utilisateur: Template
    exemples: tuple[ExempleFewShot, ...]
    empreinte_prompt: str
    temperature: float
    max_tokens: int


class RegistrePrompts:
    """Registre partagé des prompts ; une version publiée est identifiée par son nom de fichier."""

    def __init__(
        self,
        repertoire: Path | None = None,
        *,
        bibliotheque_few_shot: BibliothequeFewShot | None = None,
    ) -> None:
        self._repertoire = repertoire or Path(__file__).parent
        self._bibliotheque_few_shot = bibliotheque_few_shot or BibliothequeFewShot()
        self._definitions = {
            ("diagnostic", "evaluation", VERSION_EVALUATION_DIAGNOSTIC): self._charger_evaluation_diagnostic()
        }

    def rendre_evaluation_diagnostic(
        self,
        variables: VariablesEvaluationDiagnostic,
        *,
        version: str = VERSION_EVALUATION_DIAGNOSTIC,
    ) -> PromptRendu:
        """Rendre le prompt d'évaluation diagnostic à partir de variables validées."""
        definition = self._definition_evaluation_diagnostic(version)

        donnees = variables.model_dump(mode="json")
        exemples = variables.exemples_few_shot
        if exemples is None:
            exemples = list(self._bibliotheque_few_shot.selectionner(variables.scenario, variables.code_langue))
        if len(exemples) > _NOMBRE_EXEMPLES_MAX:
            raise ErreurRegistre(f"Un prompt accepte {_NOMBRE_EXEMPLES_MAX} exemples few-shot au maximum.")
        if any(
            exemple.scenario != variables.scenario
            or exemple.entree.contexte_apprenant.code_langue != variables.code_langue
            for exemple in exemples
        ):
            raise ErreurRegistre("Les exemples few-shot doivent correspondre au scénario et à la langue du diagnostic.")
        donnees["exemples_few_shot"] = [exemple.model_dump(mode="json") for exemple in exemples]

        valeurs = {nom: _json_prompt(donnees[nom]) for nom in _VARIABLES_TEMPLATE}
        contenu_utilisateur = definition.template_utilisateur.substitute(valeurs)
        empreinte = hashlib.sha256(
            b"\0".join(
                (
                    definition.empreinte_prompt.encode("ascii"),
                    _json_prompt(donnees["exemples_few_shot"]).encode("utf-8"),
                )
            )
        ).hexdigest()
        return PromptRendu(
            messages=(
                MessageLLM(role="system", contenu=definition.systeme),
                MessageLLM(role="user", contenu=contenu_utilisateur),
            ),
            version_prompt=definition.version_prompt,
            empreinte_prompt=f"sha256:{empreinte}",
            temperature=definition.temperature,
            max_tokens=definition.max_tokens,
        )

    def identite_evaluation_diagnostic(
        self,
        *,
        version: str = VERSION_EVALUATION_DIAGNOSTIC,
    ) -> tuple[str, str]:
        """Retourner ``(version_prompt, empreinte_prompt)`` publiés pour la définition d'un agent.

        L'empreinte couvre les ressources versionnées du prompt. Le rendu en dérive une empreinte propre à
        l'exemple few-shot sélectionné, mais ``DefinitionAgent`` doit être construit avant toute requête : il
        référence donc les ressources publiées.
        """
        definition = self._definition_evaluation_diagnostic(version)
        return definition.version_prompt, definition.empreinte_prompt

    def _definition_evaluation_diagnostic(self, version: str) -> _DefinitionPrompt:
        definition = self._definitions.get(("diagnostic", "evaluation", version))
        if definition is None:
            raise ErreurPromptIntrouvable("La version du prompt d'évaluation diagnostic est introuvable.")
        return definition

    def _charger_evaluation_diagnostic(self) -> _DefinitionPrompt:
        nom = f"evaluation@{VERSION_EVALUATION_DIAGNOSTIC}"
        repertoire = self._repertoire / "diagnostic"
        systeme = self._lire(repertoire / f"{nom}.systeme.md")
        texte_utilisateur = self._lire(repertoire / f"{nom}.utilisateur.md")
        texte_exemples = self._lire(repertoire / f"{nom}.jsonl")
        template = _valider_template(texte_utilisateur)
        exemples = _charger_exemples(texte_exemples)

        empreinte = hashlib.sha256(
            b"\0".join(
                (
                    systeme.encode("utf-8"),
                    texte_utilisateur.encode("utf-8"),
                    texte_exemples.encode("utf-8"),
                )
            )
        ).hexdigest()
        return _DefinitionPrompt(
            version_prompt=f"diagnostic/evaluation@{VERSION_EVALUATION_DIAGNOSTIC}",
            systeme=systeme.strip(),
            template_utilisateur=template,
            exemples=exemples,
            empreinte_prompt=f"sha256:{empreinte}",
            temperature=0.2,
            max_tokens=900,
        )

    @staticmethod
    def _lire(chemin: Path) -> str:
        try:
            return chemin.read_text(encoding="utf-8")
        except OSError:
            raise ErreurPromptIntrouvable("Une ressource du prompt d'évaluation diagnostic est introuvable.") from None


def _valider_template(texte: str) -> Template:
    if not texte.strip():
        raise ErreurRegistre("Le template utilisateur du diagnostic ne peut pas être vide.")
    variables: set[str] = set()
    for correspondance in Template.pattern.finditer(texte):
        if correspondance.group("invalid") is not None:
            raise ErreurRegistre("Le template utilisateur contient un marqueur de substitution invalide.")
        nom = correspondance.group("named") or correspondance.group("braced")
        if nom is not None:
            variables.add(nom)
    if variables != _VARIABLES_TEMPLATE:
        manquantes = sorted(_VARIABLES_TEMPLATE - variables)
        inattendues = sorted(variables - _VARIABLES_TEMPLATE)
        details = []
        if manquantes:
            details.append("variables manquantes : " + ", ".join(manquantes))
        if inattendues:
            details.append("variables inattendues : " + ", ".join(inattendues))
        raise ErreurRegistre("Le template utilisateur est invalide (" + "; ".join(details) + ").")
    return Template(texte.strip())


def _charger_exemples(texte: str) -> tuple[ExempleFewShot, ...]:
    exemples: list[ExempleFewShot] = []
    try:
        for ligne in texte.splitlines():
            if ligne.strip():
                exemples.append(ExempleFewShot.model_validate_json(ligne))
    except (ValueError, TypeError):
        raise ErreurRegistre("Le fichier few-shot contient un exemple invalide.") from None
    if not exemples or len(exemples) > _NOMBRE_EXEMPLES_MAX:
        raise ErreurRegistre(f"Le fichier few-shot doit contenir de 1 à {_NOMBRE_EXEMPLES_MAX} exemples valides.")
    return tuple(exemples)


def _json_prompt(valeur: object) -> str:
    """Sérialiser les valeurs en JSON sans laisser de balise injectée fermer le bloc de données."""
    return (
        json.dumps(valeur, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        .replace("&", "\\u0026")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
    )
