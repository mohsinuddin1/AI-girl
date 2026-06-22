import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Alert,
    ActivityIndicator,
    Linking,
    Dimensions,
    BackHandler,
    ScrollView,
    Image,
} from 'react-native';
import Animated, {
    withRepeat,
    withSequence,
    withTiming,
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../theme';
import useStore from '../store/useStore';
import { getOfferings, purchasePackage, restorePurchases } from '../lib/purchases';
import { useAuth } from '../features/auth/AuthProvider';
import { posthog } from '../lib/posthog';
import { scale, verticalScale, moderateScale, moderateVerticalScale } from '../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PLANS = [
    {
        id: 'annual',
        name: 'Annual',
        period: 'billed yearly',
        price: '$39.99',
        perWeek: '$0.77/week',
        trial: '3 days free trial',
        discount: 'Best Value',
        recommended: true,
    },
    {
        id: 'monthly',
        name: 'Monthly',
        period: 'billed monthly',
        price: '$8.99',
        perWeek: '$2.07/week',
        trial: null,
        discount: null,
        recommended: false,
    },
];

const FEATURES = [
    { icon: 'document-text', text: 'Unlimited Medical Scans: Analyze blood reports, lab results, and health documents instantly.' },
    { icon: 'chatbubbles', text: 'AI Health Chat: Ask MedGPT anything — your personal medical assistant, available 24/7.' },
    { icon: 'heart', text: 'Personalized Insights: Tailored to your conditions, allergies, and health goals.' },
    { icon: 'shield-checkmark', text: 'Long-Term Memory: MedGPT remembers your history and gives smarter answers over time.' },
];

export default function PaywallScreen({ navigation, route, isHardPaywall = false }) {
    const context = route?.params?.context || (isHardPaywall ? 'onboarding' : 'direct');
    const [selectedPlan, setSelectedPlan] = useState('$rc_annual');
    const [loading, setLoading] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [error, setError] = useState('');
    const [offerings, setOfferings] = useState(null);
    const [offeringsLoading, setOfferingsLoading] = useState(true);
    const [showClose, setShowClose] = useState(false); // Always hidden for 2 sec — forces value impression
    const paywallOpenedAt = useRef(Date.now());
    const isMounted = useRef(true);

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    const { user, profile, fetchProfile, healthPreferences, scanHistory } = useStore();
    const { purchasesInitialized } = useAuth();
    const insets = useSafeAreaInsets();

    // 2-second delayed X button: forces user to see the value prop before dismissing
    // Unified close-button timer: hard paywall gets 3s, soft gets 2s
    useEffect(() => {
        const delay = isHardPaywall ? 3000 : 2000;
        const t = setTimeout(() => setShowClose(true), delay);
        return () => clearTimeout(t);
    }, [isHardPaywall]);

    const goalLabel = useMemo(() => {
        if (!healthPreferences?.goals?.length) return 'Health';
        const mapping = { skin: 'Clear Skin', hormonal: 'Hormonal Balance', weight: 'Weight Management', energy: 'Better Energy', family: 'Family Safety', clean: 'Clean Living' };
        return mapping[healthPreferences.goals[0]] || 'Health';
    }, [healthPreferences]);

    const riskCount = useMemo(() => {
        if (!healthPreferences) return 0;
        const diseases = (healthPreferences.diseases || []).filter(x => x && x !== 'None').length;
        const allergies = (healthPreferences.allergies || healthPreferences.allergens || []).filter(x => x && x !== 'None').length;
        return diseases + allergies;
    }, [healthPreferences]);

    const cancellationDate = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() + 3);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }, []);

    // Pulse animation for the CTA button
    const pulseValue = useSharedValue(1);

    // Personalized copy from last scan result
    const lastScan = scanHistory?.[0];
    const harmfulCount = lastScan?.harmful_chemicals?.length || lastScan?.harmfulChemicals?.length || 0;
    const lastProduct = lastScan?.product_name || lastScan?.productName || '';

    const dynamicPlans = useMemo(() => {
        if (!offerings) {
            return [
                {
                    id: '$rc_annual',
                    name: 'Annual',
                    period: 'billed yearly',
                    price: '$39.99',
                    perWeek: '$0.77/week',
                    trial: '3 days free trial',
                    discount: 'Best Value',
                    recommended: true,
                },
                {
                    id: '$rc_monthly',
                    name: 'Monthly',
                    period: 'billed monthly',
                    price: '$8.99',
                    perWeek: '$2.07/week',
                    trial: null,
                    discount: null,
                    recommended: false,
                },
            ];
        }

        const packages = offerings.availablePackages || [];
        const metadata = offerings.metadata || {};
        // Support both the old object map AND the flat keys just in case
        const highlights = metadata.highlights || {};
        const trials = metadata.trials || {};

        if (metadata.highlight_package_id && metadata.highlight_message) {
            highlights[metadata.highlight_package_id] = metadata.highlight_message;
        }

        const parseIntroPrice = (product, packageId) => {
            // 1. Manual override from RevenueCat metadata JSON
            if (trials[packageId]) {
                return trials[packageId];
            }

            // 2. Automatic detection from App Store / Google Play
            if (product.introPrice && product.introPrice.price === 0) {
                const { periodNumberOfUnits, periodUnit } = product.introPrice;
                if (periodNumberOfUnits && periodUnit) {
                    return `${periodNumberOfUnits} ${periodUnit.toLowerCase()}${periodNumberOfUnits > 1 ? 's' : ''} free trial`;
                }
                return 'Has free trial';
            }
            return null;
        };

        const generatePlanData = (pkg) => {
            const product = pkg.product;
            let price = product.priceString || '$0.00';
            let trial = parseIntroPrice(product, pkg.identifier);
            let perWeek = null;
            let name = pkg.packageType === 'ANNUAL' ? 'Annual' :
                pkg.packageType === 'MONTHLY' ? 'Monthly' :
                    pkg.packageType === 'WEEKLY' ? 'Weekly' : 'Plan';
            let period = pkg.packageType === 'ANNUAL' ? 'billed yearly' :
                pkg.packageType === 'MONTHLY' ? 'billed monthly' :
                    pkg.packageType === 'WEEKLY' ? 'billed weekly' : '';

            if (product.price) {
                const currencySymbol = price.replace(/[\d.,]/g, '').trim() || '$';
                if (pkg.packageType === 'ANNUAL') {
                    const weeklyValue = (product.price / 52).toFixed(2);
                    perWeek = `${currencySymbol}${weeklyValue}/week`;
                } else if (pkg.packageType === 'MONTHLY') {
                    const weeklyValue = ((product.price * 12) / 52).toFixed(2);
                    perWeek = `${currencySymbol}${weeklyValue}/week`;
                } else if (pkg.packageType === 'WEEKLY') {
                    perWeek = `${price}/week`;
                }
            }

            return {
                id: pkg.identifier,
                name: name,
                period: period,
                price: price,
                perWeek: perWeek,
                trial: trial,
                discount: highlights[pkg.identifier] || null,
                recommended: !!highlights[pkg.identifier],
            };
        };

        return packages.map(generatePlanData);
    }, [offerings]);

    const activePlan = dynamicPlans.find(plan => plan.id === selectedPlan) || dynamicPlans[0];

    // Apply dynamic default plan when offerings load
    useEffect(() => {
        if (offerings) {
            const metadata = offerings.metadata || {};
            if (metadata.default_package_id) {
                setSelectedPlan(metadata.default_package_id);
            } else if (offerings.availablePackages?.length > 0) {
                // Keep selected plan if it exists in new packages, otherwise default to first
                const exists = offerings.availablePackages.some(p => p.identifier === selectedPlan);
                if (!exists) setSelectedPlan(offerings.availablePackages[0].identifier);
            }
        }
    }, [offerings]);

    useEffect(() => {
        posthog.capture('paywall viewed', {
            context,
            scans_completed: profile?.scan_usage?.daily_scans || 0,
            is_pro: profile?.is_pro || false,
        });
        if (purchasesInitialized) {
            loadOfferingsWithRetry();
        }

        pulseValue.value = withRepeat(
            withSequence(
                withTiming(1.02, { duration: 800 }),
                withTiming(1, { duration: 800 })
            ),
            -1,
            true
        );
    }, [purchasesInitialized]);

    // (close button timer is now unified in the hook above)

    // Block Android back button when hard paywall is active
    useEffect(() => {
        if (!isHardPaywall) return;
        const onBackPress = () => true; // returning true prevents default back behavior
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isHardPaywall]);

    const animatedCtaStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: pulseValue.value }],
        };
    });

    const loadOfferingsWithRetry = async (maxRetries = 3) => {
        setOfferingsLoading(true);
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const current = await getOfferings();
                if (current) {
                    if (isMounted.current) {
                        setOfferings(current);
                        setOfferingsLoading(false);
                    }
                    posthog.capture('paywall_offerings_loaded', {
                        offering_id: current.identifier,
                        packages: (current.availablePackages || []).map(p => p.identifier),
                        has_metadata: !!current.metadata,
                    });
                    return;
                }
            } catch (e) {
                console.warn(`Offerings fetch attempt ${attempt} failed:`, e);
            }
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1500));
            }
        }
        if (isMounted.current) {
            setOfferingsLoading(false);
        }
    };

    const handleSubscribe = async () => {
        setError('');
        setLoading(true);
        posthog.capture('purchase_started', { package_id: selectedPlan, context });

        try {
            let currentOfferings = offerings;

            // If offerings haven't loaded yet, do one final attempt to fetch them
            if (!currentOfferings && purchasesInitialized) {
                currentOfferings = await loadOfferingsAndReturn();
            }

            // No offerings at all — show clear error
            if (!currentOfferings) {
                if (isMounted.current) setError('Subscription products are not available right now. Please check your internet connection and try again.');
                return;
            }

            const packages = currentOfferings.availablePackages || [];

            // Empty offering — App Store products may be rejected or not configured
            if (packages.length === 0) {
                if (isMounted.current) setError('Subscriptions are currently unavailable. Please try again later.');
                return;
            }

            let pkg = packages.find(p => p.identifier === selectedPlan);

            // Last resort: grab first available package
            if (!pkg && packages.length > 0) {
                pkg = packages[0];
            }

            if (!pkg) {
                if (isMounted.current) setError('Could not find the selected subscription plan. Please try again.');
                return;
            }

            const { success, cancelled } = await purchasePackage(pkg);
            if (cancelled) {
                posthog.capture('payment_sheet_cancelled', {
                    package_id: selectedPlan,
                    context,
                    cancellation_type: 'payment_sheet_dismiss',
                    time_spent_seconds: Math.round((Date.now() - paywallOpenedAt.current) / 1000),
                });
                if (isMounted.current) setError('Purchase was cancelled. You can try again.');
            } else if (success) {
                posthog.capture('purchase_succeeded', { package_id: selectedPlan, context, time_spent_seconds: Math.round((Date.now() - paywallOpenedAt.current) / 1000) });
                if (user?.id) {
                    await fetchProfile(user.id);
                }
                if (isMounted.current) navigation.replace('Tabs');
            }
        } catch (err) {
            console.error('Purchase error:', err);
            posthog.capture('purchase_failed', {
                package_id: selectedPlan,
                error_code: err.code ?? null,
                error_message: err.message ?? String(err) ?? 'unknown',
                error_type: err.constructor?.name ?? null,
                context,
                platform: Platform.OS,
            });
            if (isMounted.current) setError(err.message || 'Failed to complete purchase. Please try again.');
        } finally {
            if (isMounted.current) setLoading(false);
        }
    };

    // Returns the offerings directly (avoids stale React state in async flows)
    const loadOfferingsAndReturn = async () => {
        setOfferingsLoading(true);
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const current = await getOfferings();
                if (current) {
                    if (isMounted.current) {
                        setOfferings(current);
                        setOfferingsLoading(false);
                    }
                    return current;
                }
            } catch (e) {
                console.warn(`Offerings fetch attempt ${attempt} failed:`, e);
            }
            if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
        }
        if (isMounted.current) setOfferingsLoading(false);
        return null;
    };

    const handleRestore = async () => {
        setRestoring(true);
        setError('');
        posthog.capture('restore_started');
        try {
            const { success } = await restorePurchases();
            if (success) {
                posthog.capture('restore_succeeded');
                if (user?.id) {
                    await fetchProfile(user.id);
                }
                if (isMounted.current) {
                    Alert.alert('Restored!', 'Your Pro subscription has been restored.', [
                        { text: 'OK', onPress: () => navigation.replace('Tabs') },
                    ]);
                }
            } else {
                posthog.capture('restore_failed', { reason: 'No active subscription found' });
                if (isMounted.current) setError('No active subscription found to restore.');
            }
        } catch (err) {
            posthog.capture('restore_failed', { reason: err.message });
            if (isMounted.current) setError(err.message || 'Failed to restore purchases');
        } finally {
            if (isMounted.current) setRestoring(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Close — hidden on hard paywall */}
            {showClose && (
                <View style={styles.closeRow}>
                    <TouchableOpacity
                        onPress={() => {
                            posthog.capture('paywall_dismissed', { context, time_spent_seconds: Math.round((Date.now() - paywallOpenedAt.current) / 1000) });
                            if (isHardPaywall) {
                                // Hard paywall: setOnboarded() triggers navigator tree swap
                                // which unmounts this screen — no manual navigation needed
                                useStore.getState().setOnboarded();
                                return;
                            }
                            if (navigation.canGoBack && navigation.canGoBack()) {
                                navigation.goBack();
                            } else {
                                navigation.replace?.('Tabs') || navigation.navigate?.('Tabs');
                            }
                        }}
                        style={styles.closeBtn}
                    >
                        <Ionicons name="close" size={20} color={Colors.primary} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Main Content — ScrollView ensures all plans are visible on any screen size */}
            <ScrollView
                style={styles.mainContent}
                contentContainerStyle={[styles.mainContentInner, { paddingTop: Math.max(insets.top + 10, 16) }]}
                showsVerticalScrollIndicator={false}
                bounces={true}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.contentConstraint}>
                    {/* Hero */}
                    <View style={styles.heroContainer}>
                        <Image source={require('../../assets/appinside1.png')} style={{ width: 80, height: 80, borderRadius: 20, marginBottom: 4, resizeMode: 'contain' }} />
                        <Text style={styles.heroHeadline}>
                            {'Your Health, Understood'}
                        </Text>
                        <Text style={styles.heroHeadlineHighlight}>
                            {riskCount > 0
                                ? `${riskCount} Condition${riskCount > 1 ? 's' : ''} Being Monitored`
                                : 'Personal Medical AI'}
                        </Text>
                        <Text style={styles.heroSubtext}>
                            {`Scan reports, chat with your AI doctor, and track your health — all in one place.\nLet's protect your ${goalLabel} together.`}
                        </Text>
                    </View>

                    {/* Features */}
                    <View style={styles.featuresList}>
                        {FEATURES.map((feat, i) => (
                            <View key={i} style={styles.featureRow}>
                                <Ionicons name={feat.icon} size={20} color="#2E9E6D" style={{ marginRight: 10 }} />
                                <Text style={styles.featureText}>{feat.text}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Plans */}
                    <View style={styles.plansSection}>
                        {dynamicPlans.map((plan) => (
                            <TouchableOpacity
                                key={plan.id}
                                onPress={() => {
                                    setSelectedPlan(plan.id);
                                    posthog.capture('package_selected', { package_id: plan.id });
                                }}
                                style={[
                                    styles.planCard,
                                    selectedPlan === plan.id && styles.planCardSelected,
                                ]}
                                activeOpacity={0.9}
                            >
                                {plan.discount && (
                                    <View style={styles.discountBadge}>
                                        <Text style={styles.discountText}>{plan.discount}</Text>
                                    </View>
                                )}
                                <View style={styles.planRow}>
                                    <View
                                        style={[
                                            styles.radioCircle,
                                            selectedPlan === plan.id && styles.radioCircleSelected,
                                        ]}
                                    >
                                        {selectedPlan === plan.id && (
                                            <Ionicons name="checkmark" size={12} color={Colors.white} />
                                        )}
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 4 }}>
                                        <Text style={styles.planName}>{plan.name}</Text>
                                        {plan.perWeek ? <Text style={styles.planPerWeek}>{plan.perWeek}</Text> : null}
                                        {plan.trial && (
                                            <Text style={styles.planTrial}>{plan.trial}</Text>
                                        )}
                                    </View>
                                    <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                                        <Text style={styles.planTotal}>{plan.price}</Text>
                                        <Text style={styles.planPeriodText}>{plan.period}</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Error */}
                    {error ? (
                        <Text style={styles.errorText}>{error}</Text>
                    ) : null}
                </View>
            </ScrollView>

            {/* Bottom CTA — Fixed at bottom */}
            <View style={[styles.ctaContainer, { paddingBottom: (Platform.OS === 'ios' ? verticalScale(36) : verticalScale(32)) + insets.bottom }]}>
                <Animated.View style={animatedCtaStyle}>
                    <TouchableOpacity
                        onPress={handleSubscribe}
                        disabled={loading || offeringsLoading}
                        style={[styles.ctaBtn, (loading || offeringsLoading) && { opacity: 0.6 }]}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <View style={styles.ctaLoading}>
                                <ActivityIndicator size="small" color={Colors.white} />
                                <Text style={styles.ctaBtnText}>Processing...</Text>
                            </View>
                        ) : offeringsLoading ? (
                            <View style={styles.ctaLoading}>
                                <ActivityIndicator size="small" color={Colors.white} />
                                <Text style={styles.ctaBtnText}>Loading plans...</Text>
                            </View>
                        ) : (
                            <Text style={styles.ctaBtnText}>
                                {activePlan?.trial ? 'Start Your FREE Trial' : 'Continue'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </Animated.View>

                {/* Subscription Legal Terms */}
                <Text style={styles.subscriptionTermsText}>
                    {(() => {
                        const periodLabel = activePlan?.period?.replace('billed ', '') || '';
                        const priceWithPeriod = periodLabel ? `${activePlan?.price}/${periodLabel}` : activePlan?.price;
                        return activePlan?.trial
                            ? `${activePlan.trial}, then ${priceWithPeriod}. `
                            : `${priceWithPeriod}. `;
                    })()}
                    {activePlan?.discount?.toLowerCase()?.includes('prepaid')
                        ? 'One-time payment. Does not auto-renew.'
                        : `Auto-renews. Cancel anytime in ${Platform.OS === 'ios' ? 'App Store' : 'Google Play'} settings at least 24 hrs before renewal.`}
                </Text>

                <View style={styles.bottomRow}>
                    <TouchableOpacity onPress={handleRestore} disabled={restoring}>
                        <Text style={styles.restoreText}>
                            {restoring ? 'Restoring...' : 'Restore purchases'}
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.legalRow}>
                        <TouchableOpacity onPress={() => Linking.openURL('https://webpure-scan-ai.vercel.app/terms')}>
                            <Text style={styles.legalLink}>Terms of Service</Text>
                        </TouchableOpacity>
                        <Text style={styles.legalDivider}>|</Text>
                        <TouchableOpacity onPress={() => Linking.openURL('https://webpure-scan-ai.vercel.app/privacy')}>
                            <Text style={styles.legalLink}>Privacy Policy</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}

const MAX_CONTENT_WIDTH = 500;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    closeRow: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 36, right: 0, paddingHorizontal: scale(20), zIndex: 100 },
    closeBtn: { width: scale(36), height: scale(36), borderRadius: scale(18), alignItems: 'center', justifyContent: 'center' },

    // ScrollView takes remaining space; contentContainer handles spacing
    mainContent: { flex: 1 },
    mainContentInner: { flexGrow: 1, justifyContent: 'flex-start', paddingHorizontal: scale(20), paddingTop: moderateVerticalScale(16), paddingBottom: moderateVerticalScale(32) },

    // Constrain content width on wider screens (iPad) for readability
    contentConstraint: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },

    // Hero
    heroContainer: { alignItems: 'center', marginBottom: moderateVerticalScale(16) },
    heroHeadline: { fontSize: moderateScale(20), fontWeight: '800', color: Colors.primary, textAlign: 'center' },
    heroHeadlineHighlight: { fontSize: moderateScale(24), fontWeight: '900', color: '#2E9E6D', textAlign: 'center', marginTop: moderateVerticalScale(2), marginBottom: moderateVerticalScale(6) },
    heroSubtext: { fontSize: moderateScale(13), color: Colors.textSecondary, textAlign: 'center', lineHeight: moderateScale(19), fontWeight: '500' },

    // Features
    featuresList: { marginHorizontal: scale(12), marginBottom: moderateVerticalScale(16) },
    featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: moderateVerticalScale(10) },
    featureText: { fontSize: moderateScale(13), color: Colors.textSecondary, flex: 1, lineHeight: moderateScale(18), fontWeight: '600' },

    // Plans
    plansSection: { gap: moderateVerticalScale(12) },
    planCard: { padding: moderateScale(14), borderRadius: scale(20), borderWidth: 1.5, borderColor: Colors.borderLight, backgroundColor: '#FFFFFF', position: 'relative' },
    planCardSelected: { borderColor: Colors.primary, borderWidth: 2 },
    discountBadge: { position: 'absolute', top: -10, right: 20, backgroundColor: Colors.primary, paddingHorizontal: scale(10), paddingVertical: moderateVerticalScale(3), borderRadius: scale(14) },
    discountText: { fontSize: moderateScale(10), fontWeight: '800', color: Colors.white, letterSpacing: 0.5 },
    planRow: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
    radioCircle: { width: moderateScale(20), height: moderateScale(20), borderRadius: moderateScale(10), borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
    radioCircleSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary },
    planName: { fontSize: moderateScale(16), fontWeight: '800', color: Colors.primary },
    planPerWeek: { fontSize: moderateScale(15), fontWeight: '800', color: Colors.primary, marginTop: moderateVerticalScale(2) },
    planTrial: { fontSize: moderateScale(11), fontWeight: '700', color: '#2E9E6D', marginTop: moderateVerticalScale(4) },
    planTotal: { fontSize: moderateScale(16), fontWeight: '800', color: Colors.primary },
    planPeriodText: { fontSize: moderateScale(12), color: Colors.textSecondary, marginTop: moderateVerticalScale(2), fontWeight: '500' },

    errorText: { color: Colors.danger, fontSize: moderateScale(12), textAlign: 'center', marginTop: moderateVerticalScale(4) },

    // CTA Fixed Bottom
    ctaContainer: { paddingHorizontal: scale(20), paddingBottom: Platform.OS === 'ios' ? verticalScale(32) : verticalScale(16), paddingTop: verticalScale(12), backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' },
    ctaSocialContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: moderateVerticalScale(8), gap: scale(4) },
    ctaSocialText: { fontSize: moderateScale(11), color: Colors.textSecondary, fontWeight: '600' },
    ctaBtn: { backgroundColor: '#2E9E6D', paddingVertical: verticalScale(16), borderRadius: scale(16), alignItems: 'center', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', width: '100%', ...Shadows.elevated },
    ctaLoading: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
    ctaBtnText: { color: Colors.white, fontSize: moderateScale(16), fontWeight: '800' },
    subscriptionTermsText: { textAlign: 'center', color: Colors.textMuted, fontSize: moderateScale(9.5), marginTop: moderateVerticalScale(8), fontWeight: '400', lineHeight: moderateScale(13), maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
    bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: moderateVerticalScale(10), maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', width: '100%' },
    restoreText: { color: Colors.textSecondary, fontSize: moderateScale(11), textDecorationLine: 'underline' },
    legalRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
    legalLink: { fontSize: moderateScale(10), color: Colors.textMuted, textDecorationLine: 'underline' },
    legalDivider: { fontSize: moderateScale(10), color: Colors.textMuted },
});

