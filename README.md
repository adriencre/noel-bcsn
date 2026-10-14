# BCSN · Tournoi de Noël

Site responsive : formulaire public `/`, administration privée `/admin`, aperçu fictif `/admin/demo`.

Le coach renseigne club, catégorie, nom, e-mail, téléphone facultatif, choix explicite concernant les images, et message facultatif. Éric accepte ou refuse depuis son tableau de bord ; un e-mail est alors envoyé au coach via Resend. Un échec d'envoi est signalé et peut être retenté sans perdre l'inscription. Recherche, filtres, export Excel et copie du lien public inclus.

## Démarrage

Node 22 recommandé.

```sh
npm install
npm run dev
```

Cette commande affiche les interfaces et la démonstration. Pour le stockage et la connexion admin, utiliser les fonctions Netlify :

```sh
cp .env.example .env
# Renseigner les variables ci-dessous dans .env
npm run dev:netlify
```

## Déploiement Netlify

1. Importer ce dossier via un dépôt Git dans Netlify. La configuration de build est dans `netlify.toml` : `npm run build`, publication `dist`, fonctions `netlify/functions`.
2. Dans les variables d'environnement Netlify (portée Functions), configurer :

| Variable | Usage |
| --- | --- |
| `ADMIN_PASSWORD` | Mot de passe privé d'Éric, au moins 12 caractères |
| `SESSION_SECRET` | Secret aléatoire, au moins 32 caractères ; générer avec `openssl rand -hex 32` |
| `RESEND_API_KEY` | Clé API Resend pour les confirmations |
| `MAIL_FROM` | Expéditeur sur un domaine vérifié dans Resend, ex. `Tournoi BCSN <tournoi@club.fr>` |
| `ORGANIZER_EMAIL` | Adresse de réponse d'Éric, également affichée dans la notice données |
| `EVENT_DATE` | Date lisible, facultative tant que non fixée |
| `EVENT_LOCATION` | Salle et adresse, facultatives tant que non fixées |
| `EVENT_CATEGORIES` | Catégories séparées par des virgules. Si absent : champ libre |

3. Déployer, ouvrir `/admin`, se connecter avec le mot de passe choisi. Partager le lien `/` avec les clubs.
4. Faire une inscription de contrôle, la valider et vérifier la réception du mail avant diffusion. Aucun véritable mail n'a été envoyé pendant le développement.

## Stockage durable

Les inscriptions sont enregistrées **côté serveur dans un store Netlify Blobs lié au site**, avec lecture fortement cohérente. Ce n'est ni un fichier JSON dans le dépôt, ni du localStorage, ni un store lié au déploiement. Les rebuilds et redéploiements du même site conservent les données. Les aperçus et le développement utilisent des stores distincts de la production. Supprimer le site ou le store supprime ses données ; exporter régulièrement les inscriptions pour conserver une sauvegarde.

Les objets sont sérialisés par le SDK ; aucun fichier de données n'est publié dans `dist`. Documentation : https://docs.netlify.com/build/data-and-storage/netlify-blobs/

## Accès et fonctionnement

Sessions signées de 8 heures, cookie HttpOnly/SameSite Strict/Secure en HTTPS. Aucun mot de passe ni secret dans le frontend. Toutes les lectures et modifications des inscriptions sont authentifiées côté serveur. Validation serveur, contrôle d'origine, honeypot et limitation de débit Netlify. Les envois répétés d'un même formulaire utilisent un identifiant unique pour éviter les doublons lors d'une nouvelle tentative réseau.

Les mails partent uniquement après une décision d'Éric, jamais lors du dépôt initial. Le statut est conservé même si le service mail n'est pas configuré. L'indication « envoyé » signifie accepté par le prestataire, pas garanti délivré dans la boîte du destinataire. Resend gère l'idempotence des tentatives pendant sa fenêtre de rétention.

La date, la salle et les catégories réelles restent à renseigner. La réponse « non » aux images n'empêche pas l'inscription. La réponse « oui » demande au coach de déclarer qu'il possède les autorisations nécessaires, y compris celles des représentants légaux pour les mineurs. L'organisation doit adapter sa notice et sa durée de conservation à ses pratiques ; aucune suppression automatique n'est activée.

```sh
npm test
npm run build
```
