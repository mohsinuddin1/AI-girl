import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Platform,
    Share,
    LayoutAnimation,
    UIManager,
    Dimensions,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeIn,
    FadeOut,
    FadeInDown,
    ZoomIn,
    LinearTransition,
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withDelay,
    Easing,
    withSequence,
    interpolate,
    SlideInDown,
    SlideOutDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, getGradeColor, getGradeBg } from '../theme';
import { supabase } from '../lib/supabase';
import useStore from '../store/useStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { posthog } from '../lib/posthog';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ───────────────────────────────────────────────────
//  LOADING / SKELETON HELPERS
// ───────────────────────────────────────────────────
const SkeletonRow = () => {
    const opacity = useSharedValue(0.4);
    useEffect(() => {
        opacity.value = withRepeat(withTiming(0.8, { duration: 800 }), -1, true);
    }, []);
    const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
    return (
        <Animated.View style={[styles.minimalCard, style, { height: 70, backgroundColor: Colors.surfaceMuted, borderColor: 'transparent', marginBottom: 12 }]} />
    );
};

// ── AI Analysis Status Messages ──
const AI_ANALYSIS_STEPS = [
    { icon: '🔬', text: 'Scanning ingredient database...', sub: 'Cross-referencing 12,000+ compounds' },
    { icon: '🧬', text: 'Analyzing chemical structures...', sub: 'Checking molecular interactions' },
    { icon: '⚗️', text: 'Evaluating ingredient safety...', sub: 'Position-weighted risk assessment' },
    { icon: '🛡️', text: 'Checking regulatory databases...', sub: 'FDA, EU, WHO safety standards' },
    { icon: '🧠', text: 'Personalizing for your health...', sub: 'Matching with your health profile' },
    { icon: '📊', text: 'Computing safety grade...', sub: 'Finalizing ingredient score' },
];

const ScanningLine = () => {
    const translateY = useSharedValue(0);
    useEffect(() => {
        translateY.value = withRepeat(
            withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            -1, true
        );
    }, []);
    const lineStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: interpolate(translateY.value, [0, 1], [0, 60]) }],
        opacity: interpolate(translateY.value, [0, 0.5, 1], [0.3, 1, 0.3]),
    }));
    return (
        <Animated.View style={[{
            height: 2, backgroundColor: Colors.accent, borderRadius: 1,
            marginHorizontal: 4, shadowColor: Colors.accent,
            shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6,
        }, lineStyle]} />
    );
};

const AIAnalyzingBanner = () => {
    const [stepIndex, setStepIndex] = useState(0);
    const glowOpacity = useSharedValue(0.4);
    const progressWidth = useSharedValue(0);
    const iconScale = useSharedValue(1);
    const dotOpacity1 = useSharedValue(0.3);
    const dotOpacity2 = useSharedValue(0.3);
    const dotOpacity3 = useSharedValue(0.3);

    useEffect(() => {
        const interval = setInterval(() => {
            setStepIndex(prev => (prev + 1) % AI_ANALYSIS_STEPS.length);
        }, 2800);
        glowOpacity.value = withRepeat(withTiming(0.9, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, true);
        progressWidth.value = withTiming(85, { duration: 15000, easing: Easing.out(Easing.quad) });
        iconScale.value = withRepeat(withSequence(
            withTiming(1.15, { duration: 600, easing: Easing.out(Easing.ease) }),
            withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ), -1, false);
        dotOpacity1.value = withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })), -1, false);
        dotOpacity2.value = withDelay(200, withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })), -1, false));
        dotOpacity3.value = withDelay(400, withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })), -1, false));
        return () => clearInterval(interval);
    }, []);

    const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));
    const progressStyle = useAnimatedStyle(() => ({ width: `${progressWidth.value}%` }));
    const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
    const dot1Style = useAnimatedStyle(() => ({ opacity: dotOpacity1.value }));
    const dot2Style = useAnimatedStyle(() => ({ opacity: dotOpacity2.value }));
    const dot3Style = useAnimatedStyle(() => ({ opacity: dotOpacity3.value }));

    const step = AI_ANALYSIS_STEPS[stepIndex];

    return (
        <Animated.View entering={FadeIn.duration(400)} style={styles.aiBannerContainer}>
            <Animated.View style={[styles.aiBannerGlow, glowStyle]} />
            <View style={styles.aiBannerContent}>
                <Animated.View style={[styles.aiBannerIconWrap, iconStyle]}>
                    <Text style={styles.aiBannerIcon}>{step.icon}</Text>
                </Animated.View>
                <View style={styles.aiBannerTextArea}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.aiBannerTitle}>{step.text}</Text>
                        <View style={{ flexDirection: 'row', marginLeft: 2, gap: 2 }}>
                            <Animated.View style={[styles.aiDot, dot1Style]} />
                            <Animated.View style={[styles.aiDot, dot2Style]} />
                            <Animated.View style={[styles.aiDot, dot3Style]} />
                        </View>
                    </View>
                    <Text style={styles.aiBannerSub}>{step.sub}</Text>
                </View>
            </View>
            <View style={{ marginTop: 12, height: 64, overflow: 'hidden', borderRadius: 8 }}>
                <View style={{ backgroundColor: Colors.surfaceMuted, borderRadius: 8, padding: 8, height: 64 }}>
                    <View style={styles.aiScanRow}>
                        <View style={[styles.aiScanBlock, { width: '35%' }]} />
                        <View style={[styles.aiScanBlock, { width: '20%' }]} />
                        <View style={[styles.aiScanBlock, { width: '15%', backgroundColor: 'rgba(239, 68, 68, 0.15)' }]} />
                    </View>
                    <View style={[styles.aiScanRow, { marginTop: 8 }]}>
                        <View style={[styles.aiScanBlock, { width: '25%' }]} />
                        <View style={[styles.aiScanBlock, { width: '30%' }]} />
                        <View style={[styles.aiScanBlock, { width: '10%', backgroundColor: 'rgba(34, 197, 94, 0.15)' }]} />
                    </View>
                    <ScanningLine />
                </View>
            </View>
            <View style={styles.aiProgressTrack}>
                <Animated.View style={[styles.aiProgressFill, progressStyle]} />
            </View>
            <Text style={styles.aiProgressLabel}>AI is compiling your ingredient insights</Text>
        </Animated.View>
    );
};

// Placeholder summary cards during analysis
const AnalyzingSummaryCards = () => {
    const shimmerPos = useSharedValue(0);
    useEffect(() => {
        shimmerPos.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, true);
    }, []);
    const shimmerStyle = useAnimatedStyle(() => ({
        opacity: interpolate(shimmerPos.value, [0, 0.5, 1], [0.4, 0.8, 0.4]),
    }));
    return (
        <View style={styles.summaryGrid}>
            {['Ingredients', 'Risks', 'Grade'].map((label, i) => (
                <Animated.View key={label} entering={FadeInDown.delay(i * 100)} style={styles.summaryCard}>
                    <Animated.View style={[{ width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceMuted, marginBottom: 4 }, shimmerStyle]} />
                    <Animated.Text style={[styles.summaryLabel, shimmerStyle]}>{label}</Animated.Text>
                </Animated.View>
            ))}
        </View>
    );
};

// ───────────────────────────────────────────────────
//  CONSTANTS & HELPERS
// ───────────────────────────────────────────────────
const CATEGORY_ICONS = {
    carcinogen: '☢️', endocrine_disruptor: '⚠️', neurotoxin: '🧠',
    irritant: '🔴', allergen: '🤧', safe: '✅',
};

function getRiskPillStyle(riskLevel, percent = null) {
    switch (riskLevel) {
        case 'high': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'high' };
        case 'moderate': return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', label: 'moderate' };
        case 'low': return { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', label: 'low' };
        case 'negligible':
            const labelText = (percent !== null && parseFloat(percent) >= 1) ? 'safe' : 'trace';
            return { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', label: labelText };
        default: return { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', label: riskLevel || 'unknown' };
    }
}

function getRiskIcon(riskLevel) {
    switch (riskLevel) {
        case 'high': return { name: 'warning', color: '#ef4444' };
        case 'moderate': return { name: 'alert-circle', color: '#f59e0b' };
        case 'low': return { name: 'checkbox', color: '#22c55e' };
        case 'negligible': return { name: 'checkmark-circle', color: '#94a3b8' };
        default: return { name: 'help-circle', color: '#94a3b8' };
    }
}

const TABS = ['Overview', 'Ingredients', 'Macros'];

function getGradeDescription(grade) {
    const descriptions = {
        A: { title: 'Excellent', desc: 'This product is very safe with minimal ingredient concerns.' },
        B: { title: 'Good', desc: 'Generally safe with minor ingredients to be aware of.' },
        C: { title: 'Moderate', desc: 'Some ingredients may pose risks. Review details below.' },
        D: { title: 'Concerning', desc: 'Contains multiple ingredients with known health risks.' },
        E: { title: 'Hazardous', desc: 'High concern. Several concerning ingredients detected.' },
    };
    return descriptions[grade] || descriptions.C;
}

const PersonalMascot = ({ grade }) => {
    let mascotSource;
    let message = "";
    
    if (grade === 'A' || grade === 'B') {
        mascotSource = require('../../assets/mascot_happy.png');
        message = grade === 'A' ? "Excellent choice! This is perfectly safe for you." : "Good find! Overall a safe bet.";
    } else if (grade === 'C') {
        mascotSource = require('../../assets/mascot_neutral.png');
        message = "A bit of a mixed bag. Check the ingredients below.";
    } else {
        mascotSource = require('../../assets/mascot_scared.png');
        message = grade === 'D' ? "I'm worried. There are concerning ingredients here!" : "STOP! This is highly hazardous. Do NOT use this.";
    }

    return (
        <Animated.View entering={FadeInDown.delay(300)} style={styles.mascotContainer}>
            <Image source={mascotSource} style={styles.mascotImg} />
            <View style={styles.mascotSpeechBubble}>
                 <View style={styles.mascotBubbleTail} />
                 <Text style={styles.mascotSpeechText}>{message}</Text>
            </View>
        </Animated.View>
    );
};

// Helpers for Open Data Badges
function getNutriScoreColor(score) {
    if (!score) return Colors.textMuted;
    const s = score.toLowerCase();
    if (s === 'a') return '#059669'; if (s === 'b') return '#84cc16';
    if (s === 'c') return '#eab308'; if (s === 'd') return '#f97316';
    if (s === 'e') return '#ef4444'; return Colors.textMuted;
}
function getNovaColor(group) {
    if (group === 1) return '#059669'; if (group === 2) return '#84cc16';
    if (group === 3) return '#eab308'; if (group === 4) return '#ef4444';
    return Colors.textMuted;
}
function getNovaDescription(group) {
    if (group === 1) return 'Unprocessed/minimally processed'; if (group === 2) return 'Processed culinary ingredients';
    if (group === 3) return 'Processed foods'; if (group === 4) return 'Ultra-processed foods';
    return 'Unknown processing level';
}
function getNutrientLevelColor(level) {
    if (!level) return { bg: 'transparent', text: Colors.textMuted };
    const l = level.toLowerCase();
    if (l === 'high') return { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' };
    if (l === 'moderate') return { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b' };
    if (l === 'low') return { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e' };
    return { bg: 'rgba(148, 163, 184, 0.1)', text: '#94a3b8' };
}

// ───────────────────────────────────────────────────
//  DONUT CHART COMPONENT (Pure RN — no SVG dep)
// ───────────────────────────────────────────────────
function getScoreColor(score) {
    if (score >= 80) return '#10b981'; // green
    if (score >= 60) return '#84cc16'; // lime
    if (score >= 40) return '#eab308'; // yellow
    if (score >= 20) return '#f97316'; // orange
    return '#ef4444'; // red
}

function getTypeIcon(type) {
    switch (type) {
        case 'goal': return '🎯';
        case 'disease': return '🛡️';
        case 'allergy': return '🤧';
        default: return '📊';
    }
}

const DonutChart = ({ score, size = 72 }) => {
    const animatedScore = useSharedValue(0);
    const color = getScoreColor(score);
    const strokeWidth = 7;

    useEffect(() => {
        animatedScore.value = withDelay(300, withTiming(score, { duration: 1000, easing: Easing.out(Easing.quad) }));
    }, [score]);

    const progress = Math.min(Math.max(score / 100, 0), 1);
    const rotation1 = Math.min(progress * 360, 180);
    const rotation2 = Math.max((progress * 360) - 180, 0);

    // Soft glow background color
    const glowBg = score >= 60 ? 'rgba(16, 185, 129, 0.08)' : score >= 40 ? 'rgba(234, 179, 8, 0.08)' : 'rgba(239, 68, 68, 0.08)';

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            {/* Soft glow circle */}
            <View style={{
                position: 'absolute', width: size + 8, height: size + 8, borderRadius: (size + 8) / 2,
                backgroundColor: glowBg,
            }} />
            {/* Track */}
            <View style={{
                position: 'absolute', width: size, height: size, borderRadius: size / 2,
                borderWidth: strokeWidth, borderColor: 'rgba(0,0,0,0.04)',
            }} />
            {/* Right half */}
            <View style={{ position: 'absolute', width: size, height: size, overflow: 'hidden' }}>
                <View style={{ position: 'absolute', width: size / 2, height: size, right: 0, overflow: 'hidden' }}>
                    <View style={{
                        width: size, height: size, borderRadius: size / 2,
                        borderWidth: strokeWidth, borderColor: color,
                        borderLeftColor: 'transparent', borderBottomColor: 'transparent',
                        transform: [{ rotate: `${rotation1 - 45}deg` }],
                        position: 'absolute', right: 0,
                    }} />
                </View>
            </View>
            {/* Left half */}
            {progress > 0.5 && (
                <View style={{ position: 'absolute', width: size, height: size, overflow: 'hidden' }}>
                    <View style={{ position: 'absolute', width: size / 2, height: size, left: 0, overflow: 'hidden' }}>
                        <View style={{
                            width: size, height: size, borderRadius: size / 2,
                            borderWidth: strokeWidth, borderColor: color,
                            borderRightColor: 'transparent', borderTopColor: 'transparent',
                            transform: [{ rotate: `${rotation2 - 45}deg` }],
                            position: 'absolute', left: 0,
                        }} />
                    </View>
                </View>
            )}
            {/* Center */}
            <Text style={{ fontSize: size * 0.24, fontWeight: '900', color }}>{score}%</Text>
        </View>
    );
};

// ── Category Score Card (Goals / Conditions / Allergies — compact, premium) ──
const CategoryScoreCard = ({ categoryName, icon, score, note, subItems, expanded, onToggle, ingredients, delay = 0 }) => {
    const color = getScoreColor(score);
    const donutSize = Math.min(SCREEN_WIDTH * 0.12, 48);

    return (
        <Animated.View entering={FadeInDown.delay(delay).springify().damping(18)} style={styles.scoreCard}>
            <TouchableOpacity onPress={onToggle} activeOpacity={0.75}>
                <View style={styles.scoreCardHeader}>
                    <DonutChart score={score} size={donutSize} />
                    <View style={{ flex: 1, marginLeft: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 16 }}>{icon}</Text>
                            <Text style={styles.scoreCardName} numberOfLines={1}>{categoryName}</Text>
                        </View>
                        <Text style={[styles.scoreCardType, { color }]}>
                            {score >= 70 ? 'GOOD COMPATIBILITY' : score >= 40 ? 'SOME CONCERNS' : 'NEEDS ATTENTION'}
                        </Text>
                    </View>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
                </View>
            </TouchableOpacity>
            {expanded && (
                <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} style={styles.scoreCardNote}>
                    {note && <Text style={styles.scoreCardNoteText}>{note}</Text>}
                    {subItems.map((name, idx) => {
                        const relIngredients = ingredients.filter(ing => ing.personalNote && ing.personalNote.toLowerCase().includes(name.toLowerCase()));
                        return (
                            <View key={`sub-${idx}`} style={{ marginTop: idx === 0 && note ? 10 : idx > 0 ? 6 : 0 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                                    <View style={styles.subDot} />
                                    <Text style={styles.subName}>{name}</Text>
                                </View>
                                {relIngredients.map((ing, i) => (
                                    <View key={`ri-${i}`} style={styles.subIngRow}>
                                        <View style={[styles.subIngDot, { backgroundColor: getRiskPillStyle(ing.riskLevel, ing.percent).color }]} />
                                        <Text style={styles.subIngText} numberOfLines={2}>{ing.name}{ing.personalNote ? `: ${ing.personalNote}` : ''}</Text>
                                    </View>
                                ))}
                            </View>
                        );
                    })}
                </Animated.View>
            )}
        </Animated.View>
    );
};


// ───────────────────────────────────────────────────
//  CELEBRATION COMPONENTS (Balloons & Confetti)
// ───────────────────────────────────────────────────
const FloatingBalloon = ({ delay, color }) => {
    const progress = useSharedValue(0);
    const startX = useMemo(() => Math.random() * (SCREEN_WIDTH - 40) + 20, []);
    const duration = useMemo(() => 4000 + Math.random() * 3000, []);
    const scale = useMemo(() => 0.6 + Math.random() * 0.8, []);
    const drift = useMemo(() => (Math.random() - 0.5) * 60, []);

    useEffect(() => {
        progress.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.quad) }));
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            position: 'absolute',
            transform: [
                { translateY: interpolate(progress.value, [0, 1], [SCREEN_HEIGHT + 50, -100]) },
                { translateX: startX + Math.sin(progress.value * 8) * drift },
                { scale },
                { rotate: `${Math.sin(progress.value * 6) * 15}deg` }
            ],
            opacity: interpolate(progress.value, [0, 0.1, 0.8, 1], [0, 1, 1, 0]),
        };
    });

    return (
        <Animated.View style={animatedStyle}>
            <Text style={{ fontSize: 34 }}>{color}</Text>
        </Animated.View>
    );
};

const BalloonCelebration = ({ visible }) => {
    if (!visible) return null;

    const balloonColors = ['🎈', '🎊', '✨', '🎈', '🎉'];

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {[...Array(12)].map((_, i) => (
                <FloatingBalloon
                    key={i}
                    delay={i * 300}
                    color={balloonColors[i % balloonColors.length]}
                />
            ))}
            <Animated.View 
                entering={ZoomIn.duration(800).springify().damping(12)} 
                style={styles.congratsOverlay}
            >
                <LinearGradient
                    colors={['#FFD700', '#FFA500']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.congratsBadge}
                >
                    <Ionicons name="trophy" size={24} color={Colors.white} />
                    <View style={{ marginLeft: 10 }}>
                        <Text style={styles.congratsTitle}>TOP CHOICE!</Text>
                        <Text style={styles.congratsSubText}>Perfectly safe for you</Text>
                    </View>
                </LinearGradient>
            </Animated.View>
        </View>
    );
};

// ═══════════════════════════════════════════════════
//  MAIN RESULT SCREEN
// ═══════════════════════════════════════════════════
export default function ResultScreen({ route, navigation }) {
    const { scanId, result: passedResult, imageUrl: passedImageUrl } = route.params || {};
    const { scanResult, isAnalyzing, healthPreferences, showMascot } = useStore();
    const profile = healthPreferences;

    const [result, setResult] = useState(passedResult || null);
    const [imageUrl, setImageUrl] = useState(passedImageUrl || null);
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(!passedResult);
    const [expandedItems, setExpandedItems] = useState({});
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    const [celebratedId, setCelebratedId] = useState(null);

    // ── BACKGROUND SCAN LISTENER ──
    // Use grade as the signal: grade stays '-' until AI completes
    const isBackgroundLoading = isAnalyzing && passedResult?.method === 'barcode' && (!result?.grade || result.grade === '-');

    useEffect(() => {
        if (!scanResult) return;
        // For barcode scans: only accept if barcodes match
        if (passedResult?.method === 'barcode') {
            if (passedResult?.barcode === scanResult.barcode) {
                setResult(scanResult);
                if (scanResult.imageUrl) setImageUrl(scanResult.imageUrl);
                // Show upgrade modal if rate limit was hit during background AI
                if (scanResult.upgradeRequired) {
                    setShowUpgradeModal(true);
                }
            }
        }
        // For ingredient scans: only accept if the scanResult is also an ingredient scan
        // (prevents stale barcode results from overwriting)
        else if (scanResult.method !== 'barcode') {
            setResult(scanResult);
            if (scanResult.imageUrl) setImageUrl(scanResult.imageUrl);
        }
    }, [scanResult, passedResult]);

    // Trigger celebration for A/B grades
    useEffect(() => {
        if (result && (result.grade === 'A' || result.grade === 'B') && !isBackgroundLoading && celebratedId !== result.id) {
            const resultId = result.id || 'current';
            setCelebratedId(resultId);
            
            let hideTimer;
            // Short delay to let the screen content settle
            const showTimer = setTimeout(() => {
                setShowCelebration(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                
                // Hide after a few seconds
                hideTimer = setTimeout(() => setShowCelebration(false), 6000);
            }, 500);
            
            return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
        }
    }, [result, isBackgroundLoading, celebratedId]);

    const toggleExpand = (key) => {
        setExpandedItems((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    // Score animation
    const pulseValue = useSharedValue(0.4);
    useEffect(() => {
        pulseValue.value = withRepeat(withTiming(0.8, { duration: 2000 }), -1, true);
    }, [result]);

    const pulseStyle = useAnimatedStyle(() => ({
        opacity: pulseValue.value * 0.1,
        transform: [{ scale: 1 + pulseValue.value * 0.1 }],
    }));

    // Load scan from DB if not passed
    useEffect(() => {
        if (!passedResult && scanId) loadScan();
    }, [scanId]);

    const loadScan = async () => {
        try {
            const { data, error } = await supabase.from('scans').select('*').eq('id', scanId).single();
            if (error) throw error;
            setResult({
                product_name: data.product_name,
                ingredients: data.ingredients || [],
                harmful_chemicals: data.harmful_chemicals || [],
                grade: data.grade,
                score: data.score,
                productType: data.scan_type || 'food',
                method: data.method || 'barcode',
                nutriscore: data.nutriscore,
                novaGroup: data.nova_group,
                macros: data.macros || null,
                nutrientLevels: data.nutrient_levels || null,
                healthScores: data.health_scores || [],
                allergens: data.allergens || [],
                additives: data.additives || [],
                traces: data.traces || [],
                micros: data.micros || null,
                ingredients_analysis_tags: data.ingredients_analysis_tags || data.ingredients_analysis || [],
            });
            setImageUrl(data.image_url);
        } catch (err) {
            console.error('Error loading scan:', err);
        } finally {
            setLoading(false);
        }
    };

    const availableTabs = useMemo(() => TABS.filter(t => t !== 'Macros' || (result?.productType === 'food' && result?.macros)), [result?.productType, result?.macros]);

    // Memoized allergen matching — avoids re-computation on every render
    const allergenData = useMemo(() => {
        const userAllergies = (healthPreferences?.allergens || healthPreferences?.allergies || [])
            .filter(a => a && a !== 'None')
            .map(a => a.toLowerCase().trim().replace(/-/g, ' '));
        const productAllergens = (result?.allergens || [])
            .map(a => a.toLowerCase().trim().replace(/-/g, ' '));
        if (productAllergens.length === 0) return null;
        // Don't show allergen banner if user hasn't set any allergies
        if (userAllergies.length === 0) return null;
        const matchedAllergens = productAllergens.filter(pa =>
            userAllergies.some(ua => pa.includes(ua) || ua.includes(pa))
        );
        return { hasMatch: matchedAllergens.length > 0, allergensList: result?.allergens || [] };
    }, [healthPreferences, result?.allergens]);

    if (loading) return <LoadingSpinner message="Loading results..." />;

    if (!result) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Could not load scan results.</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.errorBtn}>
                    <Text style={styles.errorBtnText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const grade = result.grade || 'C';
    const gradeColor = getGradeColor(grade);
    const gradeDesc = getGradeDescription(grade);
    const ingredients = result.ingredients || [];
    const harmfulChemicals = result.harmful_chemicals || result.harmfulChemicals || [];
    const healthScores = result.healthScores || [];

    const handleShare = async () => {
        try {
            const productName = result.product_name || result.productName || 'Scanned Product';
            const message = `Check out the safety scan for ${productName} on MedGPT! Grade: ${grade}. ${harmfulChemicals.length} ingredients of concern found.`;
            await Share.share({ message, title: 'MedGPT Result' });
        } catch (error) {
            console.log('Error sharing:', error);
        }
    };

    // ─────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────
    return (
        <View style={styles.container}>
            {/* Fixed Background Image */}
            {imageUrl ? (
                <View style={styles.heroWrap}>
                    <Image source={{ uri: imageUrl }} style={styles.heroImage} />
                    <View style={styles.heroOverlay} />
                </View>
            ) : (
                <Animated.View style={[styles.bgPulse, { backgroundColor: gradeColor }, pulseStyle]} pointerEvents="none" />
            )}

            {/* Absolute Header */}
            <View style={styles.absoluteHeader}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.circleBtn}>
                    <Ionicons name="arrow-back" size={20} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShare} style={styles.circleBtn}>
                    <Ionicons name="share-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={{ height: imageUrl ? 220 : 80 }} />

                <View style={styles.mainContent}>
                    {/* Medical Disclaimer Banner */}
                    <View style={{ backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="information-circle-outline" size={20} color="#F57C00" />
                        <Text style={{ fontSize: 12, color: '#E65100', marginLeft: 8, flex: 1, lineHeight: 16 }}>
                            Disclaimer: This analysis is AI-generated and not a substitute for professional medical advice. Always consult a healthcare provider.
                        </Text>
                    </View>
                    {/* Title */}
                    <View style={styles.titleSection}>
                        <Text style={styles.productTitle}>{result.product_name || result.productName || 'Scanned Product'}</Text>
                        <Text style={styles.productSubtitle}>Food & Cosmetic Analysis</Text>
                    </View>

                    {/* Trust Badges (vegan/non-vegan tags) */}
                    {(result.ingredients_analysis_tags?.length > 0) && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trustBadgesScroll}>
                            {result.ingredients_analysis_tags?.slice(0, 3).map((analysis, idx) => {
                                const isWarning = analysis.includes('non') || analysis.includes('unknown');
                                return (
                                    <View key={`analysis-${idx}`} style={[styles.trustBadge, { backgroundColor: isWarning ? '#FFF3E0' : '#E8F5E9', borderColor: isWarning ? '#FFB74D' : '#81C784' }]}>
                                        <Ionicons name={isWarning ? "warning" : "checkmark-circle"} size={12} color={isWarning ? '#F57C00' : '#2E7D32'} />
                                        <Text style={[styles.trustBadgeText, { color: isWarning ? '#F57C00' : '#2E7D32' }]}>{analysis.replace(/-/g, ' ').toUpperCase()}</Text>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    )}

                    {/* Instant Allergy Alert */}
                    {allergenData && (
                        <View style={[styles.allergyBanner, { backgroundColor: allergenData.hasMatch ? '#FEF2F2' : '#F8FAFC', borderColor: allergenData.hasMatch ? '#FECACA' : '#E2E8F0' }]}>
                            <Ionicons name="warning" size={24} color={allergenData.hasMatch ? '#DC2626' : '#64748B'} />
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text style={[styles.allergyBannerTitle, { color: allergenData.hasMatch ? '#B91C1C' : '#475569' }]}>
                                    {allergenData.hasMatch ? '⚠️ ALLERGY MATCH FOUND!' : 'CONTAINS ALLERGENS'}
                                </Text>
                                <Text style={[styles.allergyBannerSub, { color: allergenData.hasMatch ? '#DC2626' : '#64748B' }]}>
                                    {allergenData.allergensList.join(', ').replace(/-/g, ' ').toUpperCase()}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* A-E Grade Bar (no numeric score) */}
                    <View style={[styles.nutriScoreContainer, { marginTop: 3 }]}>
                        <Text style={styles.nutriTitle}>SAFETY GRADE/BUYING SCORE</Text>
                        <View style={[styles.gradesRow, { marginTop: 16 }]}>
                            {['A', 'B', 'C', 'D', 'E'].map(g => {
                                const isActive = g === grade && !isBackgroundLoading;
                                return (
                                    <View key={g} style={[styles.gradeBlock, { backgroundColor: getGradeColor(g), position: 'relative' }, isActive && styles.gradeBlockActive]}>
                                        <Text style={[styles.gradeBlockText, isActive && styles.gradeBlockTextActive]}>{g}</Text>
                                    </View>
                                );
                            })}
                        </View>
                        {isBackgroundLoading ? null : (
                            <>
                                <Text style={styles.gradeDescText}>{gradeDesc.desc}</Text>
                                {showMascot && <PersonalMascot grade={grade} />}
                            </>
                        )}
                    </View>

                    {/* AI Analysis Banner */}
                    {isBackgroundLoading && <AIAnalyzingBanner />}

                    {/* Open Data Badges (Food Only) */}
                    {result.productType === 'food' && (result.nutriscore || result.novaGroup) && (
                        <View style={styles.openDataBadgesRow}>
                            {result.nutriscore && (
                                <View style={[styles.odBadge, styles.odBadgeNutri, { flex: 1 }]}>
                                    <View style={[styles.odBadgeValueWrap, { backgroundColor: getNutriScoreColor(result.nutriscore) }]}>
                                        <Text style={styles.odBadgeValue}>{result.nutriscore.toUpperCase()}</Text>
                                    </View>
                                    <View style={styles.odBadgeTextCol}>
                                        <Text style={styles.odBadgeTitleText}>Nutri-Score {result.nutriscore.toUpperCase()}</Text>
                                    </View>
                                </View>
                            )}
                            {result.novaGroup && (
                                <View style={[styles.odBadge, styles.odBadgeNova, { flex: 1.2 }]}>
                                    <View style={styles.odBadgeNovaIconWrap}>
                                        <Text style={styles.odBadgeNovaLabel}>NOVA</Text>
                                        <View style={styles.odBadgeNovaInner}>
                                            <Text style={styles.odBadgeValue}>{result.novaGroup}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.odBadgeTextCol}>
                                        <Text style={[styles.odBadgeTitleText, { color: getNovaColor(result.novaGroup) }]} numberOfLines={2}>
                                            {getNovaDescription(result.novaGroup)}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    )}
                    


                    <View style={styles.tabsRow}>
                        {availableTabs.map((tab) => {
                            const originalIndex = TABS.indexOf(tab);
                            return (
                                <TouchableOpacity
                                    key={tab}
                                    onPress={() => setActiveTab(originalIndex)}
                                    style={[styles.tab, activeTab === originalIndex && styles.tabActive]}
                                >
                                    <Text style={[styles.tabText, activeTab === originalIndex && styles.tabTextActive]}>
                                        {tab}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* ═══ TAB 0: OVERVIEW ═══ */}
                    {activeTab === 0 && (
                        <Animated.View entering={FadeInDown}>
                            {isBackgroundLoading && <AnalyzingSummaryCards />}

                            {/* ── Health Score Category Cards (3 max: Goals, Conditions, Allergies) ── */}
                            {!isBackgroundLoading && (() => {
                                const prefs = healthPreferences || {};
                                const userGoals = (prefs.goals || []).filter(x => x && x !== 'None');
                                const userDiseases = (prefs.diseases || []).filter(x => x && x !== 'None');
                                const userAllergies = (prefs.allergens || prefs.allergies || []).filter(x => x && x !== 'None');

                                if (!userGoals.length && !userDiseases.length && !userAllergies.length) {
                                    return (
                                        <TouchableOpacity onPress={() => navigation.navigate('HealthPreferences')} activeOpacity={0.7} style={styles.healthCtaBanner}>
                                            <Ionicons name="heart-circle-outline" size={28} color={Colors.accent} />
                                            <View style={{ flex: 1, marginLeft: 12 }}>
                                                <Text style={styles.healthCtaTitle}>Personalize Your Results</Text>
                                                <Text style={styles.healthCtaSub}>Add your health goals, conditions & allergies</Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                                        </TouchableOpacity>
                                    );
                                }

                                const aiScores = result.healthScores || [];

                                // Match AI category scores
                                const findCatScore = (cat) => {
                                    const match = aiScores.find(s => s.category?.toLowerCase() === cat.toLowerCase());
                                    return { score: match?.score ?? 50, note: match?.note || null };
                                };

                                const categories = [];
                                if (userGoals.length) {
                                    const { score, note } = findCatScore('goals');
                                    categories.push({ key: 'goals', name: 'Your Goals', icon: '🎯', score, note, subItems: userGoals });
                                }
                                if (userDiseases.length) {
                                    const { score, note } = findCatScore('conditions');
                                    categories.push({ key: 'conditions', name: 'Health Conditions', icon: '🛡️', score, note, subItems: userDiseases });
                                }
                                if (userAllergies.length) {
                                    const { score, note } = findCatScore('allergies');
                                    categories.push({ key: 'allergies', name: 'Allergies & Sensitivities', icon: '🤧', score, note, subItems: userAllergies });
                                }

                                return (
                                    <View style={styles.section}>
                                        <Text style={styles.sectionTitle}>🎯 Your Health Scores</Text>
                                        <View style={styles.healthScoresGrid}>
                                            {categories.map((cat, idx) => (
                                                <CategoryScoreCard
                                                    key={cat.key}
                                                    categoryName={cat.name}
                                                    icon={cat.icon}
                                                    score={cat.score}
                                                    note={cat.note}
                                                    subItems={cat.subItems}
                                                    expanded={expandedItems[`cat-${cat.key}`]}
                                                    onToggle={() => toggleExpand(`cat-${cat.key}`)}
                                                    ingredients={ingredients}
                                                    delay={80 + idx * 100}
                                                />
                                            ))}
                                        </View>
                                    </View>
                                );
                            })()}

                            {/* ── Chemicals of Concern ── */}
                            {harmfulChemicals.length > 0 && !isBackgroundLoading && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>⚠️ Chemicals of Concern</Text>
                                    {harmfulChemicals.map((chem, i) => {
                                        const risk = getRiskPillStyle(chem.riskLevel, chem.percent);
                                        const icon = getRiskIcon(chem.riskLevel);
                                        return (
                                            <Animated.View
                                                key={`concern-${chem.name || i}-${i}`}
                                                entering={FadeInDown.delay(100 + i * 80)}
                                                layout={LinearTransition.springify().mass(0.6)}
                                                style={styles.minimalCard}
                                            >
                                                <TouchableOpacity onPress={() => toggleExpand(`concern-${i}`)} activeOpacity={0.7} style={styles.minimalCardHeader}>
                                                    <Ionicons name={icon.name} size={22} color={icon.color} style={styles.ingredientCheckIcon} />
                                                    <View style={{ flex: 1, paddingHorizontal: 12 }}>
                                                        <Text style={styles.ingredientNameText}>{chem.name}</Text>
                                                        <Text style={styles.ingredientStatusText}>{(chem.category || '').replace('_', ' ')}</Text>
                                                    </View>
                                                    <View style={[styles.riskPill, { backgroundColor: risk.bg }]}>
                                                        <Text style={[styles.riskPillText, { color: risk.color }]}>{risk.label}</Text>
                                                    </View>
                                                    <Ionicons name={expandedItems[`concern-${i}`] ? "chevron-up" : "chevron-down"} size={20} color={Colors.textMuted} style={{ marginLeft: 8 }} />
                                                </TouchableOpacity>

                                                {expandedItems[`concern-${i}`] && (
                                                    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.expandedContent}>
                                                        {chem.explanation ? <Text style={styles.detailRisk}>{chem.explanation}</Text> : null}
                                                        {chem.contextualNote && (
                                                            <View style={styles.dosageWrap}>
                                                                <Ionicons name="flask-outline" size={14} color={Colors.textSecondary} />
                                                                <Text style={styles.dosageText}>{chem.contextualNote}</Text>
                                                            </View>
                                                        )}
                                                        {chem.personalNote && (
                                                            <View style={[styles.dosageWrap, { backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}>
                                                                <Ionicons name="person-circle-outline" size={14} color={Colors.danger} />
                                                                <Text style={[styles.dosageText, { color: Colors.danger }]}>{chem.personalNote}</Text>
                                                            </View>
                                                        )}
                                                        {chem.regulatoryStatus && (
                                                            <View style={styles.dosageWrap}>
                                                                <Ionicons name="shield-checkmark-outline" size={14} color={Colors.textSecondary} />
                                                                <Text style={styles.dosageText}>{chem.regulatoryStatus}</Text>
                                                            </View>
                                                        )}
                                                        {chem.citation && (
                                                            <View style={styles.dosageWrap}>
                                                                <Ionicons name="library-outline" size={14} color={Colors.textSecondary} />
                                                                <Text style={styles.dosageText}>{chem.citation}</Text>
                                                            </View>
                                                        )}
                                                    </Animated.View>
                                                )}
                                            </Animated.View>
                                        );
                                    })}
                                </View>
                            )}

                            {/* No concerns — safe message */}
                            {harmfulChemicals.length === 0 && !isBackgroundLoading && (
                                <View style={styles.emptyTab}>
                                    <View style={[styles.emptyIconWrap, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                                        <Ionicons name="shield-checkmark" size={40} color="#22C55E" />
                                    </View>
                                    <Text style={styles.emptyTabTitle}>No chemicals of concern!</Text>
                                    <Text style={styles.emptyTabText}>This product appears to be safe.</Text>
                                </View>
                            )}

                            <TouchableOpacity onPress={handleShare} activeOpacity={0.8}>
                                <Animated.View entering={ZoomIn.delay(500)} style={styles.shareBtnLarge}>
                                    <Ionicons name="share-social" size={20} color={Colors.white} />
                                    <Text style={styles.shareBtnTextLarge}>Share Result Ticket</Text>
                                </Animated.View>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    {/* ═══ TAB 1: INGREDIENTS (Full Label) ═══ */}
                    {activeTab === 1 && (
                        <Animated.View entering={FadeInDown}>
                            {isBackgroundLoading ? (
                                <View style={{ paddingTop: 8 }}>
                                    <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
                                </View>
                            ) : ingredients.length === 0 ? (
                                <View style={styles.emptyTab}>
                                    <Text style={styles.emptyTabTitle}>No ingredients parsed</Text>
                                </View>
                            ) : (
                                <View style={{ paddingTop: 8 }}>
                                    {ingredients.map((ing, i) => {
                                        const name = typeof ing === 'string' ? ing : ing.name;
                                        const riskLevel = typeof ing === 'string' ? 'low' : (ing.riskLevel || 'low');
                                        const risk = getRiskPillStyle(riskLevel, typeof ing === 'string' ? null : ing.percent);
                                        const icon = getRiskIcon(riskLevel);
                                        const isFlagged = riskLevel === 'high' || riskLevel === 'moderate';
                                        const statusLabel = riskLevel === 'high' ? 'Concerning' : riskLevel === 'moderate' ? 'Moderate' : 'Safe';

                                        return (
                                            <Animated.View entering={FadeInDown.delay(i * 30)} key={`ing-${name || i}-${i}`} style={styles.minimalCard}>
                                                <TouchableOpacity
                                                    onPress={isFlagged ? () => toggleExpand(`ing-${i}`) : undefined}
                                                    activeOpacity={isFlagged ? 0.7 : 1}
                                                    style={styles.minimalCardHeader}
                                                >
                                                    <Ionicons name={icon.name} size={22} color={icon.color} style={styles.ingredientCheckIcon} />
                                                    <View style={{ flex: 1, paddingHorizontal: 12 }}>
                                                        <Text style={styles.ingredientNameText}>{name}</Text>
                                                        <Text style={styles.ingredientStatusText}>
                                                            {statusLabel}{ing.percent ? ` · ${ing.percent}%` : ''}
                                                        </Text>
                                                    </View>
                                                    <View style={[styles.riskPill, { backgroundColor: risk.bg }]}>
                                                        <Text style={[styles.riskPillText, { color: risk.color }]}>{risk.label}</Text>
                                                    </View>
                                                    {isFlagged && (
                                                        <Ionicons name={expandedItems[`ing-${i}`] ? "chevron-up" : "chevron-down"} size={18} color={Colors.textMuted} style={{ marginLeft: 6 }} />
                                                    )}
                                                </TouchableOpacity>

                                                {/* Only moderate/high get expanded details */}
                                                {isFlagged && expandedItems[`ing-${i}`] && (
                                                    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.expandedContent}>
                                                        {ing.explanation ? <Text style={styles.detailRisk}>{ing.explanation}</Text> : null}
                                                        {ing.personalNote && (
                                                            <View style={[styles.dosageWrap, { backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}>
                                                                <Ionicons name="person-circle-outline" size={14} color={Colors.danger} />
                                                                <Text style={[styles.dosageText, { color: Colors.danger }]}>{ing.personalNote}</Text>
                                                            </View>
                                                        )}
                                                        {ing.regulatoryStatus && (
                                                            <View style={styles.dosageWrap}>
                                                                <Ionicons name="shield-checkmark-outline" size={14} color={Colors.textSecondary} />
                                                                <Text style={styles.dosageText}>{ing.regulatoryStatus}</Text>
                                                            </View>
                                                        )}
                                                        {ing.citation && (
                                                            <View style={styles.dosageWrap}>
                                                                <Ionicons name="library-outline" size={14} color={Colors.textSecondary} />
                                                                <Text style={styles.dosageText}>{ing.citation}</Text>
                                                            </View>
                                                        )}
                                                    </Animated.View>
                                                )}
                                            </Animated.View>
                                        );
                                    })}

                                    {/* Allergens */}
                                    {result.allergens && result.allergens.length > 0 && (
                                        <View style={styles.additivesSection}>
                                            <Text style={styles.sectionTitle}>🤧 Allergens</Text>
                                            <View style={styles.additivesWrap}>
                                                {result.allergens.map((tag, i) => (
                                                    <View key={i} style={[styles.additiveTag, { borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }]}>
                                                        <Text style={[styles.additiveTagText, { color: '#ef4444' }]}>{tag.replace('en:', '').toUpperCase()}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}

                                    {/* Traces */}
                                    {result.traces && result.traces.length > 0 && (
                                        <View style={styles.additivesSection}>
                                            <Text style={styles.sectionTitle}>⚠️ May Contain (Traces)</Text>
                                            <View style={styles.additivesWrap}>
                                                {result.traces.map((tag, i) => {
                                                    const cleanTag = tag.replace('en:', '').toLowerCase();
                                                    const matchesProfile = [...(profile?.allergies || []), ...(profile?.customAllergies || [])]
                                                        .some(a => cleanTag.includes(a.toLowerCase()));
                                                    const color = matchesProfile ? '#ef4444' : '#f97316';
                                                    const bgColor = matchesProfile ? 'rgba(239, 68, 68, 0.05)' : 'rgba(249, 115, 22, 0.05)';
                                                    const borderColor = matchesProfile ? 'rgba(239, 68, 68, 0.3)' : 'rgba(249, 115, 22, 0.3)';

                                                    return (
                                                        <View key={`trace-${i}`} style={[styles.additiveTag, { borderColor, backgroundColor: bgColor }]}>
                                                            <Text style={[styles.additiveTagText, { color }]}>{cleanTag.toUpperCase()}</Text>
                                                        </View>
                                                    )
                                                })}
                                            </View>
                                        </View>
                                    )}

                                    {/* Additives */}
                                    {result.additives && result.additives.length > 0 && (
                                        <View style={styles.additivesSection}>
                                            <Text style={styles.sectionTitle}>🧪 Additives</Text>
                                            <View style={styles.additivesWrap}>
                                                {result.additives.map((tag, i) => (
                                                    <View key={i} style={styles.additiveTag}>
                                                        <Text style={styles.additiveTagText}>{tag.replace('en:', '').toUpperCase()}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                </View>
                            )}
                        </Animated.View>
                    )}

                    {/* ═══ TAB 2: MACROS (Food Only) ═══ */}
                    {activeTab === 2 && result.macros && (
                        <Animated.View entering={FadeInDown}>
                            <Text style={styles.macrosSubtitle}>Nutrition values per 100g / 100ml</Text>
                            <View style={styles.macrosGrid}>
                                {[
                                    { label: 'Calories', value: result.macros?.calories, unit: 'kcal', level: null },
                                    { label: 'Protein', value: result.macros?.protein, unit: 'g', level: null },
                                    { label: 'Carbs', value: result.macros?.carbs, unit: 'g', level: null },
                                    { label: 'Sugar', value: result.macros?.sugar, unit: 'g', level: result.nutrientLevels?.sugars },
                                    { label: 'Fats', value: result.macros?.fats, unit: 'g', level: result.nutrientLevels?.fat },
                                    { label: 'Sat Fat', value: result.macros?.saturatedFat, unit: 'g', level: result.nutrientLevels?.['saturated-fat'] },
                                    { label: 'Salt', value: result.macros?.salt, unit: 'g', level: result.nutrientLevels?.salt },
                                    { label: 'Fiber', value: result.macros?.fiber, unit: 'g', level: null },
                                ].filter(m => m.value != null).map((m, i) => (
                                    <Animated.View key={m.label} entering={FadeInDown.delay(i * 30)} style={styles.macroCard}>
                                        <Text style={styles.macroValue}>{m.value} <Text style={{ fontSize: 12, fontWeight: '600' }}>{m.unit}</Text></Text>
                                        <Text style={styles.macroLabel}>{m.label}</Text>
                                        {m.level && (
                                            <View style={[styles.nutrientLevelPill, { backgroundColor: getNutrientLevelColor(m.level).bg }]}>
                                                <Text style={[styles.nutrientLevelText, { color: getNutrientLevelColor(m.level).text }]}>
                                                    {m.level}
                                                </Text>
                                            </View>
                                        )}
                                    </Animated.View>
                                ))}
                            </View>

                            {/* Micros (Vitamins & Minerals) */}
                            {result.micros && Object.keys(result.micros).length > 0 && (
                                <View style={[styles.section, { marginTop: -10, paddingBottom: 20 }]}>
                                    <TouchableOpacity 
                                        onPress={() => toggleExpand('micros')}
                                        style={styles.microsToggleBtn}
                                    >
                                        <Text style={styles.microsToggleText}>Vitamins {"&"} Minerals</Text>
                                        <Ionicons name={expandedItems.micros ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primary} style={{ marginLeft: 6 }} />
                                    </TouchableOpacity>
                                    
                                    {expandedItems.micros && (
                                        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                                                {Object.entries(result.micros).filter(([_, val]) => val !== null && val > 0).map(([key, val], i) => {
                                                    let unit = ' mg';
                                                    let displayVal = val;

                                                    // OpenFoodFacts returns `_100g` fields in grams representing the value per 100g.
                                                    if (val < 0.0001) {       
                                                        // less than 0.1 mg -> show as µg
                                                        unit = ' µg';
                                                        displayVal = Math.round(val * 1000000 * 10) / 10;
                                                    } else if (val < 1) {   
                                                        // less than 1 g -> show as mg
                                                        unit = ' mg';
                                                        displayVal = Math.round(val * 1000 * 10) / 10;
                                                    } else {
                                                        // val >= 1: likely either already in mg (fallback via `_value`) or actually > 1g. Default to mg for micros as 1+ gram is massive for vitamins, so it was probably a raw mg value.
                                                        unit = ' mg';
                                                        displayVal = Math.round(val * 10) / 10;
                                                    }
                                                    
                                                    let label = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
                                                    label = label.charAt(0).toUpperCase() + label.slice(1);
                                                    
                                                    return (
                                                        <Animated.View key={`micro-${key}`} entering={FadeInDown.delay(i * 30)} style={[styles.macroCard, { width: '30%', padding: 10, paddingVertical: 12 }]}>
                                                            <Text style={[styles.macroValue, { fontSize: 13 }]} numberOfLines={1}>{displayVal}<Text style={{fontSize: 10, fontWeight: '600'}}>{unit}</Text></Text>
                                                            <Text style={[styles.macroLabel, { fontSize: 10, marginTop: 2, textAlign: 'center' }]} numberOfLines={2}>{label}</Text>
                                                        </Animated.View>
                                                    );
                                                })}
                                            </View>
                                        </Animated.View>
                                    )}
                                </View>
                            )}
                        </Animated.View>
                    )}

                    <Text style={styles.disclaimerText}>
                        Ingredient insights are based on publicly available research and regulatory references.
                        This information is provided for educational purposes only and does not constitute medical advice.
                    </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Feedback')} style={styles.resultFeedbackBtn}>
                        <Text style={styles.resultFeedbackText}>Is something wrong? Report results</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <BalloonCelebration visible={showCelebration} />

            {/* ═══ Premium "Upgrade Required" Modal (Rate Limit Hit during Background AI) ═══ */}
            <Modal transparent={true} visible={showUpgradeModal} animationType="none" onRequestClose={() => {
                setShowUpgradeModal(false);
            }}>
                <View style={styles.modalOverlay}>
                    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
                        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => {
                            setShowUpgradeModal(false);
                        }}>
                            <LinearGradient colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']} style={StyleSheet.absoluteFill} />
                        </TouchableOpacity>
                    </Animated.View>
                    <Animated.View entering={SlideInDown.springify().damping(16).stiffness(100)} exiting={SlideOutDown.duration(200)} style={styles.notFoundModalCard}>
                        <View style={styles.dragIndicator} />

                        <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.12)', marginBottom: 16 }]}>
                            <Ionicons name="trending-up" size={32} color="#f59e0b" />
                        </View>

                        <Text style={[styles.modalTitle, { fontSize: 24 }]}>We're Overwhelmed!</Text>
                        <Text style={[styles.modalDesc, { fontSize: 15, lineHeight: 23, marginBottom: 8 }]}>
                            Thousands of families are scanning right now to protect their loved ones.
                        </Text>
                        <Text style={[styles.modalDesc, { fontSize: 14, color: '#94a3b8', marginBottom: 24 }]}>
                            Pro members get priority access — even during peak hours. Join them and never miss a scan.
                        </Text>

                        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.8} onPress={() => {
                            setShowUpgradeModal(false);
                            posthog.capture('upgrade_modal_cta_tapped', { trigger: 'server_block_result' });
                            navigation.navigate('Paywall');
                        }}>
                            <LinearGradient colors={['#0f172a', '#1e293b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryButtonGradient}>
                                <Ionicons name="shield-checkmark" size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.primaryButtonText}>Protect Your Family Now</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.secondaryButton} onPress={() => {
                            setShowUpgradeModal(false);
                        }}>
                            <Text style={styles.secondaryButtonText}>Maybe Later</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
}

// ═══════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background, position: 'relative' },
    bgPulse: { position: 'absolute', top: -100, left: -100, right: -100, height: 600, borderRadius: 300 },
    scroll: { paddingBottom: 0 },

    // ── Premium Modals ──
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    notFoundModalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: Radii.xl, borderTopRightRadius: Radii.xl, padding: 24, paddingBottom: 40, alignItems: 'center', ...Shadows.elevated },
    dragIndicator: { width: 40, height: 5, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 3, marginBottom: 20 },
    iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
    modalTitle: { fontSize: 22, fontWeight: '800', color: Colors.primary, textAlign: 'center', marginBottom: 12 },
    modalDesc: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
    primaryButton: { width: '100%', borderRadius: Radii.button, overflow: 'hidden', marginBottom: 12 },
    primaryButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
    primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    secondaryButton: { paddingVertical: 12, width: '100%', alignItems: 'center' },
    secondaryButtonText: { color: Colors.textMuted, fontSize: 15, fontWeight: '600' },

    // Header / Image Overlay
    heroWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: 350 },
    heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.1)' },

    absoluteHeader: {
        position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, left: 20, right: 20,
        flexDirection: 'row', justifyContent: 'space-between', zIndex: 10,
    },
    circleBtn: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white,
        alignItems: 'center', justifyContent: 'center', ...Shadows.card,
    },

    // Main Rounded Content
    mainContent: {
        backgroundColor: Colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32,
        paddingTop: 20, minHeight: 600, paddingBottom: 60,
    },

    // Title Section
    titleSection: { alignItems: 'center', marginBottom: 14 },
    productTitle: { fontSize: 20, fontWeight: '800', color: Colors.primary, textAlign: 'center', marginBottom: 2, paddingHorizontal: 20 },
    productSubtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginBottom: 6 },

    // Trust Badges
    trustBadgesScroll: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 6, gap: 8 },
    trustBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight, gap: 6 },
    trustBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.text },

    // Allergy Banner
    allergyBanner: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1.5, marginBottom: 12, marginHorizontal: 20 },
    allergyBannerTitle: { fontSize: 13, fontWeight: '800' },
    allergyBannerSub: { fontSize: 11, fontWeight: '700', marginTop: 2 },

    // Grade Bar
    nutriScoreContainer: {
        marginHorizontal: 20, padding: 14, backgroundColor: Colors.surface,
        borderRadius: Radii.card, marginBottom: 12, ...Shadows.card, borderWidth: 1, borderColor: Colors.borderLight,
    },
    nutriTitle: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 1.5, marginBottom: 8 },
    gradesRow: { flexDirection: 'row', gap: 5, marginBottom: 8 },
    gradeBlock: { flex: 1, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', opacity: 0.35 },
    gradeBlockActive: { opacity: 1, transform: [{ scale: 1.12 }], zIndex: 2, ...Shadows.elevated },
    gradeBlockText: { fontSize: 15, fontWeight: '900', color: Colors.white },
    gradeBlockTextActive: { fontSize: 18 },
    gradeDescText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
    
    // Mascot Styling
    mascotContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        backgroundColor: Colors.surface,
        borderRadius: Radii.card,
        marginTop: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        ...Shadows.soft,
    },
    mascotImg: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.surfaceMuted,
    },
    mascotSpeechBubble: {
        flex: 1,
        marginLeft: 18,
        backgroundColor: '#F1F5F9',
        padding: 12,
        borderRadius: 14,
        position: 'relative',
    },
    mascotBubbleTail: {
        position: 'absolute',
        top: 20,
        left: -8,
        width: 16,
        height: 16,
        backgroundColor: '#F1F5F9',
        transform: [{ rotate: '45deg' }],
    },
    mascotSpeechText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.primary,
        lineHeight: 18,
    },

    // Open Data Badges
    openDataBadgesRow: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 10 },
    odBadge: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 10, borderRadius: Radii.card, alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1, ...Shadows.card },
    odBadgeNutri: { borderColor: 'rgba(234, 179, 8, 0.3)', backgroundColor: '#fffdf6' },
    odBadgeNova: { borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: '#fff5f5' },
    odBadgeValueWrap: { width: 36, height: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    odBadgeValue: { fontSize: 18, fontWeight: '900', color: Colors.white },
    odBadgeTextCol: { flex: 1, marginLeft: 10, justifyContent: 'center' },
    odBadgeTitleText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
    odBadgeNovaIconWrap: { width: 36, height: 36, backgroundColor: '#ef4444', borderRadius: 4, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 3 },
    odBadgeNovaLabel: { fontSize: 7, fontWeight: '800', color: Colors.white, marginBottom: 1 },
    odBadgeNovaInner: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },

    // Tabs
    tabsRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 10, backgroundColor: Colors.surfaceMuted, borderRadius: Radii.pill, padding: 3 },
    tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radii.pill },
    tabActive: { backgroundColor: Colors.surface, ...Shadows.card },
    tabText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
    tabTextActive: { color: Colors.primary },

    // Summary
    summaryGrid: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 12 },
    summaryCard: { flex: 1, padding: 14, backgroundColor: Colors.surfaceElevated, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center' },
    summaryValue: { fontSize: 20, fontWeight: '900', color: Colors.primary },
    summaryLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 3, textAlign: 'center' },

    // Section
    section: { marginHorizontal: 20, marginBottom: 10 },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.primary, marginBottom: 8 },

    // Health Scores Grid
    healthScoresGrid: { gap: 6 },
    scoreCard: {
        padding: 12, backgroundColor: Colors.surface, borderRadius: 14,
        borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    },
    scoreCardHeader: { flexDirection: 'row', alignItems: 'center' },
    scoreCardIcon: { fontSize: 16, marginBottom: 2 },
    scoreCardName: { fontSize: 14, fontWeight: '800', color: Colors.primary },
    scoreCardType: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginTop: 1, letterSpacing: 0.5 },
    scoreCardNote: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' },
    scoreCardNoteText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
    subItemRow: {},
    subDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent, marginRight: 10 },
    subName: { fontSize: 13, fontWeight: '700', color: Colors.primary },
    subIngRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 3, marginLeft: 20 },
    subIngDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5, marginRight: 8 },
    subIngText: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16, flex: 1 },

    // Health CTA Banner
    healthCtaBanner: {
        flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 16,
        padding: 14, backgroundColor: Colors.surface, borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(14, 165, 233, 0.15)',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    },
    healthCtaTitle: { fontSize: 14, fontWeight: '800', color: Colors.primary },
    healthCtaSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

    // Relevant Ingredients (used in Chemicals of Concern)
    relevantIngRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 },
    relevantIngDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, marginRight: 10 },
    relevantIngName: { fontSize: 13, fontWeight: '700', color: Colors.primary },
    relevantIngNote: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, marginTop: 2 },

    // Ingredient Cards
    minimalCard: { marginHorizontal: 20, marginBottom: 12, padding: 16, backgroundColor: Colors.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.borderLight },
    minimalCardHeader: { flexDirection: 'row', alignItems: 'center' },
    ingredientCheckIcon: { marginTop: 2 },
    ingredientNameText: { fontSize: 16, fontWeight: '800', color: Colors.primary, marginBottom: 2 },
    ingredientStatusText: { fontSize: 13, color: Colors.textSecondary, textTransform: 'capitalize' },
    riskPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radii.pill },
    riskPillText: { fontSize: 12, fontWeight: '800', textTransform: 'lowercase' },

    expandedContent: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.borderLight },
    detailRisk: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginBottom: 12 },
    dosageWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radii.sm, alignSelf: 'flex-start', marginBottom: 8 },
    dosageText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginLeft: 6 },

    disclaimerText: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginHorizontal: 30, marginTop: 12, marginBottom: 20, lineHeight: 16 },

    // Macros
    macrosSubtitle: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center', marginBottom: 16, marginTop: -4 },
    macrosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginHorizontal: 20, paddingBottom: 20 },
    macroCard: { width: '48%', padding: 16, backgroundColor: Colors.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center' },
    macroValue: { fontSize: 18, fontWeight: '800', color: Colors.primary },
    macroLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginTop: 4 },
    nutrientLevelPill: { marginTop: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    nutrientLevelText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

    // Micros toggle button
    microsToggleBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 12, marginHorizontal: 20, marginBottom: 12,
        backgroundColor: Colors.surface, borderRadius: Radii.md,
        borderWidth: 1, borderColor: 'rgba(14, 165, 233, 0.2)',
        ...Shadows.card
    },
    microsToggleText: { fontSize: 14, fontWeight: '700', color: Colors.primary },

    // Allergens / Additives
    additivesSection: { marginHorizontal: 20, marginTop: 8, paddingBottom: 20 },
    additivesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 16 },
    additiveTag: { backgroundColor: Colors.surfaceMuted, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1, borderColor: Colors.borderLight },
    additiveTagText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },

    // Empty tab
    emptyTab: { alignItems: 'center', paddingVertical: 40 },
    emptyIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTabTitle: { fontSize: 16, fontWeight: '700', color: Colors.primary, marginTop: 8 },
    emptyTabText: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },

    // Error
    errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
    errorText: { fontSize: 16, color: Colors.textSecondary, marginBottom: 16 },
    errorBtn: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: Colors.accent, borderRadius: Radii.button },
    errorBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },

    // Share Button
    shareBtnLarge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 14, marginHorizontal: 20, marginBottom: 20, borderRadius: Radii.button, ...Shadows.elevated },
    shareBtnTextLarge: { fontSize: 16, fontWeight: '800', color: Colors.white },
    resultFeedbackBtn: { marginTop: 8, marginBottom: 40, alignItems: 'center' },
    resultFeedbackText: { fontSize: 12, color: Colors.textMuted, textDecorationLine: 'underline', fontStyle: 'italic' },

    // ── AI Analyzing Banner ──
    aiBannerContainer: {
        marginHorizontal: 20, marginBottom: 20, padding: 20,
        backgroundColor: Colors.surface, borderRadius: Radii.card,
        borderWidth: 1, borderColor: 'rgba(14, 165, 233, 0.2)',
        overflow: 'hidden', ...Shadows.card,
    },
    aiBannerGlow: {
        position: 'absolute', top: -40, right: -40, width: 120, height: 120,
        borderRadius: 60, backgroundColor: 'rgba(14, 165, 233, 0.12)',
    },
    aiBannerContent: { flexDirection: 'row', alignItems: 'center' },
    aiBannerIconWrap: {
        width: 52, height: 52, borderRadius: 16,
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
        alignItems: 'center', justifyContent: 'center', marginRight: 14,
    },
    aiBannerIcon: { fontSize: 26 },
    aiBannerTextArea: { flex: 1 },
    aiBannerTitle: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginBottom: 2 },
    aiBannerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
    aiDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.accent },
    aiScanRow: { flexDirection: 'row', gap: 8 },
    aiScanBlock: { height: 16, borderRadius: 4, backgroundColor: 'rgba(14, 165, 233, 0.08)' },
    aiProgressTrack: { height: 4, backgroundColor: Colors.surfaceMuted, borderRadius: 2, marginTop: 16, overflow: 'hidden' },
    aiProgressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 2 },
    aiProgressLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, textAlign: 'center', marginTop: 10 },

    // Congrats Overlay
    congratsOverlay: {
        position: 'absolute',
        top: '25%',
        alignSelf: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    congratsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderRadius: 20,
        ...Shadows.elevated,
    },
    congratsTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: Colors.white,
        letterSpacing: 1,
    },
    congratsSubText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.white,
        opacity: 0.9,
    },
});