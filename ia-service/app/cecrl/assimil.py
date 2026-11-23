"""Phases d'imprégnation puis d'activation de la méthode Assimil.

La phase est dérivée du nombre de tours conservés en mémoire courte ; elle peut aussi être imposée explicitement
par un appelant (par exemple par le backend quand une séquence pédagogique est déjà démarrée).
"""

from __future__ import annotations

from app.schemas.chatbot import PhaseAssimil

SEUIL_ACTIVATION_TOURS = 4


def phase_pour_tours(nombre_tours: int, phase_explicite: PhaseAssimil | None = None) -> PhaseAssimil:
    """Imprégnation au début, activation après quelques tours de production."""
    if phase_explicite is not None:
        return phase_explicite
    return "activation" if nombre_tours >= SEUIL_ACTIVATION_TOURS else "impregnation"
