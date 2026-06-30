import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Platform,
    KeyboardAvoidingView,
    ScrollView,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme';
import useStore from '../store/useStore';
import { supabase } from '../lib/supabase';
import { posthog } from '../lib/posthog';

const FEEDBACK_TYPES = [
    { id: 'bug', label: 'Report a Bug', icon: 'bug-outline' },
    { id: 'feature', label: 'Suggest a Feature', icon: 'bulb-outline' },
    { id: 'cancel', label: 'Reason for Canceling', icon: 'sad-outline' },
    { id: 'other', label: 'Other', icon: 'chatbubble-ellipses-outline' },
];

export default function FeedbackScreen({ navigation }) {
    const { user, profile } = useStore();
    const [selectedType, setSelectedType] = useState('bug');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!message.trim()) {
            Alert.alert('Empty Message', 'Please enter some feedback before submitting.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('aigirl_feedback').insert({
                user_id: user?.id,
                email: user?.email,
                name: user?.user_metadata?.full_name || 'Anonymous',
                feedback_type: selectedType,
                message: message.trim(),
            });

            if (error) {
                console.error('Error submitting feedback:', error);
                throw error;
            }

            posthog.capture('feedback_submitted', { type: selectedType });
            
            Alert.alert(
                'Thank You!',
                'Your feedback helps us improve AIGirl tremendously.',
                [{ text: 'Close', onPress: () => navigation.goBack() }]
            );
        } catch (e) {
            Alert.alert('Error', 'Failed to submit feedback. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="close" size={24} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Give Feedback</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.subtitle}>
                    We read every message. If you're having issues, please let us know how we can improve before you leave!
                </Text>

                <Text style={styles.sectionLabel}>What is this regarding?</Text>
                <View style={styles.typesGrid}>
                    {FEEDBACK_TYPES.map((type) => {
                        const isSelected = selectedType === type.id;
                        return (
                            <TouchableOpacity
                                key={type.id}
                                style={[styles.typeCard, isSelected && styles.typeCardActive]}
                                onPress={() => setSelectedType(type.id)}
                            >
                                <Ionicons
                                    name={type.icon}
                                    size={24}
                                    color={isSelected ? Colors.accent : Colors.textMuted}
                                />
                                <Text style={[styles.typeText, isSelected && styles.typeTextActive]}>
                                    {type.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <Text style={styles.sectionLabel}>Your Message</Text>
                <TextInput
                    style={styles.textInput}
                    placeholder="Tell us what you like, what's broken, or what could be better..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    textAlignVertical="top"
                    value={message}
                    onChangeText={setMessage}
                    maxLength={1000}
                />

                <TouchableOpacity
                    style={[styles.submitBtn, (!message.trim() || isSubmitting) && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={!message.trim() || isSubmitting}
                >
                    <Text style={styles.submitBtnText}>
                        {isSubmitting ? 'Sending...' : 'Send Feedback'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.surfaceMuted },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.primary },
    scroll: { padding: 20, paddingBottom: 60 },
    subtitle: {
        fontSize: 15,
        color: Colors.textSecondary,
        lineHeight: 22,
        marginBottom: 24,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.textSecondary,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    typesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    typeCard: {
        width: '48%',
        backgroundColor: Colors.surface,
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderRadius: Radii.md,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.border,
        ...Shadows.light,
    },
    typeCardActive: {
        borderColor: Colors.accent,
        backgroundColor: 'rgba(232,168,56,0.05)',
    },
    typeText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    typeTextActive: {
        color: Colors.accent,
    },
    textInput: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radii.md,
        padding: 16,
        height: 150,
        fontSize: 15,
        color: Colors.primary,
        marginBottom: 24,
    },
    submitBtn: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: Radii.md,
        alignItems: 'center',
        ...Shadows.card,
    },
    submitBtnDisabled: {
        opacity: 0.5,
    },
    submitBtnText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: '700',
    },
});
