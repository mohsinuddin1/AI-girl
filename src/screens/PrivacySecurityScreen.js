import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme';
import useStore from '../store/useStore';
import { supabase } from '../lib/supabase';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function PrivacySecurityScreen({ navigation }) {
    const { user, scanHistory, fetchScanHistory } = useStore();

    const handleClearHistory = () => {
        Alert.alert(
            'Clear Scan History',
            'Are you sure you want to delete all your past scans? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear History',
                    style: 'destructive',
                    onPress: async () => {
                        if (!user) return;
                        const { error } = await supabase
                            .from('scans')
                            .delete()
                            .eq('user_id', user.id);

                        if (error) {
                            Alert.alert('Error', 'Failed to clear history.');
                        } else {
                            fetchScanHistory(); // Refresh local state
                            Alert.alert('Success', 'Your scan history has been cleared.');
                        }
                    },
                },
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Privacy & Security</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
                    <Text style={styles.sectionTitle}>Data Protection</Text>

                    <View style={styles.infoCard}>
                        <Ionicons name="shield-checkmark" size={32} color={Colors.success} style={styles.icon} />
                        <Text style={styles.infoTitle}>Your scans are private</Text>
                        <Text style={styles.infoDesc}>
                            Images you capture for scanning are analyzed instantly via secure edge functions. We do not sell your biometric or personal scanning data to third parties.
                        </Text>
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
                    <Text style={styles.sectionTitle}>Manage Data</Text>

                    <TouchableOpacity onPress={handleClearHistory} style={styles.actionItem}>
                        <View style={styles.actionIconWrap}>
                            <Ionicons name="trash-bin" size={20} color={Colors.danger} />
                        </View>
                        <View style={styles.actionTextWrap}>
                            <Text style={styles.actionTitle}>Clear Scan History</Text>
                            <Text style={styles.actionSub}>{scanHistory?.length || 0} scans recorded</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
                    <TouchableOpacity onPress={() => Linking.openURL('https://webpure-scan-ai.vercel.app/privacy')} style={styles.linkItem}>
                        <Text style={styles.linkText}>View Full Privacy Policy</Text>
                        <Ionicons name="open-outline" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.surfaceMuted },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.primary },
    scroll: { padding: 20, paddingBottom: 60 },

    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },

    infoCard: { backgroundColor: Colors.surface, padding: 24, borderRadius: Radii.xl, ...Shadows.card, alignItems: 'center' },
    icon: { marginBottom: 16 },
    infoTitle: { fontSize: 18, fontWeight: '700', color: Colors.primary, marginBottom: 8 },
    infoDesc: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

    actionItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.surface, borderRadius: Radii.xl, ...Shadows.card },
    actionIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(239, 68, 68, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    actionTextWrap: { flex: 1 },
    actionTitle: { fontSize: 16, fontWeight: '600', color: Colors.primary },
    actionSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

    linkItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
    linkText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginRight: 8 },
});
