/**
 * Google OAuth Client IDs
 *
 * How to get these:
 * 1. Go to https://console.firebase.google.com → your project → Project Settings
 * 2. Under "Your apps", click the gear → Google Sign-In → Web SDK configuration
 * 3. Copy "Web client ID" → paste below as WEB_CLIENT_ID
 *
 * For Android client ID:
 * - Download google-services.json from Firebase Console
 * - The client_id where client_type == 1 is your Android OAuth client ID (native app)
 *
 * For iOS client ID:
 * - Download GoogleService-Info.plist from Firebase Console
 * - CLIENT_ID field is your iOS OAuth client ID
 *
 * In Expo Go (development), only WEB_CLIENT_ID is required.
 * For production builds, all three are recommended.
 */

export const GOOGLE_AUTH = {
  // Web Client ID (used for redirect flow on Android)
  WEB_CLIENT_ID: '964264491610-hmee88rsaqvt5bjneed9k1usa97hjjup.apps.googleusercontent.com',

  // iOS Client ID (from GoogleService-Info.plist)
  IOS_CLIENT_ID: '964264491610-i0dm3jcedvnebrh6ke44ngv82derm4ee.apps.googleusercontent.com',

  // Android Native Client ID (should match package: com.ravisoni.patrme)
  ANDROID_CLIENT_ID: '964264491610-uk3bf3fd0396a48ljp1pj07urtu9t6nh.apps.googleusercontent.com',
};
