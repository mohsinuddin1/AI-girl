import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/features/auth/AuthProvider';
import AppNavigator from './src/navigation/AppNavigator';
import useStore from './src/store/useStore';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { View, Text, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OfflineBanner from './src/components/OfflineBanner';
import * as Sentry from '@sentry/react-native';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    debug: __DEV__,
    tracesSampleRate: 1.0,
  });
}

// ── Keep splash screen visible (safe) ──
try {
  SplashScreen.preventAutoHideAsync();
} catch (e) {
  console.warn('[AIGirl] SplashScreen.preventAutoHideAsync failed:', e?.message);
}

// ── PostHog (lazy + safe) ──
let PostHogProvider = null;
let posthogClient = null;
try {
  const ph = require('./src/lib/posthog');
  posthogClient = ph.posthog;
  // Only load the Provider if we have a real PostHog client (not the no-op stub)
  if (posthogClient && typeof posthogClient.capture === 'function' && posthogClient !== null) {
    PostHogProvider = require('posthog-react-native').PostHogProvider;
  }
} catch (e) {
  console.warn('[AIGirl] PostHog setup failed:', e?.message);
}

// ── Error Boundary (catches rendering crashes that Sentry.wrap hides) ──
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[AIGirl] RENDER CRASH:', error, errorInfo?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 12 }}>Something went wrong</Text>
          <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
          <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 16, textAlign: 'center' }}>
            Please restart the app. If this keeps happening, reinstall.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}


function AppContent() {
  const { checkOnboarding, loadHealthPreferences, user, profile, initNotifications } = useStore();
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    const migrateStorage = async () => {
      try {
        const migrated = await AsyncStorage.getItem('aigirl_storage_migrated');
        if (migrated !== 'true') {
          const keys = await AsyncStorage.getAllKeys();
          for (const key of keys) {
            if (key.startsWith('purescan_')) {
              const val = await AsyncStorage.getItem(key);
              const newKey = key.replace('purescan_', 'aigirl_');
              await AsyncStorage.setItem(newKey, val);
            }
          }
          await AsyncStorage.setItem('aigirl_storage_migrated', 'true');
        }
      } catch (e) {
        console.warn('Migration failed', e);
      }
      checkOnboarding();
      loadHealthPreferences();
    };
    migrateStorage();
  }, []);

  // Initialize notifications when user is authenticated AND profile row exists in DB.
  // We wait for `profile` because push_tokens has a FK constraint on users.id —
  // if we save the token before fetchProfile creates the user row, the INSERT fails.
  useEffect(() => {
    if (user && profile) {
      initNotifications();

      // Listen for incoming notifications while app is in foreground
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received:', notification.request.content.title);
      });

      // Listen for user tapping on a notification
      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        console.log('Notification tapped, data:', data);
        // You can handle deep linking here based on data.type
      });

      return () => {
        notificationListener.current?.remove();
        responseListener.current?.remove();
      };
    }
  }, [user, profile]);

  const content = (
    <AuthProvider>
      <AppNavigator />
      <StatusBar style="dark" />
    </AuthProvider>
  );

  return PostHogProvider ? (
    <PostHogProvider client={posthogClient} autocapture={{ captureScreens: false }}>
      {content}
    </PostHogProvider>
  ) : content;
}

function App() {
  useEffect(() => {
    try {
      // Hide immediately since we no longer wait for custom fonts
      SplashScreen.hideAsync();
    } catch (e) {
      console.warn('[AIGirl] SplashScreen.hideAsync failed:', e?.message);
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppErrorBoundary>
          <OfflineBanner />
          <AppContent />
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);
