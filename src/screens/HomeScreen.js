import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Platform,
} from 'react-native';
import Animated, {
    FadeInDown,
    FadeInUp,
    ZoomIn,
    FadeIn,
    withSpring,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    withDelay,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme';
import useStore from '../store/useStore';
import GuestAuthModal from '../components/GuestAuthModal';
import { getLevelInfo } from '../utils/levelInfo';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getWeekDays() {
    const today = new Date();
    const days = [];
    for (let i = -3; i <= 3; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        days.push({
            label: DAYS[d.getDay()],
            date: d.getDate(),
            fullDate: new Date(d),  // store full Date for filtering
            isToday: i === 0,
            isPast: i < 0,
            isFuture: i > 0,
        });
    }
    return days;
}

// getLevelInfo imported from utils/levelInfo.js

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

function getGradeGradient(grade) {
    const colors = {
        A: ['#22c55e', '#16a34a'],
        B: ['#84cc16', '#65a30d'],
        C: ['#eab308', '#ca8a04'],
        D: ['#f97316', '#ea580c'],
        E: ['#ef4444', '#dc2626'],
    };
    return colors[grade] || colors.C;
}

const MAX_RECENT_SCANS = 5;

export default function HomeScreen({ navigation }) {
    const { user, profile, scanHistory, scanHistoryByDate, fetchScanHistory, canScan, getRemainingScans, loading, isGuestMode, appSettings, medicalReports, fetchMedicalReports } =
        useStore();
    const weekDays = getWeekDays();
    const level = getLevelInfo(profile?.level_xp || 0);
    const greeting = getGreeting();
    const firstName =
        isGuestMode && !user ? 'there' :
            user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

    // Calendar day selection state — defaults to today
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showGuestAuth, setShowGuestAuth] = useState(false);

    useFocusEffect(
        useCallback(() => {
            if (user) {
                fetchScanHistory();
                fetchMedicalReports();
            }
            // Auto-open scanner for new signups who just dismissed PostAuthPaywall
            const store = useStore.getState();
            if (store.pendingFirstScan) {
                store.setPendingFirstScan(false);
                setTimeout(() => navigation.navigate('Chat', { openUploadModal: true }), 300);
            }
        }, [user])
    );

    // O(1) lookup: scans for the selected day
    const selectedDayScans = useMemo(() => {
        const key = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
        return scanHistoryByDate[key] || [];
    }, [scanHistoryByDate, selectedDate]);

    // O(1) lookup: today's scans for the daily progress bar
    const todayScans = useMemo(() => {
        const now = new Date();
        const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
        return scanHistoryByDate[key] || [];
    }, [scanHistoryByDate]);

    const isSelectedToday = selectedDate.toDateString() === new Date().toDateString();

    // Merge recent scans + medical reports, sorted by date, limited to 3
    const recentInsights = useMemo(() => {
        const scanItems = (scanHistory || []).slice(0, 5).map(s => ({
            id: s.id,
            type: 'scan',
            title: s.product_name || 'Medical Scan',
            date: s.created_at,
            data: s,
        }));
        const reportItems = (medicalReports || []).slice(0, 5).map(r => ({
            id: r.id,
            type: 'report',
            title: r.title || r.report_type || 'Medical Report',
            date: r.created_at,
            data: r,
        }));
        return [...scanItems, ...reportItems]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 3);
    }, [scanHistory, medicalReports]);

    const handleGuestSignIn = () => {
        setShowGuestAuth(false);
        useStore.getState().setGuestRequiresAuth(true);
        useStore.getState().setGuestMode(false);
        useStore.getState().clearOnboarding();
    };

    const handleScan = () => {
        if (isGuestMode && !user) {
            setShowGuestAuth(true);
            return;
        }
        if (!canScan()) {
            navigation.navigate('Paywall');
        } else {
            navigation.navigate('Chat', { openUploadModal: true });
        }
    };

    // Progress bar animation
    const xpProgress = useSharedValue(0);
    const dailyProgress = useSharedValue(0);

    useEffect(() => {
        const maxScans = profile?.is_pro ? 40 : (appSettings?.free_daily_limit || 1);
        xpProgress.value = withDelay(500, withTiming((level.current / level.max) * 100, { duration: 800 }));
        dailyProgress.value = withDelay(600, withTiming(Math.min((todayScans.length / maxScans) * 100, 100), { duration: 800 }));
    }, [level.current, todayScans.length, profile?.is_pro, appSettings?.free_daily_limit]);

    const xpBarStyle = useAnimatedStyle(() => ({
        width: `${xpProgress.value}%`,
    }));

    const dailyBarStyle = useAnimatedStyle(() => ({
        width: `${dailyProgress.value}%`,
    }));

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
            >
                {/* Minimal Header */}
                <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.menuBtn} activeOpacity={0.8}>
                        <Ionicons name="menu" size={28} color={Colors.primary} />
                    </TouchableOpacity>
                    <View style={styles.brandTitleWrap}>
                        <Image source={require('../../assets/appinside1.png')} style={styles.headerLogo} />
                        <Text style={styles.brandTitle}>MedGPT</Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('History')} style={styles.menuBtn} activeOpacity={0.8}>
                        <Ionicons name="file-tray-full-outline" size={24} color={Colors.primary} />
                    </TouchableOpacity>
                </Animated.View>

                {/* Hero Text */}
                <Animated.View entering={FadeInDown.delay(200)} style={styles.heroSection}>
                    <View style={styles.pillBadge}>
                        <Text style={styles.pillBadgeText}>#1 Medical AI Worldwide</Text>
                    </View>
                    <Text style={styles.heroTitle}>
                        Med<Text style={{ color: Colors.accent }}>GPT</Text>, a health companion that actually knows you
                    </Text>
                    <Text style={styles.heroSubtext}>
                        Healthcare that finally puts you first.{'\n'}Personal. Accurate. Available when you need it.
                    </Text>
                </Animated.View>

                {/* Main Scan Actions */}
                <Animated.View entering={FadeInDown.delay(300)} style={styles.actionSection}>
                    <TouchableOpacity onPress={handleScan} style={styles.primaryScanBtn} activeOpacity={0.8}>
                        <Ionicons name="document-text-outline" size={24} color={Colors.white} />
                        <Text style={styles.primaryScanText}>Scan Medical Reports</Text>
                    </TouchableOpacity>

                    <View style={styles.secondaryActionRow}>
                        <TouchableOpacity onPress={handleScan} style={styles.secondaryScanBtn} activeOpacity={0.8}>
                            <Ionicons name="receipt-outline" size={22} color={Colors.accent} />
                            <Text style={styles.secondaryScanText}>Prescription</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleScan} style={styles.secondaryScanBtn} activeOpacity={0.8}>
                            <Ionicons name="flask-outline" size={22} color={Colors.accent} />
                            <Text style={styles.secondaryScanText}>Medicine Info</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                {/* Recent Insights */}
                <Animated.View entering={FadeInDown.delay(400)} style={styles.recentSection}>
                    <Text style={styles.sectionTitle}>Recent Insights</Text>
                    {recentInsights.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyTitle}>Your health journey starts here</Text>
                            <Text style={styles.emptySubtext}>Upload your first report to get started.</Text>
                        </View>
                    ) : (
                        recentInsights.map((item, i) => (
                            <Animated.View key={`${item.type}-${item.id}`} entering={FadeInDown.delay(50 * i)}>
                                <TouchableOpacity
                                    onPress={() => {
                                        if (item.type === 'report') {
                                            navigation.navigate('ReportDetail', { report: item.data, reportId: item.id });
                                        } else {
                                            navigation.navigate('Result', { scanId: item.id });
                                        }
                                    }}
                                    style={styles.scanItem}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.scanIconWrap}>
                                        <Ionicons
                                            name={item.type === 'report' ? 'document-text' : 'scan-outline'}
                                            size={18}
                                            color={item.type === 'report' ? '#3B82F6' : Colors.accent}
                                        />
                                    </View>
                                    <View style={styles.scanInfo}>
                                        <Text style={styles.scanName} numberOfLines={1}>{item.title}</Text>
                                        <Text style={styles.scanTime}>{new Date(item.date).toLocaleDateString()}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={Colors.border} />
                                </TouchableOpacity>
                            </Animated.View>
                        ))
                    )}
                </Animated.View>

            </ScrollView>

            <GuestAuthModal
                visible={showGuestAuth}
                onSignIn={handleGuestSignIn}
                onDismiss={() => setShowGuestAuth(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scroll: { paddingBottom: 160 },

    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingHorizontal: 20, paddingBottom: 16 },
    menuBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    brandTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
    },
    brandTitle: { fontSize: 24, fontWeight: '700', color: Colors.accent, letterSpacing: -0.5 },
    headerLogo: {
        width: 66,
        height: 66,
        borderRadius: 8,
        resizeMode: 'contain',
        marginRight: -12,
    },

    // Hero
    heroSection: { paddingHorizontal: 24, marginTop: 12, marginBottom: 32 },
    pillBadge: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surfaceMuted, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
    pillBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.secondary },
    heroTitle: { fontSize: 36, fontWeight: '500', color: Colors.primary, lineHeight: 42, letterSpacing: -1, marginBottom: 16 },
    heroSubtext: { fontSize: 16, color: Colors.secondary, lineHeight: 24 },

    // Actions
    actionSection: { paddingHorizontal: 24, marginBottom: 40 },
    primaryScanBtn: { backgroundColor: Colors.accent, paddingVertical: 18, paddingHorizontal: 24, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 },
    primaryScanText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
    secondaryActionRow: { flexDirection: 'row', gap: 12 },
    secondaryScanBtn: { flex: 1, backgroundColor: Colors.surfaceMuted, paddingVertical: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border },
    secondaryScanText: { color: Colors.accent, fontSize: 14, fontWeight: '600' },

    // Recent
    recentSection: { paddingHorizontal: 24 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.primary, marginBottom: 16 },
    emptyState: { padding: 24, backgroundColor: Colors.surfaceMuted, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    emptyTitle: { fontSize: 15, fontWeight: '600', color: Colors.primary, marginBottom: 4 },
    emptySubtext: { fontSize: 13, color: Colors.secondary, textAlign: 'center' },
    scanItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
    scanIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    scanInfo: { flex: 1, marginRight: 12 },
    scanName: { fontSize: 16, fontWeight: '500', color: Colors.primary, marginBottom: 4 },
    scanTime: { fontSize: 13, color: Colors.secondary },
});
