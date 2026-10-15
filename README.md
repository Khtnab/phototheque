# Photothèque — application Android / iPhone / web

Photos, vidéos et notes classées par thème, recadrage, export PDF, et (Android) une barre flottante
Photo / Vidéo / Texte affichée par-dessus toutes les autres applis.

## Tester tout de suite sur le téléphone (sans le raccourci flottant)
1. Installe **Expo Go** (Play Store ou App Store).
2. Ouvre snack.expo.dev, choisis le SDK 57, colle le contenu de `App.js`.
3. Ouvre le projet dans Expo Go.

## Construire l'appli Android installable (avec le raccourci flottant)
À faire une fois, depuis un ordinateur (Windows, Mac ou Linux) avec Node.js installé :

```
npm install
npx eas-cli login          # compte Expo gratuit : expo.dev
npx eas-cli init
npx eas-cli build -p android --profile preview
```

À la fin (≈ 15 min), EAS donne un lien : ouvre-le sur ton téléphone Android pour télécharger
et installer l'APK (autorise l'installation depuis cette source quand Android le demande).

## Utiliser le raccourci flottant
1. Dans l'appli, touche « ⚡ Activer le raccourci flottant ».
2. Accepte l'appareil photo, les notifications, puis « Afficher par-dessus les autres applis ».
3. Quitte l'appli : la barre apparaît au bord droit.
   - **Photo** : appareil photo. Le raccourci **🖥** à droite lance une **capture d'écran cadrée** :
     un cadre apparaît sur l'écran, déplace-le, tire sur un coin pour le redimensionner, puis « Capturer ».
   - **Vidéo** : caméra. Le raccourci **🖥** lance un **enregistrement de l'écran** entier ;
     pour l'arrêter, touche la notification « Enregistrement de l'écran ».
   - **Texte** : note rapide à taper.
   - **✕** retire la barre ; **⋮⋮** la déplace vers le haut ou le bas.
   Android demande son accord à chaque capture d'écran (« Commencer maintenant ») : c'est une règle du système.
4. Les captures arrivent dans le thème « Captures rapides » à la prochaine ouverture de l'appli.
   Depuis une capture, « Déplacer vers un autre thème » la range ailleurs.

Si la construction échoue, copie le message d'erreur et envoie-le moi.
