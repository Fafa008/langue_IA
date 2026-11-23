"""Tous les modèles, importés ici pour qu'Alembic et SQLAlchemy connaissent chaque table."""

from app.models.ateliers import Atelier
from app.models.chatbot import (
    ErreurRecurrenteChatbot,
    JournalChatbot,
    MessageChatbot,
    ProfilMemoireChatbot,
    QuotaChatbot,
    SessionMemoireChatbot,
)
from app.models.diagnostic import Reponse, TestDiagnostic
from app.models.enums import (
    Role,
    StatutAbonnement,
    StatutAtelier,
    StatutDiagnostic,
    StatutParcours,
    StatutUtilisateur,
    TypeExercice,
)
from app.models.facturation import Abonnement, Formule, formule_langue
from app.models.parcours import Exercice, Parcours, ParcoursExercice, ProgressionLecon
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

# Alias transitoire (US-N01) : la table `question` n'existe plus, le contrat IA garde `id_question` (T2).
Question = Exercice

__all__ = [
    "Abonnement",
    "Administrateur",
    "Apprenant",
    "Atelier",
    "Formateur",
    "Formule",
    "JournalChatbot",
    "Langue",
    "MessageChatbot",
    "Niveau",
    "ErreurRecurrenteChatbot",
    "Exercice",
    "Parcours",
    "ParcoursExercice",
    "Permission",
    "ProgressionLecon",
    "ProfilMemoireChatbot",
    "QuotaChatbot",
    "SessionMemoireChatbot",
    "Question",
    "Reponse",
    "Role",
    "RoleRBAC",
    "StatutAbonnement",
    "StatutAtelier",
    "StatutDiagnostic",
    "StatutParcours",
    "StatutUtilisateur",
    "TestDiagnostic",
    "TypeExercice",
    "Utilisateur",
    "apprenant_langue",
    "formateur_langue",
    "formule_langue",
    "langue_niveau",
    "role_permission",
]
