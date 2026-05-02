# Patr Mobile

React Native app for [patr.me](https://patr.me) built with Expo.

---

## Quick Start

```bash
cd patr-mobile
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone (iOS or Android).

---

## Google Sign-In Setup (Required)

The app uses Google Sign-In via Firebase. You need to add your OAuth client IDs before sign-in works.

### Step 1 — Get your Web Client ID

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials?project=patr-4829d)
2. Under **OAuth 2.0 Client IDs**, find **"Web client (auto created by Google Service)"**
3. Copy the **Client ID** (ends in `.apps.googleusercontent.com`)

### Step 2 — Add the Client ID

Open `src/config/googleAuth.ts` and paste your value:

```typescript
export const GOOGLE_AUTH = {
  WEB_CLIENT_ID: 'PASTE_YOUR_WEB_CLIENT_ID_HERE.apps.googleusercontent.com',
  // Only needed for production EAS builds:
  ANDROID_CLIENT_ID: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  IOS_CLIENT_ID:     'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
};
```

> **Expo Go / development**: Only `WEB_CLIENT_ID` is needed.

### Step 3 — Allow the Expo redirect URI

1. In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials?project=patr-4829d), click your **Web client ID**
2. Under **Authorized redirect URIs**, click **Add URI** and add:
   ```
   https://auth.expo.io/@YOUR_EXPO_USERNAME/patr-mobile
   ```
   Replace `YOUR_EXPO_USERNAME` with your Expo account (run `npx expo whoami` to find it).
3. Click **Save**

---

## Project Structure

```
patr-mobile/
├── App.tsx                          # Root entry point
├── app.json                         # Expo config (bundle ID, scheme, etc.)
├── src/
│   ├── config/
│   │   ├── firebase.ts              # Firebase initialization
│   │   └── googleAuth.ts            # ← Add OAuth client IDs here
│   ├── contexts/
│   │   ├── AuthContext.tsx          # Auth state, signInWithGoogle, logout
│   │   └── ThemeContext.tsx         # 6 themes, persisted via AsyncStorage
│   ├── navigation/
│   │   └── AppNavigator.tsx         # Stack + Bottom Tab navigator
│   ├── screens/
│   │   ├── LoginScreen.tsx          # Google Sign-In (expo-auth-session)
│   │   ├── HomeScreen.tsx           # Feed (Following + Discover tabs)
│   │   ├── ExploreScreen.tsx        # Search users + discover
│   │   ├── NotificationsScreen.tsx  # Notifications
│   │   ├── ProfileScreen.tsx        # Your own profile + posts
│   │   ├── SettingsScreen.tsx       # Theme picker + account info + logout
│   │   ├── PostDetailScreen.tsx     # Single post view
│   │   ├── UserProfileScreen.tsx    # Another user's profile + follow/unfollow
│   │   └── ComposePostScreen.tsx    # Create post with optional image
│   ├── components/
│   │   └── PostCard.tsx             # Reusable post card
│   └── types/
│       └── index.ts                 # TypeScript types
```

---

## Building for Production with EAS

### Install EAS CLI
```bash
npm install -g eas-cli
eas login
eas build:configure
```

### Android APK (for testing, no Play Store)
```bash
eas build --platform android --profile preview
```

### Android App Bundle (for Play Store)
```bash
eas build --platform android --profile production
```

### iOS IPA (requires Apple Developer account)
```bash
eas build --platform ios --profile production
```

EAS Build runs in the cloud — no local Xcode/Android Studio needed!

---

## Notes

- **API**: `https://patr.me/api`
- **Firebase project**: `patr-4829d` (same as the web app)
- **Auth**: Firebase + Google, persisted via AsyncStorage
- **Themes**: Dark, Aurora, Sunset, Forest, Paper, Cyber
- For production Android: place `google-services.json` in project root
- For production iOS: place `GoogleService-Info.plist` in project root
