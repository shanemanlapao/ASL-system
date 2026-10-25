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
    if (window.location && window.location.origin && !window.location.origin.includes(':8081')) {
      return window.location.origin;
    }
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
  return 'http://10.0.28.67:8000';
};

export const API_URL = getApiUrl();

/**
 * Universal media URL resolver:
 * 1. Upgrades insecure HTTP URLs on production Azure to HTTPS (fixes browser Mixed Content & Android cleartext blocks).
 * 2. Rewrites relative /static/... or obsolete LAN IPs to the active API_URL.
 */
export const resolveMediaUrl = (url?: string): string => {
  if (!url) return '';
  let resolved = url.trim();

  // Upgrade HTTP to HTTPS for Azure production
  if (resolved.startsWith('http://brightpath.azurewebsites.net')) {
    resolved = resolved.replace('http://brightpath.azurewebsites.net', 'https://brightpath.azurewebsites.net');
  }

  // If running in browser over HTTPS, ensure any same-origin URL uses HTTPS
  if (typeof window !== 'undefined' && window.location?.protocol === 'https:') {
    if (resolved.startsWith('http://') && resolved.includes(window.location.hostname)) {
      resolved = resolved.replace('http://', 'https://');
    }
  }

  // If it's a static upload path (/static/...), anchor it to the active API_URL
  if (resolved.includes('/static/')) {
    const filename = resolved.substring(resolved.indexOf('/static/'));
    return `${API_URL}${filename}`;
  }

  return resolved;
};
