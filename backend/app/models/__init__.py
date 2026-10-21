"""Tous les modèles, importés ici pour qu'Alembic et SQLAlchemy connaissent chaque table."""

from app.models.ateliers import Atelier
from app.models.diagnostic import Question, Reponse, TestDiagnostic
from app.models.enums import Role, StatutAbonnement, StatutAtelier, StatutDiagnostic, StatutUtilisateur
from app.models.facturation import Abonnement, Formule, formule_langue
from app.models.pedagogie import Langue, Niveau, langue_niveau
from app.models.roles import Permission, RoleRBAC, role_permission
from app.models.utilisateurs import (
    Administrateur,
    Apprenant,
    Formateur,
    Utilisateur,
    apprenant_langue,
    formateur_langue,
)

__all__ = [
    "Abonnement",
    "Administrateur",
    "Apprenant",
    "Atelier",
    "Formateur",
    "Formule",
    "Langue",
    "Niveau",
    "Permission",
    "Question",
    "Reponse",
    "Role",
    "RoleRBAC",
    "StatutAbonnement",
    "StatutAtelier",
    "StatutDiagnostic",
    "StatutUtilisateur",
    "TestDiagnostic",
    "Utilisateur",
    "apprenant_langue",
    "formateur_langue",
    "formule_langue",
    "langue_niveau",
    "role_permission",
]
