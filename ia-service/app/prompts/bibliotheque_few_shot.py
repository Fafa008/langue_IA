"""Bibliothèque versionnée d'exemples pédagogiques anonymes pour le diagnostic."""

import json
from pathlib import Path

from pydantic import ValidationError

from app.core.erreurs import ErreurRegistre
from app.prompts.variables import ExempleFewShot, ScenarioDiagnostic
from app.schemas.regles import CodeLangue

_SCENARIOS: tuple[ScenarioDiagnostic, ...] = ("quotidien", "entretien", "examen")
_LANGUES: tuple[CodeLangue, ...] = ("fr", "en", "zh", "it", "de")


class BibliothequeFewShot:
    """Charge une fois les exemples et sélectionne un exemple exact par scénario et langue."""

    def __init__(self, repertoire: Path | None = None) -> None:
        self._repertoire = repertoire or Path(__file__).parent / "exemples" / "diagnostic"
        self._exemples = self._charger()

    def selectionner(self, scenario: ScenarioDiagnostic, code_langue: CodeLangue) -> tuple[ExempleFewShot, ...]:
        """Retourner l'exemple correspondant exactement, sans repli vers une autre langue ou un autre scénario."""
        exemples = self._exemples.get((scenario, code_langue), ())
        if not exemples:
            raise ErreurRegistre(
                f"Aucun exemple few-shot n'est disponible pour le scénario {scenario} et la langue {code_langue}."
            )
        return exemples[:1]

    def _charger(self) -> dict[tuple[ScenarioDiagnostic, CodeLangue], tuple[ExempleFewShot, ...]]:
        catalogue: dict[tuple[ScenarioDiagnostic, CodeLangue], list[ExempleFewShot]] = {}
        for scenario in _SCENARIOS:
            chemin = self._repertoire / f"{scenario}.json"
            try:
                contenu = json.loads(chemin.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                message = f"Le fichier de la bibliothèque few-shot est absent ou invalide ({scenario})."
                raise ErreurRegistre(message) from None
            if not isinstance(contenu, list) or not contenu:
                raise ErreurRegistre(f"Le fichier few-shot {scenario} doit contenir une liste non vide.")

            for donnees in contenu:
                try:
                    exemple = ExempleFewShot.model_validate(donnees)
                except ValidationError:
                    raise ErreurRegistre(f"Un exemple few-shot du scénario {scenario} est invalide.") from None
                if exemple.scenario != scenario:
                    raise ErreurRegistre(f"Un exemple few-shot est rangé dans le mauvais scénario ({scenario}).")
                langue = exemple.entree.contexte_apprenant.code_langue
                cle = (scenario, langue)
                if cle in catalogue:
                    raise ErreurRegistre(
                        f"Plusieurs exemples few-shot sont déclarés pour le scénario {scenario} et la langue {langue}."
                    )
                catalogue[cle] = [exemple]

        attendus = {(scenario, langue) for scenario in _SCENARIOS for langue in _LANGUES}
        absents = attendus - catalogue.keys()
        if absents:
            scenario, langue = sorted(absents)[0]
            raise ErreurRegistre(f"Exemple few-shot manquant pour le scénario {scenario} et la langue {langue}.")
        return {cle: tuple(exemples) for cle, exemples in catalogue.items()}
