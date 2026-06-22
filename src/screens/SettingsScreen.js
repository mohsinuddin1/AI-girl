import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
    Alert,
    Linking,
    Switch,
} from 'react-native';
import Animated, {
    FadeInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme';
import useStore from '../store/useStore';
import { getLevelInfo } from '../utils/levelInfo';
import { supabase } from '../lib/supabase';
import { posthog } from '../lib/posthog';

// getLevelInfo imported from utils/levelInfo.js

export default function SettingsScreen({ navigation }) {
    const { user, profile, signOut, clearOnboarding, showMascot, setShowMascot, isGuestMode, setGuestMode } = useStore();
    const level = getLevelInfo(profile?.level_xp || 0);

    const handleSignOut = async () => {
        if (isGuestMode && !user) {
            // Guest → redirect to sign-in
            await setGuestMode(false);
            await clearOnboarding();
            return;
        }
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out',
                style: 'destructive',
                onPress: async () => {
                    await signOut();
                },
            },
        ]);
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'Are you sure you want to permanently delete your account? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Permanently',
                    style: 'destructive',
                    onPress: async () => {
                        posthog.capture('account deletion started');
                        try {
                            await supabase?.rpc('delete_user_account');
                            posthog.capture('account deletion succeeded');
                            await signOut();
                            Alert.alert('Account Deleted', 'Your account has been successfully removed.');
                        } catch (e) {
                            console.error('Account deletion error:', e);
                            posthog.capture('account deletion failed', { reason: e.message });
                            Alert.alert('Notice', 'Please contact support to complete account deletion or sign out for now.');
                            await signOut();
                        }
                    },
                },
            ]
        );
    };

    const handleManageSubscription = () => {
        if (Platform.OS === 'ios') {
            Linking.openURL('https://apps.apple.com/account/subscriptions');
        } else {
            Linking.openURL('https://play.google.com/store/account/subscriptions');
        }
    };

    const menuItems = [
        ...(!profile?.is_pro
            ? [
                {
                    icon: 'diamond',
                    label: 'Upgrade to Pro',
                    subtitle: 'Unlimited scans — protect your family',
                    action: () => navigation.navigate('Paywall'),
                    accent: true,
                },
            ]
            : []),
        {
            icon: 'medical',
            label: 'Health Preferences',
            subtitle: 'Risk assessment settings',
            action: () => navigation.navigate('HealthPreferences'),
        },

        {
            icon: 'notifications',
            label: 'Notifications',
            subtitle: 'Manage alerts',
            action: () => navigation.navigate('Notifications'),
        },
        {
            icon: 'shield-checkmark',
            label: 'Privacy & Security',
            subtitle: 'Data protection',
            action: () => navigation.navigate('PrivacySecurity'),
        },
        {
            icon: 'help-circle',
            label: 'Help & Support',
            subtitle: 'FAQ and contact us',
            action: () => navigation.navigate('HelpSupport'),
        },
        {
            icon: 'person-circle-outline',
            label: 'Account',
            subtitle: 'Manage profile and subscription',
            action: () => navigation.navigate('Account'),
        },
    ];

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Settings</Text>
                </View>

                {/* Profile Card */}
                <Animated.View entering={FadeInDown.delay(100)} style={styles.profileCard}>
                    <View style={styles.profileRow}>
                        <View style={styles.avatar}>
                            <Ionicons name="person" size={24} color={Colors.primary} />
                            {profile?.is_pro && <View style={styles.proRing} />}
                        </View>
                        <Text style={styles.profileName}>
                            {isGuestMode && !user ? 'Guest' : (user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User')}
                        </Text>
                        <View style={styles.emailRow}>
                            <Ionicons name="mail" size={12} color={Colors.textMuted} />
                            <Text style={styles.profileEmail}>{isGuestMode && !user ? 'Not signed in' : (user?.email || 'Not signed in')}</Text>
                        </View>
                        {profile?.is_pro && (
                            <View style={styles.proPill}>
                                <Text style={styles.proPillText}>PRO</Text>
                            </View>
                        )}
                    </View>

                    {/* Stats */}
                    <View style={styles.statsRow}>
                        <View style={styles.statCol}>
                            <Text style={styles.statValue}>{profile?.current_streak || 0}</Text>
                            <Text style={styles.statLabel}>Day Streak</Text>
                        </View>
                        <View style={styles.statCol}>
                            <Text style={styles.statValue}>{level.name}</Text>
                            <Text style={styles.statLabel}>Level {level.level}</Text>
                        </View>
                        <View style={styles.statCol}>
                            <Text style={styles.statValue}>{profile?.level_xp || 0}</Text>
                            <Text style={styles.statLabel}>Total XP</Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Subscription Card (Pro users) */}
                {profile?.is_pro && (
                    <Animated.View entering={FadeInDown.delay(200)} style={styles.subCard}>
                        <TouchableOpacity activeOpacity={0.8} onPress={handleManageSubscription}>
                            <LinearGradient
                                colors={['rgba(232,168,56,0.08)', 'rgba(240,192,96,0.04)']}
                                style={styles.subCardInner}
                            >
                                <View style={styles.subHeader}>
                                    <View style={styles.subIconWrap}>
                                        <LinearGradient colors={['#e8a838', '#f0c060']} style={styles.subIcon}>
                                            <Ionicons name="diamond" size={16} color={Colors.white} />
                                        </LinearGradient>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.subTitle}>Pro Subscription</Text>
                                        <Text style={styles.subDesc}>Unlimited scans active</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color="#e8a838" />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* Menu Items Grouped */}
                <Animated.View entering={FadeInDown.delay(200)} style={styles.menuSection}>
                    {menuItems.map((item, i) => (
                        <View key={item.label}>
                            <TouchableOpacity
                                onPress={item.isToggle ? () => item.onToggle(!item.value) : item.action}
                                style={styles.menuItem}
                                activeOpacity={0.6}
                            >
                                <View style={[styles.menuIcon, item.accent && styles.menuIconAccent, item.danger && styles.menuIconDanger]}>
                                    <Ionicons
                                        name={item.icon}
                                        size={20}
                                        color={item.danger ? Colors.danger : (item.accent ? Colors.accent : Colors.textSecondary)}
                                    />
                                </View>
                                <View style={styles.menuItemContent}>
                                    <Text style={[styles.menuLabel, item.danger && { color: Colors.danger }, item.accent && { color: Colors.accent }]}>{item.label}</Text>
                                    {item.subtitle && <Text style={styles.menuSubtitle}>{item.subtitle}</Text>}
                                </View>
                                {item.isToggle ? (
                                    <Switch
                                        value={item.value}
                                        onValueChange={item.onToggle}
                                        trackColor={{ false: '#e2e8f0', true: Colors.primary }}
                                        thumbColor={item.value ? '#fff' : '#f4f3f4'}
                                    />
                                ) : (
                                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                                )}
                            </TouchableOpacity>
                            {i < menuItems.length - 1 && <View style={styles.menuSeparator} />}
                        </View>
                    ))}
                </Animated.View>

                {/* Sign Out / Sign In */}
                <Animated.View entering={FadeInDown.delay(500)} style={styles.signOutSection}>
                    <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
                        <Ionicons name={isGuestMode && !user ? 'log-in' : 'log-out'} size={18} color={isGuestMode && !user ? Colors.accent : Colors.danger} />
                        <Text style={[styles.signOutText, isGuestMode && !user && { color: Colors.accent }]}>{isGuestMode && !user ? 'Sign In' : 'Sign Out'}</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Legal & Contact */}
                <Animated.View entering={FadeInDown.delay(600)} style={styles.legalSection}>
                    <View style={styles.legalRow}>
                        <TouchableOpacity onPress={() => Linking.openURL('https://webpure-scan-ai.vercel.app/terms')}>
                            <Text style={styles.legalLink}>Terms of Service</Text>
                        </TouchableOpacity>
                        <Text style={styles.legalDivider}>•</Text>
                        <TouchableOpacity onPress={() => Linking.openURL('https://webpure-scan-ai.vercel.app/privacy')}>
                            <Text style={styles.legalLink}>Privacy Policy</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => Linking.openURL('mailto:purescanai@outlook.com?subject=PureScan%20AI%20App%20Support')} style={styles.contactRow}>
                        <Ionicons name="mail-outline" size={14} color={Colors.textMuted} />
                        <Text style={styles.legalLink}>purescanai@outlook.com</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Version */}
                <Text style={styles.version}>MedGPT v1.0.0</Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scroll: { paddingBottom: 160 },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 64 : 48,
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    headerTitle: { fontSize: 28, fontWeight: '700', color: Colors.primary, letterSpacing: -0.5 },

    // Centered Clean Profile
    profileCard: { marginHorizontal: 20, padding: 24, backgroundColor: Colors.surfaceElevated, borderRadius: 24, marginBottom: 24, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, ...Shadows.soft },
    profileRow: { alignItems: 'center', gap: 12 },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(10,10,10,0.05)', alignItems: 'center', justifyContent: 'center' },
    profileName: { fontSize: 20, fontWeight: '700', color: Colors.primary, textAlign: 'center' },
    emailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, justifyContent: 'center' },
    profileEmail: { fontSize: 13, color: Colors.secondary },
    proPill: { backgroundColor: Colors.accentLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 12 },
    proPillText: { fontSize: 12, fontWeight: '800', color: Colors.accent, letterSpacing: 1 },

    statsRow: { flexDirection: 'row', marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: Colors.borderLight, width: '100%' },
    statCol: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 18, fontWeight: '700', color: Colors.primary },
    statLabel: { fontSize: 11, color: Colors.secondary, marginTop: 4, fontWeight: '600' },

    // Subscription
    subCard: { marginHorizontal: 20, borderRadius: 24, overflow: 'hidden', marginBottom: 24, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, ...Shadows.soft },
    subCardInner: { padding: 16 },
    subHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    subIconWrap: {},
    subIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    subTitle: { fontSize: 15, fontWeight: '700', color: Colors.primary },
    subDesc: { fontSize: 13, color: Colors.secondary, marginTop: 2 },

    // Menu Inset Group
    menuSection: { marginHorizontal: 20, backgroundColor: Colors.surfaceElevated, borderRadius: 24, ...Shadows.soft, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.surfaceElevated },
    menuIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    menuIconAccent: { backgroundColor: Colors.accentLight },
    menuIconDanger: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    menuItemContent: { flex: 1, justifyContent: 'center' },
    menuLabel: { fontSize: 15, fontWeight: '600', color: Colors.primary },
    menuSubtitle: { fontSize: 12, color: Colors.secondary, marginTop: 2 },
    menuSeparator: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 68 },

    // Sign Out Minimal
    signOutSection: { paddingHorizontal: 20, marginTop: 32, alignItems: 'center' },
    signOutBtn: { paddingVertical: 12, paddingHorizontal: 24 },
    signOutText: { fontSize: 15, fontWeight: '600', color: Colors.danger },

    // Legal & Contact
    legalSection: { alignItems: 'center', marginTop: 24, paddingHorizontal: 20 },
    legalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    legalLink: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
    legalDivider: { fontSize: 12, color: Colors.textMuted },
    contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },

    version: { textAlign: 'center', fontSize: 10, color: Colors.textMuted, marginTop: 24 },
});
