import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import useStore from '../store/useStore';
import { Colors, Radii, Shadows } from '../theme';

export default function UpgradeModal() {
    const { showUpgradeModal, setShowUpgradeModal } = useStore();
    const navigation = useNavigation();

    // Handle Android hardware back button
    React.useEffect(() => {
        if (!showUpgradeModal) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            setShowUpgradeModal(false);
            return true;
        });
        return () => sub.remove();
    }, [showUpgradeModal]);

    // Never return null — return invisible View to avoid SafeAreaProvider crash
    if (!showUpgradeModal) return <View style={{ width: 0, height: 0, overflow: 'hidden' }} />;

    const handleDismiss = () => {
        setShowUpgradeModal(false);
    };

    const handleUpgrade = () => {
        setShowUpgradeModal(false);
        setTimeout(() => {
            navigation.navigate('Paywall');
        }, 300);
    };

    return (
        <Modal
            transparent={true}
            visible={showUpgradeModal}
            animationType="slide"
            onRequestClose={handleDismiss}
        >
            <View style={styles.overlay}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={handleDismiss}
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
                            colors={['#2E7D5B', '#34D399']}
                            style={styles.iconCircleGradient}
                        >
                            <Ionicons name="sparkles" size={36} color="#fff" />
                        </LinearGradient>
                    </View>

                    <Text style={styles.title}>Your Health Deserves More</Text>
                    <Text style={styles.description}>
                        You're already taking amazing steps for your well-being — don't stop now! Unlock unlimited scans and priority AI analysis so nothing stands between you and the answers you need.
                    </Text>

                    <View style={styles.benefitsRow}>
                        <View style={styles.benefitChip}>
                            <Ionicons name="infinite-outline" size={14} color={Colors.accent} />
                            <Text style={styles.benefitText}>Unlimited Scans</Text>
                        </View>
                        <View style={styles.benefitChip}>
                            <Ionicons name="flash-outline" size={14} color={Colors.accent} />
                            <Text style={styles.benefitText}>Priority AI</Text>
                        </View>
                        <View style={styles.benefitChip}>
                            <Ionicons name="shield-checkmark-outline" size={14} color={Colors.accent} />
                            <Text style={styles.benefitText}>Full Access</Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.primaryButton} onPress={handleUpgrade} activeOpacity={0.8}>
                        <LinearGradient
                            colors={['#2E7D5B', '#34D399']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.primaryButtonGradient}
                        >
                            <Text style={styles.primaryButtonText}>Unlock My Full Potential</Text>
                            <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.secondaryButton} onPress={handleDismiss}>
                        <Text style={styles.secondaryButtonText}>Not Right Now</Text>
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
        backgroundColor: Colors.surface || '#fff',
        borderTopLeftRadius: Radii.xl || 28,
        borderTopRightRadius: Radii.xl || 28,
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
        marginBottom: 10,
    },
    description: {
        fontSize: 15,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 18,
        paddingHorizontal: 10,
    },
    benefitsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 22,
    },
    benefitChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Colors.accentLight,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: Radii.pill,
    },
    benefitText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.accent,
    },
    primaryButton: {
        width: '100%',
        borderRadius: Radii.button || 16,
        overflow: 'hidden',
        marginBottom: 14,
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
