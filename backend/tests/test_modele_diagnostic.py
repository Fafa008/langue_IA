"""Modèle du diagnostic (US34) : questions, tentatives de diagnostic et réponses.

Ces tests visent la couche modèle contre PostgreSQL (clés étrangères, contrainte d'unicité,
défauts serveur, migration applicable et réversible) ; les routes du diagnostic ne font pas
encore partie du MVP (backend/README.md).
"""

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from alembic import command
from alembic.config import Config
from app.models import Langue, Niveau, Question, Reponse, StatutDiagnostic, diagnostic
from app.models.enums import CODES
from tests.conftest import creer_utilisateur


def _langue(db: Session, code: str = "fr") -> Langue:
    return db.scalars(select(Langue).where(Langue.code == code)).one()


def _niveau(db: Session, code: str = "A1") -> Niveau:
    return db.scalars(select(Niveau).where(Niveau.code == code)).one()


def _question(db: Session, **champs) -> Question:
    question = Question(
        enonce="Complétez : « Bonjour, je ___ Rova. »",
        competence="compréhension écrite",
        langue=_langue(db),
        niveau=_niveau(db),
        **champs,
    )
    db.add(question)
    db.commit()
    return question


def _tentative(db: Session, **champs) -> diagnostic.TestDiagnostic:
    apprenant = creer_utilisateur(db).apprenant
    tentative = diagnostic.TestDiagnostic(apprenant=apprenant, langue=_langue(db), niveau=_niveau(db), **champs)
    db.add(tentative)
    db.commit()
    return tentative


def _reponse(
    db: Session, tentative: diagnostic.TestDiagnostic, question: Question, texte: str = "je suis Rova", **champs
) -> Reponse:
    reponse = Reponse(tentative=tentative, question=question, reponse_fournie=texte, **champs)
    db.add(reponse)
    db.commit()
    return reponse


class TestCreation:
    def test_une_question_reliee_sa_langue_et_son_niveau(self, db: Session):
        question = _question(db)
        assert question.id_question is not None
        assert (question.langue.code, question.niveau.code) == ("fr", "A1")
        assert question.competence == "compréhension écrite"

    def test_une_tentative_demarre_en_cours_avec_une_date_de_serveur(self, db: Session):
        """Défauts : statut EN_COURS posé par le modèle, date_debut remplie par PostgreSQL."""
        tentative = _tentative(db)
        assert tentative.statut == StatutDiagnostic.EN_COURS
        assert tentative.date_debut is not None
        assert tentative.date_fin is None
        assert tentative.id_niveau_final is None

    def test_une_reponse_stocke_son_texte_et_repart_sans_evaluation(self, db: Session):
        reponse = _reponse(db, _tentative(db), _question(db))
        assert reponse.reponse_fournie == "je suis Rova"
        assert reponse.evaluation is None

    def test_le_statut_du_diagnostic_est_stocke_en_entier(self, db: Session):
        """Colonne SMALLINT : EN_COURS vaut 1 en base, le texte reste une affaire d'API."""
        tentative = _tentative(db)
        requete = text("SELECT statut FROM test_diagnostic WHERE id_test = :id")
        assert db.execute(requete, {"id": tentative.id_test}).scalar() == 1


class TestEnumEntier:
    def test_les_codes_de_statut_diagnostic_ne_doivent_jamais_changer(self):
        """Garde-fou : ces entiers seront en base ; les modifier corromprait les tentatives existantes."""
        assert CODES[StatutDiagnostic] == {
            StatutDiagnostic.EN_COURS: 1,
            StatutDiagnostic.TERMINE: 2,
            StatutDiagnostic.ANNULE: 3,
        }


class TestRelations:
    def test_une_reponse_est_liee_a_sa_tentative_et_a_sa_question(self, db: Session):
        tentative = _tentative(db)
        question = _question(db)
        reponse = _reponse(db, tentative, question)

        assert reponse.tentative.id_test == tentative.id_test
        assert reponse.question.id_question == question.id_question
        assert [r.id_reponse for r in tentative.reponses] == [reponse.id_reponse]

    def test_le_niveau_final_renseigne_l_issue_du_diagnostic(self, db: Session):
        """Le diagnostic est un diagnostic de niveau : son issue attendue est un niveau estimé."""
        cible = _niveau(db, "A2")
        tentative = _tentative(db, statut=StatutDiagnostic.TERMINE, id_niveau_final=cible.id_niveau)
        assert tentative.niveau_final.code == "A2"

    def test_supprimer_l_apprenant_supprime_ses_tentatives_et_leurs_reponses(self, db: Session):
        """ON DELETE CASCADE de bout en bout : apprenant → test_diagnostic → reponse (SQL brut)."""
        utilisateur = creer_utilisateur(db)
        tentative = diagnostic.TestDiagnostic(apprenant=utilisateur.apprenant, langue=_langue(db), niveau=_niveau(db))
        db.add(tentative)
        db.flush()
        db.add(Reponse(id_tentative=tentative.id_test, question=_question(db), reponse_fournie="je suis Rova"))
        db.commit()
        id_user = utilisateur.id_user

        # Suppression SQL directe : elle déclenche les clés étrangères de la migration,
        # indépendamment du cascade ORM delete-orphan.
        db.execute(text("DELETE FROM utilisateur WHERE id_user = :id"), {"id": id_user})
        db.commit()

        assert db.execute(text("SELECT COUNT(*) FROM test_diagnostic")).scalar() == 0
        assert db.execute(text("SELECT COUNT(*) FROM reponse")).scalar() == 0


class TestContraintes:
    def test_une_seule_reponse_par_question_et_par_tentative(self, db: Session):
        """Contrainte d'unicité : rejouer la même réponse est refusé par la base elle-même."""
        tentative = _tentative(db)
        question = _question(db)
        _reponse(db, tentative, question)
        db.add(Reponse(id_tentative=tentative.id_test, id_question=question.id_question, reponse_fournie="autre"))

        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()

    def test_une_langue_utilisee_ne_peut_pas_etre_supprimee(self, db: Session):
        """ON DELETE RESTRICT : la langue d'une question ou d'une tentative est protégée."""
        _question(db)
        with pytest.raises(IntegrityError):
            db.execute(text("DELETE FROM langue WHERE code = 'fr'"))
        db.rollback()
        assert db.scalars(select(Langue).where(Langue.code == "fr")).one_or_none() is not None

    def test_un_niveau_utilise_ne_peut_pas_etre_supprime(self, db: Session):
        """ON DELETE RESTRICT : contrat, DELETE /niveaux doit refuser (409) si un test utilise le niveau."""
        _tentative(db)
        with pytest.raises(IntegrityError):
            db.execute(text("DELETE FROM niveau WHERE code = 'A1'"))
        db.rollback()
        assert db.scalars(select(Niveau).where(Niveau.code == "A1")).one_or_none() is not None

    def test_une_question_utilisee_ne_peut_pas_etre_supprimee(self, db: Session):
        """ON DELETE RESTRICT : supprimer une question n'emporterait pas l'historique des réponses."""
        question = _question(db)
        _reponse(db, _tentative(db), question)
        with pytest.raises(IntegrityError):
            db.execute(text("DELETE FROM question WHERE id_question = :id"), {"id": question.id_question})
        db.rollback()
        assert db.get(Question, question.id_question) is not None

    def test_une_reponse_ne_peut_pas_pointer_vers_un_element_inconnu(self, db: Session):
        """Clés étrangères : ni tentative inconnue ni question inconnue ne passent en base."""
        db.add(Reponse(id_tentative=999999, id_question=999999, reponse_fournie="x"))
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()

    def test_une_tentative_ne_peut_pas_pointer_vers_un_apprenant_inconnu(self, db: Session):
        db.add(
            diagnostic.TestDiagnostic(
                id_apprenant=999999, id_langue=_langue(db).id_langue, id_niveau=_niveau(db).id_niveau
            )
        )
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()


class TestMigration:
    def test_la_migration_cree_les_tables_du_diagnostic(self, db: Session):
        """conftest applique `alembic upgrade head` (donc cette migration) avant chaque session."""
        tables = db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).scalars().all()
        assert {"question", "test_diagnostic", "reponse"} <= set(tables)

    def test_la_migration_du_diagnostic_est_reversible(self, db: Session):
        """Chaque migration du diagnostic peut être annulée puis rejouée sans toucher aux autres tables."""
        config = Config("alembic.ini")
        command.downgrade(config, "-1")

        colonnes_question = (
            db.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name = 'question'"
                )
            )
            .scalars()
            .all()
        )
        assert {"id_question", "enonce", "competence", "id_langue", "id_niveau"} <= set(colonnes_question)
        assert not {"type_reponse", "choix", "support", "audio_url", "audio_texte"} & set(colonnes_question)

        command.downgrade(config, "-1")
        reste = db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).scalars().all()
        assert not {"question", "test_diagnostic", "reponse"} & set(reste)

        command.upgrade(config, "head")
        tables = db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).scalars().all()
        assert {"question", "test_diagnostic", "reponse"} <= set(tables)
        colonnes_question = (
            db.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name = 'question'"
                )
            )
            .scalars()
            .all()
        )
        assert {"type_reponse", "choix", "support", "audio_url", "audio_texte"} <= set(colonnes_question)
