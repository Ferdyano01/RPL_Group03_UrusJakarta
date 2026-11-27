# UrusJakarta Frontend (Web & Android)

Cross-platform **React Native + Expo SDK 57** frontend (with Expo Router and React Compiler) powering both the static Web portal (`https://urusjakarta.alamsyah.net`) and the Android mobile app (`com.urusjakarta.app`).

---

## Tech Stack & Structure

```text
frontend/
├── app.json                         # Expo config, permissions, API URL fallback, plugins
├── eas.json                         # EAS Build profiles (preview APK, production AAB)
├── babel.config.js                  # Expo Babel preset (reanimated/worklets disabled)
├── plugins/
│   └── withAndroidOptimization.js   # Android ABI split, R8 minify/shrink, resource flags
├── assets/images/                   # Pruned app icons & splash assets
└── src/
    ├── app/
    │   ├── _layout.tsx              # Root Stack, SplashScreen, Web <Head> & preconnect
    │   ├── index.tsx                # Landing overview & live system status bar
    │   ├── signup.tsx               # Citizen login / registration screen
    │   ├── beranda.tsx              # Dashboard metrics & recent reports feed
    │   ├── lapor.tsx                # 3-step AI road damage reporting workflow
    │   ├── riwayat.tsx              # Filterable / priority-sorted report history
    │   ├── profil.tsx               # Account profile edit, agency info & logout
    │   └── explore.tsx              # Interactive guide & severity/status legend
    ├── components/
    │   ├── bottom-nav.tsx           # Safe-area-aware bottom navigation bar
    │   ├── report-detail-modal.tsx  # Report modal (YOLO viewer, status & RBAC panel)
    │   ├── web-camera-modal.web.tsx # WebRTC camera capture with canvas resizing
    │   └── yolo-detection-viewer.tsx# Interactive bounding-box overlay on road photos
    └── services/
        └── api.ts                   # REST client, JWT validation, caching, XHR uploads
```

---

## Development Scripts

```bash
cd frontend
npm install

# Run interactive Expo CLI
npm start

# Run Web dev server (http://localhost:8081)
npm run web

# Run Android app locally (requires Android SDK + JDK)
npm run android
```

---

## Production Web Build (Static Export for Nginx)

`app.json` configures `"web": { "output": "static" }`. To build static HTML/JS/CSS into `frontend/dist/`:

```bash
cd frontend
EXPO_PUBLIC_API_URL=https://urusjakarta.alamsyah.net npx expo export --platform web
```

Serve `frontend/dist/` behind Nginx with `try_files $uri $uri.html $uri/ /index.html;` and long-lived immutable caching on `/_expo/static/`.

---

## Android Build & APK Size Optimizations

The project uses Expo Continuous Native Generation (CNG) plus [`plugins/withAndroidOptimization.js`](./plugins/withAndroidOptimization.js):
- **ABI filtering (`armeabi-v7a,arm64-v8a`)**: Excludes x86/x86_64 emulator ABIs from release APK/AAB outputs.
- **R8 Minification & Resource Shrinking**: Enables `android.enableMinifyInReleaseBuilds=true`, `android.enableShrinkResourcesInReleaseBuilds=true`, and bundle compression.
- **Dependency Pruning & Autolinking Exclusions**: Removes unused template libraries (`react-native-reanimated`, `react-native-gesture-handler`, `react-native-worklets`, `expo-image`, `expo-symbols`, etc.) via `package.json` `expo.autolinking.android.exclude`.
- **Native Multipart Upload Reliability**: Uses `XMLHttpRequest` in `src/services/api.ts` for native `FormData` uploads (`file://` and `content://`) alongside client-side JPEG compression on Web `<input type="file">` (`lapor.tsx`).

### Useful Android Commands
```bash
# Regenerate native android/ Gradle project
npm run prebuild:android

# Build installable APK in cloud via EAS (preview profile)
npm run build:android:apk

# Build release APK locally (requires local Android SDK & JDK)
npm run android:apk:local

# Export Android JS/Hermes bundle check
npm run build:android:bundle
```
