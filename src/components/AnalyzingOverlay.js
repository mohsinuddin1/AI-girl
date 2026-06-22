import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Dimensions,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    withDelay,
    interpolate,
    Easing,
    FadeInDown,
    SlideInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Warm accent colors matching HomeScreen's gold palette
const WARM = {
    gold: '#e8a838',
    goldLight: '#f0c060',
    amber: '#f59e0b',
    amberGlow: 'rgba(232,168,56,0.35)',
    amberSoft: 'rgba(245,158,11,0.12)',
    cyan: '#0ea5e9',
    cyanSoft: 'rgba(14,165,233,0.15)',
    mint: '#34d399',
};

// Phase mapping
const PHASES = [
    { key: 'uploading', label: 'Upload', icon: 'cloud-upload-outline' },
    { key: 'analyzing', label: 'Analyze', icon: 'flask-outline' },
    { key: 'saving', label: 'Save', icon: 'checkmark-done-outline' },
];

// Detection messages shown during analysis — each has a unique id
const DETECTION_MESSAGES = [
    { id: 'd0', text: 'Scanning ingredient list...', icon: 'search-outline' },
    { id: 'd1', text: 'Checking for parabens & sulfates', icon: 'warning-outline' },
    { id: 'd2', text: 'Analyzing preservative compounds', icon: 'flask-outline' },
    { id: 'd3', text: 'Cross-referencing ingredient database', icon: 'server-outline' },
    { id: 'd4', text: 'Evaluating ingredient sensitivity profile', icon: 'shield-checkmark-outline' },
    { id: 'd5', text: 'Calculating overall ingredient score', icon: 'stats-chart-outline' },
    { id: 'd6', text: 'Generating your report...', icon: 'document-text-outline' },
];

// Chemical pills
const CHEMICAL_PILLS = [
    { id: 'c0', name: 'Parabens' },
    { id: 'c1', name: 'Sulfates' },
    { id: 'c2', name: 'Phthalates' },
    { id: 'c3', name: 'BPA' },
    { id: 'c4', name: 'Formaldehyde' },
    { id: 'c5', name: 'Triclosan' },
];

// Separate particle component to avoid hook-in-loop issue
function FloatingParticle({ sharedValue, x, y, size, color }) {
    const animStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: sharedValue.value }],
    }));
    return (
        <Animated.View style={[styles.particle, { left: x, top: y }, animStyle]}>
            <View style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: color,
                opacity: 0.5,
            }} />
        </Animated.View>
    );
}

export default function AnalyzingOverlay({ scanPhase, onCancel }) {
    const [visibleDetections, setVisibleDetections] = useState([]);
    const [visiblePillIds, setVisiblePillIds] = useState([]);
    const [percentage, setPercentage] = useState(0);
    const msgCounter = useRef(0);

    // Orbital ring rotations
    const ring1Rotation = useSharedValue(0);
    const ring2Rotation = useSharedValue(0);
    const ring3Rotation = useSharedValue(0);

    // Central icon pulse
    const iconPulse = useSharedValue(1);
    const glowOpacity = useSharedValue(0.2);

    // 6 particle Y shared values (fixed count = valid hooks)
    const p0Y = useSharedValue(0);
    const p1Y = useSharedValue(0);
    const p2Y = useSharedValue(0);
    const p3Y = useSharedValue(0);
    const p4Y = useSharedValue(0);
    const p5Y = useSharedValue(0);

    // Progress bar width
    const progressWidth = useSharedValue(0);

    // Shimmer for time estimate
    const shimmer = useSharedValue(0);

    // Start all animations on mount
    useEffect(() => {
        ring1Rotation.value = withRepeat(
            withTiming(360, { duration: 4000, easing: Easing.linear }), -1, false
        );
        ring2Rotation.value = withRepeat(
            withTiming(-360, { duration: 6000, easing: Easing.linear }), -1, false
        );
        ring3Rotation.value = withRepeat(
            withTiming(360, { duration: 8000, easing: Easing.linear }), -1, false
        );

        iconPulse.value = withRepeat(
            withSequence(
                withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
            ), -1, true
        );
        glowOpacity.value = withRepeat(
            withSequence(
                withTiming(0.5, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.15, { duration: 1200, easing: Easing.inOut(Easing.ease) })
            ), -1, true
        );

        // Particles
        const driftParticle = (sv, delay) => {
            sv.value = withDelay(delay, withRepeat(
                withSequence(
                    withTiming(-25, { duration: 3000 + delay, easing: Easing.inOut(Easing.ease) }),
                    withTiming(0, { duration: 3000 + delay, easing: Easing.inOut(Easing.ease) })
                ), -1, true
            ));
        };
        driftParticle(p0Y, 0);
        driftParticle(p1Y, 500);
        driftParticle(p2Y, 1000);
        driftParticle(p3Y, 300);
        driftParticle(p4Y, 700);
        driftParticle(p5Y, 1200);

        shimmer.value = withRepeat(
            withTiming(1, { duration: 2000, easing: Easing.linear }), -1, false
        );
    }, []);

    // Phase-based progress
    useEffect(() => {
        const p = (scanPhase || '').toLowerCase();
        if (p.includes('upload')) progressWidth.value = withTiming(0.33, { duration: 800 });
        else if (p.includes('analyz')) progressWidth.value = withTiming(0.66, { duration: 800 });
        else if (p.includes('sav')) progressWidth.value = withTiming(0.95, { duration: 800 });
    }, [scanPhase]);

    // Percentage counter
    useEffect(() => {
        const p = (scanPhase || '').toLowerCase();
        let target = 10;
        if (p.includes('upload')) target = 25;
        else if (p.includes('analyz')) target = 65;
        else if (p.includes('sav')) target = 92;

        const start = percentage;
        const diff = target - start;
        if (diff === 0) return;
        const steps = 30;
        let step = 0;
        const interval = setInterval(() => {
            step++;
            setPercentage(Math.round(start + (diff * step) / steps));
            if (step >= steps) clearInterval(interval);
        }, 50);
        return () => clearInterval(interval);
    }, [scanPhase]);

    // Detection messages — use counter ref for stable unique keys
    useEffect(() => {
        msgCounter.current = 0;
        setVisibleDetections([{ ...DETECTION_MESSAGES[0], uid: `msg-${msgCounter.current}` }]);
        let i = 0;
        const interval = setInterval(() => {
            i++;
            msgCounter.current++;
            if (i < DETECTION_MESSAGES.length) {
                // Snapshot values before passing to state updater
                const idx = i;
                const uid = `msg-${msgCounter.current}`;
                setVisibleDetections(prev => {
                    const next = [...prev, { ...DETECTION_MESSAGES[idx], uid }];
                    if (next.length > 4) next.shift();
                    return next;
                });
            } else {
                clearInterval(interval);
            }
        }, 2200);
        return () => clearInterval(interval);
    }, []);

    // Chemical pills appearing with delay
    useEffect(() => {
        let i = 0;
        const interval = setInterval(() => {
            if (i < CHEMICAL_PILLS.length) {
                // Snapshot index before passing to state updater
                const idx = i;
                setVisiblePillIds(prev => [...prev, CHEMICAL_PILLS[idx].id]);
                i++;
            } else {
                clearInterval(interval);
            }
        }, 800);
        return () => clearInterval(interval);
    }, []);

    const getCurrentPhaseIndex = useCallback(() => {
        const p = (scanPhase || '').toLowerCase();
        if (p.includes('sav')) return 2;
        if (p.includes('analyz')) return 1;
        return 0;
    }, [scanPhase]);

    const currentPhaseIdx = getCurrentPhaseIndex();

    // ─── Animated Styles (all at top level, no loops) ───
    const ring1Style = useAnimatedStyle(() => ({ transform: [{ rotate: `${ring1Rotation.value}deg` }] }));
    const ring2Style = useAnimatedStyle(() => ({ transform: [{ rotate: `${ring2Rotation.value}deg` }] }));
    const ring3Style = useAnimatedStyle(() => ({ transform: [{ rotate: `${ring3Rotation.value}deg` }] }));
    const iconPulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconPulse.value }] }));
    const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));
    const progressBarStyle = useAnimatedStyle(() => ({ width: `${progressWidth.value * 100}%` }));
    const shimmerStyle = useAnimatedStyle(() => ({
        opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.4, 0.8, 0.4]),
    }));

    const visiblePillItems = CHEMICAL_PILLS.filter(p => visiblePillIds.includes(p.id));

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#020617', '#0f1729', '#1a1a2e']} style={styles.gradient}>

                {/* ─── Floating Particles (each is its own component with its own hook) ─── */}
                <FloatingParticle sharedValue={p0Y} x={SCREEN_WIDTH * 0.15} y={80} size={3} color={WARM.gold} />
                <FloatingParticle sharedValue={p1Y} x={SCREEN_WIDTH * 0.8} y={120} size={4} color={WARM.cyan} />
                <FloatingParticle sharedValue={p2Y} x={SCREEN_WIDTH * 0.25} y={200} size={3} color={WARM.goldLight} />
                <FloatingParticle sharedValue={p3Y} x={SCREEN_WIDTH * 0.7} y={260} size={5} color={WARM.cyan} />
                <FloatingParticle sharedValue={p4Y} x={SCREEN_WIDTH * 0.1} y={340} size={4} color={WARM.amber} />
                <FloatingParticle sharedValue={p5Y} x={SCREEN_WIDTH * 0.85} y={400} size={3} color={WARM.goldLight} />

                {/* ─── Orbital Visualization ─── */}
                <View style={styles.orbitalContainer}>
                    <Animated.View style={[styles.centralGlow, glowStyle]} />
                    <Animated.View style={[styles.ring, styles.ring3, ring3Style]}>
                        <View style={[styles.ringDot, styles.ringDot3]} />
                    </Animated.View>
                    <Animated.View style={[styles.ring, styles.ring2, ring2Style]}>
                        <View style={[styles.ringDot, styles.ringDot2]} />
                    </Animated.View>
                    <Animated.View style={[styles.ring, styles.ring1, ring1Style]}>
                        <View style={[styles.ringDot, styles.ringDot1]} />
                    </Animated.View>
                    <Animated.View style={[styles.centralIcon, iconPulseStyle]}>
                        <LinearGradient
                            colors={['rgba(232,168,56,0.2)', 'rgba(14,165,233,0.1)']}
                            style={styles.centralIconBg}
                        >
                            <Ionicons name="scan" size={36} color={WARM.gold} />
                        </LinearGradient>
                    </Animated.View>
                </View>

                {/* ─── Percentage Counter ─── */}
                <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.percentageContainer}>
                    <Text style={styles.percentageText}>{percentage}%</Text>
                    <Text style={styles.percentageLabel}>{scanPhase || 'Initializing...'}</Text>
                </Animated.View>

                {/* ─── 3-Phase Progress Stepper ─── */}
                <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.stepperContainer}>
                    <View style={styles.stepperTrack}>
                        <Animated.View style={[styles.stepperFill, progressBarStyle]}>
                            <LinearGradient
                                colors={[WARM.gold, WARM.goldLight]}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                style={styles.stepperFillGradient}
                            />
                        </Animated.View>
                    </View>
                    <View style={styles.stepperLabels}>
                        {PHASES.map((phase, i) => {
                            const done = i < currentPhaseIdx;
                            const active = i === currentPhaseIdx;
                            return (
                                <View key={phase.key} style={styles.stepperItem}>
                                    <View style={[styles.stepperDot, done && styles.stepperDotCompleted, active && styles.stepperDotActive]}>
                                        {done
                                            ? <Ionicons name="checkmark" size={10} color="#fff" />
                                            : <Ionicons name={phase.icon} size={10} color={active ? WARM.gold : 'rgba(255,255,255,0.3)'} />
                                        }
                                    </View>
                                    <Text style={[styles.stepperLabel, done && styles.stepperLabelCompleted, active && styles.stepperLabelActive]}>
                                        {phase.label}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </Animated.View>

                {/* ─── Chemical Pills ─── */}
                <View style={styles.pillsRow}>
                    {visiblePillItems.map((pill) => (
                        <Animated.View key={pill.id} entering={FadeInDown.duration(400)} style={styles.pill}>
                            <Text style={styles.pillText}>{pill.name}</Text>
                        </Animated.View>
                    ))}
                </View>

                {/* ─── Live Detection Card ─── */}
                <Animated.View entering={SlideInDown.delay(400).springify()} style={styles.detectionCard}>
                    <View style={styles.detectionHeader}>
                        <View style={styles.detectionHeaderDot} />
                        <Text style={styles.detectionHeaderText}>Live Analysis</Text>
                    </View>
                    <View style={styles.detectionList}>
                        {visibleDetections.map((det, i) => {
                            const isLatest = i === visibleDetections.length - 1;
                            return (
                                <View key={det.uid} style={styles.detectionItem}>
                                    <View style={[styles.detectionIcon, isLatest && styles.detectionIconActive]}>
                                        <Ionicons
                                            name={isLatest ? det.icon : 'checkmark-circle'}
                                            size={14}
                                            color={isLatest ? WARM.gold : WARM.mint}
                                        />
                                    </View>
                                    <Text style={[styles.detectionText, isLatest ? styles.detectionTextActive : styles.detectionTextDone]}>
                                        {det.text}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </Animated.View>

                {/* ─── Time Estimate ─── */}
                <Animated.Text style={[styles.timeEstimate, shimmerStyle]}>
                    This usually takes 10–15 seconds ✨
                </Animated.Text>

                {/* ─── Cancel Button ─── */}
                {onCancel && (
                    <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} activeOpacity={0.7}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                )}
            </LinearGradient>
        </View>
    );
}

const RING_SIZE_1 = 120;
const RING_SIZE_2 = 160;
const RING_SIZE_3 = 200;

const styles = StyleSheet.create({
    container: { flex: 1 },
    gradient: {
        flex: 1, alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 80 : 60,
        paddingHorizontal: 24,
    },

    particle: { position: 'absolute', zIndex: 0 },

    orbitalContainer: {
        width: RING_SIZE_3 + 20, height: RING_SIZE_3 + 20,
        alignItems: 'center', justifyContent: 'center', marginBottom: 24,
    },
    centralGlow: {
        position: 'absolute', width: RING_SIZE_3, height: RING_SIZE_3,
        borderRadius: RING_SIZE_3 / 2, backgroundColor: WARM.gold,
    },
    ring: { position: 'absolute', alignItems: 'center', justifyContent: 'flex-start' },
    ring1: { width: RING_SIZE_1, height: RING_SIZE_1, borderRadius: RING_SIZE_1 / 2, borderWidth: 1.5, borderColor: 'rgba(232,168,56,0.4)' },
    ring2: { width: RING_SIZE_2, height: RING_SIZE_2, borderRadius: RING_SIZE_2 / 2, borderWidth: 1, borderColor: 'rgba(14,165,233,0.25)' },
    ring3: { width: RING_SIZE_3, height: RING_SIZE_3, borderRadius: RING_SIZE_3 / 2, borderWidth: 1, borderColor: 'rgba(232,168,56,0.12)' },
    ringDot: { position: 'absolute', borderRadius: 50 },
    ringDot1: { width: 8, height: 8, backgroundColor: WARM.gold, top: -4, shadowColor: WARM.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 6, elevation: 8 },
    ringDot2: { width: 6, height: 6, backgroundColor: WARM.cyan, top: -3, shadowColor: WARM.cyan, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4, elevation: 6 },
    ringDot3: { width: 5, height: 5, backgroundColor: WARM.goldLight, top: -2.5, shadowColor: WARM.goldLight, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 3, elevation: 4 },

    centralIcon: { position: 'absolute' },
    centralIconBg: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(232,168,56,0.3)' },

    percentageContainer: { alignItems: 'center', marginBottom: 20 },
    percentageText: { fontSize: 42, fontWeight: '800', color: '#f8fafc', letterSpacing: -1 },
    percentageLabel: { fontSize: 13, color: WARM.goldLight, fontWeight: '600', marginTop: 4, letterSpacing: 0.5 },

    stepperContainer: { width: '100%', marginBottom: 24 },
    stepperTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 },
    stepperFill: { height: '100%', borderRadius: 2, overflow: 'hidden' },
    stepperFillGradient: { flex: 1 },
    stepperLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    stepperItem: { alignItems: 'center', gap: 4 },
    stepperDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
    stepperDotCompleted: { backgroundColor: WARM.mint, borderColor: WARM.mint },
    stepperDotActive: { borderColor: WARM.gold, backgroundColor: WARM.amberSoft },
    stepperLabel: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '600' },
    stepperLabelCompleted: { color: WARM.mint },
    stepperLabelActive: { color: WARM.goldLight },

    pillsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 20, paddingHorizontal: 8 },
    pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(232,168,56,0.08)', borderWidth: 1, borderColor: 'rgba(232,168,56,0.2)' },
    pillText: { fontSize: 11, color: 'rgba(240,192,96,0.75)', fontWeight: '600', letterSpacing: 0.3 },

    detectionCard: { width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Radii.card, borderWidth: 1, borderColor: 'rgba(232,168,56,0.1)', padding: 16, marginBottom: 20 },
    detectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    detectionHeaderDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: WARM.gold, shadowColor: WARM.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4, elevation: 4 },
    detectionHeaderText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.8, textTransform: 'uppercase' },
    detectionList: { gap: 10 },
    detectionItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    detectionIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(52,211,153,0.1)', alignItems: 'center', justifyContent: 'center' },
    detectionIconActive: { backgroundColor: WARM.amberSoft },
    detectionText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500', flex: 1 },
    detectionTextActive: { color: 'rgba(255,255,255,0.85)' },
    detectionTextDone: { color: 'rgba(255,255,255,0.35)' },

    timeEstimate: { fontSize: 12, color: 'rgba(240,192,96,0.5)', fontWeight: '500', marginBottom: 12 },
    cancelBtn: { paddingHorizontal: 24, paddingVertical: 10 },
    cancelText: { fontSize: 14, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
});
