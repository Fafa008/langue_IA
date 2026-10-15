# Évolutions du diagramme de classes

Changements décidés pendant les sprints, à reporter dans le fichier source du diagramme de classes.
Le contrat d'API ([`docs/api/contrat-frontend.md`](../api/contrat-frontend.md)) et le frontend les appliquent déjà.

## Association Langue — Niveau (plusieurs à plusieurs)

**Pourquoi** : tous les niveaux ne sont pas ouverts pour toutes les langues du centre
(niveaux HSK pour le mandarin, A1–C2 pour les langues européennes, une langue nouvelle qui n'ouvre que A1–A2…).
Une liste de niveaux commune à toutes les langues ne permet pas de le dire.

**Changement** (paquetage Pédagogie) :

```
Langue  0..* ──────── 0..*  Niveau
            « ouvre »
```

- Table d'association `LangueNiveau(id_langue, id_niveau)`, clé primaire composée des deux colonnes,
  clés étrangères vers `Langue` et `Niveau`.
- Attribut de navigation : `Langue.niveaux : List<Niveau>` (même écriture que `Formule.langues : List<Langue>`).
- Suppression d'une langue ou d'un niveau : ses lignes `LangueNiveau` sont supprimées en cascade.
- Une langue doit ouvrir **au moins un** niveau (règle de gestion, vérifiée par le frontend et le backend).

**Conséquence à prévoir** : un `Parcours`, un `Exercice` ou un `TestDiagnostic` portant sur une langue et un niveau
devrait utiliser un niveau ouvert pour cette langue (contrôle côté backend).

**Pas de changement** : `Langue` n'a toujours ni statut ni énumération `StatutLangue` ; retirer une langue se fait
par la suppression (refusée si elle est utilisée).

## Association Apprenant — Langue (langues suivies) — proposition, à valider

**Pourquoi** : à l'inscription, l'apprenant choisit ses langues (`langues` de `POST /auth/register`), et le tableau de
bord compte les apprenants par langue. Le diagramme ne dit pas où ce choix est enregistré.

**Proposition appliquée par le backend MVP** (paquetage Utilisateurs) :

```
Apprenant  0..* ──────── 0..*  Langue
               « suit »
```

- Table d'association `ApprenantLangue(id_apprenant, id_langue)`, clé primaire composée.
- Supprimée avec l'apprenant (cascade) ; une langue suivie ne peut pas être supprimée (RESTRICT).

**Alternative** : passer par `Parcours` (« cible » une langue). L'association directe reste utile tant qu'aucun
parcours n'est créé (l'apprenant vient de s'inscrire). À trancher avec l'équipe avant de reporter dans le diagramme.
