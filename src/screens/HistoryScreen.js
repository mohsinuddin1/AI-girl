import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Platform,
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
} from 'react-native';
import Animated, {
    FadeInDown,
    FadeIn,
    SlideInRight,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Colors, Radii, Shadows } from '../theme';
import useStore from '../store/useStore';

// Report type icon/color mapping
const REPORT_TYPE_CONFIG = {
    'Blood Test': { icon: 'water', color: '#EF4444', bg: '#FEF2F2' },
    'Prescription': { icon: 'document-text', color: '#3B82F6', bg: '#EFF6FF' },
    'Medicine': { icon: 'medkit', color: '#10B981', bg: '#ECFDF5' },
    'X-Ray': { icon: 'body', color: '#8B5CF6', bg: '#F5F3FF' },
    'MRI': { icon: 'scan', color: '#6366F1', bg: '#EEF2FF' },
    'Lab Report': { icon: 'flask', color: '#F59E0B', bg: '#FFFBEB' },
    'document': { icon: 'document', color: Colors.accent, bg: Colors.accentLight },
    'default': { icon: 'document', color: Colors.accent, bg: Colors.accentLight },
};

function getTypeConfig(reportType) {
    return REPORT_TYPE_CONFIG[reportType] || REPORT_TYPE_CONFIG['default'];
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Today • ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
}

// ─── Report Card Component ───
function ReportCard({ report, index, navigation, onLongPress }) {
    const typeConfig = getTypeConfig(report.report_type);
    const findings = report.key_findings || [];
    const summaryPreview = (report.summary || '').substring(0, 120);

    return (
        <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(18)}>
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ReportDetail', { report, reportId: report.id })}
                onLongPress={() => onLongPress(report)}
                delayLongPress={400}
            >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                    <View style={[styles.typeIconWrap, { backgroundColor: typeConfig.bg }]}>
                        <Ionicons name={typeConfig.icon} size={18} color={typeConfig.color} />
                    </View>
                    <View style={styles.cardHeaderText}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{report.title || 'Medical Report'}</Text>
                        <Text style={styles.cardDate}>{formatDate(report.created_at)}</Text>
                    </View>
                    <View style={[styles.typeBadge, { backgroundColor: typeConfig.bg }]}>
                        <Text style={[styles.typeBadgeText, { color: typeConfig.color }]} numberOfLines={1}>
                            {report.report_type || 'Document'}
                        </Text>
                    </View>
                </View>

                {/* Summary Preview */}
                {summaryPreview ? (
                    <Text style={styles.cardSummary} numberOfLines={3}>
                        {summaryPreview}{summaryPreview.length >= 120 ? '...' : ''}
                    </Text>
                ) : null}

                {/* Findings Preview */}
                {findings.length > 0 && (
                    <View style={styles.findingsRow}>
                        {findings.slice(0, 3).map((finding, i) => (
                            <View key={i} style={styles.findingChip}>
                                <View style={styles.findingDot} />
                                <Text style={styles.findingChipText} numberOfLines={1}>{finding}</Text>
                            </View>
                        ))}
                        {findings.length > 3 && (
                            <Text style={styles.moreText}>+{findings.length - 3} more</Text>
                        )}
                    </View>
                )}

                {/* Footer */}
                <View style={styles.cardFooter}>
                    {report.file_name && (
                        <View style={styles.fileTag}>
                            <Ionicons name="attach" size={12} color={Colors.textMuted} />
                            <Text style={styles.fileTagText} numberOfLines={1}>{report.file_name}</Text>
                        </View>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function HistoryScreen({ navigation }) {
    const {
        user,
        medicalReports,
        medicalReportsLoading,
        medicalReportsHasMore,
        fetchMedicalReports,
        fetchMoreMedicalReports,
        removeMedicalReport,
        updateMedicalReport,
    } = useStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [renameModal, setRenameModal] = useState(null); // { id, title }
    const [renameText, setRenameText] = useState('');

    useEffect(() => {
        if (user) {
            fetchMedicalReports();
        }
    }, [user]);

    const filteredReports = useMemo(() => {
        if (!searchQuery) return medicalReports;
        const query = searchQuery.toLowerCase();
        return medicalReports.filter((r) =>
            (r.title || '').toLowerCase().includes(query) ||
            (r.report_type || '').toLowerCase().includes(query) ||
            (r.summary || '').toLowerCase().includes(query)
        );
    }, [medicalReports, searchQuery]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchMedicalReports();
        setRefreshing(false);
    }, [fetchMedicalReports]);

    const handleLoadMore = useCallback(() => {
        if (medicalReportsHasMore && !medicalReportsLoading && !searchQuery) {
            fetchMoreMedicalReports();
        }
    }, [medicalReportsHasMore, medicalReportsLoading, searchQuery, fetchMoreMedicalReports]);

    const handleLongPress = (report) => {
        Alert.alert(
            report.title || 'Medical Report',
            'What would you like to do?',
            [
                {
                    text: 'Rename',
                    onPress: () => {
                        setRenameText(report.title || '');
                        setRenameModal(report);
                    },
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert('Delete Report', 'This cannot be undone.', [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: async () => {
                                    try {
                                        const { ReportService } = require('../services/ReportService');
                                        await ReportService.deleteReport(report.id);
                                        removeMedicalReport(report.id);
                                    } catch (err) {
                                        Alert.alert('Error', 'Failed to delete report.');
                                    }
                                },
                            },
                        ]);
                    },
                },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const handleRename = async () => {
        if (!renameText.trim() || !renameModal) return;
        try {
            const { ReportService } = require('../services/ReportService');
            await ReportService.renameReport(renameModal.id, renameText.trim());
            updateMedicalReport(renameModal.id, { title: renameText.trim() });
            setRenameModal(null);
        } catch (err) {
            Alert.alert('Error', 'Failed to rename report.');
        }
    };

    const handleUpload = () => {
        navigation.navigate('Chat', { openUploadModal: true });
    };

    const renderFooter = () => {
        if (!medicalReportsLoading) return null;
        return (
            <View style={styles.loadingFooter}>
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text style={styles.loadingText}>Loading more reports...</Text>
            </View>
        );
    };

    const renderHeader = () => (
        <View style={styles.innerContent}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Records</Text>
                    <Text style={styles.subtitle}>
                        {medicalReports.length} {medicalReports.length === 1 ? 'report' : 'reports'}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => setShowSearch(!showSearch)}
                    style={styles.searchToggle}
                >
                    <Ionicons name={showSearch ? 'close' : 'search'} size={18} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Search */}
            {showSearch && (
                <Animated.View entering={FadeInDown} style={styles.searchWrap}>
                    <Ionicons name="search" size={16} color={Colors.textMuted} style={styles.searchIcon} />
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search reports..."
                        placeholderTextColor={Colors.textMuted}
                        style={styles.searchInput}
                        autoFocus
                    />
                </Animated.View>
            )}
        </View>
    );

    const renderEmpty = () => (
        <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
                <Ionicons name="document-text-outline" size={40} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>
                {searchQuery
                    ? 'No matching reports'
                    : 'No medical reports yet'}
            </Text>
            <Text style={styles.emptySubtext}>
                {searchQuery
                    ? 'Try adjusting your search'
                    : 'Upload a medical report, prescription, or lab result to get started.'}
            </Text>
            {!searchQuery && (
                <TouchableOpacity style={styles.emptyBtn} onPress={handleUpload}>
                    <Ionicons name="cloud-upload-outline" size={18} color={Colors.white} />
                    <Text style={styles.emptyBtnText}>Upload Report</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <FlashList
                data={filteredReports}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                    <ReportCard
                        report={item}
                        index={index}
                        navigation={navigation}
                        onLongPress={handleLongPress}
                    />
                )}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={renderFooter}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.4}
                showsVerticalScrollIndicator={false}
                estimatedItemSize={180}
                contentContainerStyle={styles.scroll}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={Colors.accent}
                        colors={[Colors.accent]}
                    />
                }
            />

            {/* FAB — Upload new report */}
            {medicalReports.length > 0 && (
                <Animated.View entering={FadeIn.delay(500)} style={styles.fabWrap}>
                    <TouchableOpacity style={styles.fab} onPress={handleUpload} activeOpacity={0.8}>
                        <Ionicons name="add" size={28} color={Colors.white} />
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* Rename Modal */}
            <Modal visible={!!renameModal} transparent animationType="fade" onRequestClose={() => setRenameModal(null)}>
                <View style={styles.modalOverlay}>
                    <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Rename Report</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={renameText}
                            onChangeText={setRenameText}
                            placeholder="Enter new title..."
                            placeholderTextColor={Colors.textMuted}
                            autoFocus
                            selectTextOnFocus
                        />
                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRenameModal(null)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleRename}>
                                <Text style={styles.modalSaveText}>Rename</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scroll: { paddingBottom: 160, paddingHorizontal: 20 },
    innerContent: { flex: 1 },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 56 : 40,
        paddingHorizontal: 4,
        paddingBottom: 16,
    },
    title: { fontSize: 28, fontWeight: '800', color: Colors.primary, letterSpacing: -0.5 },
    subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
    searchToggle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },

    searchWrap: { position: 'relative', marginBottom: 16 },
    searchIcon: { position: 'absolute', left: 14, top: 14, zIndex: 1 },
    searchInput: { backgroundColor: Colors.surfaceMuted, paddingVertical: 12, paddingLeft: 42, paddingRight: 16, borderRadius: Radii.md, fontSize: 14, color: Colors.primary },

    // Card
    card: {
        backgroundColor: Colors.white,
        borderRadius: Radii.card,
        padding: 18,
        marginBottom: 14,
        ...Shadows.soft,
        borderWidth: 1,
        borderColor: Colors.borderLight,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    typeIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    cardHeaderText: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.primary,
        letterSpacing: -0.3,
    },
    cardDate: {
        fontSize: 12,
        color: Colors.textMuted,
        fontWeight: '500',
        marginTop: 2,
    },
    typeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    typeBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    cardSummary: {
        fontSize: 14,
        lineHeight: 20,
        color: Colors.textSecondary,
        fontWeight: '400',
        marginBottom: 12,
    },
    findingsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    findingChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surfaceMuted,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        gap: 6,
    },
    findingDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: Colors.accent,
    },
    findingChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.primary,
        maxWidth: 120,
    },
    moreText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.textMuted,
        alignSelf: 'center',
        paddingHorizontal: 4,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    fileTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flex: 1,
    },
    fileTagText: {
        fontSize: 11,
        color: Colors.textMuted,
        fontWeight: '500',
        maxWidth: 200,
    },

    // Empty State
    emptyState: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 20 },
    emptyIconWrap: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.primary, marginBottom: 8 },
    emptySubtext: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 280, marginBottom: 24 },
    emptyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.accent,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: Radii.button,
        ...Shadows.elevated,
    },
    emptyBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },

    // FAB
    fabWrap: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 120 : 100,
        right: 24,
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadows.fab,
    },

    // Loading
    loadingFooter: { alignItems: 'center', paddingVertical: 20, gap: 8 },
    loadingText: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },

    // Rename Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    modalContent: { backgroundColor: Colors.white, borderRadius: Radii.card, padding: 24, width: '100%', maxWidth: 360, ...Shadows.elevated },
    modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.primary, marginBottom: 16, textAlign: 'center' },
    modalInput: { backgroundColor: Colors.surfaceMuted, borderRadius: Radii.input, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: Colors.primary, marginBottom: 20 },
    modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    modalCancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: Radii.button },
    modalCancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
    modalSaveBtn: { backgroundColor: Colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radii.button },
    modalSaveText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
