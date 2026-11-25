# Agodeo Web Printer

Application web **100 % locale et statique** (aucun serveur backend, aucune donnée envoyée sur Internet) pour piloter en Bluetooth Low Energy (BLE) les mini imprimantes thermiques de poche 57 mm compatibles **FunPrint / Agodeo** (famille « cat printer ») : MXW01 (Agodeo), C9/C15/C17/C20, X1/X2, GB01/GB02/GB03, GT01 et clones.

**Deux protocoles sont supportés et détectés automatiquement** (présence de la caractéristique de données `AE03`) :

- **MXW01** (ton Agodeo) : trames `22 21 … FF`, commandes sur `AE01`, réponses sur `AE02`, image sur `AE03`
- **cat classique** (GB01, GT01…) : trames `51 78 … FF`, tout sur `AE01`/`AE02`

L'application permet de se connecter depuis le navigateur, lire l'état (papier, batterie, température, surchauffe), imprimer du **texte** ou une **image/photo** (bitmap noir et blanc 384 px, dithering Floyd-Steinberg optionnel), régler la densité et avancer le papier.

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
python -m http.server 8000      # Windows
python3 -m http.server 8000     # Linux / macOS
```

Puis ouvrir [http://localhost:8000](http://localhost:8000) dans **Chrome ou Edge**.

Alternatives : `npx serve .`, ou VS Code → clic droit sur `index.html` → « Open with Live Server ».

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
4. Onglet **Texte** ou **Image**, régler la **densité** (curseur énergie). L'aperçu montre exactement ce qui sera imprimé (384 px de large).
5. **« Imprimer »** : envoie la séquence complète et attend la fin d'impression (notification `AA` sur MXW01).
6. **« Avancer le papier »** éjecte l'étiquette (nombre de lignes réglable).

Le **journal BLE** en bas affiche toutes les trames envoyées (`envoi …`) et reçues (`reçu …`) en hex — indispensable pour déboguer.

---

## 4. Architecture du code

```
agodeo-web-printer/
├── index.html        structure de la page (connexion / contenu / impression + journal)
├── style.css
├── js/
│   ├── protocol.js   protocoles binaires purs (aucun DOM ni BLE) : trames, CRC8, commandes, décodage
│   ├── printer.js    client BLE : connexion GATT, détection du protocole (AE03 => MXW01), notifications,
│   │                 flow control, séquences d'impression MXW01 et cat, état, feed
│   ├── image.js      rendu du contenu en bitmap : texte/image -> canvas -> lignes 48 octets, aperçu
│   └── app.js        câblage de l'interface (boutons, onglets, version affichée, journal)
└── README.md
```

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
- `FF` = terminateur

**Image** : 384 px de large = 48 octets par ligne, **LSB first** (bit 0 = pixel de gauche), **1 = noir**, 0 = blanc. Lignes contiguës, sans en-tête par ligne.

### Famille MXW01 — Agodeo / FunPrint (header `22 21`)

| Cmd | Payload | Description |
|---|---|---|
| `A1` | `00` | statut → réponse `A1` sur `AE02` |
| `A2` | intensité `00`–`64` (0x5D = 93 conseillé) | densité d'impression |
| `A3` | lignes LE16 | avancer/éjecter le papier |
| `A4` | lignes LE16 | rentrer le papier |
| `A9` | `height LE16, 0x30, mode` | demande d'impression (hauteur en lignes, 48 octets/ligne, mode 0 = 1 bit/px) → attendre l'ack `A9` (payload[0] = 0x00 = OK) |
| `AD` | `00` | fin des données image (flush) |
| `AA` | — | **notification** : impression physique terminée |
| `AB` | `00` | niveau de batterie → réponse 1 octet (0–100) |
| `AC` | — | annuler l'impression |
| `B0` | `00` | type d'impression |
| `B1` | `00` | version firmware (chaîne UTF-8) |

**Réponse statut `A1`** (payload) : `[0]` état (0 veille, 1 impression, 2 avance, 3 éjection), `[3]` batterie %, `[4]` température tête °C, `[6]` 0 = OK sinon erreur, `[7]` code erreur (0x01/0x09 = pas de papier, 0x04 = surchauffe, 0x08 = batterie faible).

**Séquence d'impression MXW01** (implémentée dans `_printMxw`) :

```
A1 00 (statut) → A2 <intensité> → A9 <height LE16> 30 00 → attendre ack A9
→ image (48 octets/ligne) sur AE03, par morceaux de 20 octets, 12 ms d'écart
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

- Impression **noir et blanc** uniquement, 384 px (57 mm). Le papier thermique s'efface avec le temps et la chaleur : pas un support d'archivage.
- **Tout est local** : aucune image ni texte ne quitte le navigateur.
- Web Bluetooth **indisponible sur iPhone/iPad** ; pour iOS il faudrait une app native (Swift/CoreBluetooth) — `js/protocol.js` est directement réutilisable.

---

## 8. Crédits

Protocoles documentés publiquement par la communauté (reverse engineering) :

- Protocole MXW01 (`22 21`) : [jeremy46231/MXW01-catprinter — PROTOCOL.md](https://github.com/jeremy46231/MXW01-catprinter/blob/master/PROTOCOL.md), [MaikelChan/CatPrinterBLE](https://github.com/MaikelChan/CatPrinterBLE), [clementvp/mxw01-thermal-printer](https://github.com/clementvp/mxw01-thermal-printer), [nikkoong/thermal-printer — PROTOCOL.md](https://github.com/nikkoong/thermal-printer/blob/main/PROTOCOL.md), [veli-ozturk/mxw01-sticker-printer](https://github.com/veli-ozturk/mxw01-sticker-printer)
- Protocole cat classique (`51 78`) : [rbaron/catprinter](https://github.com/rbaron/catprinter) + [article](https://rbaron.net/blog/2021/08/15/Reverse-engineering-the-cat-printer-bluetooth-protocol), [wiki fulda1/Thermal_Printer](https://github.com/fulda1/Thermal_Printer/wiki/Cat-printer-protocol), [WerWolv](https://werwolv.net/blog/cat_printer/)
