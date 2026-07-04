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
    ImageBackground,
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
        name: '1 YEAR',
        period: 'billed yearly',
        price: '₹3,700.00',
        weeklyPrice: '₹71.15',
        trial: '3 days free trial',
        discount: 'Save 90%',
        recommended: true,
    },
    {
        id: 'monthly',
        name: '1 MONTH',
        period: 'billed monthly',
        price: '₹1,100.00',
        weeklyPrice: '₹275.00',
        trial: null,
        discount: null,
        recommended: false,
    },
    {
        id: 'weekly',
        name: '1 WEEK',
        period: 'billed weekly',
        price: '₹550.00',
        weeklyPrice: '₹550.00',
        trial: null,
        discount: null,
        recommended: false,
    },
];

const FEATURES = [
    { icon: 'infinite', text: 'Unlimited Chat' },
    { icon: 'call', text: 'Unlock AI Calling' },
    { icon: 'lock-closed', text: 'Unlock Images & Videos' },
    { icon: 'sparkles', text: 'Personalized Experience' },
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

    const { user, profile, fetchProfile, healthPreferences, scanHistory, selectedPersona } = useStore();
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
                    id: '$rc_weekly',
                    name: '1 WEEK',
                    period: 'billed weekly',
                    price: '₹550.00',
                    weeklyPrice: '₹550.00',
                    trial: null,
                    discount: null,
                    recommended: false,
                },
                {
                    id: '$rc_monthly',
                    name: '1 MONTH',
                    period: 'billed monthly',
                    price: '₹1,100.00',
                    weeklyPrice: '₹275.00',
                    trial: null,
                    discount: null,
                    recommended: false,
                },
                {
                    id: '$rc_annual',
                    name: '1 YEAR',
                    period: 'billed yearly',
                    price: '₹3,700.00',
                    weeklyPrice: '₹71.15',
                    trial: '3 days free trial',
                    discount: 'Save 90%',
                    recommended: true,
                },
            ];
        }

        const packages = offerings.availablePackages || [];
        const metadata = offerings.metadata || {};
        const highlights = metadata.highlights || {};
        const trials = metadata.trials || {};

        if (metadata.highlight_package_id && metadata.highlight_message) {
            highlights[metadata.highlight_package_id] = metadata.highlight_message;
        }

        const parseIntroPrice = (product, packageId) => {
            if (trials[packageId]) return trials[packageId];
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
            let weeklyPrice = null;
            let name = pkg.packageType === 'ANNUAL' ? '1 YEAR' :
                pkg.packageType === 'MONTHLY' ? '1 MONTH' :
                    pkg.packageType === 'WEEKLY' ? '1 WEEK' : 'PLAN';
            let period = pkg.packageType === 'ANNUAL' ? 'billed yearly' :
                pkg.packageType === 'MONTHLY' ? 'billed monthly' :
                    pkg.packageType === 'WEEKLY' ? 'billed weekly' : '';

            if (product.price) {
                const currencySymbol = price.replace(/[\d.,]/g, '').trim() || '$';
                if (pkg.packageType === 'ANNUAL') {
                    const weeklyValue = (product.price / 52).toFixed(2);
                    weeklyPrice = `${currencySymbol}${weeklyValue}`;
                } else if (pkg.packageType === 'MONTHLY') {
                    const weeklyValue = ((product.price * 12) / 52).toFixed(2);
                    weeklyPrice = `${currencySymbol}${weeklyValue}`;
                } else if (pkg.packageType === 'WEEKLY') {
                    weeklyPrice = `${price}`;
                }
            }

            return {
                id: pkg.identifier,
                name: name,
                period: period,
                price: price,
                weeklyPrice: weeklyPrice || price,
                trial: trial,
                discount: highlights[pkg.identifier] || (pkg.packageType === 'ANNUAL' ? 'Save 90%' : null),
                recommended: !!highlights[pkg.identifier] || pkg.packageType === 'ANNUAL',
            };
        };

        const order = { 'WEEKLY': 1, 'MONTHLY': 2, 'ANNUAL': 3 };
        const sortedPackages = [...packages].sort((a, b) => (order[a.packageType] || 99) - (order[b.packageType] || 99));

        return sortedPackages.map(generatePlanData);
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
        <ImageBackground source={selectedPersona?.image_url ? { uri: selectedPersona.image_url } : require('../../assets/logo.png')} style={styles.container} resizeMode="cover">
            {/* Dark gradient overlay */}
            <View style={styles.overlay} />

            {/* Header: Close & Restore */}
            <View style={[styles.headerRow, { paddingTop: Platform.OS === 'ios' ? 50 : 36 }]}>
                {showClose ? (
                    <TouchableOpacity
                        onPress={() => {
                            posthog.capture('paywall_dismissed', { context, time_spent_seconds: Math.round((Date.now() - paywallOpenedAt.current) / 1000) });
                            if (isHardPaywall) {
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
                        <Ionicons name="close" size={20} color="#333" />
                    </TouchableOpacity>
                ) : <View style={styles.closeBtnPlaceholder} />}
                
                <TouchableOpacity onPress={handleRestore} disabled={restoring} style={styles.restoreBtn}>
                    <Text style={styles.restoreText}>
                        {restoring ? 'Restoring...' : 'Restore'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Main Content */}
            <ScrollView
                style={styles.mainContent}
                contentContainerStyle={styles.mainContentInner}
                showsVerticalScrollIndicator={false}
                bounces={true}
            >
                {/* Hero / Title */}
                <View style={styles.heroContainer}>
                    <View style={styles.titleWrapper}>
                        <Text style={styles.titleText}>MyGirl AI</Text>
                        <View style={styles.proBadge}>
                            <Text style={styles.proBadgeText}>PRO</Text>
                        </View>
                    </View>
                </View>

                {/* Features */}
                <View style={styles.featuresList}>
                    {FEATURES.map((feat, i) => (
                        <View key={i} style={styles.featureRow}>
                            <Ionicons name={feat.icon} size={20} color="#fff" style={styles.featureIcon} />
                            <Text style={styles.featureText}>{feat.text}</Text>
                        </View>
                    ))}
                </View>

                {/* Plans */}
                <View style={styles.plansSection}>
                    {dynamicPlans.map((plan) => {
                        const isSelected = selectedPlan === plan.id;
                        return (
                            <TouchableOpacity
                                key={plan.id}
                                onPress={() => {
                                    setSelectedPlan(plan.id);
                                    posthog.capture('package_selected', { package_id: plan.id });
                                }}
                                style={[
                                    styles.planCard,
                                    isSelected && styles.planCardSelected,
                                ]}
                                activeOpacity={0.9}
                            >
                                {plan.discount && (
                                    <View style={styles.discountBadge}>
                                        <Text style={styles.discountText}>{plan.discount}</Text>
                                    </View>
                                )}
                                <View style={styles.planTopPart}>
                                    <Text style={styles.planName}>{plan.name}</Text>
                                    <Text style={styles.planPrice}>{plan.price}</Text>
                                </View>
                                <View style={[styles.planBottomPart, isSelected && styles.planBottomPartSelected]}>
                                    <Text style={[styles.planWeeklyValue, isSelected && styles.planWeeklyValueSelected]}>{plan.weeklyPrice}</Text>
                                    <Text style={[styles.planWeeklyLabel, isSelected && styles.planWeeklyLabelSelected]}>PER WEEK</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </ScrollView>

            {/* Bottom CTA */}
            <View style={[styles.ctaContainer, { paddingBottom: (Platform.OS === 'ios' ? verticalScale(36) : verticalScale(32)) + insets.bottom }]}>
                <Animated.View style={animatedCtaStyle}>
                    <TouchableOpacity
                        onPress={handleSubscribe}
                        disabled={loading || offeringsLoading}
                        style={[styles.ctaBtn, (loading || offeringsLoading) && { opacity: 0.6 }]}
                        activeOpacity={0.8}
                    >
                        {loading || offeringsLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.ctaBtnText}>Continue</Text>
                        )}
                    </TouchableOpacity>
                </Animated.View>

                <Text style={styles.subscriptionTermsText}>
                    Subscription renews automatically. You can cancel anytime.
                </Text>

                <View style={styles.legalRow}>
                    <TouchableOpacity onPress={() => Linking.openURL('https://webpure-scan-ai.vercel.app/privacy')}>
                        <Text style={styles.legalLink}>Privacy Policy</Text>
                    </TouchableOpacity>
                    <Text style={styles.legalDivider}>|</Text>
                    <TouchableOpacity onPress={() => Linking.openURL('https://webpure-scan-ai.vercel.app/terms')}>
                        <Text style={styles.legalLink}>Term and Condition</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        zIndex: 10,
    },
    closeBtn: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center'
    },
    closeBtnPlaceholder: { width: 36, height: 36 },
    restoreBtn: { paddingVertical: 8, paddingHorizontal: 12 },
    restoreText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    
    mainContent: { flex: 1, zIndex: 5 },
    mainContentInner: { 
        flexGrow: 1, 
        justifyContent: 'flex-end', 
        paddingHorizontal: 16, 
        paddingBottom: 20,
        paddingTop: 100,
    },

    heroContainer: { alignItems: 'center', marginBottom: 24 },
    titleWrapper: { flexDirection: 'row', alignItems: 'center' },
    titleText: { fontSize: 32, fontWeight: '800', color: '#fff' },
    proBadge: { backgroundColor: '#8E74FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8 },
    proBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },

    featuresList: { alignItems: 'center', marginBottom: 32 },
    featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, width: 260 },
    featureIcon: { marginRight: 16, width: 24, textAlign: 'center' },
    featureText: { fontSize: 16, color: '#fff', fontWeight: '600' },

    plansSection: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    planCard: { 
        flex: 1, 
        backgroundColor: '#0a0a0a', 
        borderRadius: 16, 
        borderWidth: 1.5, 
        borderColor: '#333', 
        overflow: 'visible',
    },
    planCardSelected: { borderColor: '#8E74FF', borderWidth: 2 },
    discountBadge: { 
        position: 'absolute', top: -12, left: 0, right: 0, 
        backgroundColor: '#8E74FF', 
        borderRadius: 10, 
        alignItems: 'center', 
        justifyContent: 'center', 
        paddingVertical: 2,
        marginHorizontal: '10%'
    },
    discountText: { fontSize: 10, fontWeight: '800', color: '#fff' },
    
    planTopPart: { padding: 12, alignItems: 'center', justifyContent: 'center', height: 80 },
    planName: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 6 },
    planPrice: { fontSize: 13, color: '#ccc', fontWeight: '600' },
    
    planBottomPart: { backgroundColor: '#333', borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingVertical: 10, alignItems: 'center' },
    planBottomPartSelected: { backgroundColor: '#8E74FF' },
    planWeeklyValue: { fontSize: 14, fontWeight: '700', color: '#fff' },
    planWeeklyValueSelected: { color: '#fff' },
    planWeeklyLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', marginTop: 2 },
    planWeeklyLabelSelected: { color: '#fff' },

    errorText: { color: '#ff4444', fontSize: 14, textAlign: 'center', marginTop: 16 },

    ctaContainer: { paddingHorizontal: 20, backgroundColor: 'transparent', paddingTop: 16 },
    ctaBtn: { backgroundColor: '#8E74FF', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
    ctaBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
    
    subscriptionTermsText: { textAlign: 'center', color: '#aaa', fontSize: 10, marginTop: 16, fontWeight: '500' },
    legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 16 },
    legalLink: { fontSize: 10, color: '#aaa', fontWeight: '600' },
    legalDivider: { fontSize: 10, color: '#aaa' },
});

