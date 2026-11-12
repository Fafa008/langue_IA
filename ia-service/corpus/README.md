# Corpus documentaire CECRL

Ce dossier contient **uniquement les métadonnées** du corpus documentaire utilisé par le RAG du service IA
(PRE-08). Les descripteurs officiels du Conseil de l'Europe ne sont pas versionnés : leurs droits de réutilisation
ne sont pas clarifiés par écrit.

## Contenu

| Fichier | Versionné | Rôle |
| --- | --- | --- |
| `cecrl/manifeste.json` | oui | Version, source, statut juridique, langues, niveaux, compétences, comptages et empreinte SHA256 du corpus généré. |
| `cecrl/descripteurs.jsonl` | **non** (`.gitignore`) | Un descripteur par ligne, produit par `scripts/ingestion_cecrl.py` hors du dépôt puis copié ou monté ici. |

Le manifeste ne contient aucun texte de descripteur : il ne peut donc pas être distribué comme un substitut du
document officiel.

## Génération

Depuis `ia-service/`, avec `openpyxl` installé (`requirements-dev.txt`) :

```powershell
python -m scripts.ingestion_cecrl `
    --source "C:/temp/cefr-descriptors-2020.zip" `
    --sortie "C:/temp/corpus/cecrl" `
    --langue en
```

Le script refuse toute sortie située dans le dépôt. Il vérifie l'empreinte SHA256 du classeur officiel
(`7c80f798758b7c780225376f1bdedaef7a073c8f6616810f36e13b74b6f614d7`) et échoue sur toute autre source tant que
`--accepter-source-inconnue` n'est pas fourni.

## Activation

Le corpus est **désactivé par défaut** : le service reste sur `RecuperateurVide` et le prompt applique sa règle de
prudence. Pour l'activer :

```bash
# Corpus monté hors du dépôt (recommandé)
export RAG_CORPUS_ACTIF=true
export RAG_CORPUS_CHEMIN=/chemin/vers/corpus/cecrl
```

`RAG_CORPUS_VERIFIER_EMPREINTE=false` ne désactive que le contrôle d'intégrité du fichier ; les validations de
structure du manifeste et des descripteurs restent actives. Un corpus absent ou incohérent est journalisé puis
remplacé par `RecuperateurVide`, sans bloquer le démarrage.

## Droits

Le statut `non_clarifiee` du manifeste signifie : usage interne, non distribué, non commercial, tant qu'aucune
autorisation écrite n'a été obtenue auprès du Conseil de l'Europe. Aucun descripteur officiel ne doit être ajouté
au dépôt, à un artefact de build, à une image Docker publiée ou à un jeu de données partagé.

Les tests n'utilisent que `ia-service/tests/donnees_corpus.py`, un corpus synthétique inventé.
