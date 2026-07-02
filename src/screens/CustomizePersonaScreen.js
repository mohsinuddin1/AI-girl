import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
    PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import useStore from '../store/useStore';

const { height } = Dimensions.get('window');

const THEME = {
    bg: '#040b16',
    primary: '#fff',
    accent: '#0ea5e9',
};

// --- Same CustomSlider from OnboardingScreen ---
const CustomSlider = ({ labelLeft, labelRight, value, onValueChange }) => {
    const sliderDimRef = useRef(0);
    const valueRef = useRef(value);
    const startValue = useRef(0);
    const onValueChangeRef = useRef(onValueChange);
    const trackRef = useRef(null);

    useEffect(() => { valueRef.current = value; }, [value]);
    useEffect(() => { onValueChangeRef.current = onValueChange; }, [onValueChange]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => true,
            onMoveShouldSetPanResponderCapture: () => true,
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: (evt) => {
                startValue.current = valueRef.current;
                if (sliderDimRef.current > 0 && trackRef.current) {
                    trackRef.current.measure((x, y, w, h, pageX, pageY) => {
                        if (w > 0) {
                            const touchX = evt.nativeEvent.pageX - pageX;
                            let newValue = touchX / w;
                            if (newValue < 0) newValue = 0;
                            if (newValue > 1) newValue = 1;
                            startValue.current = newValue;
                            valueRef.current = newValue;
                            onValueChangeRef.current(newValue);
                        }
                    });
                }
            },
            onPanResponderMove: (evt, gestureState) => {
                if (sliderDimRef.current === 0) return;
                const deltaValue = gestureState.dx / sliderDimRef.current;
                let newValue = startValue.current + deltaValue;
                if (newValue < 0) newValue = 0;
                if (newValue > 1) newValue = 1;
                onValueChangeRef.current(newValue);
            },
        })
    ).current;

    return (
        <View style={styles.sliderContainer}>
            <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>{labelLeft}</Text>
                <Text style={styles.sliderLabel}>{labelRight}</Text>
            </View>
            <View
                ref={trackRef}
                style={styles.sliderTrackHitArea}
                onLayout={(e) => { sliderDimRef.current = e.nativeEvent.layout.width; }}
                {...panResponder.panHandlers}
            >
                <View style={styles.sliderTrack}>
                    <View style={[styles.sliderFill, { width: `${value * 100}%` }]} />
                </View>
                <View style={[styles.sliderThumb, { left: `${value * 100}%` }]} />
            </View>
        </View>
    );
};

export default function CustomizePersonaScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { selectedPersona, personas, setSelectedPersona } = useStore();

    // Local state initialised from the current custom persona
    const [girlName, setGirlName] = useState(selectedPersona?.name || 'Custom Girl');
    const [traits, setTraits] = useState({
        shyFlirty: selectedPersona?.personality?.shyFlirty ?? 0.5,
        pessOpt: selectedPersona?.personality?.pessOpt ?? 0.5,
        ordMyst: selectedPersona?.personality?.ordMyst ?? 0.5,
    });
    const [extraDemand, setExtraDemand] = useState(selectedPersona?.extra_demand || '');
    const [selectedImageUrl, setSelectedImageUrl] = useState(
        selectedPersona?.image_url || personas?.[0]?.image_url
    );

    const handleSave = () => {
        const updatedPersona = {
            ...selectedPersona,
            id: selectedPersona?.id || 'custom',
            name: girlName,
            image_url: selectedImageUrl,
            personality: traits,
            extra_demand: extraDemand,
        };
        setSelectedPersona(updatedPersona);
        navigation.goBack();
    };

    // Background image
    const bgImageUrl = selectedImageUrl || personas?.[0]?.image_url;

    return (
        <View style={styles.container}>
            {/* Full-screen background image */}
            {bgImageUrl && (
                <Image source={{ uri: bgImageUrl }} style={styles.fullBgImage} />
            )}

            <LinearGradient
                colors={['transparent', 'rgba(4,11,22,0.9)', THEME.bg]}
                style={styles.globalBottomGradient}
            />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Customize Persona</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Content — same layout as onboarding SlidePersonality */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 150 }}>
                    <View style={styles.customContainer}>
                        {/* Girl Name */}
                        <Text style={styles.sectionLabel}>Her Name</Text>
                        <TextInput
                            style={styles.textArea}
                            placeholder="Enter name..."
                            placeholderTextColor="rgba(255,255,255,0.5)"
                            value={girlName}
                            onChangeText={setGirlName}
                        />

                        {/* Select Image */}
                        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Select Image</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginBottom: 24 }}>
                            {personas?.map((p) => (
                                <TouchableOpacity
                                    key={p.id}
                                    onPress={() => setSelectedImageUrl(p.image_url)}
                                    style={[styles.avatarThumbWrap, selectedImageUrl === p.image_url && styles.avatarThumbSelected]}
                                >
                                    <Image source={{ uri: p.image_url }} style={styles.avatarThumb} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Personality Traits */}
                        <Text style={styles.sectionLabel}>Personality Traits</Text>
                        <View style={styles.slidersWrapperInline}>
                            <CustomSlider
                                labelLeft="Shy" labelRight="Flirty"
                                value={traits.shyFlirty}
                                onValueChange={(val) => setTraits({ ...traits, shyFlirty: val })}
                            />
                            <CustomSlider
                                labelLeft="Pessimistic" labelRight="Optimistic"
                                value={traits.pessOpt}
                                onValueChange={(val) => setTraits({ ...traits, pessOpt: val })}
                            />
                            <CustomSlider
                                labelLeft="Ordinary" labelRight="Mysterious"
                                value={traits.ordMyst}
                                onValueChange={(val) => setTraits({ ...traits, ordMyst: val })}
                            />
                        </View>

                        {/* Extra Details */}
                        <Text style={styles.sectionLabel}>Extra Details</Text>
                        <TextInput
                            style={[styles.textArea, { minHeight: 80 }]}
                            placeholder="Any extra personality demands..."
                            placeholderTextColor="rgba(255,255,255,0.5)"
                            multiline
                            numberOfLines={3}
                            value={extraDemand}
                            onChangeText={setExtraDemand}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Save button */}
            <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                <TouchableOpacity onPress={handleSave} style={styles.primaryBtn} activeOpacity={0.8}>
                    <Text style={styles.primaryBtnText}>Save</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.bg },

    fullBgImage: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        width: '100%', height: '100%', resizeMode: 'cover',
    },
    globalBottomGradient: {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: height * 0.6,
    },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, zIndex: 10,
    },
    headerTitle: { color: THEME.primary, fontSize: 24, fontWeight: '700' },

    // Adjusted to remove absolute positioning and allow normal scrolling
    customContainer: {
        flex: 1, justifyContent: 'flex-end',
        paddingHorizontal: 24, paddingBottom: 24, paddingTop: 24,
    },
    sectionLabel: { color: THEME.primary, fontSize: 16, fontWeight: '600', marginBottom: 12 },
    slidersWrapperInline: { gap: 12, marginBottom: 24 },

    avatarThumbWrap: {
        width: 64, height: 64 * (16 / 9), borderRadius: 16, overflow: 'hidden',
        borderWidth: 2, borderColor: 'transparent', opacity: 0.6,
    },
    avatarThumbSelected: { borderColor: THEME.accent, opacity: 1 },
    avatarThumb: { width: '100%', height: '100%', resizeMode: 'cover' },

    textArea: {
        width: '100%', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
        color: THEME.primary, fontSize: 16, padding: 16, textAlignVertical: 'top',
        marginBottom: 8,
    },

    // Slider styles (same as onboarding)
    sliderContainer: { width: '100%' },
    sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    sliderLabel: { color: THEME.primary, fontSize: 15, fontWeight: '500' },
    sliderTrackHitArea: { height: 40, justifyContent: 'center', position: 'relative' },
    sliderTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, width: '100%' },
    sliderFill: { position: 'absolute', left: 0, height: '100%', backgroundColor: THEME.accent, borderRadius: 2 },
    sliderThumb: {
        position: 'absolute', width: 24, height: 24, borderRadius: 12,
        backgroundColor: THEME.primary, top: 8, marginLeft: -12,
        elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3, shadowRadius: 3,
    },

    bottomControls: { paddingHorizontal: 24, paddingTop: 16, backgroundColor: 'transparent' },
    primaryBtn: { backgroundColor: THEME.primary, paddingVertical: 18, borderRadius: 30, alignItems: 'center' },
    primaryBtnText: { color: THEME.bg, fontSize: 18, fontWeight: '700' },
});
