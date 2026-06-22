import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Linking, LayoutAnimation, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme';
import Animated, { FadeInDown } from 'react-native-reanimated';

// Enable layout animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    const isNewArch = typeof global !== 'undefined' && Boolean(global.RN$Bridgeless || global.nativeFabricUIManager || global.__turboModuleProxy);
    if (!isNewArch) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

const FAQS = [
    {
        q: 'How does MedGPT analyze products?',
        a: 'We use advanced AI models trained on global cosmetic and food databases to read ingredients from your images and instantly flag known harmful chemicals, endocrine disruptors, and allergens.',
    },
    {
        q: 'What do I get with my subscription?',
        a: 'Pro subscribers get unlimited AI scans for both food and cosmetics, personalized allergy alerts, trace-level sensitivity analysis, and an ad-free private experience. Plans include a 3-day free trial on the annual subscription.',
    },
    {
        q: 'What is the Ingredient Grade?',
        a: 'The Ingredient Grade ranges from A (safest) to E (hazardous). It is determined by the accumulation of concerning ingredients mapped against cosmetic and health science indexes.',
    },
    {
        q: 'Are my images saved?',
        a: 'Images are temporarily stored in secure cloud storage solely for the AI to process and for you to review in your history. You can clear your scan history at any time in the Privacy settings.',
    },
];

export default function HelpSupportScreen({ navigation }) {
    const [expandedIndex, setExpandedIndex] = useState(null);

    const toggleFAQ = (index) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedIndex(index === expandedIndex ? null : index);
    };

    const handleContactSupport = () => {
        Linking.openURL('mailto:purescanai@outlook.com?subject=PureScan%20AI%20App%20Support&body=Hi%20PureScan%20AI%20Team,%0A%0A[Please%20describe%20your%20issue%20or%20feedback%20here]%0A%0A...');
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Help & Support</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                <Animated.View entering={FadeInDown.delay(100)} style={styles.contactCard}>
                    <View style={styles.contactIconWrap}>
                        <Ionicons name="mail" size={24} color={Colors.white} />
                    </View>
                    <View style={styles.contactTextWrap}>
                        <Text style={styles.contactTitle}>Need direct help?</Text>
                        <Text style={styles.contactSub}>Email us at purescanai@outlook.com</Text>
                    </View>
                    <TouchableOpacity onPress={handleContactSupport} style={styles.contactBtn}>
                        <Text style={styles.contactBtnText}>Contact Us</Text>
                    </TouchableOpacity>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
                    <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
                    <View style={styles.faqContainer}>
                        {FAQS.map((faq, index) => (
                            <View key={index} style={styles.faqItem}>
                                <TouchableOpacity onPress={() => toggleFAQ(index)} style={styles.faqQuestion} activeOpacity={0.7}>
                                    <Text style={styles.faqQuestionText}>{faq.q}</Text>
                                    <Ionicons
                                        name={expandedIndex === index ? 'chevron-up' : 'chevron-down'}
                                        size={20}
                                        color={Colors.textMuted}
                                    />
                                </TouchableOpacity>
                                {expandedIndex === index && (
                                    <View style={styles.faqAnswer}>
                                        <Text style={styles.faqAnswerText}>{faq.a}</Text>
                                    </View>
                                )}
                                {index < FAQS.length - 1 && <View style={styles.separator} />}
                            </View>
                        ))}
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(300)} style={styles.linkSection}>
                    <TouchableOpacity onPress={() => Linking.openURL('https://webpure-scan-ai.vercel.app/terms')} style={styles.linkItem}>
                        <Text style={styles.linkText}>Terms of Service</Text>
                        <Ionicons name="open-outline" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Linking.openURL('https://webpure-scan-ai.vercel.app/privacy')} style={styles.linkItem}>
                        <Text style={styles.linkText}>Privacy Policy</Text>
                        <Ionicons name="open-outline" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.surfaceMuted },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.primary },
    scroll: { padding: 20, paddingBottom: 60 },

    contactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 20, borderRadius: Radii.xl, ...Shadows.card, marginBottom: 32 },
    contactIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    contactTextWrap: { flex: 1 },
    contactTitle: { fontSize: 16, fontWeight: '700', color: Colors.primary },
    contactSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
    contactBtn: { backgroundColor: Colors.surfaceMuted, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radii.button },
    contactBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

    sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
    faqContainer: { backgroundColor: Colors.surface, borderRadius: Radii.xl, paddingHorizontal: 16, ...Shadows.card },
    faqItem: { paddingVertical: 16 },
    faqQuestion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    faqQuestionText: { fontSize: 15, fontWeight: '600', color: Colors.primary, flex: 1, paddingRight: 16, lineHeight: 22 },
    faqAnswer: { marginTop: 12, paddingRight: 16 },
    faqAnswerText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
    separator: { height: 1, backgroundColor: Colors.border, marginTop: 16 },

    linkSection: { marginTop: 32, alignItems: 'center' },
    linkItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    linkText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginRight: 8 },
});
