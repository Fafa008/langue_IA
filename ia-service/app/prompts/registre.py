"""Chargement, validation, versionnement et rendu des prompts partagés."""

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from string import Template

from app.core.erreurs import ErreurPromptIntrouvable, ErreurRegistre
from app.llm.base import MessageLLM
from app.prompts.bibliotheque_few_shot import BibliothequeFewShot
from app.prompts.variables import (
    ExempleFewShot,
    VariablesConversationChatbot,
    VariablesConversationChatbotV2,
    VariablesCorrectionChatbot,
    VariablesCorrectionReponseLibre,
    VariablesEvaluationDiagnostic,
    VariablesExerciceChatbot,
    VariablesMemoireChatbot,
    VariablesRecommandation,
    VariablesTraductionChatbot,
)

VERSION_EVALUATION_DIAGNOSTIC = "1.1.0"
VERSION_CONVERSATION_CHATBOT = "1.2.0"
VERSION_CONVERSATION_CHATBOT_V2 = "1.3.0"
VERSION_CORRECTION_CHATBOT = "1.0.0"
VERSION_TRADUCTION_CHATBOT = "1.0.0"
VERSION_MEMOIRE_CHATBOT = "1.0.0"
VERSION_EXERCICE_CHATBOT = "1.0.0"
VERSION_CORRECTION_REPONSE_LIBRE = "1.0.0"
VERSION_ACTIONS_RECOMMANDATION = "1.0.0"
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
_VARIABLES_TEMPLATE_CHATBOT = frozenset({"contexte_apprenant", "historique", "message"})
_VARIABLES_TEMPLATE_CHATBOT_V2 = frozenset(
    {
        "contexte_apprenant",
        "historique",
        "message",
        "descripteurs_rag",
        "phase_assimil",
        "niveau_effectif",
        "niveau_confirme",
    }
)
_VARIABLES_TEMPLATE_CORRECTION_CHATBOT = frozenset({"message", "niveau_effectif", "phase_assimil", "resume_session"})
_VARIABLES_TEMPLATE_TRADUCTION_CHATBOT = frozenset({"message", "code_langue", "niveau_effectif"})
_VARIABLES_TEMPLATE_MEMOIRE_CHATBOT = frozenset(
    {"code_langue", "referentiel", "niveau_effectif", "phase_assimil", "resume_session", "tours"}
)
_VARIABLES_TEMPLATE_EXERCICE_CHATBOT = frozenset(
    {"contexte_apprenant", "type_erreur", "erreur", "niveau_effectif", "descripteurs_rag"}
)
_VARIABLES_TEMPLATE_CORRECTION = frozenset({"contexte_apprenant", "phase", "exercice", "descripteurs_rag"})
_VARIABLES_TEMPLATE_RECOMMANDATION = frozenset({"contexte_apprenant", "points_faibles", "niveau_vise"})
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
            ("diagnostic", "evaluation", VERSION_EVALUATION_DIAGNOSTIC): self._charger_evaluation_diagnostic(),
            ("chatbot", "conversation", VERSION_CONVERSATION_CHATBOT): self._charger_conversation_chatbot(),
            (
                "chatbot",
                "conversation",
                VERSION_CONVERSATION_CHATBOT_V2,
            ): self._charger_conversation_chatbot_v2(),
            ("chatbot", "correction", VERSION_CORRECTION_CHATBOT): self._charger_correction_chatbot(),
            ("chatbot", "traduction", VERSION_TRADUCTION_CHATBOT): self._charger_traduction_chatbot(),
            ("chatbot", "memoire", VERSION_MEMOIRE_CHATBOT): self._charger_memoire_chatbot(),
            ("chatbot", "exercice", VERSION_EXERCICE_CHATBOT): self._charger_exercice_chatbot(),
            (
                "correction",
                "reponse-libre",
                VERSION_CORRECTION_REPONSE_LIBRE,
            ): self._charger_correction_reponse_libre(),
            (
                "recommandation",
                "actions",
                VERSION_ACTIONS_RECOMMANDATION,
            ): self._charger_actions_recommandation(),
        }

    def definition(self, agent: str, tache: str, version: str) -> tuple[str, str]:
        """Version et empreinte d'un prompt publié, pour déclarer un agent sans rendre le prompt."""
        definition = self._definitions.get((agent, tache, version))
        if definition is None:
            raise ErreurPromptIntrouvable("La version de prompt demandée est introuvable.")
        return definition.version_prompt, definition.empreinte_prompt

    def rendre_conversation_chatbot(
        self,
        variables: VariablesConversationChatbot,
        *,
        version: str = VERSION_CONVERSATION_CHATBOT,
    ) -> PromptRendu:
        """Rendre le prompt de conversation du chatbot à partir de variables validées."""
        definition = self._definitions.get(("chatbot", "conversation", version))
        if definition is None:
            raise ErreurPromptIntrouvable("La version du prompt de conversation du chatbot est introuvable.")

        donnees = variables.model_dump(mode="json")
        valeurs = {nom: _json_prompt(donnees[nom]) for nom in _VARIABLES_TEMPLATE_CHATBOT}
        contenu_utilisateur = definition.template_utilisateur.substitute(valeurs)
        return PromptRendu(
            messages=(
                MessageLLM(role="system", contenu=definition.systeme),
                MessageLLM(role="user", contenu=contenu_utilisateur),
            ),
            version_prompt=definition.version_prompt,
            empreinte_prompt=definition.empreinte_prompt,
            temperature=definition.temperature,
            max_tokens=definition.max_tokens,
        )

    def rendre_conversation_chatbot_v2(
        self,
        variables: VariablesConversationChatbotV2,
        *,
        version: str = VERSION_CONVERSATION_CHATBOT_V2,
    ) -> PromptRendu:
        """Rendre le prompt 1.3.0 : même réponse, avec CECRL et phase Assimil en contexte."""
        definition = self._definitions.get(("chatbot", "conversation", version))
        if definition is None:
            raise ErreurPromptIntrouvable("La version du prompt de conversation du chatbot est introuvable.")

        donnees = variables.model_dump(mode="json")
        valeurs = {nom: _json_prompt(donnees[nom]) for nom in _VARIABLES_TEMPLATE_CHATBOT_V2}
        contenu_utilisateur = definition.template_utilisateur.substitute(valeurs)
        return PromptRendu(
            messages=(
                MessageLLM(role="system", contenu=definition.systeme),
                MessageLLM(role="user", contenu=contenu_utilisateur),
            ),
            version_prompt=definition.version_prompt,
            empreinte_prompt=definition.empreinte_prompt,
            temperature=definition.temperature,
            max_tokens=definition.max_tokens,
        )

    def rendre_correction_chatbot(
        self,
        variables: VariablesCorrectionChatbot,
        *,
        version: str = VERSION_CORRECTION_CHATBOT,
    ) -> PromptRendu:
        """Rendre le prompt de correction en marge du chat (JSON strict)."""
        definition = self._definitions.get(("chatbot", "correction", version))
        if definition is None:
            raise ErreurPromptIntrouvable("La version du prompt de correction du chatbot est introuvable.")

        donnees = variables.model_dump(mode="json")
        valeurs = {nom: _json_prompt(donnees[nom]) for nom in _VARIABLES_TEMPLATE_CORRECTION_CHATBOT}
        return PromptRendu(
            messages=(
                MessageLLM(role="system", contenu=definition.systeme),
                MessageLLM(role="user", contenu=definition.template_utilisateur.substitute(valeurs)),
            ),
            version_prompt=definition.version_prompt,
            empreinte_prompt=definition.empreinte_prompt,
            temperature=definition.temperature,
            max_tokens=definition.max_tokens,
        )

    def rendre_traduction_chatbot(
        self,
        variables: VariablesTraductionChatbot,
        *,
        version: str = VERSION_TRADUCTION_CHATBOT,
    ) -> PromptRendu:
        """Rendre le prompt de traduction vers le français d'une réponse de l'assistant."""
        definition = self._definitions.get(("chatbot", "traduction", version))
        if definition is None:
            raise ErreurPromptIntrouvable("La version du prompt de traduction du chatbot est introuvable.")

        donnees = variables.model_dump(mode="json")
        valeurs = {nom: _json_prompt(donnees[nom]) for nom in _VARIABLES_TEMPLATE_TRADUCTION_CHATBOT}
        return PromptRendu(
            messages=(
                MessageLLM(role="system", contenu=definition.systeme),
                MessageLLM(role="user", contenu=definition.template_utilisateur.substitute(valeurs)),
            ),
            version_prompt=definition.version_prompt,
            empreinte_prompt=definition.empreinte_prompt,
            temperature=definition.temperature,
            max_tokens=definition.max_tokens,
        )

    def rendre_memoire_chatbot(
        self,
        variables: VariablesMemoireChatbot,
        *,
        version: str = VERSION_MEMOIRE_CHATBOT,
    ) -> PromptRendu:
        """Rendre le prompt de synthèse de fin de session (JSON strict)."""
        definition = self._definitions.get(("chatbot", "memoire", version))
        if definition is None:
            raise ErreurPromptIntrouvable("La version du prompt de mémoire du chatbot est introuvable.")

        donnees = variables.model_dump(mode="json")
        valeurs = {nom: _json_prompt(donnees[nom]) for nom in _VARIABLES_TEMPLATE_MEMOIRE_CHATBOT}
        return PromptRendu(
            messages=(
                MessageLLM(role="system", contenu=definition.systeme),
                MessageLLM(role="user", contenu=definition.template_utilisateur.substitute(valeurs)),
            ),
            version_prompt=definition.version_prompt,
            empreinte_prompt=definition.empreinte_prompt,
            temperature=definition.temperature,
            max_tokens=definition.max_tokens,
        )

    def rendre_exercice_chatbot(
        self,
        variables: VariablesExerciceChatbot,
        *,
        version: str = VERSION_EXERCICE_CHATBOT,
    ) -> PromptRendu:
        """Rendre le prompt d'exercice ciblé à partir d'une erreur et d'un descripteur CECRL/HSK."""
        definition = self._definitions.get(("chatbot", "exercice", version))
        if definition is None:
            raise ErreurPromptIntrouvable("La version du prompt d'exercice du chatbot est introuvable.")

        donnees = variables.model_dump(mode="json")
        valeurs = {nom: _json_prompt(donnees[nom]) for nom in _VARIABLES_TEMPLATE_EXERCICE_CHATBOT}
        return PromptRendu(
            messages=(
                MessageLLM(role="system", contenu=definition.systeme),
                MessageLLM(role="user", contenu=definition.template_utilisateur.substitute(valeurs)),
            ),
            version_prompt=definition.version_prompt,
            empreinte_prompt=definition.empreinte_prompt,
            temperature=definition.temperature,
            max_tokens=definition.max_tokens,
        )

    def rendre_correction_reponse_libre(
        self,
        variables: VariablesCorrectionReponseLibre,
        *,
        version: str = VERSION_CORRECTION_REPONSE_LIBRE,
    ) -> PromptRendu:
        """Rendre le prompt de correction d'une réponse libre (US157) à partir de variables validées."""
        definition = self._definitions.get(("correction", "reponse-libre", version))
        if definition is None:
            raise ErreurPromptIntrouvable("La version du prompt de correction des réponses libres est introuvable.")

        donnees = variables.model_dump(mode="json")
        valeurs = {nom: _json_prompt(donnees[nom]) for nom in _VARIABLES_TEMPLATE_CORRECTION}
        return PromptRendu(
            messages=(
                MessageLLM(role="system", contenu=definition.systeme),
                MessageLLM(role="user", contenu=definition.template_utilisateur.substitute(valeurs)),
            ),
            version_prompt=definition.version_prompt,
            empreinte_prompt=definition.empreinte_prompt,
            temperature=definition.temperature,
            max_tokens=definition.max_tokens,
        )

    def rendre_actions_recommandation(
        self,
        variables: VariablesRecommandation,
        *,
        version: str = VERSION_ACTIONS_RECOMMANDATION,
    ) -> PromptRendu:
        """Rendre le prompt d'actions de recommandation à partir de variables validées."""
        definition = self._definitions.get(("recommandation", "actions", version))
        if definition is None:
            raise ErreurPromptIntrouvable("La version du prompt d'actions de recommandation est introuvable.")

        donnees = variables.model_dump(mode="json")
        valeurs = {nom: _json_prompt(donnees[nom]) for nom in _VARIABLES_TEMPLATE_RECOMMANDATION}
        return PromptRendu(
            messages=(
                MessageLLM(role="system", contenu=definition.systeme),
                MessageLLM(role="user", contenu=definition.template_utilisateur.substitute(valeurs)),
            ),
            version_prompt=definition.version_prompt,
            empreinte_prompt=definition.empreinte_prompt,
            temperature=definition.temperature,
            max_tokens=definition.max_tokens,
        )

    def identite_actions_recommandation(
        self,
        *,
        version: str = VERSION_ACTIONS_RECOMMANDATION,
    ) -> tuple[str, str]:
        """Retourner ``(version_prompt, empreinte_prompt)`` publiés pour la définition de l'agent."""
        definition = self._definitions.get(("recommandation", "actions", version))
        if definition is None:
            raise ErreurPromptIntrouvable("La version du prompt d'actions de recommandation est introuvable.")
        return definition.version_prompt, definition.empreinte_prompt

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

    def _charger_actions_recommandation(self) -> _DefinitionPrompt:
        nom = f"actions@{VERSION_ACTIONS_RECOMMANDATION}"
        repertoire = self._repertoire / "recommandation"
        systeme = self._lire(repertoire / f"{nom}.systeme.md")
        texte_utilisateur = self._lire(repertoire / f"{nom}.utilisateur.md")
        template = _valider_template(texte_utilisateur, _VARIABLES_TEMPLATE_RECOMMANDATION)

        empreinte = hashlib.sha256(b"\0".join((systeme.encode("utf-8"), texte_utilisateur.encode("utf-8"))))
        return _DefinitionPrompt(
            version_prompt=f"recommandation/actions@{VERSION_ACTIONS_RECOMMANDATION}",
            systeme=systeme.strip(),
            template_utilisateur=template,
            exemples=(),
            empreinte_prompt=f"sha256:{empreinte.hexdigest()}",
            temperature=0.2,
            max_tokens=900,
        )

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

    def _charger_conversation_chatbot(self) -> _DefinitionPrompt:
        nom = f"conversation@{VERSION_CONVERSATION_CHATBOT}"
        repertoire = self._repertoire / "chatbot"
        systeme = self._lire(repertoire / f"{nom}.systeme.md")
        texte_utilisateur = self._lire(repertoire / f"{nom}.utilisateur.md")
        template = _valider_template(texte_utilisateur, _VARIABLES_TEMPLATE_CHATBOT)

        empreinte = hashlib.sha256(b"\0".join((systeme.encode("utf-8"), texte_utilisateur.encode("utf-8"))))
        # Température plus haute que le diagnostic : une conversation gagne à varier ses formulations.
        return _DefinitionPrompt(
            version_prompt=f"chatbot/conversation@{VERSION_CONVERSATION_CHATBOT}",
            systeme=systeme.strip(),
            template_utilisateur=template,
            exemples=(),
            empreinte_prompt=f"sha256:{empreinte.hexdigest()}",
            temperature=0.5,
            # La traduction et l'explication françaises s'ajoutent à la réponse et aux corrections en marge.
            # Les modèles à raisonnement (ex. gpt-oss sur Groq) consomment une part du budget avant le JSON :
            # 900 jetons pouvaient être épuisés avant la fin du document, d'où un refus HTTP 400 en mode JSON.
            max_tokens=1800,
        )

    def _charger_conversation_chatbot_v2(self) -> _DefinitionPrompt:
        nom = f"conversation@{VERSION_CONVERSATION_CHATBOT_V2}"
        repertoire = self._repertoire / "chatbot"
        systeme = self._lire(repertoire / f"{nom}.systeme.md")
        texte_utilisateur = self._lire(repertoire / f"{nom}.utilisateur.md")
        template = _valider_template(texte_utilisateur, _VARIABLES_TEMPLATE_CHATBOT_V2)

        empreinte = hashlib.sha256(b"\0".join((systeme.encode("utf-8"), texte_utilisateur.encode("utf-8"))))
        return _DefinitionPrompt(
            version_prompt=f"chatbot/conversation@{VERSION_CONVERSATION_CHATBOT_V2}",
            systeme=systeme.strip(),
            template_utilisateur=template,
            exemples=(),
            empreinte_prompt=f"sha256:{empreinte.hexdigest()}",
            temperature=0.5,
            max_tokens=1800,
        )

    def _charger_correction_chatbot(self) -> _DefinitionPrompt:
        nom = f"correction@{VERSION_CORRECTION_CHATBOT}"
        repertoire = self._repertoire / "chatbot"
        systeme = self._lire(repertoire / f"{nom}.systeme.md")
        texte_utilisateur = self._lire(repertoire / f"{nom}.utilisateur.md")
        template = _valider_template(texte_utilisateur, _VARIABLES_TEMPLATE_CORRECTION_CHATBOT)

        empreinte = hashlib.sha256(b"\0".join((systeme.encode("utf-8"), texte_utilisateur.encode("utf-8"))))
        return _DefinitionPrompt(
            version_prompt=f"chatbot/correction@{VERSION_CORRECTION_CHATBOT}",
            systeme=systeme.strip(),
            template_utilisateur=template,
            exemples=(),
            empreinte_prompt=f"sha256:{empreinte.hexdigest()}",
            temperature=0.2,
            max_tokens=600,
        )

    def _charger_traduction_chatbot(self) -> _DefinitionPrompt:
        nom = f"traduction@{VERSION_TRADUCTION_CHATBOT}"
        repertoire = self._repertoire / "chatbot"
        systeme = self._lire(repertoire / f"{nom}.systeme.md")
        texte_utilisateur = self._lire(repertoire / f"{nom}.utilisateur.md")
        template = _valider_template(texte_utilisateur, _VARIABLES_TEMPLATE_TRADUCTION_CHATBOT)

        empreinte = hashlib.sha256(b"\0".join((systeme.encode("utf-8"), texte_utilisateur.encode("utf-8"))))
        return _DefinitionPrompt(
            version_prompt=f"chatbot/traduction@{VERSION_TRADUCTION_CHATBOT}",
            systeme=systeme.strip(),
            template_utilisateur=template,
            exemples=(),
            empreinte_prompt=f"sha256:{empreinte.hexdigest()}",
            temperature=0.2,
            max_tokens=1200,
        )

    def _charger_memoire_chatbot(self) -> _DefinitionPrompt:
        nom = f"memoire@{VERSION_MEMOIRE_CHATBOT}"
        repertoire = self._repertoire / "chatbot"
        systeme = self._lire(repertoire / f"{nom}.systeme.md")
        texte_utilisateur = self._lire(repertoire / f"{nom}.utilisateur.md")
        template = _valider_template(texte_utilisateur, _VARIABLES_TEMPLATE_MEMOIRE_CHATBOT)

        empreinte = hashlib.sha256(b"\0".join((systeme.encode("utf-8"), texte_utilisateur.encode("utf-8"))))
        return _DefinitionPrompt(
            version_prompt=f"chatbot/memoire@{VERSION_MEMOIRE_CHATBOT}",
            systeme=systeme.strip(),
            template_utilisateur=template,
            exemples=(),
            empreinte_prompt=f"sha256:{empreinte.hexdigest()}",
            temperature=0.1,
            max_tokens=900,
        )

    def _charger_exercice_chatbot(self) -> _DefinitionPrompt:
        nom = f"exercice@{VERSION_EXERCICE_CHATBOT}"
        repertoire = self._repertoire / "chatbot"
        systeme = self._lire(repertoire / f"{nom}.systeme.md")
        texte_utilisateur = self._lire(repertoire / f"{nom}.utilisateur.md")
        template = _valider_template(texte_utilisateur, _VARIABLES_TEMPLATE_EXERCICE_CHATBOT)

        empreinte = hashlib.sha256(b"\0".join((systeme.encode("utf-8"), texte_utilisateur.encode("utf-8"))))
        return _DefinitionPrompt(
            version_prompt=f"chatbot/exercice@{VERSION_EXERCICE_CHATBOT}",
            systeme=systeme.strip(),
            template_utilisateur=template,
            exemples=(),
            empreinte_prompt=f"sha256:{empreinte.hexdigest()}",
            temperature=0.3,
            max_tokens=1000,
        )

    def _charger_correction_reponse_libre(self) -> _DefinitionPrompt:
        nom = f"reponse-libre@{VERSION_CORRECTION_REPONSE_LIBRE}"
        repertoire = self._repertoire / "correction"
        systeme = self._lire(repertoire / f"{nom}.systeme.md")
        texte_utilisateur = self._lire(repertoire / f"{nom}.utilisateur.md")
        template = _valider_template(texte_utilisateur, _VARIABLES_TEMPLATE_CORRECTION)

        empreinte = hashlib.sha256(b"\0".join((systeme.encode("utf-8"), texte_utilisateur.encode("utf-8"))))
        # Température basse : une correction doit être stable ; la réécriture complète (phase active) demande de
        # la place, d'où un plafond de jetons plus haut que le diagnostic.
        return _DefinitionPrompt(
            version_prompt=f"correction/reponse-libre@{VERSION_CORRECTION_REPONSE_LIBRE}",
            systeme=systeme.strip(),
            template_utilisateur=template,
            exemples=(),
            empreinte_prompt=f"sha256:{empreinte.hexdigest()}",
            temperature=0.2,
            max_tokens=1500,
        )

    @staticmethod
    def _lire(chemin: Path) -> str:
        try:
            return chemin.read_text(encoding="utf-8")
        except OSError:
            raise ErreurPromptIntrouvable("Une ressource de prompt versionné est introuvable.") from None


def _valider_template(texte: str, attendues: frozenset[str] = _VARIABLES_TEMPLATE) -> Template:
    if not texte.strip():
        raise ErreurRegistre("Le template utilisateur ne peut pas être vide.")
    variables: set[str] = set()
    for correspondance in Template.pattern.finditer(texte):
        if correspondance.group("invalid") is not None:
            raise ErreurRegistre("Le template utilisateur contient un marqueur de substitution invalide.")
        nom = correspondance.group("named") or correspondance.group("braced")
        if nom is not None:
            variables.add(nom)
    if variables != attendues:
        manquantes = sorted(attendues - variables)
        inattendues = sorted(variables - attendues)
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
