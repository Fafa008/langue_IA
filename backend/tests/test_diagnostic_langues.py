"""Langues proposées sur l'écran d'accueil du test de positionnement."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Langue, Niveau, Question, Role
from tests.conftest import creer_utilisateur, entete

URL = "/api/v1/diagnostic/langues"


def _ajouter_question(db: Session, code_langue: str, code_niveau: str, type_reponse: str = "choix") -> None:
    db.add(
        Question(
            enonce=f"Question {code_langue} {code_niveau} {type_reponse}",
            competence="grammaire",
            type_reponse=type_reponse,
            choix=["a", "b"] if type_reponse == "choix" else None,
            langue=db.scalar(select(Langue).where(Langue.code == code_langue)),
            niveau=db.scalar(select(Niveau).where(Niveau.code == code_niveau)),
        )
    )
    db.commit()


def _par_code(reponse) -> dict[str, dict]:
    return {langue["code"]: langue for langue in reponse.json()}


class TestLanguesDiagnostic:
    def test_reserve_aux_apprenants(self, client, db: Session):
        assert client.get(URL).status_code == 401

        formateur = creer_utilisateur(db, Role.FORMATEUR, email="formateur@exemple.com")
        assert client.get(URL, headers=entete(formateur)).status_code == 403

    def test_liste_toutes_les_langues_triees_avec_leur_echelle(self, client, db: Session):
        apprenant = creer_utilisateur(db)

        reponse = client.get(URL, headers=entete(apprenant))

        assert reponse.status_code == 200
        langues = reponse.json()
        assert [langue["libelle"] for langue in langues] == sorted(langue["libelle"] for langue in langues)
        assert {langue["code"] for langue in langues} == set(db.scalars(select(Langue.code)).all())
        par_code = _par_code(reponse)
        assert par_code["en"]["cadre"] == "CECRL"
        assert par_code["en"]["niveaux"] == ["A1", "A2", "B1", "B2", "C1", "C2"]
        assert par_code["zh"]["cadre"] == "HSK"
        assert all(niveau.startswith("HSK") for niveau in par_code["zh"]["niveaux"])

    def test_une_langue_sans_question_est_bientot_disponible(self, client, db: Session):
        apprenant = creer_utilisateur(db)

        langue = _par_code(client.get(URL, headers=entete(apprenant)))["en"]

        assert langue["disponible"] is False
        assert langue["nombre_questions"] == 0

    def test_compte_les_questions_enregistrables_du_niveau_de_depart(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        # A1 n'a qu'une question audio : le test commence en A2, avec ses deux questions choix et texte
        _ajouter_question(db, "en", "A1", "audio")
        _ajouter_question(db, "en", "A2", "choix")
        _ajouter_question(db, "en", "A2", "texte")
        _ajouter_question(db, "en", "A2", "audio")
        _ajouter_question(db, "en", "B1", "choix")

        langue = _par_code(client.get(URL, headers=entete(apprenant)))["en"]

        assert langue["disponible"] is True
        assert langue["nombre_questions"] == 2
        tentative = client.post("/api/v1/diagnostic/tentatives", headers=entete(apprenant), json={"code_langue": "en"})
        assert tentative.status_code == 201
        assert tentative.json()["code_niveau"] == "A2"
