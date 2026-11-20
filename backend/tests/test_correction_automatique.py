"""Tests de la correction déterministe des réponses courtes (US43-BE), sans IA.

Les cas purs (normalisation, règle de correction) n'ont pas besoin de base ; les cas HTTP passent par la base de test.
Un garde-fou autouse fait échouer tout test où la correction appellerait le service IA.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import ParcoursExercice
from app.services import correction_exercice
from app.services.correction_automatique import corriger_automatiquement, normaliser
from tests.conftest import creer_utilisateur, entete
from tests.fabriques_parcours import creer_parcours
from tests.fabriques_parcours import url_reponse as url


@pytest.fixture(autouse=True)
def ia_interdite(monkeypatch: pytest.MonkeyPatch) -> None:
    """La correction automatique ne doit jamais solliciter le service IA : tout appel fait échouer le test."""

    def appel_interdit(requete: object) -> None:
        raise AssertionError("La correction automatique ne doit pas appeler le service IA")

    monkeypatch.setattr(correction_exercice, "corriger_reponse_libre", appel_interdit)


def contenu_choix(**champs: object) -> dict[str, object]:
    return {
        "format": "choix",
        "intitule": "Le passé composé",
        "consigne": "Choisissez la bonne forme.",
        "enonce": "Hier, je ___ au marché.",
        "choix": ["suis allé", "vais aller"],
        "reponses": ["suis allé"],
        "explication": "« Aller » se conjugue avec être au passé composé.",
        **champs,
    }


# Cas purs


@pytest.mark.parametrize(
    ("brut", "attendu"),
    [
        ("Suis Allé !", "suis alle"),
        ("j'ai  mangé", "jai mange"),
        ("  Très, bien.  ", "tres bien"),
        ("« Bonjour » ?", "bonjour"),
    ],
)
def test_normaliser_ignore_casse_accents_ponctuation_et_espaces(brut: str, attendu: str) -> None:
    assert normaliser(brut) == attendu


def test_reponse_juste_vaut_100_sans_reponse_attendue() -> None:
    resultat = corriger_automatiquement(contenu_choix(), "suis allé")

    assert resultat.statut == "REUSSI"
    assert resultat.score_obtenu == 100
    assert resultat.mode_correction == "AUTOMATIQUE"
    assert resultat.reponse_attendue is None
    assert resultat.explication == "« Aller » se conjugue avec être au passé composé."
    assert resultat.phase is None and resultat.lecon_atteinte is None and resultat.reformulation is None


def test_reponse_fausse_donne_la_bonne_reponse_et_l_explication() -> None:
    resultat = corriger_automatiquement(contenu_choix(), "vais aller")

    assert resultat.statut == "A_REVOIR"
    assert resultat.score_obtenu == 0
    assert resultat.reponse_attendue == "suis allé"
    assert resultat.explication is not None


def test_plusieurs_reponses_acceptees() -> None:
    contenu = contenu_choix(reponses=["suis allé", "je suis allé"])

    assert corriger_automatiquement(contenu, "Je suis allé !").statut == "REUSSI"


def test_meme_reponse_meme_resultat() -> None:
    premier = corriger_automatiquement(contenu_choix(), "vais aller")
    second = corriger_automatiquement(contenu_choix(), "vais aller")

    assert premier == second


@pytest.mark.parametrize(
    "contenu",
    [{}, {"reponses": []}, {"reponses": "suis allé"}, {"reponses": [""]}, {"reponses": [3]}],
    ids=["absentes", "vides", "texte-brut", "chaine-vide", "non-texte"],
)
def test_reponses_invalides_levent_une_erreur(contenu: dict) -> None:
    with pytest.raises(ValueError):
        corriger_automatiquement({"format": "choix", **contenu}, "suis allé")


# Cas HTTP


def envoyer_auto(client: TestClient, apprenant, ids: tuple[int, int], corps: dict[str, object]):
    return client.post(url(*ids), json=corps, headers=entete(apprenant))


def test_qcm_juste_corrige_sans_ia_et_enregistre(client, db: Session) -> None:
    apprenant = creer_utilisateur(db)
    ids = creer_parcours(db, apprenant, contenu=contenu_choix())

    reponse = envoyer_auto(client, apprenant, ids, {"format": "choix", "reponse": "suis allé"})

    assert reponse.status_code == 200
    assert reponse.json()["statut"] == "REUSSI"
    assert reponse.json()["mode_correction"] == "AUTOMATIQUE"
    db.expire_all()
    ligne = db.get(ParcoursExercice, ids[1])
    assert ligne.score_obtenu == 100
    assert ligne.reponse_apprenant == "suis allé"
    assert ligne.feedback_ia is None
    assert ligne.date_reponse is not None


def test_reponse_fausse_renvoie_la_bonne_reponse(client, db: Session) -> None:
    apprenant = creer_utilisateur(db)
    ids = creer_parcours(db, apprenant, contenu=contenu_choix())

    corps = envoyer_auto(client, apprenant, ids, {"format": "choix", "reponse": "vais aller"}).json()

    assert corps["statut"] == "A_REVOIR"
    assert corps["score_obtenu"] == 0
    assert corps["reponse_attendue"] == "suis allé"
    assert "explication" in corps and corps["explication"] is not None


@pytest.mark.parametrize(
    ("format_", "contenu"),
    [
        ("texte", {"format": "texte", "consigne": "Complétez.", "enonce": "Il ___ .", "reponses": ["va"]}),
        (
            "ecoute",
            {
                "format": "ecoute",
                "consigne": "Écoutez.",
                "question": "Où ?",
                "texte_audio": "À la gare.",
                "reponses": ["gare"],
            },
        ),
        (
            "prononciation",
            {"format": "prononciation", "consigne": "Lisez.", "phrase": "Bonjour.", "reponses": ["bonjour"]},
        ),
    ],
)
def test_autres_formats_courts_corriges_sans_ia(client, db: Session, format_: str, contenu: dict) -> None:
    apprenant = creer_utilisateur(db)
    ids = creer_parcours(db, apprenant, contenu=contenu)
    bonne = contenu["reponses"][0]

    corps = envoyer_auto(client, apprenant, ids, {"format": format_, "reponse": bonne.upper()}).json()

    assert corps["statut"] == "REUSSI"


def test_refaire_un_exercice_remplace_la_correction(client, db: Session) -> None:
    apprenant = creer_utilisateur(db)
    ids = creer_parcours(db, apprenant, contenu=contenu_choix())

    envoyer_auto(client, apprenant, ids, {"format": "choix", "reponse": "vais aller"})
    envoyer_auto(client, apprenant, ids, {"format": "choix", "reponse": "suis allé"})

    db.expire_all()
    ligne = db.get(ParcoursExercice, ids[1])
    assert ligne.score_obtenu == 100
    assert ligne.reponse_apprenant == "suis allé"


def test_exercice_sans_reponses_acceptees_refuse_sans_rien_enregistrer(client, db: Session) -> None:
    apprenant = creer_utilisateur(db)
    contenu = contenu_choix()
    del contenu["reponses"]
    ids = creer_parcours(db, apprenant, contenu=contenu)

    reponse = envoyer_auto(client, apprenant, ids, {"format": "choix", "reponse": "suis allé"})

    assert reponse.status_code == 409
    db.expire_all()
    assert db.get(ParcoursExercice, ids[1]).score_obtenu is None
