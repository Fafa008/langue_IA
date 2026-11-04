"""Gestion partagée des prompts versionnés et de leurs exemples."""

from app.prompts.bibliotheque_few_shot import BibliothequeFewShot, ScenarioDiagnostic
from app.prompts.registre import PromptRendu, RegistrePrompts

__all__ = ["BibliothequeFewShot", "PromptRendu", "RegistrePrompts", "ScenarioDiagnostic"]
