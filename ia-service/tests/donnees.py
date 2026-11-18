"""Données partagées par les tests : uniquement des valeurs fictives."""

REQUEST_ID = "3f1c9b7e-6a2d-4f0e-9c1a-2b7d5e8f4a10"

CONTEXTE_MINIMAL = {
    "code_langue": "en",
    "referentiel": "CECRL",
    "niveau_preliminaire": "B1",
}

MEMOIRE_PEDAGOGIQUE = {
    "resume": "Deux sessions de conversation, bonnes bases lexicales.",
    "points_forts": ["aisance à l'oral"],
    "points_faibles": ["emploi des temps"],
    "nb_activites": 12,
}

RESULTAT_VALIDE = {
    "code_langue": "en",
    "referentiel": "CECRL",
    "niveau_estime": "B2",
    "phase_assimil": "activation",
    "points_faibles": [
        {
            "domaine": "expression_ecrite",
            "id_question": "q-1",
            "observation": "La réponse comporte une phrase au présent là où le passé serait attendu.",
            "justification": "Cette observation semble indiquer un emploi irrégulier des temps ; à confirmer.",
        },
    ],
    "score_confiance": 0.78,
    "niveau_preliminaire": "B1",
    "ecart_avec_niveau_preliminaire": 1,
}

META_VALIDE = {
    "duree_ms": 1840,
    "fournisseur": "factice",
    "modele": "modele-test",
    "version_corpus": "2026.10",
    "empreinte_prompt": "sha256:" + "a" * 64,
}
