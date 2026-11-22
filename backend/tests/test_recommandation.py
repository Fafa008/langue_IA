"""Tests de l'endpoint de recommandation de parcours (REC-03), sur PostgreSQL de test et sans réseau.

Le service IA est remplacé par une doublure qui rejoue une enveloppe ou lève une erreur technique. Aucun test ne
doit exposer de code technique à l'apprenant : une panne se traduit par un statut ``PARTIEL`` et une liste vide.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Langue, Parcours, Utilisateur
from app.schemas.ia import ReponseRecommandationIA, RequeteRecommandationIA
from app.services import recommandation as service_recommandation
from app.services.ia import ErreurServiceIA
from tests.conftest import creer_utilisateur, entete
from tests.fabriques_parcours import creer_parcours_vide

POINTS_FAIBLES = [
    {
        "domaine": "grammaire",
        "id_question": "q-12",
        "observation": "Le prétérit manque dans « yesterday I go ».",
        "justification": "Le repère temporel situe l'action dans le passé.",
    },
    {
        "domaine": "vocabulaire",
        "id_question": "q-18",
        "observation": "Le mot « marchandise » est employé à la place de « goods ».",
        "justification": "Le champ lexical des achats reste imprécis.",
    },
]

ANALYSE_IA = {
    "resultat": {"points_faibles": POINTS_FAIBLES},
}


def resultat_valide() -> dict:
    return {
        "code_langue": "en",
        "referentiel": "CECRL",
        "niveau_cible": "B1",
        "recommandations": [
            {
                "domaine": "grammaire",
                "type_exercice": "GRAMMAIRE",
                "action": "Refaire un exercice de conjugaison au prétérit.",
                "justification": "Le point faible porte sur le prétérit.",
                "priorite": 1,
            },
            {
                "domaine": "vocabulaire",
                "type_exercice": "VOCABULAIRE",
                "action": "Réviser le vocabulaire des achats.",
                "justification": "Le terme employé est imprécis.",
                "priorite": 2,
            },
        ],
        "resume": "Deux actions courtes : grammaire puis vocabulaire.",
        "confiance": 0.72,
    }


def enveloppe(request_id, resultat: dict) -> dict:
    return {
        "request_id": str(request_id),
        "agent": "recommandation",
        "version_agent": "1.0.0",
        "version_prompt": "recommandation/actions@1.0.0",
        "statut": "succes",
        "resultat": resultat,
        "meta": {
            "duree_ms": 120,
            "fournisseur": "factice",
            "modele": "modele-test",
            "version_corpus": None,
            "empreinte_prompt": "sha256:" + "a" * 64,
        },
    }


class FauxServiceIA:
    """Remplace l'appel HTTP : garde les requêtes et rejoue une enveloppe ou une erreur."""

    def __init__(self) -> None:
        self.requetes: list[RequeteRecommandationIA] = []
        self.resultat: dict | None = None
        self.erreur: Exception | None = None

    def __call__(self, requete: RequeteRecommandationIA) -> ReponseRecommandationIA:
        self.requetes.append(requete)
        if self.erreur is not None:
            raise self.erreur
        return ReponseRecommandationIA.model_validate(
            enveloppe(requete.request_id, self.resultat if self.resultat is not None else resultat_valide())
        )


@pytest.fixture
def faux_ia(monkeypatch: pytest.MonkeyPatch) -> FauxServiceIA:
    faux = FauxServiceIA()
    monkeypatch.setattr(service_recommandation, "recommander_actions", faux)
    return faux


@pytest.fixture
def apprenant(db: Session) -> Utilisateur:
    return creer_utilisateur(db)


@pytest.fixture
def parcours(db: Session, apprenant: Utilisateur) -> Parcours:
    parcours_ = creer_parcours_vide(db, apprenant, langue="en", niveau_vise="B1")
    parcours_.test_diagnostic.analyse_ia = ANALYSE_IA
    db.commit()
    return parcours_


def url(parcours: Parcours) -> str:
    return f"/api/v1/parcours/{parcours.id_parcours}/recommandations"


def test_endpoint_exige_une_authentification(client: TestClient, parcours: Parcours, faux_ia: FauxServiceIA) -> None:
    assert client.post(url(parcours)).status_code == 401
    assert faux_ia.requetes == []


def test_endpoint_reserve_aux_apprenants(
    client: TestClient,
    parcours: Parcours,
    admin_entete: dict[str, str],
    faux_ia: FauxServiceIA,
) -> None:
    assert client.post(url(parcours), headers=admin_entete).status_code == 403
    assert faux_ia.requetes == []


def test_endpoint_404_si_le_parcours_appartient_a_un_autre(
    client: TestClient, db: Session, parcours: Parcours, faux_ia: FauxServiceIA
) -> None:
    autre = creer_utilisateur(db, email="autre@exemple.com")

    assert client.post(url(parcours), headers=entete(autre)).status_code == 404
    assert faux_ia.requetes == []


def test_recommandation_complete_et_persistee(
    client: TestClient, db: Session, parcours: Parcours, apprenant: Utilisateur, faux_ia: FauxServiceIA
) -> None:
    reponse = client.post(url(parcours), headers=entete(apprenant))

    assert reponse.status_code == 200
    corps = reponse.json()
    assert corps["statut"] == "COMPLET"
    assert corps["code_langue"] == "en"
    assert corps["referentiel"] == "CECRL"
    assert corps["niveau_cible"] == "B1"
    assert [action["domaine"] for action in corps["recommandations"]] == ["grammaire", "vocabulaire"]
    assert [action["priorite"] for action in corps["recommandations"]] == [1, 2]
    assert corps["confiance"] == 0.72
    assert len(faux_ia.requetes) == 1
    requete = faux_ia.requetes[0]
    assert requete.contexte.code_langue == "en"
    assert requete.contexte.lecon_atteinte == parcours.lecon_atteinte
    assert requete.entree.niveau_vise == "B1"
    assert [point.domaine for point in requete.entree.points_faibles] == ["grammaire", "vocabulaire"]

    db.expire_all()
    enregistre = db.get(Parcours, parcours.id_parcours).recommandation_ia
    assert enregistre["public"] == corps
    assert enregistre["empreinte"].startswith("sha256:")
    assert enregistre["enveloppe_ia"]["agent"] == "recommandation"
    assert enregistre["code_technique"] is None

    parcours_en_cours = client.get("/api/v1/parcours/en-cours", headers=entete(apprenant))
    assert parcours_en_cours.status_code == 200
    assert parcours_en_cours.json()["recommandation"] == corps


def test_requete_inchangee_ne_declenche_pas_un_second_appel(
    client: TestClient, parcours: Parcours, apprenant: Utilisateur, faux_ia: FauxServiceIA
) -> None:
    premier = client.post(url(parcours), headers=entete(apprenant))
    second = client.post(url(parcours), headers=entete(apprenant))

    assert premier.status_code == second.status_code == 200
    assert second.json() == premier.json()
    assert len(faux_ia.requetes) == 1


def test_panne_ia_donne_un_resultat_partiel_sans_code_technique(
    client: TestClient, parcours: Parcours, apprenant: Utilisateur, faux_ia: FauxServiceIA, db: Session
) -> None:
    faux_ia.erreur = ErreurServiceIA("indisponible")

    reponse = client.post(url(parcours), headers=entete(apprenant))

    assert reponse.status_code == 200
    corps = reponse.json()
    assert corps["statut"] == "PARTIEL"
    assert corps["recommandations"] == []
    assert corps["confiance"] == 0.0
    assert "indisponible" not in reponse.text
    db.expire_all()
    enregistre = db.get(Parcours, parcours.id_parcours).recommandation_ia
    assert enregistre["code_technique"] == "indisponible"

    # Un résultat partiel n'est pas mis en cache : le rafraîchissement explicite retente l'appel.
    assert client.post(url(parcours), headers=entete(apprenant)).status_code == 200
    assert len(faux_ia.requetes) == 2


def test_reponse_incoherente_est_refusee_sans_erreur_pour_l_apprenant(
    client: TestClient, parcours: Parcours, apprenant: Utilisateur, faux_ia: FauxServiceIA
) -> None:
    incoherent = resultat_valide()
    incoherent["niveau_cible"] = "A2"
    faux_ia.resultat = incoherent

    reponse = client.post(url(parcours), headers=entete(apprenant))

    assert reponse.status_code == 200
    assert reponse.json()["statut"] == "PARTIEL"
    assert reponse.json()["recommandations"] == []


def test_sans_domaine_exploitable_aucun_appel_ia(
    client: TestClient, db: Session, parcours: Parcours, apprenant: Utilisateur, faux_ia: FauxServiceIA
) -> None:
    parcours.test_diagnostic.analyse_ia = {
        "resultat": {
            "points_faibles": [
                {
                    "domaine": "expression_ecrite",
                    "id_question": "q-9",
                    "observation": "Phrase courte.",
                    "justification": "Production à développer.",
                }
            ]
        }
    }
    db.commit()

    reponse = client.post(url(parcours), headers=entete(apprenant))

    assert reponse.status_code == 200
    assert reponse.json()["statut"] == "PARTIEL"
    assert reponse.json()["recommandations"] == []
    assert faux_ia.requetes == []


def test_langue_hors_contrat_sans_appel_ia(
    client: TestClient, db: Session, parcours: Parcours, apprenant: Utilisateur, faux_ia: FauxServiceIA
) -> None:
    langue_ar = db.scalar(select(Langue).where(Langue.code == "ar"))
    if langue_ar is None:
        langue_ar = Langue(code="ar", libelle="Arabe")
        db.add(langue_ar)
        db.flush()
    parcours.langue = langue_ar
    db.commit()

    reponse = client.post(url(parcours), headers=entete(apprenant))

    assert reponse.status_code == 200
    assert reponse.json()["statut"] == "PARTIEL"
    assert faux_ia.requetes == []


def test_empreinte_stable_et_sensible_au_contenu() -> None:
    contexte = {"code_langue": "en", "referentiel": "CECRL", "niveau_preliminaire": "B1"}
    entree = {"niveau_vise": "B2"}
    premiere = service_recommandation._empreinte(contexte, entree)
    assert premiere == service_recommandation._empreinte(dict(contexte), dict(entree))
    assert premiere.startswith("sha256:")
    assert premiere != service_recommandation._empreinte(contexte, {"niveau_vise": "B1"})
