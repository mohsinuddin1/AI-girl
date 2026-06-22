import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../theme';
import useStore from '../store/useStore';
import { supabase } from '../lib/supabase';
import { posthog } from '../lib/posthog';

export default function AccountScreen({ navigation }) {
    const { user, healthPreferences, signOut } = useStore();

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

    const displayName = healthPreferences?.name || user?.user_metadata?.full_name || 'Guest User';
    const email = user?.email || 'Guest Account';

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
                    <Ionicons name="arrow-back" size={24} color="#0f172a" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Account</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                
                {/* Profile Card */}
                <View style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Ionicons name="person" size={32} color="#64748b" />
                    </View>
                    <View style={styles.profileTextContainer}>
                        <Text style={styles.name}>{displayName}</Text>
                        <Text style={styles.email}>{email}</Text>
                    </View>
                </View>

                {/* Subscription Section */}
                <Text style={styles.sectionTitle}>SUBSCRIPTION</Text>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Manage Subscription</Text>
                    <Text style={styles.cardDesc}>View your current plan, upgrade to Pro, or manage your MedGPT subscription.</Text>
                    <TouchableOpacity style={[styles.button, { backgroundColor: '#f1f5f9' }]} onPress={handleManageSubscription}>
                        <Text style={[styles.buttonText, { color: '#0f172a' }]}>Manage Subscriptions</Text>
                    </TouchableOpacity>
                </View>

                {/* Feedback Section */}
                <Text style={styles.sectionTitle}>HELP US IMPROVE</Text>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Give Feedback</Text>
                    <Text style={styles.cardDesc}>Have a suggestion or experiencing an issue? We'd love to hear from you.</Text>
                    <TouchableOpacity style={styles.darkButton} onPress={() => navigation.navigate('Feedback')}>
                        <Ionicons name="chatbubble-ellipses" size={16} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.darkButtonText}>Share Feedback</Text>
                    </TouchableOpacity>
                </View>

                {/* Danger Zone */}
                <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>DANGER ZONE</Text>
                <View style={[styles.card, styles.dangerCard]}>
                    <Text style={styles.cardTitle}>Delete Account</Text>
                    <Text style={styles.cardDesc}>Permanently remove your account data, health preferences, and scan history. This action cannot be undone.</Text>
                    <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAccount}>
                        <Text style={styles.dangerButtonText}>Delete Account</Text>
                    </TouchableOpacity>
                </View>
                
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backBtn: {},
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    
    scroll: { padding: 20, paddingBottom: 60 },
    
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 32,
        ...Shadows.soft,
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    profileTextContainer: { flex: 1 },
    name: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
    email: { fontSize: 14, color: '#64748b' },

    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: 1,
        marginLeft: 4,
        marginBottom: 12,
        textTransform: 'uppercase',
    },
    
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        ...Shadows.soft,
    },
    dangerCard: {
        borderWidth: 1,
        borderColor: '#fee2e2',
    },
    cardTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
    cardDesc: { fontSize: 14, color: '#64748b', lineHeight: 20, marginBottom: 16 },
    
    button: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: { fontSize: 15, fontWeight: '700' },
    
    darkButton: {
        flexDirection: 'row',
        backgroundColor: '#0f172a',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    darkButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    
    dangerButton: {
        backgroundColor: '#fee2e2',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dangerButtonText: { fontSize: 15, fontWeight: '700', color: '#ef4444' },
});
