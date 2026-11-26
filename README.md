# Agodeo Web Printer

Application web **100 % locale et statique** (aucun serveur backend, aucune donnée envoyée sur Internet) pour piloter en Bluetooth Low Energy (BLE) les mini imprimantes thermiques de poche 57 mm compatibles **FunPrint / Agodeo** (famille « cat printer ») : MXW01 (Agodeo), C9/C15/C17/C20, X1/X2, GB01/GB02/GB03, GT01 et clones.

**Deux protocoles sont supportés et détectés automatiquement** (présence de la caractéristique de données `AE03`) :

- **MXW01** (ton Agodeo) : trames `22 21 … FF`, commandes sur `AE01`, réponses sur `AE02`, image sur `AE03`
- **cat classique** (GB01, GT01…) : trames `51 78 … FF`, tout sur `AE01`/`AE02`

L'application permet de se connecter depuis le navigateur, lire l'état (papier, batterie, température, surchauffe), imprimer du **texte**, une **image/photo** (bitmap 384 px, dithering Floyd-Steinberg optionnel) ou un **QR code généré localement**, régler la densité et le mode (mono / 16 gris), et avancer le papier. Elle est **installable comme une appli (PWA)** et se **reconnecte en un clic** au dernier appareil.

L'interface est organisée en **4 onglets** (barre du bas) : **🖨️ Imprimante** (connexion, état, labo protocole, journal BLE), **✏️ Contenu** (texte / image / QR / modèles + aperçu + impression), **📷 Photo** (appareil photo : zoom, flash, switch caméra, minuteur, grille 3×3, télécharger/imprimer) et **🎞️ Photobooth** (plein écran, impression directe de la photo).

📜 **[CHANGELOG.md](CHANGELOG.md)** — historique de toutes les versions (le numéro en haut de l'app = dernière entrée du changelog).

🎨 **Thème visuel** : palette chaude (crème / terracotta / chocolat) définie en variables CSS dans `style.css` — facile à personnaliser.

⛶ **Plein écran** : bouton ⛶ dans l'en-tête (onglets Imprimante et Contenu) via l'API Fullscreen — masque toute l'interface Chrome dans la session. Alternative permanente : installer la PWA (⋮ → « Installer l'application »), elle s'ouvre en `standalone` (vrai plein écran, même hors ligne).

---

## 1. Compatibilité

### Navigateurs (Web Bluetooth)

| Plateforme | Navigateur | Fonctionne ? |
|---|---|---|
| Windows / macOS / Linux / ChromeOS | **Chrome** ou **Edge** | ✅ oui |
| Android | **Chrome** | ✅ oui (Bluetooth à activer + autorisation de la page) |
| iPhone / iPad | Safari | ❌ non (Web Bluetooth non supporté) |
| Tous OS | Firefox | ❌ non |

### Contexte sécurisé obligatoire

Web Bluetooth n'est disponible qu'en **HTTPS** ou sur **`http://localhost` / `http://127.0.0.1`** (pas l'IP du réseau). En local, un simple serveur statique suffit : `python -m http.server` (Windows) ou `python3 -m http.server` (Linux/macOS). En production : hébergement HTTPS (GitHub Pages, Netlify, Vercel…).

### Matériel

- Mini imprimante thermique 57 mm type Agodeo/FunPrint, **allumée**, à proximité (< 10 m), Bluetooth activé côté PC/téléphone. **Une seule connexion BLE à la fois** : fermer l'app FunPrint sur le téléphone avant de connecter depuis le PC.
- Rouleau de papier thermique **57 mm** chargé, face thermosensible (lisse/brillante) vers la tête d'impression, capot fermé.

---

## 2. Installation et lancement

```bash
git clone https://github.com/matheisenheim/agodeo-web-printer.git
cd agodeo-web-printer
git checkout vibe/agodeo-web-printer-7ead01
python serve.py                 # recommandé : Cache-Control no-store, aucun 304 en dev
# ou à défaut :
python -m http.server 8000      # Windows
python3 -m http.server 8000     # Linux / macOS
```

Puis ouvrir [http://localhost:8000](http://localhost:8000) dans **Chrome ou Edge**.

> ⚠ Si la page affiche une vieille version (boutons morts, pas de n° de version) : le navigateur sert son cache. Solutions : lancer avec `python serve.py` + **Ctrl+Shift+R**, ou F12 → Network → cocher « Disable cache », ou Chrome → ⋮ → « Effacer les données de ce site ». Pour une PWA installée : la retirer de l'écran d'accueil, effacer les données du site, puis la réinstaller.

Alternatives : `npx serve .`, ou VS Code → clic droit sur `index.html` → « Open with Live Server ».

### Tester sur téléphone (Android)

Sur téléphone, Web Bluetooth exige un **contexte sécurisé (HTTPS)** — `localhost` ne désigne pas le PC. Trois méthodes :

1. **GitHub Pages (recommandé)** : activer Pages sur la branche `vibe/agodeo-web-printer-7ead01` — [Settings → Pages](https://github.com/matheisenheim/agodeo-web-printer/settings/pages) → Source « Deploy from a branch » → branche `vibe/agodeo-web-printer-7ead01` → dossier `/ (root)` → Save. Après 1–2 min, l'app est servie en HTTPS sur **https://matheisenheim.github.io/agodeo-web-printer/**
2. **adb reverse** : téléphone branché en USB au PC (débogage USB activé) → `adb reverse tcp:8000 tcp:8000`, lancer `python -m http.server 8000` sur le PC, puis ouvrir `http://localhost:8000` dans Chrome Android (`localhost` = contexte sécurisé)
3. **Flag Chrome Android** : `chrome://flags/#unsafely-treat-insecure-origin-as-secure` → saisir `http://<IP-du-PC>:8000`, ouvrir cette URL dans Chrome

Puis, sur le téléphone : Chrome, Bluetooth activé, **autoriser l'autorisation Bluetooth pour le site** (cadenas → Autorisations → Bluetooth), fermer l'app FunPrint, allumer l'imprimante, cliquer « Connecter l'imprimante » et choisir MXW01 dans le sélecteur Android.

### Installer l'app (PWA)

En HTTPS (GitHub Pages) ou localhost, Chrome/Edge propose « Installer » / « Ajouter à l'écran d'accueil » (icône ⋮ → Installer l'application). L'app fonctionne ensuite **hors ligne** grâce au service worker (`sw.js` met en cache tous les fichiers, versionné avec l'app).

### Mettre à jour le code (nouvelles versions)

Depuis le dossier du projet, sans modifier les fichiers toi-même :

```bash
git fetch origin
git checkout vibe/agodeo-web-printer-7ead01   # seulement la première fois
git pull origin vibe/agodeo-web-printer-7ead01
```

Puis recharge la page avec **Ctrl+F5** (sinon le cache garde l'ancien JS) et vérifie le numéro de version affiché en haut de la page.

---

## 3. Guide d'utilisation

1. Allumer l'imprimante, charger un rouleau 57 mm, fermer FunPrint sur le téléphone.
2. Cliquer **« Connecter l'imprimante »** (laisser le préfixe vide pour tout lister, ou taper `MXW01`), choisir l'imprimante dans le sélecteur du navigateur.
3. **« État de l'imprimante »** : pour un MXW01 affiche état + batterie % + température de la tête + erreur éventuelle (pas de papier, surchauffe…).
4. Onglet **Contenu** : sous-onglets **Texte**, **Image**, **QR code** ou **Modèles**, régler la **densité** (curseur énergie) et le **mode** : mono 1 bit (rapide) ou 16 niveaux de gris 4 bits « HD » (photos). L'aperçu montre le rendu (384 px de large). Le sous-onglet **Image** et le sélecteur de fichier sont **désactivés pendant qu'une image est en cours** (décodage d'un import ou impression d'une image en cours) pour éviter double import / double impression.

### Labo protocole (reverse engineering)

Panneau **« Labo protocole »** : envoie une trame brute (`cmd` + `payload` en hex, ex. `ae` / `00`) sur `AE01` avec le bon header (auto selon le protocole détecté) ; les réponses de l'imprimante arrivent dans le journal BLE. Boutons rapides : `A7` (ID série), `AB` batterie, `A4` retract, `B1` version.

Pour découvrir `AE`, `B2`, `B3` (inconnues), 3 pistes :

1. **Labo de l'app** : tester `ae 00`, `b2 00`, `b3 00` et variantes de payload, noter les réponses (journal BLE). Ne rien envoyer pendant une impression ; si blocage → éteindre/rallumer l'imprimante.
2. **Décompilation de l'app officielle FunPrint**, extraite de TON téléphone : `adb shell pm path com.fun.mxw` puis `adb pull <chemin>` → ouvrir l'APK avec **jadx** → chercher `BluetoothOrder`, `0xAE`, `0xB2`, `0xB3` dans le code (la classe `BluetoothOrder.java` contient déjà la construction des paquets connus).
3. **Snoop HCI** : Options développeur Android → « Journal d'analyse Bluetooth HCI » → utiliser FunPrint normalement → `adb pull /sdcard/Android/data/com.android.bluetooth/files/btsnoop_hci.log` → ouvrir dans **Wireshark** (filtre ATT, colonne Write sur la caractéristique AE01).

### Appareil photo (📷 Photo)

Onglet **Photo** pour utiliser l'app comme un vrai appareil photo, **en plein écran comme le photobooth** : vidéo en cover, **✕ Quitter** en haut à droite, 🔦 flash en haut à gauche, **📸 gros rond au centre en bas**, colonnes de boutons à gauche (Démarrer/Arrêter, 🔄 Face/Dos) et à droite (⏱️ minuteur 3 s, ▦ grille 3×3 en toggles), **slider de zoom pleine largeur** au-dessus. **📸 Prendre une photo** → aperçu en overlay plein écran avec **💾 Télécharger** (PNG) ou **🖨️ Imprimer** directement. Options : **zoom** (borné par `capabilities.zoom`), **flash 🔦** (torche si supportée), **🔄 switch caméra**, **tap-to-focus** (`pointsOfInterest` + carré jaune), miroir auto en Face seulement, `focusMode: 'continuous'` à chaque démarrage/switch. **Caméra de dos (`environment`) par défaut** (repli sur la caméra avant si pas de dos), **démarrée automatiquement à l'entrée de l'onglet 📷** (bouton « Démarrer la caméra » en repli si le navigateur demande une autorisation). En 🎞️ Photobooth, la caméra se lance via le bouton « Démarrer la caméra ». La caméra s'arrête en quittant l'onglet.

**⚙️ Réglages manuels** (bouton ⚙️ en bas à droite de l'onglet 📷) : panneau avec sliders générés depuis `getCapabilities()` — chaque réglage n'apparaît que s'il est supporté par le téléphone : focus manuel, exposition (EV), temps de pose, ISO, balance des blancs (K), luminosité/contraste/saturation/netteté ; sélecteurs de mode focus/expo/WB ; **résolution et FPS** dans leur propre section « Flux caméra », empilés verticalement (redémarrage caméra) ; bouton « ↺ auto ». Tout est appliqué en live via `applyConstraints({ advanced })` (best-effort). Note : pose/ISO ne s'appliquent qu'en **exposition manuelle**, focus manuel qu'en **focusMode manual**, température de couleur qu'en **WB manuel** — déplacer le slider passe automatiquement le mode en `manual`. **Exception : la pose (`exposureTime`) n'est jamais appliquée au flux d'aperçu** — deux chemins selon la pose réglée :
- **pose > 2 s** : la photo est construite par **accumulation additive des trames de l'aperçu live** (`accumulateLongExposure`, composite `lighter` sur canvas, ~10 trames/s) pendant toute la durée de la pose. Aucun réglage n'est appliqué au flux : l'aperçu reste **100 % live** pendant la prise (jamais blanc ni figé), le guide ● gyroscope fonctionne, et la photo prend réellement la durée de la pose (20 s → statut « Photo prise en ~20 s (pose appliquée 20,0 s) » + compte à rebours). Comme une vraie pose longue, les hautes lumières s'écrêtent et le bougé floute. C'est nécessaire car `ImageCapture.takePhoto()` ignore la pose manuelle sur certains téléphones et le HAL partagé blanchirait l'aperçu.
- **pose ≤ 2 s (ou non réglée)** : flux de capture dédié (second `getUserMedia` sur la même caméra, réglages passés dans les contraintes initiales `advanced` puis ré-appliqués sur le track via `applyConstraints`), photo via **`ImageCapture.takePhoto()`**, flux fermé aussitôt — aperçu intact ; repli sur `captureStill` du flux live si le flux dédié est refusé.

Tous les autres réglages restent visibles en direct sur le flux. Case **Pose auto selon la luminosité** (section Exposition) : en auto, la pose n'est plus manuelle — elle est **mesurée toutes les 500 ms** et affichée en direct sur la ligne Pose, en combinant deux sources : la luminance moyenne de l'aperçu (`measureLuma`, canvas 64×36) **et le capteur de lumière ambiante du téléphone** s'il existe (lux via `AmbientLightSensor` / événement `devicelight`, affiché à côté : « 3,20 s (42 lx) ») ; pose retenue = max des deux, scène sombre / faible lux → pose longue (plafond 8 s, mapping log sur le lux). À la capture : pose > 2 s → accumulation pendant la durée mesurée avec gain `brightness(pose/pose-auto)` borné ×1–×8 (moyenne des trames, pas de somme additive) ; pose ≤ 2 s → `exposureTime` injecté dans le flux de capture dédié. L'aperçu live n'est jamais modifié. Les objectifs multiples (ultra-wide…) apparaissent comme des caméras séparées dans 🔄.

### Photobooth

Onglet **Photobooth** (s'ouvre **en plein écran**, sans header ni barre d'onglets) : aperçu webcam en direct (`getUserMedia`, exige HTTPS/localhost + autorisation caméra). Bouton **📸** (rond, **au centre en bas, 50 % plus grand** ; « Démarrer la caméra » à sa gauche et 🔄 à sa droite, les 3 alignés tout en bas) : fige la photo (384 px de large) et **l'imprime directement** — **on reste dans l'onglet plein écran** ; si l'imprimante n'est pas connectée ou ne répond pas, un message d'erreur **❌ s'ouvre en popup au centre de l'écran** (fermable avec **OK** ou en cliquant à côté). Sur téléphone, le bouton **🔄** bascule d'une caméra à l'autre (recto/verso) dès que le navigateur en voit au moins deux (bouton grisé sinon) et son **libellé indique la caméra active** : **🔄 Face** ou **🔄 Dos**. Le bouton **✕ Quitter** en haut à droite sort du plein écran et ramène à l'onglet précédent. En plein écran, aucun texte d'info en bas ni indicateur caméra en haut : seulement la vidéo, le bouton ✕ en haut à droite, **tap-to-focus** (`pointsOfInterest` + carré jaune, coordonnées inversées en Face).

**Filtres (carousel)** : balayer l'écran **horizontalement** sur la vidéo (ou cliquer le libellé en haut au centre) pour cycler : Aucun / N&B / Sépia / Chaud / Froid / Contraste / Inversé. Le filtre s'applique à l'aperçu live et est appliqué à la photo 384 px imprimée (`ctx.filter` à la capture). En haut à gauche, un seul **bouton flash** : 🔦 torche LED si la caméra active la supporte (via la contrainte `torch` — téléphone Android / webcam PC compatible), **sinon 🖥️ écran blanc** comme flash (plein blanc pendant le minuteur + capture, avec Wake Lock anti-assombrissement ; la luminosité système max reste à régler manuellement, aucune API web ne la force) — typiquement caméra **Face** sans flash LED, et en bas les 3 boutons alignés (caméra à gauche, rond 📸 au centre, 🔄 à droite). Le **miroir selfie** s'applique **uniquement en caméra Face** (aperçu ET photo retournés ; en 🔄 Dos, image droite) et le **minuteur 3-2-1** est **toujours actif** ; il n'y a plus de cadre + date autour de la photo. Toute notification passe par une **popup centrée fermable** (OK ou clic à côté) : erreur ❌ (imprimante non connectée / ne répond pas / caméra) **et aussi réussite** ✅ « Impression réussie » — il n'y a plus de barre d'état. Le mode **1 (mono 1 bit, éjection réduite du papier après l'impression)** est forcé automatiquement dans cet onglet et restauré en en sortant. Quitter l'onglet arrête la caméra. Un seul appareil BLE connecté à la fois (fermer FunPrint ailleurs).

**Page de test** : bouton « Page de test » (panneau Impression) → génère une mire (titre + date + version, damier d'alignement, barre des 16 niveaux de gris, 8 lignes de texte, QR du projet) et l'imprime directement si l'imprimante est connectée, sinon la met dans l'aperçu.

**Infos appareil** (bouton « Infos appareil B0/B1 ») : affiche le **firmware (B1)**, le **type d'impression (B0)** et le **ID série (A7)** en hex (6 octets).

### Modèles d'étiquettes (thème thé)

L'onglet **Modèles** propose des cadres vectoriels dessinés sur le canvas (384 px) :

- **Cadre bas-relief & feuilles** : double filet avec ombre portée, feuilles de thé dans les 4 coins, champs nom / origine-notes / poids, et **QR optionnel** (champ URL) en bas à droite
- **Médaillon « sceau de thé »** : cercle double avec feuille centrale, nom en dessous
- **Bandeau branche de thé** : branche feuillue en haut du cadre, nom centré

En mode **4 bits / 16 gris (HD)**, l'ombre portée du cadre sort en vrais dégradés (bas-relief réel) ; en mode 1 bit, elle est seuillée/hachurée.
5. Si un appareil a déjà été connecté, le bouton **« Reconnecter à … »** ré-établit la liaison en un clic (sans repasser par le sélecteur), grâce aux autorisations conservées par le navigateur (`localStorage` + `navigator.bluetooth.getDevices()`).
6. Tant que l'imprimante est connectée, son **état est ré-interrogé toutes les 30 s** (`A1`) : batterie, température, erreurs — avec une alerte ⚠ sous 20 % de batterie.

### Paramètres réglables

| Paramètre | Réglable ? | Commentaire |
|---|---|---|
| **DPI** | ❌ non | fixe : la tête imprime **384 points physiques** (~48 mm imprimables → **~203 dpi réels**, 8 pts/mm). Les « 300 DPI » de la fiche commerciale sont une valeur interpolée (marketing), non atteignable par logiciel — la commande `A9` ne déclare que la largeur en octets, plafonnée à 48 octets = 384 px par la tête |
| Densité / intensité | ✅ oui | curseur « énergie » → commande `A2` (0–100, défaut ~93) sur MXW01, `AF` sur cat classique |
| Mode couleur | ✅ oui (MXW01) | `A9` mode `0` = 1 bit/px (48 octets/ligne, rapide) ou mode `2` = 4 bits/px, 16 niveaux de gris (192 octets/ligne, « HD », plus lent) — c'est l'option « HD » de l'app FunPrint |
| Avance du papier | ✅ oui | nombre de lignes après impression (`A3` MXW01 / `A1` cat) |
5. **« Imprimer »** : envoie la séquence complète et attend la fin d'impression (notification `AA` sur MXW01).
6. **« Avancer le papier »** éjecte l'étiquette (nombre de lignes réglable).

Le **journal BLE** en bas affiche toutes les trames envoyées (`envoi …`) et reçues (`reçu …`) en hex — indispensable pour déboguer.

**Sonde USB (WebUSB)** : les boutons « Autoriser un appareil USB… » et « Sonder l'USB » listent les périphériques USB vus (VID:PID, nom) via `navigator.usb` — utile pour vérifier si une autre imprimante expose un port de données USB (le MXW01 n'en expose pas : USB-C = charge seule). Sur téléphone Android, utiliser avec un adaptateur OTG. WebUSB exige Chrome/Edge en HTTPS ou localhost, comme Web Bluetooth.

---

## 4. Architecture du code

```
agodeo-web-printer/
├── index.html            structure de la page (connexion / contenu / impression + journal)
├── style.css
├── manifest.webmanifest  PWA (installation sur téléphone/PC)
├── sw.js                 service worker : cache hors ligne
├── icon-192.png / icon-512.png
├── package.json          scripts npm (check, test, ci)
├── .github/workflows/ci.yml  CI GitHub Actions (syntaxe + tests à chaque push/PR)
├── test/                 check-syntax.js + protocol.test.js (CRC8, trames, parse, statut, QR)
├── vendor/               qrcode.mjs + qrcode_UTF8.mjs (Kazuhiko Arase, MIT) — génération QR hors ligne
├── js/
│   ├── protocol.js       protocoles binaires purs (aucun DOM ni BLE) : trames, CRC8, commandes, décodage
│   ├── printer.js        client BLE : connexion GATT (3 tentatives), reconnexion par id, détection du
│   │                     protocole (AE03 => MXW01), notifications, polling d'état, séquences d'impression
│   ├── image.js          rendu du contenu en bitmap : texte/image/QR/template -> canvas -> lignes 48/192 octets, aperçu
│   ├── qr.js             source QR (matrice via vendor/qrcode)
│   ├── templates.js      modèles d'étiquettes vectoriels thème thé (cadre bas-relief, médaillon, branche)
│   ├── photobooth.js     caméra (getUserMedia), capture 384 px, arrêt propre du flux
│   └── app.js            câblage de l'interface (barre d'onglets 3 vues, sous-onglets contenu, photobooth plein écran + switch caméra, reconnexion auto, SW, polling batterie, journal)
└── README.md
```

### Tests et CI

```bash
npm run ci     # = check-syntax (node --check) + check-imports (verifie que chaque import existe
               #   bien comme export dans le module cible) + tests du protocole (CRC8, trames, QR, templates)
```

La CI GitHub Actions (`.github/workflows/ci.yml`) exécute ces vérifications à chaque push sur la branche et sur la PR.

### `js/protocol.js`

- `APP_VERSION`, UUIDs (service `AE30`, write `AE01`, notify `AE02`, data `AE03`), `PRINT_WIDTH = 384`, `LINE_BYTES = 48`.
- `HEADER_CAT = [0x51, 0x78]` / `HEADER_MXW = [0x22, 0x21]` ; `CAT` et `MXW` : tables de commandes des deux familles.
- `crc8(bytes)` : CRC-8 poly **0x07**, init 0, sur le **payload seul** (vérifié contre des captures réelles).
- `buildPacket(cmd, payload, header)` : assemble `<header> <cmd> 00 <lenLo> <lenHi> <payload> <CRC8> FF`.
- `parsePacket(bytes)` : décode une trame reçue (accepte les deux headers).
- `stateToText` (cat) / `mxwStatusToText` (MXW01 : état, batterie, température, code erreur).

### `js/printer.js` — client BLE (`class CatPrinter`)

- `connect(namePrefix)` : `requestDevice` (filtre par préfixe de nom ou tous les appareils), connexion GATT **avec 3 tentatives**, `_findChannel()` localise le service `AE30`/`AF30` et les caractéristiques (write `AE01`/`AF01`, notify `AE02`/`AF02`, data `AE03`/`AF03` si présent → protocole MXW01), démarre les notifications.
- `_onNotify` : réassemble les notifications BLE fragmentées en trames complètes (`… FF`), puis `_handlePacket` dispatche : statut, flow control `AE` (cat), ack `A9`, fin `AA` (MXW01), et réveille les attentes `_waitCmd(cmd)`.
- `send(cmd, payload)` : construit la trame avec le bon header et écrit sur `AE01` **par morceaux de 20 octets** (sûr pour un MTU de 23), 12 ms entre les morceaux, en préférant `writeValue` (avec acquittement) quand disponible.
- `getState()` : `A1 00` (MXW01) ou `A3 00` (cat), attend la réponse (3 s).
- `feed(steps)` : `A3 <lignes LE16>` (MXW01) ou `A1 <pas>` (cat).
- `printLines(lines, opts)` : délègue à `_printMxw` ou `_printCat` (voir §5).

### `js/image.js`

- `renderTextToLines` : retour à la ligne à 384 px sur un `<canvas>`.
- `renderImageFileToLines` : redimensionne l'image à 384 px de large.
- `bitmapFromCanvas` : niveaux de gris (0.299R+0.587G+0.114B), dithering **Floyd-Steinberg** optionnel (sinon seuil 128), puis empaquetage : chaque ligne de 384 px = **48 octets, LSB = pixel de gauche, bit 1 = noir**.
- `drawPreview` : aperçu dans la page.

### `js/app.js`

Affiche la version (`v2.0.0` en haut de page + dans le journal), branche les boutons, détecte l'environnement (contexte sécurisé, `navigator.bluetooth`, `getAvailability()`), met à jour l'aperçu, appelle le client BLE.

---

## 5. Protocoles BLE (référence)

### Commun aux deux familles

| Rôle | UUID |
|---|---|
| Service principal | `0000AE30-0000-1000-8000-00805F9B34FB` (annoncé parfois `AF30`) |
| Commandes (write) | `0000AE01-…` (write without response / write) |
| Notifications | `0000AE02-…` (notify) |
| Données image (MXW01 seulement) | `0000AE03-…` (write without response) |

**Trame** : `<header 2 octets> <cmd> <dir=00> <lenLo> <lenHi> <payload> <CRC8> FF`
- `len` = longueur du payload, little-endian 16 bits
- `CRC8` = CRC-8 poly 0x07, init 0, calculé **sur le payload seul**
- `FF` = terminateur — **sur les réponses du MXW01, le `FF` final est absent** (capture réelle : les notifications s'arrêtent après le CRC) ; le parser de l'app se base donc sur la longueur (`6 + len + 1`) et accepte le `FF` optionnel

**Image** : 384 px de large = 48 octets par ligne en 1 bpp (192 en 4 bpp), **LSB first** (bit 0 = pixel de gauche), **1 = noir**, 0 = blanc. En 4 bpp : 2 px/octet, **pixel pair (gauche) dans le demi-octet HAUT**, 15 = noir. Lignes contiguës, sans en-tête par ligne. Les données `AE03` sont envoyées **par ligne complète** (48/192 octets par write, 12 ms d'écart) — jamais par petits morceaux, sinon les lignes sont décalées. Les jobs de moins de **90 lignes sont paddés avec des lignes blanches** (4320 octets min en 1 bpp). Le `A9` déclare la hauteur réelle du contenu.

### Famille MXW01 — Agodeo / FunPrint (header `22 21`)

| Cmd | Payload | Description |
|---|---|---|
| `A1` | `00` | statut → réponse `A1` sur `AE02` |
| `A2` | intensité `00`–`64` (0x5D = 93 conseillé) | densité d'impression |
| `A3` | lignes LE16 | avancer/éjecter le papier |
| `A4` | lignes LE16 | rentrer le papier |
| `A9` | `height LE16, bytesParLigne, mode` | demande d'impression : hauteur en lignes, octets par ligne (`0x30`=48 en 1 bit, `0xC0`=192 en 4 bits), mode (`0` = 1 bit/px, `1` = mono moins d'avance, `2` = 4 bits/px 16 gris) → attendre l'ack `A9` (payload[0] = 0x00 = OK) |
| `AD` | `00` | fin des données image (flush) |
| `AA` | — | **notification** : impression physique terminée |
| `AB` | `00` | niveau de batterie → réponse 1 octet (0–100) |
| `AC` | — | annuler l'impression |
| `B0` | `00` | type d'impression |
| `B1` | `00` | version firmware (chaîne UTF-8) |

**Commandes `AE`, `B2`, `B3`** (testées via le labo, trames réelles) : `AE 00` et `B2 00` répondent par un simple accusé de réception (echo `22 21 <cmd> 00 01 00 00 00`) sans effet métier visible (`B2` provoquait brièvement l'état `03` = éjection) ; `B3 00` ne répondait pas. Ce sont vraisemblablement des commandes internes d'appairage/chiffrement — non utilisées par l'app.

**Réponse statut `A1`** (payload) : `[0]` état (0 veille, 1 impression, 2 avance, 3 éjection), `[3]` batterie %, `[4]` température tête °C, `[6]` 0 = OK sinon erreur, `[7]` code erreur (0x01/0x09 = pas de papier, 0x04 = surchauffe, 0x08 = batterie faible). Trame réelle capturée (batterie 83 %, 15 °C, veille) : `22 21 a1 03 0a 00 00 00 00 53 0f 00 00 00 bb 00 b8 ff` — notez le 3ᵉ octet `03` (octet de direction variable sur les réponses) et l'octet `[8]` (`0xbb`) de signification inconnue. `AB` renvoie la batterie seule en 1 octet (ex. `53` = 83 %).

**Séquence d'impression MXW01** (implémentée dans `_printMxw`) :

```
A1 00 (statut) → A2 <intensité> → A9 <height LE16> <bytesParLigne> <mode> → attendre ack A9
→ image (48 octets/ligne en mode 0, 192 en mode 2) sur AE03, par morceaux de 20 octets, 12 ms d'écart
→ AD 00 → attendre AA (60 s max) → A3 <feed LE16>
```

### Famille « cat » classique — GB01/GT01… (header `51 78`)

| Cmd | Payload | Description |
|---|---|---|
| `A0` / `A1` | 1 octet (pas) | rentrer / avancer le papier |
| `A2` | 48 octets | une ligne bitmap (LSB = pixel gauche, 1 = noir) |
| `A3` | `00` | état → réponse sur `AE02` (bits : 0x01 pas de papier/capot, 0x02 couvercle, 0x04 tête chaude, 0x08 batterie faible, 0x80 busy) |
| `A4` | `0x31`–`0x36` (défaut 0x33) | qualité |
| `A6` | 11 octets | début : `AA 55 17 38 44 5F 5F 5F 44 38 2C` ; fin : `AA 55 17 00…00 17` |
| `A8` | `00` | infos appareil |
| `AE` | `00` XOn / `10` XOff | **reçu en notification** : contrôle de flux (pause/reprise) |
| `AF` | 2 octets LE | énergie thermique (densité) 0x0000–0xFFFF |
| `BD` | 1 octet | vitesse d'avance |
| `BE` | 1 octet | mode : 0 = image |

**Séquence cat** (`_printCat`) : `A3 → A4 → A6 début → AF → BD → BE → A2 ligne par ligne → A6 fin → A1`.

---

## 6. Dépannage

| Symptôme | Cause probable / solution |
|---|---|
| Bouton « Connecter » grisé | Navigateur non supporté (Firefox/Safari) ou URL non sécurisée → Chrome/Edge en `http://localhost:8000` |
| L'imprimante n'apparaît pas dans la liste | Éteinte, trop loin, ou **encore connectée à l'app FunPrint du téléphone** → fermer FunPrint, éteindre le Bluetooth du tel, rallumer l'imprimante |
| `GATT Server is disconnected` | L'imprimante n'accepte qu'un seul central BLE : la libérer côté téléphone, éteindre/rallumer l'imprimante, réessayer (3 tentatives auto) |
| « Imprimer » / « Avancer le papier » ne fait rien | Vérifier papier chargé + capot fermé ; consulter le journal BLE : si `service=…ae30 write=…ae01 data=…ae03` → protocole MXW01 bien détecté ; si `data=-` → modèle cat classique |
| Pas de réponse d'état | Informatif uniquement ; l'impression peut fonctionner quand même (tester « Imprimer ») |
| Pas de papier / impression blanche | Recharger un rouleau 57 mm face thermosensible vers la tête ; monter la densité ; qualité du papier thermique variable |
| Lignes manquantes / décalées | Ne pas fermer l'onglet pendant l'impression ; le flow control `AE 10` (cat) met l'envoi en pause automatiquement |

---

## 7. Limites et confidentialité

- **USB-C = charge uniquement** : le MXW01 n'expose aucune interface de données USB (pas de port série), donc ni WebUSB (PC) ni l'USB OTG (téléphone Android) ne peuvent s'y connecter — le seul canal de données est le **BLE**. Si un clone expose un port série, on pourrait y envoyer la même trame raster.
- Impression **noir et blanc** uniquement, 384 px (57 mm). Le papier thermique s'efface avec le temps et la chaleur : pas un support d'archivage.
- **Tout est local** : aucune image ni texte ne quitte le navigateur.
- Web Bluetooth **indisponible sur iPhone/iPad** ; pour iOS il faudrait une app native (Swift/CoreBluetooth) — `js/protocol.js` est directement réutilisable.

---

## 8. Crédits

Protocoles documentés publiquement par la communauté (reverse engineering) :

- Protocole MXW01 (`22 21`) : [jeremy46231/MXW01-catprinter — PROTOCOL.md](https://github.com/jeremy46231/MXW01-catprinter/blob/master/PROTOCOL.md), [MaikelChan/CatPrinterBLE](https://github.com/MaikelChan/CatPrinterBLE), [clementvp/mxw01-thermal-printer](https://github.com/clementvp/mxw01-thermal-printer), [nikkoong/thermal-printer — PROTOCOL.md](https://github.com/nikkoong/thermal-printer/blob/main/PROTOCOL.md), [veli-ozturk/mxw01-sticker-printer](https://github.com/veli-ozturk/mxw01-sticker-printer)
- Protocole cat classique (`51 78`) : [rbaron/catprinter](https://github.com/rbaron/catprinter) + [article](https://rbaron.net/blog/2021/08/15/Reverse-engineering-the-cat-printer-bluetooth-protocol), [wiki fulda1/Thermal_Printer](https://github.com/fulda1/Thermal_Printer/wiki/Cat-printer-protocol), [WerWolv](https://werwolv.net/blog/cat_printer/)
- Génération QR : [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (Kazuhiko Arase, MIT), embarqué dans `vendor/` pour fonctionner hors ligne
