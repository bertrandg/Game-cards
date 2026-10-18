# Petite Partie 🃏

Des petits jeux à partager **sur un seul téléphone** : chacun joue à son tour puis passe le téléphone au suivant.
Application web pensée pour le navigateur mobile, sans installation (elle peut aussi être ajoutée à l'écran d'accueil).

**▶ Jouer : https://bertrandg.github.io/Game-cards/**

## Ce que fait l'application

- **Menu des jeux** : Sea Salt & Paper et la Bataille navale, d'autres viendront s'ajouter.
- **Joueurs enregistrés** sur le téléphone (nom, couleur, victoires par jeu).
- **Parties en cours sauvegardées automatiquement** après chaque action : on peut fermer le navigateur et reprendre plus tard.
- **Passage du téléphone** : avant chaque tour, un écran cache tout et annonce le prochain joueur, avec un résumé de ce qui s'est passé depuis son dernier tour.
- **Cartes animées** : elles glissent et se retournent quand on pioche, défausse, pose un duo ou vole une carte.

Tout est stocké dans le navigateur (`localStorage`) : rien n'est envoyé sur internet.

## Jeux

### Sea Salt & Paper (2 à 4 joueurs)

Règles complètes du jeu de base (58 cartes) :
- piocher 2 cartes et en défausser une, ou prendre le dessus d'une défausse ;
- duos : crabes (fouiller une défausse), bateaux (rejouer), poissons (piocher), requin + nageur (voler une carte) ;
- collections (coquillages, poulpes, manchots, moussaillons), multiplicateurs (phare, banc de poissons, colonie, capitaine), sirènes et bonus couleur ;
- fin de manche à partir de 7 points : **STOP** ou **Dernière chance** ; victoire immédiate avec les 4 sirènes ;
- fin de partie à 40 / 35 / 30 points selon le nombre de joueurs.

Les règles résumées et le détail des cartes sont accessibles en jeu avec le bouton **?**. Un appui long sur une carte l'affiche en grand.

### Bataille navale (1 ou 2 joueurs)

- grille de 10 × 10, flotte classique : porte-avions (5), croiseur (4), contre-torpilleur (3), sous-marin (3), torpilleur (2) ;
- les navires ne se touchent pas (même en diagonale) : autour d'un navire coulé, l'eau est marquée automatiquement ;
- placement par glisser-déposer, bouton « Tourner » et placement au hasard ;
- on vise une case puis on tire (deuxième appui ou bouton « Feu ») : boulet, plouf ou explosion, navire qui sombre ;
- à deux, on se passe le téléphone après chaque tir (le joueur suivant revoit le tir reçu sur sa flotte) ;
- seul, on affronte l'**Amiral Robot**, qui traque les navires touchés et estime où se cachent les autres.

## Lancer en local

Les modules JavaScript doivent être servis en HTTP (ouvrir `index.html` directement ne marche pas) :

```bash
python3 -m http.server 8080
```

Puis ouvrir http://localhost:8080 (sur téléphone, même Wi-Fi : `http://<ip-de-l-ordinateur>:8080`).

## Mise en ligne

Le workflow `.github/workflows/pages.yml` publie le site à chaque push sur `main`.
À faire une fois : *Settings → Pages → Build and deployment → Source : GitHub Actions*.

## Structure

- `index.html`, `css/app.css`, `js/main.js` : la coque (accueil, joueurs, parties en cours, navigation par `#/…`)
- `js/storage.js` : joueurs, sauvegardes et historique dans le navigateur
- `js/ui/anim.js` : animations des cartes (technique FLIP + retournement 3D) et confettis
- `js/ui/dialog.js` : confirmations, saisie, messages
- `js/ui/sound.js` : bruitages générés en WebAudio — cartes, tirs, plouf, explosions (coupables depuis le menu du jeu)
- `js/ui/fullscreen.js` : bouton plein écran (masqué sur iPhone, où Safari ne le permet pas)
- `js/games/index.js` : registre des jeux
- `js/games/seasalt/` : Sea Salt & Paper — `cards.js` (les 58 cartes), `rules.js` (moteur de règles sans interface), `view.js` (table de jeu) ; styles dans `css/seasalt.css`
- `js/games/naval/` : Bataille navale — `rules.js` (moteur), `ai.js` (l'ordinateur), `view.js` (grilles et effets) ; styles dans `css/naval.css`
- `css/app.css` contient aussi les éléments communs aux jeux (barre du haut, fenêtres, écran « passez le téléphone », règles)

## Ajouter un jeu

1. Créer `js/games/<id>/index.js` qui exporte par défaut :
   - `newGame(players)` → l'état de départ (un objet JSON, il est sauvegardé tel quel) ;
   - `summary(state)` → une ligne de résumé pour la liste des parties en cours ;
   - `mount(root, state, host)` → dessine le jeu dans `root` et renvoie `{ destroy() }`.
     `host` fournit `save(state)` (à appeler après chaque action), `finish({ winners, summary })`, `abandon()`, `exit()` et `restart(players)`.
2. L'inscrire dans `js/games/index.js` (nom, nombre de joueurs, emoji, couleurs de la tuile, feuille de style, `load` ; `solo` si le jeu se joue aussi seul contre l'ordinateur).
3. Le jeu n'est téléchargé qu'au moment où on le lance.

Noms de fichiers en minuscules, sans chiffres ni tirets (le versionnage du déploiement en dépend).

Sea Salt & Paper est un jeu de Bruno Cathala et Théo Rivière édité par Bombyx. Cette adaptation est un projet personnel : les cartes sont redessinées et ne reprennent pas les photos d'origine.
