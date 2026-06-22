import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Linking, Image } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as StoreReview from 'expo-store-review';
import { LinearGradient } from 'expo-linear-gradient';
import useStore from '../store/useStore';
import { posthog } from '../lib/posthog';
import { Colors, Radii, Shadows } from '../theme';

const STORE_URLS = {
    ios: 'itms-apps://apps.apple.com/app/id6762176490?action=write-review',
    android: 'market://details?id=com.medgptai.app',
};

export default function ReviewPromptModal() {
    const { showReviewPrompt, setShowReviewPrompt } = useStore();
    const [selectedRating, setSelectedRating] = useState(0);
    const [step, setStep] = useState('rate'); // 'rate' | 'thanks'

    // Must be BEFORE any conditional return — React Rules of Hooks
    React.useEffect(() => {
        if (showReviewPrompt) {
            posthog.capture('rating_custom_modal_shown');
        }
    }, [showReviewPrompt]);

    if (!showReviewPrompt) return <View style={{ width: 0, height: 0, overflow: 'hidden' }} />;

    const handleClose = (reason = 'dismissed') => {
        if (reason === 'dismissed') {
            posthog.capture('rating_rejected', { step, rating: selectedRating });
        }
        setShowReviewPrompt(false);
        setSelectedRating(0);
        setStep('rate');
    };

    const handleStarPress = (rating) => {
        setSelectedRating(rating);
    };

    const handleSubmitRating = async () => {
        if (selectedRating === 0) return;

        if (selectedRating >= 4) {
            // Good rating → go to store review
            posthog.capture('rating_high', { rating: selectedRating });
            setStep('thanks');
        } else {
            // Lower rating → close gracefully (don't send to store)
            posthog.capture('rating_low', { rating: selectedRating });
            handleClose('submitted_low');
        }
    };

    const handleLeaveReview = async () => {
        posthog.capture('rating_native_modal_requested');
        setShowReviewPrompt(false);
        setSelectedRating(0);
        setStep('rate');

        // Wait for modal dismiss animation
        await new Promise(r => setTimeout(r, 400));

        // 1. Attempt native in-app rating dialog
        try {
            const available = await StoreReview.isAvailableAsync();
            const hasAction = await StoreReview.hasAction();

            if (available && hasAction) {
                posthog.capture('rating_native_modal_shown');
                await StoreReview.requestReview();
                posthog.capture('rating_native_completed');
                return;
            }
        } catch (e) {
            console.log('📝 Native review error:', e?.message);
        }

        // 2. Fallback: open store review page
        posthog.capture('rating_store_fallback_opened');
        const storeUrl = Platform.OS === 'ios' ? STORE_URLS.ios : STORE_URLS.android;
        try {
            const supported = await Linking.canOpenURL(storeUrl);
            if (supported) {
                await Linking.openURL(storeUrl);
            } else {
                const httpUrl = Platform.OS === 'ios'
                    ? 'https://apps.apple.com/app/id6762176490?action=write-review'
                    : 'https://play.google.com/store/apps/details?id=com.medgptai.app';
                await Linking.openURL(httpUrl);
            }
        } catch {
            const httpUrl = Platform.OS === 'ios'
                ? 'https://apps.apple.com/app/id6762176490?action=write-review'
                : 'https://play.google.com/store/apps/details?id=com.medgptai.app';
            Linking.openURL(httpUrl).catch(() => {});
        }
    };

    return (
        <Modal
            transparent={true}
            visible={showReviewPrompt}
            animationType="slide"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={() => handleClose('dismissed')}
                >
                    <LinearGradient
                        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
                        style={StyleSheet.absoluteFill}
                    />
                </TouchableOpacity>

                <View style={styles.modalCard}>
                    <View style={styles.dragIndicator} />

                    {step === 'rate' ? (
                        <>
                            {/* App Icon */}
                            <Image
                                source={require('../../assets/appinside1.png')}
                                style={styles.appIcon}
                            />

                            <Text style={styles.title}>You're taking care of yourself 💙</Text>
                            <Text style={styles.description}>
                                That's already a big step. You've scanned your health reports, asked real questions, and taken your well-being seriously.{'\n\n'}
                                Would you help others discover MedGPT too?
                            </Text>

                            {/* Star Rating */}
                            <View style={styles.starsRow}>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <TouchableOpacity
                                        key={star}
                                        onPress={() => handleStarPress(star)}
                                        activeOpacity={0.7}
                                        style={styles.starBtn}
                                    >
                                        <Ionicons
                                            name={star <= selectedRating ? 'star' : 'star-outline'}
                                            size={36}
                                            color={star <= selectedRating ? '#F59E0B' : '#D1D5DB'}
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.primaryButton, selectedRating === 0 && { opacity: 0.4 }]}
                                onPress={handleSubmitRating}
                                disabled={selectedRating === 0}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['#2E7D5B', '#34D399']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.primaryButtonGradient}
                                >
                                    <Text style={styles.primaryButtonText}>Submit Rating</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.secondaryButton} onPress={() => handleClose('dismissed')}>
                                <Text style={styles.secondaryButtonText}>Not now</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            {/* Thanks + Redirect to Store */}
                            <Animated.View entering={FadeInDown.delay(100)} style={styles.iconCircle}>
                                <LinearGradient
                                    colors={['#2E7D5B', '#34D399']}
                                    style={styles.iconCircleGradient}
                                >
                                    <Ionicons name="heart" size={36} color="#fff" />
                                </LinearGradient>
                            </Animated.View>

                            <Animated.Text entering={FadeInDown.delay(200)} style={styles.title}>
                                That means the world to us 🥹
                            </Animated.Text>
                            <Animated.Text entering={FadeInDown.delay(300)} style={styles.description}>
                                We're a small team building something we truly believe in — an AI that puts your health first.{'\n\n'}
                                A quick review on the {Platform.OS === 'ios' ? 'App Store' : 'Play Store'} helps more people like you discover MedGPT. It takes 10 seconds.
                            </Animated.Text>

                            <Animated.View entering={FadeInDown.delay(400)} style={{ width: '100%' }}>
                                <TouchableOpacity style={styles.primaryButton} onPress={handleLeaveReview} activeOpacity={0.8}>
                                    <LinearGradient
                                        colors={['#F59E0B', '#F0C060']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.primaryButtonGradient}
                                    >
                                        <Text style={styles.primaryButtonText}>⭐ Leave a Review</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </Animated.View>

                            <TouchableOpacity style={styles.secondaryButton} onPress={() => handleClose('dismissed')}>
                                <Text style={styles.secondaryButtonText}>Maybe later</Text>
                            </TouchableOpacity>
                        </>
                    )}
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
    appIcon: {
        width: 72,
        height: 72,
        borderRadius: 18,
        marginBottom: 20,
        resizeMode: 'contain',
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
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
        marginBottom: 24,
        paddingHorizontal: 10,
    },
    starsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 28,
    },
    starBtn: {
        padding: 4,
    },
    primaryButton: {
        width: '100%',
        borderRadius: Radii.button || 16,
        overflow: 'hidden',
        marginBottom: 16,
    },
    primaryButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
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
