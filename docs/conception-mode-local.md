# Note de conception — mode local / vie privée

Statut : **proposition**. Seul le **lot 0** (format canonique + export/import) est livré ;
tout le reste attend validation.

Objet : ajouter à PairWise un second mode de stockage où les données ne quittent pas
l'appareil, la synchronisation entre partenaires passant par un fichier chiffré déposé dans le cloud
personnel de l'utilisateur (Google Drive ou Dropbox). Le mode actuel reste inchangé.

---

## 1. Les deux modes

| | **Connecté** (actuel) | **Local** (nouveau) |
|---|---|---|
| Stockage | Firestore | IndexedDB + fichiers dans le cloud de l'utilisateur |
| Synchro du couple | temps réel | par journaux, à l'ouverture et périodiquement |
| Le serveur peut lire | oui | **il n'y a pas de serveur** |
| Synchro bancaire | ✅ | ❌ (structurel) |
| Instantané de patrimoine 23 h | ✅ ventilé par actif | ⚠️ total seul, écrit à l'ouverture de l'onglet |
| Notifications | push, app fermée | locales seulement |
| Cours crypto | ✅ | ✅ (CoinGecko, sans clé — donc requête réseau) |
| Cours actions | ✅ | ❌ saisie manuelle (la clé doit rester côté serveur) |
| Charges récurrentes, budgets, alertes, insights | ✅ | ✅ (déjà côté client) |

Ce qui tombe ne tombe pas parce que les octets sont ailleurs, mais parce que **le serveur ne
peut plus lire**. C'est la même frontière qui découperait un mode chiffré de bout en bout.

### Le nom « hors-ligne » est faux — à ne pas garder

Ce mode **utilise le réseau**. Le nier serait une promesse intenable dès la première inspection
du trafic. Voici exactement ce qui sort de l'appareil :

| Destination | Ce qui part | Ce qui NE part pas |
|---|---|---|
| Google Drive / Dropbox | le fichier **chiffré** | rien de lisible par eux |
| `api.coingecko.com` | les **symboles** détenus (`bitcoin`, `ethereum`…) + adresse IP | montants, quantités, identité |
| `open.er-api.com` | les **codes devises** utilisés | montants, identité |
| Serveurs PairWise | **rien** | — |

La fuite n'est donc pas nulle : quelqu'un qui observerait ces appels apprendrait *quels* actifs
et *quelles* devises tu utilises — jamais combien, ni qui tu es, ni la moindre transaction.
C'est un ordre de grandeur en dessous de « une entreprise détient ton livre de comptes », mais
ce n'est pas rien, et un utilisateur soucieux de sa vie privée posera la question.

**Le mode s'appelle donc « Local », pas « Hors-ligne ».** Ce qui est vrai, et suffisant :
*aucune donnée sur nos serveurs*.

### Sous-option « strict » : aucune requête sortante

Pour ceux qui veulent la version dure, un interrupteur secondaire coupe **toute** requête vers
un tiers. Conséquences à assumer et à afficher :

- Les cours crypto ne sont plus rafraîchis → valeur saisie à la main, comme l'immobilier.
- La conversion de devises repose sur le **dernier taux connu** : depuis `utils/fxCache`, la
  table complète (~161 devises) est conservée dès qu'on a été en ligne une fois, et sert
  ensuite quel que soit son âge, signalée comme approximative. La table gravée à **7 devises**
  n'intervient plus que sur une installation qui n'a jamais vu le réseau ; au-delà, PairWise
  refuse de convertir plutôt que d'inventer un taux (règle en vigueur, cf. `CLAUDE.md`).
- La synchronisation entre partenaires devient impossible : le fichier ne peut plus atteindre le
  cloud. Le mode strict est donc **mono-appareil par construction**.

Ce dernier point mérite d'être dit tôt : « strict » et « couple » s'excluent.

### Les actions : à retirer du périmètre

Twelve Data exige une clé, qui doit rester côté serveur — la mettre dans le paquet du navigateur
l'exposerait à tous. Sans serveur, il ne reste que la clé `demo`, trop limitée pour être
honnête. En mode Local, **les actions se saisissent à la main**, comme l'immobilier ou un
véhicule. Mieux vaut l'annoncer que livrer une cotation qui échoue une fois sur deux.

### Ce qu'on a le droit d'écrire

- Mode connecté : *« Tes données sont chiffrées, isolées et jamais revendues. »*
- Mode local : *« Aucune donnée sur nos serveurs. Tes finances vivent sur ton appareil et dans un
  fichier chiffré rangé dans ton propre cloud — nous n'y avons pas accès. »*

Ne pas écrire « full privacy » sur le mode connecté : `functions/netWorthSnapshots.js:176`
parcourt tous les couples et lit leurs `assets` en clair. Ne pas écrire « hors-ligne » ni
« aucune connexion » sur le mode local : c'est faux tant que les cours et le cloud sont
interrogés. Deux promesses distinctes et vraies valent mieux qu'une promesse floue, qui se
retourne au premier examen.

---

## 2. La décision structurante : un seul format canonique

La réversibilité est le point qui fixe l'architecture. Supporter les deux sens **sans doubler
le travail** suppose que les deux modes sachent produire et relire **le même document** :

```
{ format: "pairwise-export", version: 1, exportedAt,
  scope:        { memberKey, omittedPrivate },
  couple:       { … liste blanche COUPLE_FIELDS … },
  transactions: [ … ] }
```

Livré dans [src/utils/canonicalData.js](../src/utils/canonicalData.js). Trois propriétés y sont
tenues par des tests : liste **blanche** des champs exportés (un champ ajouté au doc couple ne
fuit pas par défaut), `members` exporté mais **jamais importé** (il alimente `memberUids`, sur
lequel reposent les règles de sécurité), et un import **non destructif** — l'export ne contenant
que ce que le membre courant peut voir, s'en servir pour remplacer effacerait le privé du
partenaire.

Chaque migration devient alors « exporter d'un côté, importer de l'autre », avec **un seul
morceau de code exercé dans les deux sens** — donc testé deux fois plus par le simple usage.

C'est aussi le lot le plus utile isolément : un export/import complet a de la valeur pour tout
le monde, même si le mode local n'est jamais livré.

---

## 3. Synchroniser deux appareils par des fichiers bêtes

Drive et Dropbox ne savent pas fusionner. La règle qui évite le problème :

> **Aucun fichier n'a deux auteurs.**

Chaque appareil écrit **son propre journal**, en ajout seulement :

```
/PairWise/
  nicolas.log.enc     ← écrit par l'appareil de Nicolas, lu par les deux
  jessica.log.enc     ← écrit par l'appareil de Jessica, lu par les deux
  snapshot.enc        ← repli périodique, pour ne pas relire l'historique entier
```

Chaque appareil lit les deux journaux et les replie en état local. Il n'y a donc **aucun
conflit de fichier** : le problème se réduit à ordonner des opérations.

### Format d'une opération

```
{ id, deviceId, hlc, entity, op, key, payload }
```

`hlc` est une horloge logique hybride (temps mural + compteur + identifiant d'appareil). Elle
survit à deux téléphones dont les horloges divergent, ce qu'un simple `Date.now()` ne fait pas.

### Règle de fusion

- **Par entité, pas par document.** `asset.upsert`, `budget.delete`, `tx.upsert`…
- **Dernier écrivain gagne, champ par champ**, tranché par `hlc`.
- **Suppressions = pierres tombales**, conservées, sinon une suppression se fait ressusciter par
  un journal plus ancien.

Pour une app de finances à deux, les collisions réelles sont rarissimes et sans gravité (deux
personnes renommant la même catégorie dans la même minute). Le cas qui compte — chacun saisit
ses transactions de son côté — n'est pas un conflit du tout.

---

## 4. Le vrai obstacle dans le code existant

`FinanceContext` fait aujourd'hui du **read-modify-write sur des tableaux entiers** :
`addAsset`, `addBudget`, `addRecurring`, `updateMemberName` relisent le tableau complet et le
réécrivent fusionné (c'est documenté dans `CLAUDE.md`, et parfaitement adapté à Firestore, qui
arbitre côté serveur).

Hors ligne, ce motif **perd la modification concurrente du partenaire** : deux personnes qui
ajoutent chacune un budget hors connexion produisent deux tableaux complets, et le dernier
replié écrase l'autre.

C'est le poste de travail principal, et il faut le regarder en face : les écritures doivent
devenir **élémentaires** (`upsert(asset)`, `remove(budget, id)`) plutôt que globales. Cette
bascule profite d'ailleurs au mode connecté, où elle réduit les écritures et les collisions.

### La couture

Un adaptateur de persistance derrière lequel les deux modes se rangent :

```
subscribe(onState)            → flux d'état (onSnapshot, ou repli du journal)
upsert(entity, key, payload)
remove(entity, key)
setFields(patch)              → champs scalaires du couple (devise, thème, mode…)
```

`FirestoreAdapter` et `LocalAdapter`. Les écrans ne bougent pas : ils passent déjà tous par
`FinanceContext`. C'est ce qui rend le chantier faisable sans toucher aux vingt écrans.

---

## 5. Chiffrement et appairage

Le fichier est chiffré **avant** d'atteindre Drive : la promesse porte aussi contre Drive.

- Clé symétrique aléatoire par couple (AES-GCM), jamais dérivée d'un mot de passe — un mot de
  passe de couple partagé est un mauvais secret.
- **Appairage** : l'appareil A affiche un QR contenant l'identifiant du dossier et la clé ;
  l'appareil B le scanne. La clé ne transite par aucun serveur, y compris le nôtre.
- **Récupération** : phrase de récupération à noter à l'activation. Sans elle et sans second
  appareil, les fichiers sont définitivement illisibles. À dire trois fois dans l'interface,
  pas une.
- **Révocation** (séparation, téléphone perdu) : rotation de clé, réécriture du snapshot,
  retrait du partage côté Drive.

### Contrainte vérifiée

Le dossier caché de Drive (`appDataFolder`) serait idéal — invisible, propre à l'app — mais il
est **strictement personnel et non partageable**. Il faut donc un dossier Drive normal, que l'un
des partenaires partage avec l'autre. Moins élégant, et en réalité plus vendeur : l'utilisateur
voit ses fichiers et peut les emporter.

**iCloud est hors jeu** pour une app web : il n'existe pas d'API publique. Drive et Dropbox au
lancement, et le dire franchement plutôt que de le laisser espérer.

Le dossier partagé peut d'ailleurs **tenir lieu de lien de couple**, ce qui supprime le besoin
de compte dans ce mode — la promesse en devient nettement plus crédible.

---

## 6. Migration, dans les deux sens

**Connecté → local**
1. Export canonique, et **sauvegarde de sécurité téléchargée sur l'appareil** avant tout.
2. Déconnexion des banques via `purgeBankConnections` (les jetons doivent disparaître, pas
   dormir).
3. Retrait des jetons de notification push.
4. Amorçage du magasin local, création du dossier, premier snapshot.
5. Effacement des données serveur, après confirmation explicite.

**Local → connecté**
1. Repli des journaux en un export canonique.
2. Import dans Firestore.
3. Les banques et l'instantané nocturne redeviennent disponibles.
4. Les journaux sont conservés en archive, jamais supprimés automatiquement.

**Ce qui ne se rattrape pas, et qu'il faut annoncer :** l'historique de patrimoine **ventilé par
actif** est écrit par la fonction planifiée de 23 h. Pendant la période en mode local, seuls les
totaux existent. Au retour, le détail de ces mois-là restera absent — un instantané ne se
reconstitue pas après coup, les valeurs d'actifs étant des saisies qui s'écrasent.

---

## 7. Découpage en lots

| Lot | Contenu | Utile seul ? |
|---|---|---|
| 0 | Format canonique + export/import complet | **oui** — ✅ livré |
| 1 | Adaptateur de persistance + écritures élémentaires dans `FinanceContext` | oui (moins de collisions) |
| 2 | Magasin IndexedDB, mode local **mono-appareil** | oui |
| 3 | Connecteur Drive/Dropbox (OAuth PKCE), journaux, chiffrement | non |
| 4 | Appairage, révocation, compactage des journaux | non |
| 5 | Migrations dans les deux sens, textes et garde-fous | non |

Le lot 1 est le plus risqué : il touche un motif d'écriture présent partout. À faire seul, avec
sa propre livraison.

---

## 8. Tests

La fonction de repli des journaux est **pure** : entrée une liste d'opérations, sortie un état.
Elle tombe donc pile dans le périmètre déjà testé du dépôt (logique critique pure), et se prête
aux assertions par invariants plutôt que par valeurs écrites à la main :

- rejouer les opérations dans n'importe quel ordre donne le même état (commutativité) ;
- rejouer deux fois ne change rien (idempotence) ;
- une pierre tombale gagne toujours sur une écriture d'horloge antérieure ;
- export → import → export redonne un document identique (aller-retour sans perte).

Ce dernier test est le filet de sécurité des migrations, et il doit exister **avant** le lot 5.

---

## 9. Risques

- **Perte de données par bug de fusion.** Atténuation : sauvegarde de sécurité obligatoire avant
  chaque migration, journaux jamais supprimés, compactage qui n'efface qu'après vérification.
- **Utilisateur qui perd sa phrase de récupération.** Aucune atténuation technique possible —
  c'est le prix de la promesse. Le dire clairement plutôt que l'atténuer.
- **Limites d'API Drive/Dropbox** sur des synchronisations fréquentes. Atténuation : synchroniser
  à la reprise de l'app et à intervalle, pas à chaque frappe.
- **Deux modes à maintenir pour toujours.** C'est le coût récurrent réel du projet, et il ne
  disparaîtra pas. À accepter en connaissance de cause.

---

## 10. Questions ouvertes

1. Le mode local est-il proposé **à l'inscription** ou seulement dans les réglages ?
2. Un couple peut-il être **mixte** (un partenaire connecté, l'autre local) ? Recommandation :
   **non**, le mode appartient au couple. Le supporter multiplierait les cas de fusion.
3. Le mode local est-il **payant**, gratuit, ou l'argument d'appel ?
