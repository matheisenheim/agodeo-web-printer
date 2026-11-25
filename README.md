# Agodeo Web Printer

Application web **100 % locale et statique** (aucun serveur backend, aucune donnée envoyée sur Internet) pour piloter en Bluetooth Low Energy (BLE) les mini imprimantes thermiques de poche compatibles **FunPrint / Agodeo** — le protocole dit « cat printer », partagé par de nombreux modèles : MXW01, C9/C15/C17/C20/C23, X1/X2, GB01/GB02/GB03, GT01 et leurs clones.

L'application permet de se connecter à l'imprimante depuis le navigateur, de lire son état (papier, batterie, surchauffe), d'imprimer du **texte** ou une **image/photo** (converti en bitmap noir et blanc 384 px avec dithering Floyd-Steinberg optionnel), de régler la densité d'impression et d'avancer le papier.

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

Web Bluetooth n'est disponible qu'en **HTTPS** ou sur **`http://localhost`**. En local, un simple serveur statique suffit : `python -m http.server` (Windows) ou `python3 -m http.server` (Linux/macOS). En production (hébergement), il faut un hébergement en HTTPS (GitHub Pages, Netlify, Vercel…).

### Matériel

- Mini imprimante thermique 57 mm type Agodeo/FunPrint, **allumée**, à proximité (< 10 m), Bluetooth activé côté PC/téléphone.
- Rouleau de papier thermique **57 mm** chargé, face thermosensible (lisse/brillante) tournée vers la tête d'impression.

---

## 2. Installation et lancement

Aucune dépendance à installer : ce sont de simples fichiers statiques (HTML/CSS/JS modules ES).

```bash
git clone https://github.com/matheisenheim/agodeo-web-printer.git
cd agodeo-web-printer
python -m http.server 8000      # Windows
python3 -m http.server 8000     # Linux / macOS
```

Puis ouvrir [http://localhost:8000](http://localhost:8000) dans **Chrome ou Edge**.

### Mettre à jour le code (nouvelles versions)

Depuis le dossier du projet, sans toucher à tes réglages (ne modifie pas les fichiers toi-même) :

```bash
git fetch origin
git checkout vibe/agodeo-web-printer-7ead01   # seulement la première fois
git pull origin vibe/agodeo-web-printer-7ead01
```

Puis recharge la page dans le navigateur avec **Ctrl+F5** (rechargement forcé, sinon le cache garde l'ancien JS) et vérifie le numéro de version affiché en haut de la page.

Alternatives pour servir les fichiers en local :

```bash
npx serve .            # ou
# VS Code : clic droit sur index.html -> "Open with Live Server"
```

Déploiement en ligne (HTTPS requis) : activer **GitHub Pages** sur ce repo (Settings → Pages → Deploy from branch), ou déposer le dossier sur Netlify/Vercel.

---

## 3. Guide d'utilisation

1. Allumer l'imprimante et charger un rouleau 57 mm.
2. Cliquer **« Connecter l'imprimante »**. Laisser le champ de préfixe vide pour lister tous les périphériques BLE, ou taper le préfixe du nom annoncé (souvent `MXW01`, `C17`, `X1`…). Choisir l'imprimante dans le sélecteur du navigateur et valider.
3. Optionnel : **« État de l'imprimante »** affiche papier / batterie / capot / tête chaude / impression en cours.
4. Choisir l'onglet **Texte** (saisir le texte, régler taille/police) ou **Image** (choisir un fichier PNG/JPG, cocher le dithering pour les photos). L'aperçu montre exactement ce qui sera imprimé (384 px de large).
5. Régler **Énergie / densité** (curseur 0x4000–0xFFFF : plus haut = plus noir).
6. Cliquer **« Imprimer »**. L'application envoie les commandes d'initialisation, puis chaque ligne de l'image, en respectant le contrôle de flux de l'imprimante, puis fait avancer le papier du nombre de pas indiqué.
7. **« Avancer le papier »** éjecte manuellement l'étiquette (nombre de pas réglable).

Le **journal BLE** en bas de page affiche toutes les trames envoyées (`→`) et reçues (`←`) en hexadécimal — très utile pour déboguer ou comparer avec l'app officielle FunPrint.

---

## 4. Architecture du code

```
agodeo-web-printer/
├── index.html        structure de la page (3 panneaux : connexion / contenu / impression + journal)
├── style.css         mise en page
├── js/
│   ├── protocol.js   couche protocole « cat printer » pure (aucun accès au DOM ni au BLE)
│   ├── printer.js    client BLE : connexion GATT, écriture, notifications, flow control, séquence d'impression
│   ├── image.js      rendu du contenu en bitmap : texte -> canvas, image -> canvas, canvas -> lignes 48 octets, aperçu
│   └── app.js        câblage de l'interface (boutons, onglets, aperçu, appels au client BLE)
└── README.md
```

### `js/protocol.js` — protocole binaire

- Constantes : UUID du service `0000AE30-…`, caractéristique d'écriture `0000AE01-…` (write without response), de notification `0000AE02-…` ; `PRINT_WIDTH = 384` px, `LINE_BYTES = 48` octets/ligne.
- `CMD` : tableau des commandes (`0xA0`…`0xBE`).
- `LATTICE_START` / `LATTICE_END` : constantes de 11 octets envoyées en `0xA6` avant/après l'impression.
- `crc8(bytes)` : CRC-8, polynôme **0x07**, init 0, calculé sur le **payload uniquement**.
- `buildPacket(cmd, payload)` : assemble `51 78 <cmd> 00 <lenLo> <lenHi> <payload> <CRC8> FF`.
- `parsePacket(bytes)` : décode une trame reçue (utile pour les notifications).
- `stateToText(flags)` : traduit les bits d'état reçus en texte lisible.
- `hex(bytes)` : formatage hex pour le journal.

### `js/printer.js` — client BLE (`class CatPrinter`)

- `connect(namePrefix)` : `navigator.bluetooth.requestDevice()` (filtre par préfixe de nom ou `acceptAllDevices`), connexion GATT, puis `_findChannel()` localise le service `AE30` (ou le premier service possédant une caractéristique write + notify, pour tolérer les clones aux UUID légèrement différents), démarre les notifications sur `AE02`.
- `_onNotify(bytes)` : décode les trames reçues — `0xAE` avec payload `0x10` = **pause** (tampon plein), `0x00` = reprise (réveille les écritures en attente) ; `0xA3` avec dir=1 = réponse d'état (papier, batterie…).
- `send(cmd, payload)` : construit le paquet, journalise, écrit sur `AE01` en `writeValueWithoutResponse` (avec attente si l'imprimante a demandé une pause).
- `getState(timeoutMs)` : envoie `A3`, attend la réponse d'état (2 s max).
- `feed(steps)` : envoie `A1` (avancer le papier de N pas).
- `printLines(lines, opts)` : séquence complète d'impression (voir §5), avec envoi des lignes par paquets de `chunkLines` (4) séparés de `chunkDelayMs` (40 ms) pour ménager le tampon BLE.

### `js/image.js` — contenu → bitmap imprimable

- `renderTextToLines(text, {fontSize, fontFamily})` : découpe le texte à la largeur 384 px sur un `<canvas>` (retour à la ligne sur les espaces), puis convertit en lignes bitmap.
- `renderImageFileToLines(file, {dither})` : charge l'image (`createImageBitmap`), la redimensionne à 384 px de large en conservant le ratio, puis convertit.
- `bitmapFromCanvas(canvas, dither)` : lit les pixels (`getImageData`), calcule le niveau de gris (0.299R + 0.587G + 0.114B), applique le **dithering de Floyd-Steinberg** si demandé (sinon simple seuil à 128), puis empaquette chaque ligne de 384 px en **48 octets, LSB = pixel de gauche, bit à 1 = pixel noir**.
- `drawPreview(canvas, lines)` : dessine le bitmap dans l'aperçu de la page.

### `js/app.js` — interface

Instancie `CatPrinter`, branche les boutons (connecter/déconnecter, état, feed, imprimer), les onglets Texte/Image, les réglages (taille, police, énergie), met à jour l'aperçu à chaque changement, et affiche le journal BLE. Si `navigator.bluetooth` est absent, le bouton de connexion est désactivé avec un message explicatif.

---

## 5. Protocole BLE « cat printer » (référence)

### Adressage

| Rôle | UUID (base Bluetooth 128 bits) |
|---|---|
| Service principal | `0000AE30-0000-1000-8000-00805F9B34FB` |
| Écriture des commandes | `0000AE01-0000-1000-8000-00805F9B34FB` (write without response) |
| Notifications (état, flow control) | `0000AE02-0000-1000-8000-00805F9B34FB` (notify) |

### Structure d'un paquet

```
51 78 <cmd> <dir> <lenLo> <lenHi> <payload...> <CRC8> FF
```

- `51 78` : en-tête (STX)
- `<cmd>` : commande (1 octet)
- `<dir>` : 0 = commande envoyée à l'imprimante, 1 = réponse de l'imprimante
- `<lenLo> <lenHi>` : longueur du payload en little-endian (16 bits)
- `<payload>` : données de la commande
- `<CRC8>` : CRC-8 (polynôme 0x07, init 0) calculé **sur le payload seul**
- `FF` : terminateur (ETX)

**Exemple** — demande d'état (`A3`, payload `[0x00]`, CRC8(0x00) = 0x00) :

```
51 78 A3 00 01 00 00 00 FF
```

**Exemple** — une ligne bitmap (`A2`, 48 octets de payload, len = 0x30) :

```
51 78 A2 00 30 00 <48 octets> <CRC8> FF
```

### Commandes utilisées

| Cmd | Nom | Payload | Description |
|---|---|---|---|
| `0xA0` | retract | 1 octet = nombre de pas | reculer le papier |
| `0xA1` | feed | 1 octet = nombre de pas | avancer le papier (éjection) |
| `0xA2` | drawLine | 48 octets | une ligne de 384 px ; LSB = pixel de gauche ; bit 1 = pixel noir imprimé |
| `0xA3` | getState | `[0x00]` | l'imprimante répond sur `AE02` (dir=1) |
| `0xA4` | setQuality | 1 octet `0x31`–`0x36` (défaut `0x33`) | qualité d'impression |
| `0xA6` | lattice | 11 octets | début : `AA 55 17 38 44 5F 5F 5F 44 38 2C` ; fin : `AA 55 17 00 00 00 00 00 00 00 17` |
| `0xA8` | getInfo | `[0x00]` | infos appareil (modèle, firmware) sur `AE02` |
| `0xAE` | lineControl | `[0x00]` = reprendre / `[0x10]` = pause | **reçu en notification** sur `AE02` : contrôle de flux (tampon plein) |
| `0xAF` | setEnergy | 2 octets little-endian `0x0000`–`0xFFFF` | énergie thermique = densité (noir) |
| `0xBD` | feedSpeed | 1 octet | vitesse d'avance du papier (`0x19` avant une avance à vide) |
| `0xBE` | drawMode | 1 octet | 0 = image (bitmap), 1 = texte |

### Bits de la réponse d'état (`A3`, dir = 1, payload[0])

| Bit | Signification |
|---|---|
| `0x01` | pas de papier ou capot ouvert |
| `0x02` | couvercle ouvert |
| `0x04` | tête d'impression chaude |
| `0x08` | batterie faible |
| `0x80` | impression en cours (BUSY) |

### Séquence d'impression complète (implémentée dans `printLines`)

```
A3 (état, optionnel) → A4 qualité → A6 début → AF énergie → BD vitesse → BE mode image
→ A2 ligne par ligne (avec pauses + flow control AE) → A6 fin → A1 feed
```

---

## 6. Dépannage

| Symptôme | Cause probable / solution |
|---|---|
| Bouton « Connecter » désactivé | Navigateur non supporté (Firefox/Safari) ou page non servie en HTTPS/localhost → utiliser Chrome/Edge en `http://localhost:8000` |
| L'imprimante n'apparaît pas dans la liste | Elle est éteinte, trop loin, ou déjà connectée à l'app FunPrint (la fermer) ; recharger la page et réessayer ; essayer sans préfixe de nom |
| `requestDevice` refuse / erreur | Sur Chrome Android : autoriser l'accès Bluetooth dans les paramètres du site ; vérifier que le Bluetooth du téléphone est activé |
| État = « pas de papier » ou impression blanche | Recharger un rouleau 57 mm, face thermosensible vers la tête ; monter l'énergie (curseur densité) ; le papier thermique est parfois de mauvaise qualité |
| Impression coupée / déconnexion | Rapprocher l'imprimante, attendre la fin (bit BUSY `0x80`), recharger la page et reconnecter |
| Lignes manquantes ou décalées | Le flow control `AE 10` met l'envoi en pause — c'est géré automatiquement ; ne pas fermer l'onglet pendant l'impression |

Astuce : compare les trames du journal BLE avec celles capturées (nRF Connect) si un modèle clone ne répond pas — certains annoncent le service `AF30` au lieu de `AE30` ; le code retombe alors automatiquement sur le premier service possédant une caractéristique write + notify.

---

## 7. Limites et confidentialité

- Impression **noir et blanc** uniquement, largeur fixe **384 px (57 mm)**. Le papier thermique s'efface avec le temps, la chaleur et le frottement : ce n'est pas un support d'archivage.
- **Tout est local** : aucune image ni texte ne quitte le navigateur (aucune requête réseau dans le code, hors chargement initial des fichiers statiques).
- Web Bluetooth ne fonctionne **pas sur iPhone/iPad** ; pour iOS il faudrait une app native (Swift/CoreBluetooth) — le protocole de `js/protocol.js` est directement réutilisable.

---

## 8. Crédits

Protocole « cat printer » documenté publiquement par la communauté (reverse engineering) :

- [rbaron/catprinter](https://github.com/rbaron/catprinter) (MIT) et son [article](https://rbaron.net/blog/2021/08/15/Reverse-engineering-the-cat-printer-bluetooth-protocol)
- [Wiki fulda1/Thermal_Printer — Cat printer protocol](https://github.com/fulda1/Thermal_Printer/wiki/Cat-printer-protocol)
- [WerWolv — Thermal Printer BLE Protocol reverse engineering](https://werwolv.net/blog/cat_printer/)
