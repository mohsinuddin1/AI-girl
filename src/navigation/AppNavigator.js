import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { posthog } from '../lib/posthog';

import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { Colors, Shadows } from '../theme';
import useStore from '../store/useStore';
import GuestAuthModal from '../components/GuestAuthModal';
import ReviewPromptModal from '../components/ReviewPromptModal';
import UpgradeModal from '../components/UpgradeModal';

// Screens
import OnboardingScreen from '../screens/OnboardingScreen';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ChatScreen from '../screens/ChatScreen';
import SettingsScreen from '../screens/SettingsScreen';
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

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ─── Custom Bottom Tab Bar ───
function TabItem({ icon, label, isFocused, onPress }) {
    // We'll animate the pill background scale/opacity to get that smooth "most downloaded app" effect
    const progress = useSharedValue(isFocused ? 1 : 0);

    React.useEffect(() => {
        progress.value = withSpring(isFocused ? 1 : 0, { mass: 0.6, damping: 14 });
    }, [isFocused]);

    const activeContainerStyle = useAnimatedStyle(() => ({
        backgroundColor: `rgba(255, 255, 255, ${progress.value * 0.15})`,
        transform: [{ scale: 0.95 + (progress.value * 0.05) }]
    }));

    // Black/Dark Slate for active, light grey for inactive
    const color = isFocused ? '#0f172a' : '#94a3b8';

    return (
        <TouchableOpacity
            onPress={onPress}
            style={tabStyles.tab}
            activeOpacity={0.7}
        >
            <Animated.View style={[tabStyles.tabIconWrap, activeContainerStyle]}>
                <Ionicons
                    name={icon}
                    size={22}
                    color={color}
                />
                <Text style={[tabStyles.tabLabel, { color: color, fontWeight: isFocused ? '800' : '600' }]}>
                    {label}
                </Text>
            </Animated.View>
        </TouchableOpacity>
    );
}

function CustomTabBar({ state, descriptors, navigation }) {
    const insets = useSafeAreaInsets();
    const bottomInset = Math.max(insets.bottom, 0);

    return (
        <View style={[tabStyles.container, { bottom: (Platform.OS === 'ios' ? 24 : 16) + bottomInset }]}>
            {/* Glassmorphic Bar */}
            <BlurView intensity={80} tint="light" style={tabStyles.bar}>
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;

                    const iconMap = {
                        Home: 'home',
                        History: 'file-tray-full',
                        Chat: 'chatbubble-ellipses',
                        Settings: 'settings',
                    };

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    return (
                        <TabItem
                            key={route.key}
                            icon={iconMap[route.name] || 'ellipse'}
                            label={route.name === 'History' ? 'Records' : route.name}
                            isFocused={isFocused}
                            onPress={onPress}
                        />
                    );
                })}
            </BlurView>
        </View>
    );
}

const tabStyles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between', 
        height: 68,
        paddingHorizontal: 8,
        borderRadius: 34,
        overflow: 'hidden',
        width: '100%',
        backgroundColor: 'rgba(252, 251, 248, 0.85)', // Matches new Cream theme
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    tabIconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20, 
    },
    tabLabel: {
        fontSize: 11,
        marginTop: 2,
        letterSpacing: -0.2, 
    }
});

// ─── Tab Navigator ───
function TabNavigator() {
    return (
        <Tab.Navigator
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{ headerShown: false, animation: 'shift' }}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="History" component={HistoryScreen} />
            <Tab.Screen name="Chat" component={ChatScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
    );
}

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
                console.warn('[MedGPT] Loading safety timeout hit — forcing app to proceed.');
                useStore.setState({ loading: false, onboardingLoaded: true });
            }
        }, 5000);
        return () => clearTimeout(timeout);
    }, []);

    console.log('[MedGPT Nav] loading:', loading, 'onboardingLoaded:', onboardingLoaded, 'user:', !!user, 'guest:', isGuestMode);

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
                    <Stack.Screen name="Tabs" component={TabNavigator} />
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
