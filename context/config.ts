import Constants from 'expo-constants';

// Centralized API Configuration
// Supports Web (localhost), Mobile/Emulator (dynamic Expo host IP), and Cloud (env var)
const getApiUrl = (): string => {
  // 1. Use explicit env variable if set (production / staging deployments)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Detect web environment without importing Platform (avoids SSR "Platform is not defined" errors)
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'http://localhost:8000';
  }

  // 3. Dynamic Expo host IP — automatically matches the IP Metro used to serve the bundle to the phone
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp) {
      return `http://${hostIp}:8000`;
    }
  }

  // 4. Mobile / Expo Go fallback — current LAN IP
  return 'http://10.57.107.186:8000';
};

export const API_URL = getApiUrl();
