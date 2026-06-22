import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import Markdown from 'react-native-markdown-display';
import * as Clipboard from 'expo-clipboard';
import { Colors, Radii, Shadows } from '../theme';
import { ReportService } from '../services/ReportService';
import useStore from '../store/useStore';

// Report type icon/color mapping
const REPORT_TYPE_CONFIG = {
    'Blood Test': { icon: 'water', color: '#EF4444' },
    'Prescription': { icon: 'document-text', color: '#3B82F6' },
    'Medicine': { icon: 'medkit', color: '#10B981' },
    'X-Ray': { icon: 'body', color: '#8B5CF6' },
    'MRI': { icon: 'scan', color: '#6366F1' },
    'Lab Report': { icon: 'flask', color: '#F59E0B' },
    'default': { icon: 'document', color: Colors.accent },
};

function getTypeConfig(reportType) {
    return REPORT_TYPE_CONFIG[reportType] || REPORT_TYPE_CONFIG['default'];
}

export default function ReportDetailScreen({ route, navigation }) {
    const { reportId } = route.params || {};
    const [report, setReport] = useState(route.params?.report || null);
    const [loading, setLoading] = useState(!route.params?.report);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editSummary, setEditSummary] = useState('');
    const [saving, setSaving] = useState(false);
    const { updateMedicalReport, removeMedicalReport } = useStore();

    useEffect(() => {
        if (!report && reportId) {
            loadReport();
        }
    }, [reportId]);

    const loadReport = async () => {
        try {
            setLoading(true);
            const data = await ReportService.getReport(reportId);
            setReport(data);
        } catch (error) {
            console.error('Failed to load report:', error);
            Alert.alert('Error', 'Failed to load report.');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const handleStartEdit = () => {
        setEditTitle(report.title || '');
        setEditSummary(report.summary || '');
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        if (!editTitle.trim()) {
            Alert.alert('Error', 'Title cannot be empty.');
            return;
        }
        setSaving(true);
        try {
            const updated = await ReportService.updateReport(report.id, {
                title: editTitle.trim(),
                summary: editSummary.trim(),
            });
            setReport(updated);
            updateMedicalReport(report.id, { title: updated.title, summary: updated.summary });
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to save edit:', error);
            Alert.alert('Error', 'Failed to save changes.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Report',
            'Are you sure you want to permanently delete this report?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await ReportService.deleteReport(report.id);
                            removeMedicalReport(report.id);
                            navigation.goBack();
                        } catch (error) {
                            console.error('Failed to delete report:', error);
                            Alert.alert('Error', 'Failed to delete report.');
                        }
                    },
                },
            ]
        );
    };

    const handleCopy = async () => {
        const text = `${report.title}\n\n${report.summary}\n\nKey Findings:\n${(report.key_findings || []).map(f => `• ${f}`).join('\n')}\n\nConditions:\n${(report.conditions_discussed || []).map(c => `• ${c}`).join('\n')}\n\nRecommended Follow-ups:\n${(report.recommended_followups || []).map(r => `• ${r}`).join('\n')}${report.citations && report.citations.length ? `\n\nCitations:\n${report.citations.map(c => `• ${c}`).join('\n')}` : ''}`;
        await Clipboard.setStringAsync(text);
        Alert.alert('Copied', 'Report copied to clipboard.');
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={Colors.accent} />
                </View>
            </SafeAreaView>
        );
    }

    if (!report) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingWrap}>
                    <Text style={styles.errorText}>Report not found.</Text>
                </View>
            </SafeAreaView>
        );
    }

    const typeConfig = getTypeConfig(report.report_type);
    const createdDate = new Date(report.created_at);
    const dateStr = createdDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const timeStr = createdDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={Colors.primary} />
                </TouchableOpacity>
                <View style={styles.headerActions}>
                    {!isEditing && (
                        <>
                            <TouchableOpacity onPress={handleCopy} style={styles.actionBtn}>
                                <Ionicons name="copy-outline" size={20} color={Colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleStartEdit} style={styles.actionBtn}>
                                <Ionicons name="create-outline" size={20} color={Colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleDelete} style={styles.actionBtn}>
                                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                            </TouchableOpacity>
                        </>
                    )}
                    {isEditing && (
                        <>
                            <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.actionBtn}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSaveEdit} style={[styles.actionBtn, styles.saveBtn]} disabled={saving}>
                                {saving ? (
                                    <ActivityIndicator size="small" color={Colors.white} />
                                ) : (
                                    <Text style={styles.saveText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </Animated.View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Type Badge + Date */}
                <Animated.View entering={FadeInDown.delay(100).springify().damping(18)} style={styles.metaRow}>
                    <View style={[styles.typeBadge, { backgroundColor: typeConfig.color + '18' }]}>
                        <Ionicons name={typeConfig.icon} size={14} color={typeConfig.color} />
                        <Text style={[styles.typeBadgeText, { color: typeConfig.color }]}>{report.report_type || 'Document'}</Text>
                    </View>
                    <Text style={styles.dateText}>{dateStr} • {timeStr}</Text>
                </Animated.View>

                {/* Title */}
                <Animated.View entering={FadeInDown.delay(150).springify().damping(18)}>
                    {isEditing ? (
                        <TextInput
                            style={styles.titleInput}
                            value={editTitle}
                            onChangeText={setEditTitle}
                            placeholder="Report title..."
                            placeholderTextColor={Colors.textMuted}
                            multiline
                        />
                    ) : (
                        <Text style={styles.title}>{report.title || 'Medical Report'}</Text>
                    )}
                </Animated.View>

                {/* File info */}
                {report.file_name && (
                    <Animated.View entering={FadeInDown.delay(200).springify().damping(18)} style={styles.fileInfoRow}>
                        <Ionicons name="attach" size={14} color={Colors.textMuted} />
                        <Text style={styles.fileInfoText}>{report.file_name}</Text>
                    </Animated.View>
                )}

                {/* Summary */}
                <Animated.View entering={FadeInDown.delay(250).springify().damping(18)} style={styles.section}>
                    <Text style={styles.sectionTitle}>Summary</Text>
                    <View style={styles.summaryCard}>
                        {isEditing ? (
                            <TextInput
                                style={styles.summaryInput}
                                value={editSummary}
                                onChangeText={setEditSummary}
                                placeholder="Edit summary..."
                                placeholderTextColor={Colors.textMuted}
                                multiline
                                textAlignVertical="top"
                            />
                        ) : (
                            <Markdown style={markdownStyles}>
                                {report.summary || 'No summary available.'}
                            </Markdown>
                        )}
                    </View>
                </Animated.View>

                {/* Key Findings */}
                {report.key_findings && report.key_findings.length > 0 && (
                    <Animated.View entering={FadeInDown.delay(300).springify().damping(18)} style={styles.section}>
                        <Text style={styles.sectionTitle}>Key Findings</Text>
                        {report.key_findings.map((finding, index) => (
                            <View key={index} style={styles.findingItem}>
                                <View style={styles.findingDot} />
                                <Text style={styles.findingText}>{finding}</Text>
                            </View>
                        ))}
                    </Animated.View>
                )}

                {/* Conditions Discussed */}
                {report.conditions_discussed && report.conditions_discussed.length > 0 && (
                    <Animated.View entering={FadeInDown.delay(350).springify().damping(18)} style={styles.section}>
                        <Text style={styles.sectionTitle}>Conditions Discussed</Text>
                        <View style={styles.tagsWrap}>
                            {report.conditions_discussed.map((condition, index) => (
                                <View key={index} style={styles.tag}>
                                    <Text style={styles.tagText}>{condition}</Text>
                                </View>
                            ))}
                        </View>
                    </Animated.View>
                )}

                {/* Recommended Follow-ups */}
                {report.recommended_followups && report.recommended_followups.length > 0 && (
                    <Animated.View entering={FadeInDown.delay(400).springify().damping(18)} style={styles.section}>
                        <Text style={styles.sectionTitle}>Recommended Follow-ups</Text>
                        {report.recommended_followups.map((followup, index) => (
                            <View key={index} style={styles.followupItem}>
                                <Ionicons name="checkbox-outline" size={18} color={Colors.accent} />
                                <Text style={styles.followupText}>{followup}</Text>
                            </View>
                        ))}
                    </Animated.View>
                )}

                {/* Citations */}
                {report.citations && report.citations.length > 0 && (
                    <Animated.View entering={FadeInDown.delay(450).springify().damping(18)} style={styles.section}>
                        <Text style={styles.sectionTitle}>Citations</Text>
                        {report.citations.map((citation, index) => (
                            <View key={index} style={styles.findingItem}>
                                <Ionicons name="library-outline" size={18} color={Colors.textMuted} style={{ marginRight: 10, marginTop: 2 }} />
                                <Text style={styles.findingText}>{citation}</Text>
                            </View>
                        ))}
                    </Animated.View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const markdownStyles = {
    body: {
        fontSize: 15,
        lineHeight: 24,
        color: Colors.textPrimary,
        fontWeight: '400',
    },
    paragraph: {
        marginTop: 0,
        marginBottom: 8,
    },
    heading1: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    heading2: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.primary,
    },
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorText: {
        fontSize: 16,
        color: Colors.textMuted,
        fontWeight: '600',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtn: {
        backgroundColor: Colors.accent,
        width: 'auto',
        paddingHorizontal: 20,
    },
    cancelText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    saveText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.white,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 100,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    typeBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    dateText: {
        fontSize: 12,
        color: Colors.textMuted,
        fontWeight: '500',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: Colors.primary,
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    titleInput: {
        fontSize: 24,
        fontWeight: '800',
        color: Colors.primary,
        letterSpacing: -0.5,
        marginBottom: 8,
        borderBottomWidth: 2,
        borderBottomColor: Colors.accent,
        paddingBottom: 8,
    },
    fileInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 20,
    },
    fileInfoText: {
        fontSize: 13,
        color: Colors.textMuted,
        fontWeight: '500',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.primary,
        marginBottom: 12,
        letterSpacing: -0.3,
    },
    summaryCard: {
        backgroundColor: Colors.white,
        borderRadius: Radii.card,
        padding: 20,
        ...Shadows.soft,
    },
    summaryInput: {
        fontSize: 15,
        lineHeight: 24,
        color: Colors.textPrimary,
        minHeight: 120,
    },
    findingItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 10,
        paddingLeft: 4,
    },
    findingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.accent,
        marginTop: 7,
        marginRight: 12,
    },
    findingText: {
        flex: 1,
        fontSize: 15,
        lineHeight: 22,
        color: Colors.textPrimary,
        fontWeight: '500',
    },
    tagsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        backgroundColor: Colors.accentLight,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    tagText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.accent,
    },
    followupItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 12,
        backgroundColor: Colors.white,
        padding: 14,
        borderRadius: Radii.md,
        ...Shadows.soft,
    },
    followupText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 22,
        color: Colors.textPrimary,
        fontWeight: '500',
    },
});
