"""Modèles persistants des parcours pédagogiques et de leurs exercices."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from app.core.database import Base
from app.models.diagnostic import TestDiagnostic
from app.models.enums import EnumEntier, StatutParcours, TypeExercice
from app.models.pedagogie import Langue, Niveau
from app.services.phase_parcours import PhaseParcours, est_lecon_de_revision, phase_parcours


class Parcours(Base):
    __tablename__ = "parcours"
    __table_args__ = (
        CheckConstraint("lecon_atteinte >= 1", name="ck_parcours_lecon_atteinte_positive"),
        UniqueConstraint("id_test", name="uq_parcours_id_test"),
    )

    id_parcours: Mapped[int] = mapped_column(primary_key=True)
    id_test: Mapped[int] = mapped_column(
        ForeignKey("test_diagnostic.id_test", name="fk_parcours_id_test"),
    )
    id_langue: Mapped[int] = mapped_column(ForeignKey("langue.id_langue", name="fk_parcours_id_langue"))
    id_niveau_vise: Mapped[int] = mapped_column(
        ForeignKey("niveau.id_niveau", name="fk_parcours_id_niveau_vise"),
    )
    date_creation: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    statut: Mapped[StatutParcours] = mapped_column(
        EnumEntier(StatutParcours),
        default=StatutParcours.EN_COURS,
        server_default=text("1"),
    )
    lecon_atteinte: Mapped[int] = mapped_column(Integer, default=1, server_default=text("1"))
    # REC-03 : enveloppe de recommandation validée par le backend, avec l'empreinte de la requête qui l'a produite.
    # NULL tant que l'apprenant n'a pas demandé de recommandation. Le service IA n'écrit jamais directement ici.
    recommandation_ia: Mapped[dict | None] = mapped_column(JSONB)

    test_diagnostic: Mapped[TestDiagnostic] = relationship()
    langue: Mapped[Langue] = relationship()
    niveau_vise: Mapped[Niveau] = relationship()
    parcours_exercices: Mapped[list[ParcoursExercice]] = relationship(
        back_populates="parcours",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def phase(self) -> PhaseParcours:
        return phase_parcours(self.lecon_atteinte)

    @property
    def est_lecon_de_revision(self) -> bool:
        return est_lecon_de_revision(self.lecon_atteinte)


CHAMPS_CONTENU_LEGACY = {
    "enonce": "enonce",
    "competence": "competence",
    "type_reponse": "format",
    "choix": "choix",
    "reponse_correcte": "reponses",
    "support": "support",
    "audio_url": "audio_url",
    "audio_texte": "texte_audio",
}
"""Traduction des anciens champs `question` vers les clés du `contenu` JSON (US-N01, transition)."""


class Exercice(Base):
    """Banque unique : exercices de parcours **et** exercices de diagnostic (D1, D3).

    Les alias `Question`, `id_question` et les propriétés `enonce`, `competence`, `type_reponse`,
    `choix`, `reponse_correcte`, `support`, `audio_url` et `audio_texte` sont transitoires : ils
    maintiennent la compatibilité des services et des tests pendant la migration US-N01. Le contrat
    IA conserve `id_question` (T2). Leur suppression relève d'une US ultérieure.
    """

    __tablename__ = "exercice"
    __table_args__ = (
        CheckConstraint("difficulte BETWEEN 1 AND 5", name="ck_exercice_difficulte_1_5"),
        CheckConstraint("numero_lecon IS NULL OR numero_lecon >= 1", name="ck_exercice_numero_lecon_positif"),
        CheckConstraint("usage IN ('diagnostic', 'parcours', 'les deux')", name="ck_exercice_usage"),
        CheckConstraint("statut IN ('brouillon', 'publié')", name="ck_exercice_statut"),
        CheckConstraint(
            "origine IN ('humain', 'systeme:seed_parcours', 'systeme:seed_diagnostic')", name="ck_exercice_origine"
        ),
        CheckConstraint("framework IN ('CECRL', 'HSK')", name="ck_exercice_framework"),
    )

    id_exercice: Mapped[int] = mapped_column(primary_key=True)
    # Ancien nom de la clé primaire du diagnostic ; conservé le temps de la transition (T2).
    id_question = synonym("id_exercice")
    type: Mapped[TypeExercice] = mapped_column(EnumEntier(TypeExercice))
    contenu: Mapped[str] = mapped_column(Text)
    difficulte: Mapped[int] = mapped_column(Integer)
    id_langue: Mapped[int] = mapped_column(ForeignKey("langue.id_langue", name="fk_exercice_id_langue"))
    id_niveau: Mapped[int] = mapped_column(ForeignKey("niveau.id_niveau", name="fk_exercice_id_niveau"))
    # Leçon à laquelle l'exercice est rattaché (US48). NULL : exercice du catalogue sans leçon fixée.
    numero_lecon: Mapped[int | None] = mapped_column(Integer)
    usage: Mapped[str] = mapped_column(String(20), default="parcours")
    statut: Mapped[str] = mapped_column(String(20), default="publié")
    version: Mapped[int] = mapped_column(Integer, default=1)
    origine: Mapped[str] = mapped_column(String(30), default="systeme:seed_parcours")
    auteur: Mapped[str | None] = mapped_column(String(100), default="systeme:seed_parcours")
    date_creation: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    donnees_test: Mapped[bool] = mapped_column(Boolean, default=False)
    framework: Mapped[str] = mapped_column(String(20), default="CECRL")
    level: Mapped[str] = mapped_column(String(20), default="A1")
    # Référence de fichier uniquement (D7) : jamais d'octets ni d'URI `data:` en base.
    audio_ref: Mapped[str | None] = mapped_column(Text)
    # Colonne technique de migration : NULL pour un exercice né dans la banque unique.
    id_question_originel: Mapped[int | None] = mapped_column(Integer)

    langue: Mapped[Langue] = relationship()
    niveau: Mapped[Niveau] = relationship()
    parcours_exercices: Mapped[list[ParcoursExercice]] = relationship(
        back_populates="exercice",
        passive_deletes="all",
    )

    def __init__(self, **kwargs: Any) -> None:
        """Accepte les anciens champs `question` et les traduit vers `contenu` (transition US-N01)."""
        legacy = {nom: kwargs.pop(nom) for nom in CHAMPS_CONTENU_LEGACY if nom in kwargs}
        est_diagnostic = bool(legacy)
        super().__init__(**kwargs)
        if est_diagnostic:
            self.usage = "diagnostic"
            self.origine = "systeme:seed_diagnostic"
            self.auteur = "systeme:seed_diagnostic"
            self.donnees_test = True
            self.difficulte = 3  # T4 : le niveau réel est porté par `level`
            competence = str(legacy.get("competence") or "")
            self.type = {
                "grammaire": TypeExercice.GRAMMAIRE,
                "vocabulaire": TypeExercice.VOCABULAIRE,
                "ecoute": TypeExercice.ECOUTE,
                "oral": TypeExercice.ORAL,
            }.get(competence, TypeExercice.COMPREHENSION)
        langue = kwargs.get("langue")
        niveau = kwargs.get("niveau")
        if langue is not None:
            self.framework = "HSK" if langue.code == "zh" else "CECRL"
        if niveau is not None:
            self.level = niveau.code
        if legacy:
            audio_url = legacy.get("audio_url")
            if audio_url:  # D7 : référence de fichier, jamais d'octets en base
                self.audio_ref = audio_url
            self._ecrire_champs_legacy(legacy)

    def _contenu_dict(self) -> dict[str, Any]:
        try:
            donnees = json.loads(self.contenu) if self.contenu else {}
        except (TypeError, ValueError):
            donnees = {}
        return donnees if isinstance(donnees, dict) else {}

    def _ecrire_champs_legacy(self, champs: dict[str, Any]) -> None:
        contenu = self._contenu_dict()
        for nom, valeur in champs.items():
            cle = CHAMPS_CONTENU_LEGACY[nom]
            if cle == "reponses":
                if valeur is not None:
                    contenu["reponses"] = [valeur]
                else:
                    contenu.pop("reponses", None)
            elif valeur is None:
                contenu.pop(cle, None)
            elif nom == "type_reponse" and valeur == "audio":
                contenu[cle] = "prononciation"  # T3 : production orale, format retenu
            else:
                contenu[cle] = valeur
        self.contenu = json.dumps(contenu, ensure_ascii=False)

    @property
    def enonce(self) -> str | None:
        return self._contenu_dict().get("enonce")

    @property
    def competence(self) -> str | None:
        return self._contenu_dict().get("competence")

    @property
    def type_reponse(self) -> str:
        return self._contenu_dict().get("format") or "choix"

    @property
    def choix(self) -> list[str] | None:
        return self._contenu_dict().get("choix")

    @property
    def reponse_correcte(self) -> str | None:
        reponses = self._contenu_dict().get("reponses")
        return reponses[0] if isinstance(reponses, list) and reponses else None

    @property
    def support(self) -> str | None:
        return self._contenu_dict().get("support")

    @property
    def audio_url(self) -> str | None:
        return self._contenu_dict().get("audio_url")

    @property
    def audio_texte(self) -> str | None:
        return self._contenu_dict().get("texte_audio")


class ParcoursExercice(Base):
    __tablename__ = "parcours_exercice"
    __table_args__ = (
        CheckConstraint("numero_lecon >= 1", name="ck_parcours_exercice_numero_lecon_positive"),
        CheckConstraint(
            "score_obtenu IS NULL OR score_obtenu BETWEEN 0 AND 100",
            name="ck_parcours_exercice_score_0_100",
        ),
        UniqueConstraint(
            "id_parcours",
            "numero_lecon",
            "id_exercice",
            name="uq_parcours_exercice_parcours_lecon_exercice",
        ),
    )

    id_parcours_exercice: Mapped[int] = mapped_column(primary_key=True)
    id_parcours: Mapped[int] = mapped_column(
        ForeignKey("parcours.id_parcours", ondelete="CASCADE", name="fk_parcours_exercice_id_parcours"),
    )
    id_exercice: Mapped[int] = mapped_column(
        ForeignKey("exercice.id_exercice", ondelete="RESTRICT", name="fk_parcours_exercice_id_exercice"),
    )
    numero_lecon: Mapped[int] = mapped_column(Integer)
    score_obtenu: Mapped[int | None] = mapped_column(Integer)
    # US157 : dernière réponse libre et enveloppe du feedback IA validée (la correction suivante les remplace)
    reponse_apprenant: Mapped[str | None] = mapped_column(Text)
    feedback_ia: Mapped[dict | None] = mapped_column(JSONB)
    date_reponse: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    parcours: Mapped[Parcours] = relationship(back_populates="parcours_exercices")
    exercice: Mapped[Exercice] = relationship(back_populates="parcours_exercices")


class ProgressionLecon(Base):
    """Progression sur une leçon (US48) : dernier et meilleur score de leçon, validation.

    Le score de leçon est calculé par ``services/progression_lecon.py`` ; la validation se lit sur ``best_score``.
    """

    __tablename__ = "progression_lecon"
    __table_args__ = (
        CheckConstraint("numero_lecon >= 1", name="ck_progression_lecon_numero_lecon_positif"),
        CheckConstraint(
            "last_score IS NULL OR last_score BETWEEN 0 AND 100", name="ck_progression_lecon_last_score_0_100"
        ),
        CheckConstraint(
            "best_score IS NULL OR best_score BETWEEN 0 AND 100", name="ck_progression_lecon_best_score_0_100"
        ),
        UniqueConstraint("id_parcours", "numero_lecon", name="uq_progression_lecon_parcours_lecon"),
    )

    id_progression: Mapped[int] = mapped_column(primary_key=True)
    id_parcours: Mapped[int] = mapped_column(
        ForeignKey("parcours.id_parcours", ondelete="CASCADE", name="fk_progression_lecon_id_parcours"),
    )
    numero_lecon: Mapped[int] = mapped_column(Integer)
    last_score: Mapped[int | None] = mapped_column(Integer)
    best_score: Mapped[int | None] = mapped_column(Integer)
    is_validated: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
