"""Résolution du niveau effectif d'un apprenant.

Un niveau non encore validé est ramené au premier niveau du référentiel (A1 pour le CECRL, HSK 1 pour le HSK) et
signalé comme à diagnostiquer. Aucune valeur hors contrat n'est inventée : le niveau est toujours membre du
référentiel déjà validé par :class:`app.schemas.contexte.ContexteApprenant`.
"""

from __future__ import annotations

from app.schemas.regles import CodeNiveau, Referentiel, niveaux_du_referentiel

NIVEAU_DEFAUT_CECRL: CodeNiveau = "A1"
NIVEAU_DEFAUT_HSK: CodeNiveau = "HSK 1"


def niveau_par_defaut(referentiel: Referentiel) -> CodeNiveau:
    """Premier niveau du référentiel, utilisé tant que le diagnostic n'a pas validé le niveau."""
    return NIVEAU_DEFAUT_HSK if referentiel == "HSK" else NIVEAU_DEFAUT_CECRL


def niveau_effectif(niveau: str, *, confirme: bool, referentiel: Referentiel) -> CodeNiveau:
    """Niveau à injecter dans le prompt : le niveau connu s'il est confirmé, sinon le niveau par défaut."""
    niveaux = niveaux_du_referentiel(referentiel)
    if confirme and niveau in niveaux:
        return niveau  # type: ignore[return-value]
    return niveau_par_defaut(referentiel)


def diagnostic_requis(confirme: bool) -> bool:
    """Indiquer si une étape de diagnostic doit encore être proposée à l'apprenant."""
    return not confirme
