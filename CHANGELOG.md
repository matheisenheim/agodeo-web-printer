# Changelog

Historique de toutes les versions de **agodeo-web-printer**, de la plus récente à la plus ancienne.
Ce fichier est mis à jour à chaque nouvelle version (le numéro affiché dans l'en-tête de l'app correspond à la dernière entrée).

## [3.0.16] — 2026-11-26
- **Carousel de filtres** dans le photobooth : **balayer l'écran horizontalement** (tactile ou souris) sur la vidéo pour cycler entre Aucun / N&B / Sépia / Chaud / Froid / Contraste / Inversé (retour en boucle) ; un appui sur le libellé du filtre en haut au centre avance aussi d'un cran. Le filtre s'applique à l'aperçu (CSS) **et** à la photo imprimée (`ctx.filter` à la capture)

## [3.0.15] — 2026-11-26
- **Fix visibilité du compte à rebours pendant le flash écran** : l'overlay blanc était au niveau `body` (z-40) donc au-dessus de tout l'onglet photobooth (z-10) — les chiffres restaient cachés. L'overlay est déplacé dans `#camWrap` (même contexte d'empilement, z-40) : le compte à rebours (z-45, noir sur blanc via `body.flashing`) est maintenant bien visible par-dessus le blanc

## [3.0.14] — 2026-11-26
- Flash écran (🖥️) : l'écran blanc s'allume désormais **pendant tout le minuteur 3-2-1 et jusqu'à la capture** (compte à rebours affiché en noir sur blanc), au lieu d'un éclair imperceptible à la capture. Comportement identique que l'imprimante soit connectée ou non — le flash ne dépend pas de l'imprimante

## [3.0.13] — 2026-11-26
- **Un seul bouton flash** en haut à gauche : 🔦 torche LED si la caméra active la supporte, **sinon 🖥️ écran blanc** (plein blanc pendant le minuteur + capture) — ex. caméra Face sans flash. Le bouton est caché quand la caméra est arrêtée ; l'icône/état suivent le switch de caméra

## [3.0.12] — 2026-11-26
- **Flash écran** (simulation de flash sur téléphone) : bouton 🖥️ en haut à gauche — pendant le minuteur 3-2-1 et la capture, l'écran passe **plein blanc** (overlay) ; **Wake Lock** (`navigator.wakeLock`) actif dans l'onglet Photobooth pour empêcher l'assombrissement automatique. Note : aucune API web ne peut régler la luminosité système au max — la combine plein blanc + wake lock est le maximum atteignable (luminosité à régler manuellement au max)

## [3.0.11] — 2026-11-26
- **Flash / torche de la caméra** : bouton 🔦 en haut à gauche du photobooth (visible uniquement si la caméra active expose la capacité `torch`) — fonctionne sur téléphone Android (Chrome) et sur les webcams PC qui le supportent, via `applyConstraints({ advanced: [{ torch }] })`

## [3.0.10] — 2026-11-26
- Photobooth : barre du bas réorganisée — **📸 au centre, 50 % plus grand** (114 px), « Démarrer la caméra » à **gauche** et 🔄 à **droite**, les 3 alignés tout en bas

## [3.0.9] — 2026-11-26
- **Fix position du bouton ✕ Quitter** en plein écran : le conteneur caméra (`#camWrap`) gardait `margin: 0 auto`, donc il se centrait sur la largeur intrinsèque de la vidéo — le bouton était décalé vers le milieu et **bougeait au switch de caméra** (résolutions différentes). `#camWrap` est maintenant forcé en `width: 100%; margin: 0` en mode plein écran : ✕ collé à droite de l'écran, fixe

## [3.0.8] — 2026-11-26
- **Fix switch caméra** : le premier appui sur 🔄 bascule vraiment de caméra (la caméra active est maintenant identifiée via `deviceId` du flux, au lieu de retomber sur `cameras[0]` = la caméra déjà active)

## [3.0.7] — 2026-11-26
- Photobooth : **miroir selfie toujours actif** et **minuteur 3-2-1 toujours actif** (plus de cases à cocher)
- Photobooth : **cadre + date supprimé** autour de la photo (photo brute, 384 px)
- **Popup ✅ de réussite** après une impression réussie (comme les erreurs ❌)
- **Plus de barre d'état nulle part** : tous les retours (erreur, succès, avancement) passent par la popup centrée fermable

## [3.0.6] — 2026-11-26
- Erreurs affichées en **popup centrée fermable** (bouton OK ou clic à côté)
- Bouton **📸 rond en bas à droite** ; « Démarrer la caméra » et 🔄 **empilés à gauche**

## [3.0.5] — 2026-11-26
- Photobooth : **on ne quitte plus l'onglet** après la photo
- Message d'erreur ❌ si l'imprimante n'est pas connectée ou ne répond pas

## [3.0.4] — 2026-11-26
- Badge caméra en haut à gauche et messages caméra en bas supprimés
- Le **libellé du bouton 🔄 affiche la caméra active** : 🔄 Face / 🔄 Dos

## [3.0.3] — 2026-11-26
- Photobooth plein écran : texte d'info du bas supprimé
- Badge **Face/Dos en haut à gauche** (symétrique du bouton ✕ Quitter)

## [3.0.2] — 2026-11-26
- Bouton **✕ Quitter** pour sortir du photobooth plein écran (retour à l'onglet précédent)
- **Un seul bouton 🔄 Changer de caméra** qui bascule recto/verso (remplace la liste déroulante)

## [3.0.1] — 2026-11-26
- Photobooth : mode **A9=1 (mono, éjection réduite) forcé par défaut** (au lieu du HD 2)

## [3.0.0] — 2026-11-26
- **Navigation par onglets** (barre du bas) : 🖨️ Imprimante / ✏️ Contenu / 📸 Photobooth
- Photobooth **plein écran**, switch caméra recto/verso, « Prendre la photo » **imprime directement**

## [2.7.9] — 2026-11-25
- Mode **A9=1** (mono, « less post-print feed ») sélectionné par défaut — réduit l'avance automatique du papier faite par le firmware après chaque impression
- PR #1 fusionnée dans `main` (validée)

## [2.7.8] — 2026-11-25
- **Flow control MXW01** : une notification `AE` reçue pendant l'envoi des données `AE03` met l'envoi en pause 150 ms (sinon les grosses impressions 4 bits sont tronquées — buffer plein)
- `A7` rebaptisé « ID série » (6 octets)

## [2.7.7] — 2026-11-25
- **Feed post-impression (A3) désactivé par défaut** — le papier n'avance plus automatiquement après une impression ; bouton manuel « Avancer le papier » conservé

## [2.7.6] — 2026-11-25
- Helpers `val()`/`isChecked()` avec valeurs par défaut — l'app ne plante plus si un élément HTML manque (vieux cache)

## [2.7.5] — 2026-11-25
- Case « Avancer après chaque impression » : le feed A3 post-impression devient optionnel (0 si décoché) — évite le papier qui avance tout seul en différé quand AA est manqué

## [2.7.4] — 2026-11-25
- **Fix alignement image MXW01** : données `AE03` envoyées par **lignes complètes** (48/192 octets), **padding à 90 lignes minimum**, 4 bpp : pixel pair dans le demi-octet **haut** (high nibble)

## [2.7.3] — 2026-11-25
- L'ID série / compteur **A7 aussi affiché dans l'état** (bouton manuel + polling 30 s), via `formatQueryCount` (hex + LE16)

## [2.7.2] — 2026-11-25
- **Fix parser MXW01** : les réponses arrivent **sans `0xFF` final** (capture réelle) — parser désormais basé sur la longueur, footer FF optionnel ; ack A9, statut A1 et fin AA reconnus

## [2.7.1] — 2026-11-25
- Diagnostic bouton Connecter : `window.onerror` affiché dans l'UI, log « app prête », service worker en network-first (évite les versions désynchronisées en PWA)

## [2.7.0] — 2026-11-25
- Photobooth : **miroir selfie + minuteur 3-2-1**
- **Page de test** (mire) en un clic
- Compteur d'impressions **A7** affiché dans Infos appareil (avec B0/B1)

## [2.6.0] — 2026-11-25
- **Panneau Labo protocole** : envoi de trames brutes (cmd/payload hex) sur AE01, boutons rapides A7/AB/A4/B1, réponses dans le journal BLE
- Procédure de reverse engineering (jadx sur l'APK FunPrint, snoop HCI) dans le README

## [2.5.1] — 2026-11-25
- Mode **HD (4 bits) sélectionné automatiquement** dans l'onglet Photobooth, mode précédent restauré en quittant

## [2.5.0] — 2026-11-25
- **Onglet Photobooth** : webcam live (`getUserMedia`), capture 384 px, cadre + date + texte optionnel, impression en un clic

## [2.4.0] — 2026-11-25
- **Onglet Modèles** : 3 templates vectoriels thème thé (cadre bas-relief + feuilles + QR optionnel, médaillon sceau, bandeau branche), champs dynamiques, aperçu live

## [2.3.0] — 2026-11-25
- **QR codes hors ligne** (onglet dédié, génération locale)
- **PWA installable** (manifest + service worker + icônes)
- **Reconnexion auto** au dernier appareil (un clic)
- **Polling d'état 30 s** avec alerte batterie < 20 %
- **CI GitHub Actions + tests unitaires du protocole** (`npm run ci`)

## [2.2.1] — 2026-11-25
- **Sonde WebUSB** : boutons « Autoriser un appareil USB… » et « Sonder l'USB » listant les périphériques (VID:PID) via `navigator.usb` — le MXW01 n'expose aucun port de données USB (USB-C = charge seule), documenté

## [2.1.1] — 2026-11-25
- État de l'imprimante interrogé **automatiquement dès la connexion** (en plus du bouton manuel)

## [2.1.0] — 2026-11-25
- **Choix du mode d'impression** : mono 1 bit vs **16 niveaux de gris 4 bits « HD »** (A9 mode 2, 192 octets/ligne)
- Note DPI fixe ~203 dpi réels (384 points sur 57 mm, « 300 DPI » = marketing) dans l'UI et le README

## [2.0.1] — 2026-11-25
- Notifications sur **toutes** les caractéristiques notify/indicate du service (AE02+AE04+AE05), statut A1 ré-essayé, log de chaque trame reçue décodée

## [2.0.0] — 2026-11-25
- **Support du protocole MXW01 (Agodeo/FunPrint)** en plus du « cat » classique : détection auto via la caractéristique de données `AE03` (trames `22 21`, commandes sur `AE01`, réponses `AE02`, image `AE03`)

## [1.4.1] — 2026-11-25
- Log du canal BLE choisi, erreur explicite si pas de canal d'écriture, écriture avec acquittement privilégiée, prise en charge AF01/AF02

## [1.4.0] — 2026-11-25
- Écritures BLE découpées en morceaux de 20 octets (MTU 23), pauses de 80 ms entre commandes d'init

## [1.3.0] — 2026-11-25
- Version 1.3.0 (suivi interne)

## [1.2.0] — 2026-11-25
- **Numéro de version affiché dans l'en-tête** et dans le journal BLE au démarrage

## [1.1.0] — 2026-11-25
- Diagnostic au chargement (contexte non sécurisé / navigateur incompatible / Bluetooth éteint), robustesse BLE : réassemblage des notifications fragmentées, handshake à la connexion, GATT 3 tentatives, service AF30, message explicite si l'imprimante est connectée ailleurs

## [1.0.0] — 2026-11-25
- **Première version** : app web statique Web Bluetooth pour imprimante Agodeo/FunPrint (protocole « cat printer » `51 78`), connexion, état, impression texte/image, avance du papier, journal BLE en hex
