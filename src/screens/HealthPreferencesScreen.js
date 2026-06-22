import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme';
import useStore from '../store/useStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DISEASES = [
    'PCOS', 'Infertility', 'Early Puberty', 'Breast Cancer',
    'Birth Defects', 'Thyroid Issues', 'Eczema / Psoriasis', 'Hormonal Acne',
];

function SelectablePill({ label, isSelected, onPress }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={[styles.pill, isSelected && styles.pillSelected]}
        >
            {isSelected && (
                <View style={styles.pillCheck}>
                    <Ionicons name="checkmark" size={10} color={Colors.white} />
                </View>
            )}
            <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

function CustomInputPill({ placeholder, onAdd }) {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState('');

    if (!isEditing) {
        return (
            <TouchableOpacity onPress={() => setIsEditing(true)} activeOpacity={0.7} style={styles.addPill}>
                <Ionicons name="add" size={14} color={Colors.accent} />
                <Text style={styles.addPillText}>Add</Text>
            </TouchableOpacity>
        );
    }

    return (
        <View style={styles.inputPill}>
            <TextInput
                style={styles.inputPillText}
                autoFocus
                placeholder={placeholder}
                placeholderTextColor={Colors.textMuted}
                value={val}
                onChangeText={setVal}
                onSubmitEditing={() => {
                    if (val.trim()) onAdd(val.trim());
                    setVal('');
                    setIsEditing(false);
                }}
                onBlur={() => { setIsEditing(false); setVal(''); }}
                returnKeyType="done"
            />
        </View>
    );
}

function SectionHeader({ icon, iconColor, title, subtitle, count }) {
    return (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
                <View style={[styles.sectionIcon, { backgroundColor: `${iconColor}15` }]}>
                    <Ionicons name={icon} size={18} color={iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.sectionTitle}>{title}</Text>
                        {count > 0 && (
                            <View style={[styles.countBadge, { backgroundColor: `${iconColor}15` }]}>
                                <Text style={[styles.countBadgeText, { color: iconColor }]}>{count}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.sectionSubtitle}>{subtitle}</Text>
                </View>
            </View>
        </View>
    );
}

export default function HealthPreferencesScreen({ navigation }) {
    const { healthPreferences, setHealthPreferences, profile } = useStore();
    const [saving, setSaving] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const insets = useSafeAreaInsets();

    const safePrefs = (healthPreferences && typeof healthPreferences === 'object' && !Array.isArray(healthPreferences))
        ? healthPreferences
        : { diseases: [] };

    const [selectedDiseases, setSelectedDiseases] = useState([]);

    useEffect(() => {
        const prefs = profile?.health_preferences || safePrefs;
        const normalizedPrefs = (prefs && typeof prefs === 'object' && !Array.isArray(prefs))
            ? prefs
            : { diseases: [] };

        setSelectedDiseases(Array.isArray(normalizedPrefs.diseases) ? normalizedPrefs.diseases : []);
        setIsLoaded(true);
    }, [profile?.health_preferences, healthPreferences]);

    const sourcePrefs = (profile?.health_preferences && typeof profile.health_preferences === 'object' && !Array.isArray(profile.health_preferences))
        ? profile.health_preferences
        : safePrefs;
    const hasChanges = isLoaded && (
        JSON.stringify(selectedDiseases) !== JSON.stringify(Array.isArray(sourcePrefs?.diseases) ? sourcePrefs.diseases : [])
    );

    const totalSelected = selectedDiseases.filter(x => x !== 'None').length;

    const toggleArrayItem = (setter) => (item, isExclusiveNode = false) => {
        setter(prev => {
            if (isExclusiveNode) return ['None'];
            if (item === 'None') return [];
            const fresh = (Array.isArray(prev) ? prev : []).filter(p => p !== 'None');
            if (fresh.includes(item)) {
                return fresh.filter(i => i !== item);
            }
            if (fresh.length >= 25) {
                Alert.alert('Limit Reached', 'You can select a maximum of 25 health preferences.');
                return fresh;
            }
            return [...fresh, item];
        });
    };

    const handleAddCustom = (setter) => (item) => {
        setter(prev => {
            const fresh = (Array.isArray(prev) ? prev : []).filter(x => x !== 'None');
            if (fresh.includes(item)) return fresh;
            if (fresh.length >= 25) {
                Alert.alert('Limit Reached', 'You can select a maximum of 25 health preferences.');
                return fresh;
            }
            return [...fresh, item];
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await setHealthPreferences({
                diseases: selectedDiseases,
            });
            Alert.alert('Saved ✓', 'Your health preferences have been updated.', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            Alert.alert('Error', 'Failed to save preferences. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (!isLoaded) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.accent} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBarBtn}>
                    <Ionicons name="arrow-back" size={20} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.topBarTitle}>Health Profile</Text>
                <View style={styles.topBarRight}>
                    {totalSelected > 0 && (
                        <View style={styles.totalBadge}>
                            <Text style={styles.totalBadgeText}>{totalSelected}</Text>
                        </View>
                    )}
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Animated.View entering={FadeInDown.delay(50)} style={styles.introCard}>
                    <LinearGradient colors={['#f0f9ff', '#e0f2fe']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.introGradient}>
                        <View style={styles.introIconWrap}>
                            <Ionicons name="shield-checkmark" size={20} color={Colors.accent} />
                        </View>
                        <Text style={styles.introText}>
                            Your selections personalize AI analysis to flag ingredients that are specifically risky for your health profile.
                        </Text>
                    </LinearGradient>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(100)} style={styles.sectionCard}>
                    <SectionHeader
                        icon="medical"
                        iconColor="#ef4444"
                        title="Health Concerns"
                        subtitle="Conditions you want our AI to watch for"
                        count={selectedDiseases.filter(x => x !== 'None').length}
                    />
                    <View style={styles.pillGrid}>
                        {DISEASES.map((d, i) => (
                            <Animated.View key={d} entering={FadeIn.delay(120 + i * 30)}>
                                <SelectablePill
                                    label={d}
                                    isSelected={selectedDiseases.includes(d)}
                                    onPress={() => toggleArrayItem(setSelectedDiseases)(d)}
                                />
                            </Animated.View>
                        ))}
                        {selectedDiseases.filter(s => !DISEASES.includes(s) && s !== 'None').map(custom => (
                            <SelectablePill
                                key={custom}
                                label={custom}
                                isSelected={true}
                                onPress={() => toggleArrayItem(setSelectedDiseases)(custom)}
                            />
                        ))}
                        <CustomInputPill placeholder="Type here..." onAdd={handleAddCustom(setSelectedDiseases)} />
                    </View>
                    <TouchableOpacity
                        onPress={() => toggleArrayItem(setSelectedDiseases)('None', true)}
                        style={[styles.nonePill, selectedDiseases.includes('None') && styles.nonePillSelected]}
                    >
                        <Ionicons
                            name={selectedDiseases.includes('None') ? "checkmark-circle" : "ellipse-outline"}
                            size={16}
                            color={selectedDiseases.includes('None') ? Colors.success : Colors.textMuted}
                        />
                        <Text style={[styles.noneText, selectedDiseases.includes('None') && styles.noneTextSelected]}>
                            None of the above
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>

            <Animated.View entering={FadeInDown.delay(400)} style={[styles.bottomBar, { paddingBottom: (Platform.OS === 'ios' ? 44 : 40) + insets.bottom }]}>
                {hasChanges && (
                    <Text style={styles.unsavedHint}>You have unsaved changes</Text>
                )}
                <TouchableOpacity
                    style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!hasChanges || saving}
                    activeOpacity={0.8}
                >
                    {saving ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <ActivityIndicator size="small" color={Colors.white} />
                            <Text style={styles.saveBtnText}>Saving...</Text>
                        </View>
                    ) : (
                        <>
                            <Ionicons name="checkmark-circle" size={18} color={Colors.white} style={{ marginRight: 6 }} />
                            <Text style={styles.saveBtnText}>Save Changes</Text>
                        </>
                    )}
                </TouchableOpacity>
            </Animated.View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' },
    topBarBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
    topBarTitle: { fontSize: 18, fontWeight: '800', color: Colors.primary, letterSpacing: -0.3 },
    topBarRight: { width: 36, alignItems: 'flex-end' },
    totalBadge: { backgroundColor: Colors.accent, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    totalBadgeText: { fontSize: 11, fontWeight: '800', color: Colors.white },
    scrollContent: { padding: 16, paddingBottom: 160 },
    introCard: { marginBottom: 16, borderRadius: Radii.card, overflow: 'hidden' },
    introGradient: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    introIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(14, 165, 233, 0.12)', alignItems: 'center', justifyContent: 'center' },
    introText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 19, fontWeight: '500' },
    sectionCard: { backgroundColor: Colors.surface, borderRadius: Radii.card, padding: 20, marginBottom: 12, ...Shadows.card },
    sectionHeader: { marginBottom: 16 },
    sectionHeaderLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    sectionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.primary, letterSpacing: -0.2 },
    sectionSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 3, fontWeight: '500', lineHeight: 17 },
    countBadge: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 8 },
    countBadgeText: { fontSize: 11, fontWeight: '800' },
    pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radii.pill, backgroundColor: Colors.surfaceMuted, borderWidth: 1.5, borderColor: 'transparent' },
    pillSelected: { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
    pillCheck: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
    pillText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
    pillTextSelected: { color: Colors.primary, fontWeight: '700' },
    addPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 9, borderRadius: Radii.pill, borderWidth: 1.5, borderColor: Colors.accent, borderStyle: 'dashed', backgroundColor: 'transparent' },
    addPillText: { fontSize: 13, fontWeight: '700', color: Colors.accent },
    inputPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radii.pill, backgroundColor: Colors.surfaceMuted, borderWidth: 1.5, borderColor: Colors.accent, minWidth: 120 },
    inputPillText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
    nonePill: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: Colors.surfaceMuted, borderWidth: 1.5, borderColor: 'transparent' },
    nonePillSelected: { borderColor: Colors.success, backgroundColor: 'rgba(16, 185, 129, 0.06)' },
    noneText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
    noneTextSelected: { color: Colors.success, fontWeight: '700' },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: 'rgba(255,255,255,0.97)', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' },
    unsavedHint: { fontSize: 11, fontWeight: '600', color: Colors.warning, textAlign: 'center', marginBottom: 8 },
    saveBtn: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', ...Shadows.elevated },
    saveBtnDisabled: { opacity: 0.4, backgroundColor: Colors.textMuted },
    saveBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
});
