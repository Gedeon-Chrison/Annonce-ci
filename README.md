# AnnonceCI — Publication automatique depuis iPhone

Ce projet publie automatiquement tes annonces immobilières sur **Jiji.co.ci**, **Ivoiredomi.ci** et **Moboo.ci** via GitHub Actions — sans ordinateur.

## Structure
```
annonce-ci/
├── annonces.json              ← TES ANNONCES (à modifier)
├── poster.js                  ← Script de publication (ne pas toucher)
└── .github/workflows/
    └── poster-annonces.yml    ← Déclencheur GitHub Actions
```

## Configuration des secrets (une seule fois)

Dans GitHub > Settings > Secrets and variables > Actions, ajoute :

| Nom du secret       | Valeur               |
|---------------------|----------------------|
| JIJI_EMAIL          | ton email sur Jiji   |
| JIJI_PASSWORD       | ton mot de passe     |
| IVOIREDOMI_EMAIL    | ton email            |
| IVOIREDOMI_PASSWORD | ton mot de passe     |
| MOBOO_EMAIL         | ton email            |
| MOBOO_PASSWORD      | ton mot de passe     |

## Utilisation

1. Modifie `annonces.json` avec tes annonces
2. Commit + push → GitHub Actions se déclenche automatiquement
3. Résultat visible dans l'onglet **Actions** de ton repo

## Ajouter un nouveau site

Ajoute une fonction `posterNouveauSite()` dans `poster.js` et appelle-la dans la boucle principale.
