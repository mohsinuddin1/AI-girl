import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radii, Shadows } from '../theme';

export default function GuestAuthModal({ visible, onSignIn, onDismiss }) {
    if (!visible) return <View style={{ width: 0, height: 0, overflow: 'hidden' }} />;

    return (
        <Modal
            transparent={true}
            visible={visible}
            animationType="slide"
            onRequestClose={onDismiss}
        >
            <View style={styles.overlay}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={onDismiss}
                >
                    <LinearGradient
                        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
                        style={StyleSheet.absoluteFill}
                    />
                </TouchableOpacity>

                <View style={styles.modalCard}>
                    <View style={styles.dragIndicator} />

                    <View style={styles.iconCircle}>
                        <LinearGradient
                            colors={['#0f172a', '#1e293b']}
                            style={styles.iconCircleGradient}
                        >
                            <Ionicons name="shield-checkmark" size={36} color="#fff" />
                        </LinearGradient>
                    </View>

                    <Text style={styles.title}>Unlock Your Personal{'\n'}Health Companion</Text>
                    <Text style={styles.description}>
                        Create a free account in seconds to scan medical reports, understand your prescriptions, and chat 24/7. Your personal AI health companion is ready.
                    </Text>

                    {/* Trust badges */}
                    <View style={styles.badgeRow}>
                        <View style={styles.badge}>
                            <Ionicons name="lock-closed" size={12} color={Colors.success} />
                            <Text style={styles.badgeText}>100% Private</Text>
                        </View>
                        <View style={styles.badge}>
                            <Ionicons name="flash" size={12} color={Colors.success} />
                            <Text style={styles.badgeText}>Instant Setup</Text>
                        </View>
                        <View style={styles.badge}>
                            <Ionicons name="card" size={12} color={Colors.success} />
                            <Text style={styles.badgeText}>No Card Needed</Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.primaryButton} onPress={onSignIn} activeOpacity={0.8}>
                        <LinearGradient
                            colors={['#0f172a', '#1e293b']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.primaryButtonGradient}
                        >
                            <Text style={styles.primaryButtonText}>Create Free Account</Text>
                            <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.secondaryButton} onPress={onDismiss}>
                        <Text style={styles.secondaryButtonText}>Maybe Later</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: Colors.surface,
        borderTopLeftRadius: Radii.xl,
        borderTopRightRadius: Radii.xl,
        padding: 24,
        paddingBottom: 40,
        alignItems: 'center',
        ...Shadows.elevated,
    },
    dragIndicator: {
        width: 40,
        height: 5,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 3,
        marginBottom: 20,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.surfaceMuted,
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadows.card,
    },
    iconCircleGradient: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.primary,
        textAlign: 'center',
        marginBottom: 12,
    },
    description: {
        fontSize: 15,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    badgeRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 24,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(34, 197, 94, 0.08)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.success,
    },
    primaryButton: {
        width: '100%',
        borderRadius: Radii.button,
        overflow: 'hidden',
        marginBottom: 16,
    },
    primaryButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    secondaryButton: {
        paddingVertical: 12,
        width: '100%',
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: Colors.textMuted,
        fontSize: 15,
        fontWeight: '600',
    },
});
