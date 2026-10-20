"""Modèle Utilisateur (US11) : contraintes de la base, défauts, hachage et relations.

Ces tests visent la couche modèle contre PostgreSQL (index unique, ON DELETE, défauts serveur) :
les routes sont testées dans test_auth.py et test_utilisateurs.py.
"""

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import verifier_mot_de_passe
from app.models import Apprenant, Formateur, Langue, Role, StatutUtilisateur, Utilisateur, apprenant_langue
from app.models.enums import CODES
from tests.conftest import MOT_DE_PASSE, creer_utilisateur


class TestContraintes:
    def test_l_email_est_unique_au_niveau_de_la_base(self, db: Session):
        """L'index unique de la migration protège même si un code applicatif oublie de vérifier."""
        utilisateur = creer_utilisateur(db)
        db.add(
            Utilisateur(
                nom="RAKOTO",
                prenom="Rova",
                email=utilisateur.email,  # même e-mail que le compte existant
                mot_de_passe=utilisateur.mot_de_passe,
                role=Role.APPRENANT,
            )
        )
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()

    def test_le_role_est_stocke_en_entier_en_base(self, db: Session):
        """Colonne SMALLINT : le code 1 (APPRENANT) est en base, le texte reste une affaire d'API."""
        utilisateur = creer_utilisateur(db, Role.APPRENANT)
        requete = text("SELECT role FROM utilisateur WHERE id_user = :id")
        assert db.execute(requete, {"id": utilisateur.id_user}).scalar() == 1


class TestDefauts:
    def test_le_statut_par_defaut_est_actif(self, db: Session):
        utilisateur = creer_utilisateur(db)
        assert utilisateur.statut == StatutUtilisateur.ACTIF

    def test_date_inscription_est_renseignee_par_la_base(self, db: Session):
        """server_default=now() : la date vient de PostgreSQL, pas du client."""
        utilisateur = creer_utilisateur(db)
        assert utilisateur.date_inscription is not None

    def test_le_niveau_acces_de_l_administrateur_vaut_1_par_defaut(self, db: Session):
        utilisateur = creer_utilisateur(db, Role.ADMINISTRATEUR)
        assert utilisateur.administrateur is not None
        assert utilisateur.administrateur.niveau_acces == 1


class TestMotDePasse:
    def test_seul_le_hachage_bcrypt_est_persiste(self, db: Session):
        utilisateur = creer_utilisateur(db, mot_de_passe=MOT_DE_PASSE)
        assert utilisateur.mot_de_passe != MOT_DE_PASSE
        assert utilisateur.mot_de_passe.startswith("$2")  # préfixe bcrypt
        assert MOT_DE_PASSE not in utilisateur.mot_de_passe

    def test_le_hachage_persiste_verifie_le_mot_de_passe_d_origine(self, db: Session):
        """Le haché stocké doit pouvoir authentifier le mot de passe clair d'origine."""
        utilisateur = creer_utilisateur(db, mot_de_passe=MOT_DE_PASSE)
        assert verifier_mot_de_passe(MOT_DE_PASSE, utilisateur.mot_de_passe) is True


class TestEnumEntier:
    def test_les_codes_de_role_ne_doivent_jamais_changer(self):
        """Garde-fou : ces entiers sont en base (US11) ; les modifier corromprait les comptes existants."""
        assert CODES[Role] == {Role.APPRENANT: 1, Role.FORMATEUR: 2, Role.ADMINISTRATEUR: 3}

    def test_les_codes_de_statut_ne_doivent_jamais_changer(self):
        assert CODES[StatutUtilisateur] == {
            StatutUtilisateur.ACTIF: 1,
            StatutUtilisateur.INACTIF: 2,
            StatutUtilisateur.SUSPENDU: 3,
        }


class TestRelations:
    def test_supprimer_un_utilisateur_supprime_sa_specialisation_et_ses_langues(self, db: Session):
        """ON DELETE CASCADE : la suppression de l'utilisateur nettoie apprenant et apprenant_langue."""
        utilisateur = creer_utilisateur(db)
        langue = db.scalars(select(Langue)).first()
        db.get(Apprenant, utilisateur.id_user).langues.append(langue)
        db.commit()
        id_user = utilisateur.id_user

        # Suppression SQL directe : elle déclenche les clés étrangères de la migration,
        # indépendamment du cascade ORM delete-orphan.
        db.execute(text("DELETE FROM utilisateur WHERE id_user = :id"), {"id": id_user})
        db.commit()

        # SELECT plutôt que Session.get : la session garde un objet périmé en mémoire après
        # une suppression SQL brute, seule une requête interroge l'état réel de la base.
        survit = db.execute(select(Apprenant.id_user).where(Apprenant.id_user == id_user)).scalar_one_or_none()
        assert survit is None
        restantes = db.execute(apprenant_langue.select().where(apprenant_langue.c.id_apprenant == id_user)).fetchall()
        assert restantes == []

    def test_une_langue_utilisee_ne_peut_pas_etre_supprimee(self, db: Session):
        """ON DELETE RESTRICT : on interdit de supprimer une langue choisie par un apprenant."""
        utilisateur = creer_utilisateur(db)
        langue = db.scalars(select(Langue)).first()
        db.get(Apprenant, utilisateur.id_user).langues.append(langue)
        db.commit()

        with pytest.raises(IntegrityError):
            db.execute(text("DELETE FROM langue WHERE id_langue = :id"), {"id": langue.id_langue})
        db.rollback()
        assert db.get(Langue, langue.id_langue) is not None

    def test_changer_de_role_conserve_les_specialisations_precedentes(self, client, db: Session, admin_entete):
        """Règle US11 : le changement de rôle crée la nouvelle ligne sans perdre l'ancienne."""
        cible = creer_utilisateur(db)
        reponse = client.patch(f"/api/v1/users/{cible.id_user}", headers=admin_entete, json={"role": "FORMATEUR"})

        assert reponse.status_code == 200
        db.expire_all()  # la requête a utilisé une autre session
        assert db.get(Apprenant, cible.id_user) is not None
        assert db.get(Formateur, cible.id_user) is not None
