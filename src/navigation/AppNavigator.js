import React, { useRef, useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { posthog } from '../lib/posthog';

import useStore from '../store/useStore';
import ReviewPromptModal from '../components/ReviewPromptModal';
import UpgradeModal from '../components/UpgradeModal';

// Screens
import OnboardingScreen from '../screens/OnboardingScreen';
import ChatScreen from '../screens/ChatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PersonaSelectScreen from '../screens/PersonaSelectScreen';
import ResultScreen from '../screens/ResultScreen';
import ScanScreen from '../screens/ScanScreen';
import PaywallScreen from '../screens/PaywallScreen';
import AccountScreen from '../screens/AccountScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import PrivacySecurityScreen from '../screens/PrivacySecurityScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import HealthPreferencesScreen from '../screens/HealthPreferencesScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import ReportDetailScreen from '../screens/ReportDetailScreen';
import LoadingSpinner from '../components/LoadingSpinner';

const Stack = createNativeStackNavigator();

// ─── Post-Auth: skip paywall, go straight to first scan (value-first strategy) ───
// The paywall shows AFTER the user sees their first scan result — maximizing conversion.
function PostAuthPaywallScreen() {
    const { setOnboarded } = useStore();
    useEffect(() => {
        useStore.getState().setPendingFirstScan(true);
        setOnboarded();
    }, []);
    // Must return a valid View — returning null crashes native-stack on Android
    return <View style={{ flex: 1, backgroundColor: '#FCFBF8' }} />;
}

// ─── Main Navigator ───
export default function AppNavigator() {
    const { user, profile, loading, hasSeenOnboarding, onboardingLoaded, setOnboarded, isGuestMode, guestRequiresAuth } = useStore();

    const navigationRef = useRef();
    const routeNameRef = useRef();

    // Auto-mark onboarding complete ONLY for guest-to-auth conversions.
    // New signups go through PostAuthPaywall first.
    useEffect(() => {
        if (user && !hasSeenOnboarding && guestRequiresAuth) {
            setOnboarded();
            useStore.getState().setGuestRequiresAuth(false);
        }
    }, [user, hasSeenOnboarding, guestRequiresAuth]);

    const onReady = useCallback(() => {
        routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
    }, []);

    const onStateChange = useCallback(() => {
        const previousRouteName = routeNameRef.current;
        const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;
        if (previousRouteName !== currentRouteName && currentRouteName) {
            posthog.screen(currentRouteName);
        }
        routeNameRef.current = currentRouteName;
    }, []);

    // Safety timeout: if loading state is stuck for 5+ seconds, force-proceed.
    // This prevents permanent white/loading screens when auth init hangs.
    useEffect(() => {
        const timeout = setTimeout(() => {
            const state = useStore.getState();
            if (state.loading || !state.onboardingLoaded) {
                console.warn('[AIGirl] Loading safety timeout hit — forcing app to proceed.');
                useStore.setState({ loading: false, onboardingLoaded: true });
            }
        }, 5000);
        return () => clearTimeout(timeout);
    }, []);

    console.log('[AIGirl Nav] loading:', loading, 'onboardingLoaded:', onboardingLoaded, 'user:', !!user, 'guest:', isGuestMode);

    if (loading || !onboardingLoaded) {
        return <LoadingSpinner />;
    }

    const content = (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!user && !isGuestMode ? (
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            ) : !hasSeenOnboarding ? (
                <Stack.Screen name="PostAuthPaywall" component={PostAuthPaywallScreen} />
            ) : (
                <>
                    <Stack.Screen name="Chat" component={ChatScreen} />
                    <Stack.Screen name="Settings" component={SettingsScreen} />
                    <Stack.Screen name="PersonaSelect" component={PersonaSelectScreen} />
                    <Stack.Screen
                        name="Result"
                        component={ResultScreen}
                        options={{ presentation: 'card', animation: 'slide_from_right' }}
                    />
                    <Stack.Screen
                        name="Scan"
                        component={ScanScreen}
                        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
                    />
                    <Stack.Screen
                        name="Paywall"
                        component={PaywallScreen}
                        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                    />
                    <Stack.Screen name="Account" component={AccountScreen} options={{ animation: 'slide_from_right' }} />
                    <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />
                    <Stack.Screen name="HealthPreferences" component={HealthPreferencesScreen} options={{ animation: 'slide_from_right' }} />
                    <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} options={{ animation: 'slide_from_right' }} />
                    <Stack.Screen name="HelpSupport" component={HelpSupportScreen} options={{ animation: 'slide_from_right' }} />
                    <Stack.Screen
                        name="Feedback"
                        component={FeedbackScreen}
                        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                    />
                    <Stack.Screen
                        name="ReportDetail"
                        component={ReportDetailScreen}
                        options={{ animation: 'slide_from_right' }}
                    />
                </>
            )}
        </Stack.Navigator>
    );

    return (
        <NavigationContainer ref={navigationRef} onReady={onReady} onStateChange={onStateChange}>
            {content}
            <ReviewPromptModal />
            <UpgradeModal />
        </NavigationContainer>
    );
}
