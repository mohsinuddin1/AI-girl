import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme';
import Animated, { FadeInDown } from 'react-native-reanimated';
import useStore from '../store/useStore';
import * as Device from 'expo-device';

export default function NotificationsScreen({ navigation }) {
    const { notificationPrefs, updateNotificationPref, expoPushToken } = useStore();

    const handleToggle = useCallback(async (key, value) => {
        try {
            await updateNotificationPref(key, value);
        } catch (err) {
            Alert.alert('Error', 'Failed to update notification setting. Please try again.');
        }
    }, [updateNotificationPref]);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Push Status Banner — only show on simulators/emulators */}
                {!Device.isDevice && (
                    <Animated.View entering={FadeInDown.delay(50)} style={styles.banner}>
                        <Ionicons name="information-circle" size={18} color={Colors.accent} />
                        <Text style={styles.bannerText}>
                            Push notifications are not available on simulators. Use a physical device for full functionality.
                        </Text>
                    </Animated.View>
                )}

                <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
                    <Text style={styles.sectionTitle}>Reminders</Text>

                    <View style={styles.settingItem}>
                        <View style={styles.settingText}>
                            <Text style={styles.settingLabel}>Daily Scan</Text>
                            <Text style={styles.settingSub}>Get reminded at 10:00 AM to log your daily health scans.</Text>
                        </View>
                        <Switch
                            value={notificationPrefs.daily_reminder}
                            onValueChange={(val) => handleToggle('daily_reminder', val)}
                            trackColor={{ false: Colors.border, true: Colors.success }}
                            thumbColor={Colors.white}
                        />
                    </View>

                    <View style={styles.separator} />

                    <View style={styles.settingItem}>
                        <View style={styles.settingText}>
                            <Text style={styles.settingLabel}>Streak Saver</Text>
                            <Text style={styles.settingSub}>Alert at 8:00 PM if you haven't scanned today.</Text>
                        </View>
                        <Switch
                            value={notificationPrefs.streak_saver}
                            onValueChange={(val) => handleToggle('streak_saver', val)}
                            trackColor={{ false: Colors.border, true: Colors.accent }}
                            thumbColor={Colors.white}
                        />
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
                    <Text style={styles.sectionTitle}>Updates</Text>

                    <View style={styles.settingItem}>
                        <View style={styles.settingText}>
                            <Text style={styles.settingLabel}>New Features</Text>
                            <Text style={styles.settingSub}>Announcements about AI models and premium features.</Text>
                        </View>
                        <Switch
                            value={notificationPrefs.new_features}
                            onValueChange={(val) => handleToggle('new_features', val)}
                            trackColor={{ false: Colors.border, true: Colors.success }}
                            thumbColor={Colors.white}
                        />
                    </View>
                </Animated.View>

                {/* Push Token Info (debug / transparent) */}
                {expoPushToken && (
                    <Animated.View entering={FadeInDown.delay(300)} style={styles.tokenSection}>
                        <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                        <Text style={styles.tokenText}>Push notifications enabled</Text>
                    </Animated.View>
                )}
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

    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(232,168,56,0.08)',
        borderRadius: Radii.lg,
        padding: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(232,168,56,0.15)',
    },
    bannerText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

    section: {
        backgroundColor: Colors.surface,
        borderRadius: Radii.xl,
        padding: 20,
        marginBottom: 20,
        ...Shadows.card,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.accent,
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    settingText: { flex: 1, paddingRight: 16 },
    settingLabel: { fontSize: 16, fontWeight: '600', color: Colors.primary, marginBottom: 4 },
    settingSub: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
    separator: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },

    tokenSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
    },
    tokenText: { fontSize: 13, color: Colors.success, fontWeight: '600' },
});
