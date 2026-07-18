import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.powerhousepyq.mobile',
  appName: 'UPSC PYQ Powerhouse',
  webDir: 'dist',
  // Load the live production site inside the native WebView so the app always
  // reflects the latest deployed website (content/UI updates need no rebuild).
  // Because the WebView origin IS the prod origin, all relative /api calls and
  // cookies/localStorage work exactly as they do on the website (no CORS changes).
  server: {
    url: 'https://powerhouse-pyq.vercel.app',
    cleartext: false,
  },
};

export default config;
