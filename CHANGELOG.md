# Changelog

Historique de toutes les versions de **agodeo-web-printer**, de la plus récente à la plus ancienne.
Ce fichier est mis à jour à chaque nouvelle version (le numéro affiché dans l'en-tête de l'app correspond à la dernière entrée).

## [3.2.16] — 2026-11-26
- **Menu manuel ⚙️ : Résolution et FPS séparés** — les deux sélecteurs étaient côte à côte sur une même ligne (facile à confondre) ; ils sont maintenant dans leur propre section « Flux caméra (redémarre la caméra) », **empilés verticalement** (un par ligne pleine largeur, libellé à gauche, valeur à droite), FPS renommé « FPS (images/s) »

## [3.2.15] — 2026-11-26
- **Bouton Image non fonctionnel pendant qu'une image est en cours** : l'onglet **Image** et le sélecteur de fichier sont désactivés pendant le décodage d'une image importée (`imageSource`) et pendant toute la durée d'une impression d'image (y compris depuis le photobooth) — réactivés ensuite. Garde-fou anti double import / double impression (flag `imageBusy` + `printBusy`, bouton Imprimer déjà verrouillé pendant l'impression) ; erreur d'import affichée en popup au lieu d'une exception silencieuse

## [3.2.14] — 2026-11-26
- **Pose longue émulée par accumulation des trames live (onglet 📷)** : sur ce téléphone, `takePhoto()` ignore la pose manuelle du track (photo en 2,6 s malgré « pose appliquée 19,4 s ») et le HAL caméra partagé blanchissait l'aperçu pendant la pose. Si la pose réglée dépasse 2 s, la photo est désormais construite par **accumulation additive des trames de l'aperçu live** (`accumulateLongExposure`, composite `lighter` sur canvas, ~10 trames/s) pendant toute la durée de la pose : **la visée reste 100 % live** (jamais blanc, aucun réglage appliqué au flux), le guide ● gyroscope fonctionne pendant la prise, et la photo prend réellement la durée de la pose (20 s → « Photo prise en ~20 s (pose appliquée 20,0 s) »). Comportement de vraie pose longue : les hautes lumières s'écrêtent, le bougé floute
- Pose ≤ 2 s (ou non réglée) : inchangé — `takePhoto()` sur flux de capture dédié, aperçu intact

## [3.2.13] — 2026-11-26
- **Fix pose longue < 1 s (onglet 📷)** : les contraintes `advanced` passées à `getUserMedia` sont ignorées/clampées par certains drivers — la pose est maintenant **aussi ré-appliquée sur le track du flux de capture** via `applyConstraints({ advanced })`, et l'app **attend que `getSettings().exposureTime` atteigne la valeur demandée** (jusqu'à 2 s) avant `takePhoto()` : une pose de 20 s bloque réellement la capture ~20 s (ou la valeur max du driver si elle cape). Le flux d'aperçu reste intact (visée live, jamais blanc)
- **Fix z-index plein écran** : `.cam-controls` (menu manuel ⚙️ compris) passe en `z-index: 20`, au-dessus des overlays de la vidéo (guide ●, grille, compte à rebours) — quand le menu manuel et le guide sont affichés ensemble, le guide apparaît **derrière** le menu

## [3.2.12] — 2026-11-26
- **Visée live pendant toute la prise de photo (onglet 📷)** : la capture passe par un **flux de capture dédié** (second `getUserMedia` sur la même caméra, réglages manuels — dont la pose — passés dans les contraintes initiales `advanced`), photo via `ImageCapture.takePhoto()` sur ce flux, flux fermé aussitôt. Le flux d'aperçu n'est **jamais** modifié par la pose : plus d'écran blanc pendant la pose longue, la visée reste en direct même si on bouge le téléphone pendant la capture, et le retour au live est instantané (plus de `restorePose` nécessaire sur le flux d'aperçu)
- **Pose réellement appliquée** : les contraintes initiales du flux dédié sont le moyen le plus fiable d'obtenir une vraie pose longue (14 s demandés → capture ~14 s au lieu de ~4 s). La valeur réellement appliquée est relue dans `getSettings().exposureTime` du flux de capture : le compte à rebours défile sur la durée réelle et le statut affiche « Photo prise en X s (pose appliquée Y s) »
- **Repli** : si le flux dédié est refusé (caméra déjà occupée) ou `takePhoto` échoue, retour à l'ancien comportement (pose sur le flux live + restauration juste après)

## [3.2.11] — 2026-11-26
- **Point ◎ au centre tant qu'on n'a pas appuyé sur 📸** : le gyroscope ne déplace le point que **pendant la capture** (`capturing`) — à la visée le point est parfaitement centré ; pendant une pose longue il montre en direct si le téléphone bouge
- **Aperçu toujours live** : la pose n'est jamais appliquée au flux de visée ; au 📸 elle est appliquée, `takePhoto()` tourne, puis le track est restauré **immédiatement** après (moins de latence de retour au live)
- **Compte à rebours = pose réellement appliquée** : lu dans `getSettings().exposureTime` après `applyConstraints` (et converti s/mm) — si le driver cape (ex. 14 s demandées → 4 s réelles), le compteur affiche la vraie durée

## [3.2.10] — 2026-11-26
- **Repère ◎ = niveau live (stabilisation)** : le cercle reste fixe au centre de l'aperçu, mais le **point se déplace en direct** selon le gyroscope (`deviceorientation`, gamma/beta, via rAF) — il suffit de ramener le point au centre du cercle pour stabiliser le téléphone. Demande de permission capteur gérée (iOS). Toujours guide-only : rien sur la photo
- **Anti-superposition** : le compte à rebours de pose (`#shotCountdown`) passe **plus haut (12vh) et plus petit (44 px)** pour ne plus recouvrir le guide ◎

## [3.2.9] — 2026-11-26
- **Repère centre ◎ = guide de visée uniquement** : le cercle+point ne sont plus dessinés dans la photo capturée (paramètre `markCenter`/`drawCenterMark` retirés de `captureStill`/`captureFrame`) — il reste uniquement l'overlay fixe au centre de l'aperçu live

## [3.2.8] — 2026-11-26
- **Repère centre ◎** (bouton ◎ dans l'onglet 📷) : cercle jaune + point fixe **au centre de l'aperçu live** (overlay DOM `#centerMark`) ; si activé, le cercle+point sont aussi **dessinés au centre de la photo capturée** (`drawCenterMark` dans `captureStill`/`captureFrame`, paramètre `markCenter`) → gravé dans la photo téléchargée/imprimée. Idéal pour cadrer sans bouger le téléphone

## [3.2.7] — 2026-11-26
- **Compte à rebours de pose** : si la pose réglée (slider « Pose (capture seule) ») dépasse 2 s, un **gros chiffre plein écran** (`#shotCountdown`, 8.0 → 0.0) défile pendant la capture `takePhoto()` ; statut « Pose 8.0 s… »
- **Le menu manuel (⚙️) se ferme automatiquement** quand on appuie sur 📸

## [3.2.6] — 2026-11-26
- **Fix virage bleu de la balance des blancs** : à la capture, seuls les réglages **effectivement modifiés par l'utilisateur** (flag dirty sur sliders et sélecteurs de mode) sont appliqués — avant, `applyManualNow()` forçait tous les modes en manuel (WB à la valeur K courante du capteur → bleu). Les modes non touchés restent en auto (`continuous`)
- **Pose** : slider désactivé avec mention « non supportée » si `capabilities.exposureTime` absent ou min==max (téléphone qui ne permet pas la pose manuelle)

## [3.2.5] — 2026-11-26
- **Fix pose longue** : la photo de l'onglet 📷 passe par **`ImageCapture.takePhoto()`** (nouveau `captureStill()` dans `photobooth.js`, repli sur la trame d'aperçu si indisponible) au lieu de `drawImage(video)` — une pose de 8 s est maintenant réellement appliquée à la photo (la promesse ne rend qu'après la pose), puis redimensionnée à 384 px. Statut « Capture en cours… » pendant la pose

## [3.2.4] — 2026-11-26
- **Pose affichée en secondes** (toujours `x.xxx s` : si les capacités sont en ms, conversion /1000 pour l'affichage)
- **Menu manuel plus user friendly** : panneau découpé en sections « Exposition » (mode + EV/pose/ISO), « Focus » (mode + focus manuel), « Couleurs & image » (WB + K + luminosité/contraste/saturation/netteté), titre + bouton **↺ Auto** en tête, sliders plus hauts (`accent-color` terracotta), libellés/valeurs plus lisibles

## [3.2.3] — 2026-11-26
- **Pose (`exposureTime`) uniquement à la capture** : le slider de pose n'a plus aucun effet sur le flux live (il ne fait que mémoriser la valeur, libellé « Pose (capture seule) ») ; à chaque photo, `applyManualNow()` applique la pose (+ `exposureMode: manual`) 250 ms avant la capture, puis `restorePose()` remet la pose initiale juste après — tous les autres réglages (focus, EV, ISO, WB, image…) restent appliqués **en direct** sur l'aperçu

## [3.2.2] — 2026-11-26
- **Réglages manuels ré-appliqués au moment de la capture** : avant chaque photo (📷), `applyManualNow()` renvoie tous les sliders + modes (focus/expo/WB) via `applyConstraints`, puis une latence de 250 ms laisse le driver intégrer les réglages à la trame capturée — la photo reflète maintenant les réglages, pas seulement l'aperçu continu

## [3.2.1] — 2026-11-26
- **Fix pose (exposureTime) / ISO / focus manuel / WB manuel** : ces réglages ne sont pris en compte par la caméra que si le mode correspondant est `manual` — déplacer le slider passe maintenant automatiquement le mode en `manual` (exposureTime/iso → `exposureMode`, focusDistance → `focusMode`, colorTemperature → `whiteBalanceMode`) et synchronise le sélecteur. Affichage de la pose adapté à l'unité réelle des capacités (s → affiché en ms si max < 10)

## [3.2.0] — 2026-11-26
- **Mode manuel ⚙️ dans l'onglet 📷 Photo** : panneau rétractable avec sliders construits dynamiquement depuis `getCapabilities()` (chaque réglage n'apparaît que s'il est supporté, borné min/max/step) : focus manuel (`focusDistance`), exposition EV (`exposureCompensation`), pose (`exposureTime`), ISO, balance des blancs (`colorTemperature` K), luminosité/contraste/saturation/netteté — appliqués en live via `applyConstraints({ advanced })`
- Sélecteurs de **mode** focus / expo / balance des blancs (valeurs lues dans les capacités), **résolution** (640×480 → 4K selon capacités) et **FPS** (15/24/30/60) avec redémarrage de la caméra
- Bouton **↺ Tout remettre en auto** (modes `continuous`, torch off, zoom au min, valeurs initiales restaurées depuis `getSettings()` au démarrage)
- Nouveaux exports `photobooth.js` : `trackCaps()`, `trackSettings()`, `applyAdvanced()` ; `startCamera(video, deviceId, media)` accepte width/height/frameRate

## [3.1.4] — 2026-11-26
- Auto-démarrage de la caméra **uniquement dans l'onglet 📷 Photo** ; en 🎞️ Photobooth, l'utilisateur doit appuyer lui-même sur « Démarrer la caméra »

## [3.1.3] — 2026-11-26
- **Caméra activée automatiquement** à l'entrée dans les onglets 🎞️ Photobooth et 📷 Photo (plus besoin de cliquer « Démarrer la caméra ») — `startBoothCamera()`/`startCamTab()` appelés depuis `showView`. Repli : si le navigateur bloque (1ʳᵉ autorisation à valider), popup ❌ invitant à appuyer sur le bouton

## [3.1.2] — 2026-11-26
- **Caméra de dos par défaut** : `facingMode: 'environment'` au démarrage (repli sur 'user' si pas de caméra arrière, ex. PC) — dans le photobooth ET l'onglet Photo ; libellé 🔄 = **Dos** par défaut, miroir inactif par défaut
- **Tap-to-focus aussi dans l'onglet 📷 Photo** : tap sur l'aperçu → `pointsOfInterest` (X inversé en Face) + carré jaune `#focusRing2`

## [3.1.1] — 2026-11-26
- **Onglet 📷 Photo en plein écran** (comme le photobooth) : `body.camfs` masque header/tabbar, vidéo en `object-fit: cover`, **✕ Quitter** en haut à droite (retour à l'onglet précédent), 🔦 flash en haut à gauche
- Gros boutons utilisables : **📸 rond 96 px au centre en bas**, colonnes de boutons à gauche (Démarrer/Arrêter, 🔄 Face/Dos) et à droite (⏱️ minuteur 3 s et ▦ grille 3×3 en toggles), **slider de zoom en pleine largeur** au-dessus
- Aperçu photo (télécharger/imprimer) en overlay centré plein écran

## [3.1.0] — 2026-11-26
- **Nouvel onglet 📷 « Photo » (appareil photo)** : aperçu live, **zoom** (slider borné par `capabilities.zoom`, `applyConstraints({ advanced: [{ zoom }] })`), **flash 🔦** (torche si supportée), **switch caméra 🔄 Face/Dos**, **minuteur 3 s**, **grille 3×3**, tap-to-focus, miroir auto (Face seulement)
- Capture → aperçu de la photo avec **💾 Télécharger** (PNG) ou **🖨️ Imprimer** directement
- La caméra est arrêtée automatiquement en quittant l'onglet

## [3.0.24] — 2026-11-26
- **Focus caméra** : `focusMode: 'continuous'` appliqué (best-effort) à chaque démarrage/switch de caméra via `applyConstraints({ advanced })`
- **Tap-to-focus** : un tap (sans balayage) sur l'aperçu envoie `pointsOfInterest: [{ x, y }]` à la caméra (coordonnée X inversée en caméra Face à cause du miroir) + carré jaune animé `#focusRing` au point touché

## [3.0.23] — 2026-11-26
- **Miroir uniquement en caméra Face** : en 🔄 **Dos** (caméra arrière), ni l'aperçu ni la photo imprimée ne sont retournés ; en 🔄 Face le miroir reste actif. Détection via `facingMode`/libellé au démarrage et à chaque switch

## [3.0.22] — 2026-11-26
- **Bouton ⛶ plein écran dans l'en-tête** (onglets Imprimante et Contenu uniquement — l'en-tête est masqué en Photobooth) : API Fullscreen (`requestFullscreen`/`exitFullscreen`), icône qui passe en 🗗 quand actif

## [3.0.21] — 2026-11-26
- **Refonte visuelle : palette chaude** (crème `#faf4ec`, terracotta `#c05f33`, chocolat `#5d3a26` pour header/tabbar, journal ambré) — variables CSS dans `style.css`, `theme-color` meta + manifest mis à jour
- **Onglet Imprimante plus épuré** : colonne centrée 620 px, cartes arrondies à ombre douce, titres de section en petites capitales, boutons d'action (État / Infos / Annuler) en grille 3 colonnes, boutons USB et labo en style « ghost » (contour terracotta), statuts en pastilles

## [3.0.20] — 2026-11-26
- **Stickers emoji retirés** (rendu non concluant) : suppression des 4 filtres overlay (Bonnet/Neige/Chat/Chien), du canvas d'aperçu overlay, du paramètre `overlayDraw` de `captureFrame`, et des assets `vendor/twemoji/` + entrées SW. Le carousel revient aux **7 filtres couleur** uniquement

## [3.0.19] — 2026-11-26
- **4 premiers stickers Twemoji** (assets SVG officiels embarqués dans `vendor/twemoji/`, licence CC-BY 4.0) : 🎩 **Bonnet Noël** (🎅 `1f385` qui dépasse du haut), ❄️ **Neige** (cadre rouge + 🎄 `1f384` + flocons ❄️ `2744` animés), 🐱 **Chat** (🐱 `1f431` + moustaches), 🐶 **Chien** (🐶 `1f436` + moustaches + nez)
- Préchargement des emoji (`preloadFilters()`) au démarrage et à l'entrée dans l'onglet ; SVG ajoutés à la liste `ASSETS` du service worker (PWA hors ligne OK)

## [3.0.18] — 2026-11-26
- **Stickers (Noël/Festif/Anniversaire/Nature/Animaux) retirés du carousel** — ils seront refaits **un par un**, cette fois avec des visuels trouvés sur Internet et embarqués en local : **Twemoji** (jdecked/twemoji, graphismes **CC-BY 4.0**, SVG officiels téléchargeables dans `vendor/`) ou chargés via jsDelivr. Le mécanisme overlay (canvas live + dessin dans la photo 384 px) reste en place. Le carousel ne contient plus que les 7 filtres couleur

## [3.0.17] — 2026-11-26
- **Overlays « stickers » dans le carousel de filtres** (nouveau module `js/filters.js`) : 🎄 Noël (bonnet + flocons animés + cadre rouge), 🎉 Festif (confettis + ballons + cadre doré), 🎂 Anniversaire (gâteau 2 étages + bougies + ballons), 🌿 Nature (feuilles + fleurs + cadre vert), 🐱 Animaux (oreilles de chat + moustaches)
- Aperçu live via un canvas overlay animé (rAF) par-dessus la vidéo ; à la capture, l'overlay est **dessiné dans le canvas 384 px** (après le miroir, non filtré) → imprimé tel quel

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
