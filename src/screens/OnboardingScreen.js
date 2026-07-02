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
    Alert,
    PanResponder,
    ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    FadeInDown,
    FadeInUp,
    ZoomIn,
    useSharedValue,
    withTiming,
    Easing
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../features/auth/AuthProvider';
import useStore from '../store/useStore';
import { posthog } from '../lib/posthog';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

// --- COLORS ---
const THEME = {
    bg: '#040b16',
    primary: '#fff',
    accent: '#0ea5e9',
    muted: '#94a3b8',
    card: '#0f172a'
};

const GOALS = [
    'Feel Less Lonely',
    'Have Fun',
    'Chat About Random Stuff',
    'Talk Shame-Free',
    'Play Chat Games',
    'Make a Virtual Friend',
    'Role Play',
    'Share Emotion',
    'Other'
];

// --- CUSTOM SLIDER ---
const CustomSlider = ({ labelLeft, labelRight, value, onValueChange }) => {
    const sliderDimRef = useRef(0);
    const valueRef = useRef(value);
    const startValue = useRef(0);
    const onValueChangeRef = useRef(onValueChange);
    const trackRef = useRef(null);

    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        onValueChangeRef.current = onValueChange;
    }, [onValueChange]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => true,
            onMoveShouldSetPanResponderCapture: () => true,
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: (evt) => {
                startValue.current = valueRef.current;
                // Support tap-to-set: position thumb where user taps
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

    const handleLayout = (e) => {
        sliderDimRef.current = e.nativeEvent.layout.width;
    };

    return (
        <View style={styles.sliderContainer}>
            <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>{labelLeft}</Text>
                <Text style={styles.sliderLabel}>{labelRight}</Text>
            </View>
            <View 
                ref={trackRef}
                style={styles.sliderTrackHitArea} 
                onLayout={handleLayout}
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

// --- SLIDES ---

// Slide 1: Introduce Yourself
function SlideName({ userName, setUserName }) {
    return (
        <View style={styles.slideCenter}>
            <Animated.Text entering={FadeInDown.delay(200)} style={styles.title}>
                So nice to meet you!
            </Animated.Text>
            <Animated.View entering={FadeInDown.delay(400)} style={{ width: '100%', marginTop: 100 }}>
                <Text style={styles.inputLabel}>Introduce yourself to AI</Text>
                <View style={styles.inputWrap}>
                    <TextInput 
                        style={styles.input} 
                        placeholder="Your name" 
                        placeholderTextColor={THEME.muted} 
                        value={userName} 
                        onChangeText={setUserName} 
                        autoFocus
                    />
                </View>
            </Animated.View>
        </View>
    );
}

// Slide 2: Choose Your Girl
function SlideChooseAvatar({ personas, loading, selectedAvatar, setSelectedAvatar }) {
    const firstLine = selectedAvatar?.extra_demand ? selectedAvatar.extra_demand.split('.')[0] + '.' : '';

    return (
        <View style={styles.slideFull}>
            <Animated.Text entering={FadeInDown} style={styles.titleAbsolute}>
                Choose your Girl
            </Animated.Text>
            
            {!!firstLine && selectedAvatar?.id !== 'custom' && (
                <Animated.View entering={FadeInDown.delay(200)} style={styles.personalityBox}>
                    <Text style={styles.personalityText}>{firstLine}</Text>
                </Animated.View>
            )}

            <View style={styles.carouselContainer}>
                {loading ? (
                    <ActivityIndicator size="large" color={THEME.primary} />
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, alignItems: 'center', gap: 16 }}>
                        {personas.filter(a => a.name !== 'Custom Girl' && a.id !== 'custom_girl').map((avatar) => {
                            const isSelected = selectedAvatar?.id === avatar.id;
                            return (
                                <TouchableOpacity 
                                    key={avatar.id} 
                                    onPress={() => setSelectedAvatar(avatar)}
                                    style={[styles.avatarThumbWrap, isSelected && styles.avatarThumbSelected]}
                                >
                                    <Image source={{ uri: avatar.image_url }} style={styles.avatarThumb} />
                                </TouchableOpacity>
                            );
                        })}
                        {/* Custom Option */}
                        <TouchableOpacity 
                            onPress={() => setSelectedAvatar({ id: 'custom', image_url: personas[0]?.image_url, name: 'Custom' })}
                            style={[styles.avatarThumbWrap, selectedAvatar?.id === 'custom' && styles.avatarThumbSelected, { backgroundColor: THEME.card, justifyContent: 'center', alignItems: 'center' }]}
                        >
                            <Ionicons name="add" size={28} color="#fff" />
                            <View style={styles.proBadge}><Ionicons name="star" size={10} color="#fff"/></View>
                            <Text style={{color: '#fff', fontSize: 10, position: 'absolute', bottom: 4}}>Custom</Text>
                        </TouchableOpacity>
                    </ScrollView>
                )}
            </View>
        </View>
    );
}

// Slide 3: Tweak Personality (Custom Only)
function SlidePersonality({ traits, setTraits, extraDemand, setExtraDemand, selectedAvatar, setSelectedAvatar, personas }) {
    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.slideFull}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 150 }}>
                <Animated.Text entering={FadeInDown} style={styles.titleAbsolute}>
                    Customize Persona
                </Animated.Text>
                
                <View style={styles.customContainer}>
                    <Text style={styles.sectionLabel}>Select Image</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginBottom: 24 }}>
                        {personas.filter(p => p.name !== 'Custom Girl' && p.id !== 'custom_girl').map((p) => (
                            <TouchableOpacity 
                                key={p.id} 
                                onPress={() => setSelectedAvatar({ ...selectedAvatar, image_url: p.image_url })}
                                style={[styles.avatarThumbWrap, selectedAvatar.image_url === p.image_url && styles.avatarThumbSelected]}
                            >
                                <Image source={{ uri: p.image_url }} style={styles.avatarThumb} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <Text style={styles.sectionLabel}>Personality Traits</Text>
                    <View style={styles.slidersWrapperInline}>
                        <CustomSlider 
                            labelLeft="Shy" labelRight="Flirty" 
                            value={traits.shyFlirty} 
                            onValueChange={(val) => setTraits({...traits, shyFlirty: val})} 
                        />
                        <CustomSlider 
                            labelLeft="Pessimistic" labelRight="Optimistic" 
                            value={traits.pessOpt} 
                            onValueChange={(val) => setTraits({...traits, pessOpt: val})} 
                        />
                        <CustomSlider 
                            labelLeft="Ordinary" labelRight="Mysterious" 
                            value={traits.ordMyst} 
                            onValueChange={(val) => setTraits({...traits, ordMyst: val})} 
                        />
                    </View>

                    <Text style={styles.sectionLabel}>Extra Details</Text>
                    <TextInput 
                        style={styles.textArea} 
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
    );
}

// Slide 4: Set Girl Name (Custom Only)
function SlideGirlName({ girlName, setGirlName, selectedAvatar }) {
    return (
        <View style={styles.slideFull}>
            <Animated.Text entering={FadeInDown} style={styles.titleAbsolute}>
                Set Girl Name
            </Animated.Text>
            
            <View style={styles.girlNameWrapper}>
                <TextInput 
                    style={styles.transparentInput} 
                    placeholder="Enter name..." 
                    placeholderTextColor="rgba(255,255,255,0.5)" 
                    value={girlName} 
                    onChangeText={setGirlName} 
                    autoFocus
                />
            </View>
        </View>
    );
}

// Slide 5: Select Your Goals
function SlideGoals({ selectedGoals, setSelectedGoals }) {
    const toggleGoal = (goal) => {
        if (selectedGoals.includes(goal)) {
            setSelectedGoals(selectedGoals.filter(g => g !== goal));
        } else {
            setSelectedGoals([...selectedGoals, goal]);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.slideScrollCenter}>
            <Animated.Text entering={FadeInDown} style={styles.title}>
                Select Your Goals
            </Animated.Text>
            <Animated.Text entering={FadeInDown.delay(100)} style={styles.subtitle}>
                Please tell us what you're looking for in your relationship. It'll help us personalize your experience.
            </Animated.Text>

            <View style={styles.goalsContainer}>
                {GOALS.map((goal, idx) => {
                    const isSelected = selectedGoals.includes(goal);
                    return (
                        <Animated.View key={goal} entering={FadeInUp.delay(150 + idx * 50)}>
                            <TouchableOpacity 
                                onPress={() => toggleGoal(goal)}
                                style={[styles.goalPill, isSelected && styles.goalPillSelected]}
                            >
                                <Text style={[styles.goalText, isSelected && styles.goalTextSelected]}>
                                    {goal}
                                </Text>
                            </TouchableOpacity>
                        </Animated.View>
                    );
                })}
            </View>
        </ScrollView>
    );
}

// Slide 6: Creating Avatar
function SlideCreating({ selectedAvatar, onComplete }) {
    const progress = useSharedValue(0);
    const [step, setStep] = useState(0);

    useEffect(() => {
        progress.value = withTiming(1, { duration: 3000, easing: Easing.linear });
        
        setTimeout(() => setStep(1), 1000);
        setTimeout(() => setStep(2), 2000);
        setTimeout(() => {
            setStep(3);
            onComplete();
        }, 3200);
    }, []);

    const ProgressCheck = ({ label, active }) => (
        <View style={styles.progressRow}>
            <View style={[styles.progressCircle, active && styles.progressCircleActive]}>
                {active && <Ionicons name="checkmark" size={16} color={THEME.bg} />}
            </View>
            <Text style={[styles.progressLabel, active && styles.progressLabelActive]}>{label}</Text>
        </View>
    );

    return (
        <View style={styles.slideFull}>
            <View style={styles.darkOverlay} />

            <View style={styles.creatingCenter}>
                <Text style={styles.creatingTitle}>Creating avatar</Text>
                
                <View style={styles.spinnerWrap}>
                    <View style={styles.spinnerRing} />
                    <Text style={styles.spinnerText}>100%</Text>
                </View>

                <View style={styles.progressList}>
                    <ProgressCheck label="Analyzing your information" active={step >= 1} />
                    <ProgressCheck label="Gathering Content" active={step >= 2} />
                    <ProgressCheck label="Creating Avatar" active={step >= 3} />
                </View>
            </View>
        </View>
    );
}

// --- AUTH SCREEN ---
function AuthScreen({ onResetOnboarding }) {
    const insets = useSafeAreaInsets();
    const { setOnboarded, setGuestMode } = useStore();
    const [loading, setLoading] = useState(false);

    const handleGuestSignIn = async () => {
        setLoading(true);
        await setGuestMode(true);
        await setOnboarded();
        posthog.capture('guest_mode_entered_ai_girl');
        setLoading(false);
    };

    return (
        <View style={[styles.container, { justifyContent: 'center', paddingHorizontal: 24 }]}>
            <Animated.View entering={ZoomIn}>
                <Text style={styles.title}>You're all set!</Text>
                <Text style={styles.subtitle}>Let's save your profile to start chatting.</Text>
            </Animated.View>

            <TouchableOpacity 
                onPress={handleGuestSignIn} 
                style={[styles.primaryBtn, { marginTop: 40 }]} 
                disabled={loading}
            >
                <Text style={styles.primaryBtnText}>{loading ? 'Loading...' : 'Continue as Guest'}</Text>
            </TouchableOpacity>
        </View>
    );
}

// --- MAIN ONBOARDING ---
export default function OnboardingScreen() {
    const insets = useSafeAreaInsets();
    const [currentSlide, setCurrentSlide] = useState(0);
    const [showAuth, setShowAuth] = useState(false);

    // Fetch personas
    const [personas, setPersonas] = useState([]);
    const [loadingPersonas, setLoadingPersonas] = useState(true);

    // Form State
    const [userName, setUserName] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState(null);
    const [traits, setTraits] = useState({ shyFlirty: 0.5, pessOpt: 0.5, ordMyst: 0.5 });
    const [extraDemand, setExtraDemand] = useState('');
    const [girlName, setGirlName] = useState('');
    const [selectedGoals, setSelectedGoals] = useState([]);

    const totalSlides = 6;

    useEffect(() => {
        const fetchPersonas = async () => {
            try {
                const { data, error } = await supabase.from('ai_personas').select('*').eq('is_visible', true).order('created_at', { ascending: true });
                if (data && data.length > 0) {
                    setPersonas(data);
                    setSelectedAvatar(data[0]);
                } else {
                    const fallback = [
                        { id: 'fb1', name: 'Luna', image_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=540&h=960&fit=crop', personality: {shyFlirty: 0.8, pessOpt: 0.6, ordMyst: 0.9}, extra_demand: 'I love talking about the universe and stars.' },
                        { id: 'fb2', name: 'Emma', image_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=540&h=960&fit=crop', personality: {shyFlirty: 0.4, pessOpt: 0.9, ordMyst: 0.3}, extra_demand: 'I am very practical and optimistic.' },
                        { id: 'custom_girl', name: 'Custom Girl', image_url: 'https://images.unsplash.com/photo-1525875975471-999f65706a10?w=540&h=960&fit=crop', personality: {shyFlirty: 0.5, pessOpt: 0.5, ordMyst: 0.5}, extra_demand: 'I am a custom AI persona.' }
                    ];
                    setPersonas(fallback);
                    setSelectedAvatar(fallback[0]);
                }
            } catch (err) {
                const fallback = [
                    { id: 'fb1', name: 'Luna', image_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=540&h=960&fit=crop', personality: {shyFlirty: 0.8, pessOpt: 0.6, ordMyst: 0.9}, extra_demand: 'I love talking about the universe and stars.' },
                    { id: 'fb2', name: 'Emma', image_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=540&h=960&fit=crop', personality: {shyFlirty: 0.4, pessOpt: 0.9, ordMyst: 0.3}, extra_demand: 'I am very practical and optimistic.' },
                    { id: 'custom_girl', name: 'Custom Girl', image_url: 'https://images.unsplash.com/photo-1525875975471-999f65706a10?w=540&h=960&fit=crop', personality: {shyFlirty: 0.5, pessOpt: 0.5, ordMyst: 0.5}, extra_demand: 'I am a custom AI persona.' }
                ];
                setPersonas(fallback);
                setSelectedAvatar(fallback[0]);
            }
            setLoadingPersonas(false);
        };
        fetchPersonas();
    }, []);

    const handleNext = () => {
        if (currentSlide === 0 && !userName.trim()) return Alert.alert('Oops', 'Please enter your name');
        
        if (currentSlide === 1) {
            if (selectedAvatar?.id !== 'custom') {
                // If a predefined girl is selected, populate her data and skip custom slides
                if (selectedAvatar) {
                    setTraits(typeof selectedAvatar.personality === 'string' ? JSON.parse(selectedAvatar.personality) : selectedAvatar.personality);
                    setGirlName(selectedAvatar.name);
                    setExtraDemand(selectedAvatar.extra_demand || '');
                }
                setCurrentSlide(4);
                return;
            }
        }
        
        if (currentSlide === 3 && !girlName.trim()) return Alert.alert('Oops', 'Please give her a name');

        if (currentSlide < totalSlides - 1) {
            setCurrentSlide(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentSlide === 4 && selectedAvatar?.id !== 'custom') {
            setCurrentSlide(1);
            return;
        }
        if (currentSlide > 0) setCurrentSlide(prev => prev - 1);
    };

    const handleCreationComplete = () => {
        const finalAvatar = {
            ...selectedAvatar,
            name: selectedAvatar?.id === 'custom' ? girlName : selectedAvatar?.name,
            personality: selectedAvatar?.id === 'custom' ? traits : selectedAvatar?.personality,
            extra_demand: selectedAvatar?.id === 'custom' ? extraDemand : selectedAvatar?.extra_demand,
        };
        
        useStore.getState().setSelectedPersona(finalAvatar);
        
        useStore.setState({
            companionProfile: {
                userName,
                avatar: finalAvatar,
                traits,
                extraDemand,
                girlName,
                goals: selectedGoals
            }
        });
        setShowAuth(true);
    };

    if (showAuth) {
        return <AuthScreen />;
    }

    const renderSlide = () => {
        switch (currentSlide) {
            case 0: return <SlideName userName={userName} setUserName={setUserName} />;
            case 1: return <SlideChooseAvatar personas={personas} loading={loadingPersonas} selectedAvatar={selectedAvatar} setSelectedAvatar={setSelectedAvatar} />;
            case 2: return <SlidePersonality personas={personas} traits={traits} setTraits={setTraits} extraDemand={extraDemand} setExtraDemand={setExtraDemand} selectedAvatar={selectedAvatar} setSelectedAvatar={setSelectedAvatar} />;
            case 3: return <SlideGirlName girlName={girlName} setGirlName={setGirlName} selectedAvatar={selectedAvatar} />;
            case 4: return <SlideGoals selectedGoals={selectedGoals} setSelectedGoals={setSelectedGoals} />;
            case 5: return <SlideCreating selectedAvatar={selectedAvatar} onComplete={handleCreationComplete} />;
            default: return null;
        }
    };

    const isAutoSlide = currentSlide === 5;
    
    // Calculate step mapping for header
    let displayStep = 1;
    if (currentSlide === 1) displayStep = 2;
    if (currentSlide === 2) displayStep = 3;
    if (currentSlide === 3) displayStep = 4;
    if (currentSlide === 4) displayStep = selectedAvatar?.id !== 'custom' ? 3 : 5;

    return (
        <View style={styles.container}>
            {currentSlide === 0 ? (
                <Image source={require('../../assets/appinside1.png')} style={styles.fullBgImage} />
            ) : (
                selectedAvatar && selectedAvatar.image_url && (
                    <Image source={{ uri: selectedAvatar.image_url }} style={styles.fullBgImage} />
                )
            )}
            
            <LinearGradient colors={['transparent', 'rgba(4,11,22,0.9)', THEME.bg]} style={styles.globalBottomGradient} />
            
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                {!isAutoSlide && (
                    <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
                        <TouchableOpacity onPress={handleBack} style={{ padding: 8, opacity: currentSlide === 0 ? 0 : 1 }} disabled={currentSlide === 0}>
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.stepIndicator}>Step {displayStep} / {selectedAvatar?.id !== 'custom' ? 4 : 6}</Text>
                        <View style={{ width: 40 }} />
                    </View>
                )}

                <View style={{ flex: 1 }}>
                    {renderSlide()}
                </View>

                {!isAutoSlide && (
                    <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                        <TouchableOpacity onPress={handleNext} style={styles.primaryBtn} activeOpacity={0.8}>
                            <Text style={styles.primaryBtnText}>
                                {currentSlide === 1 && selectedAvatar?.id === 'custom' ? 'Make Custom AI Girl' : 'Continue'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, zIndex: 10 },
    stepIndicator: { color: THEME.primary, fontSize: 16, fontWeight: '600' },
    
    slideCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(4, 11, 22, 0.7)' },
    slideScrollCenter: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 100, backgroundColor: 'rgba(4, 11, 22, 0.7)' },
    slideFull: { flex: 1, backgroundColor: 'transparent', position: 'relative' },
    
    title: { fontSize: 28, fontWeight: '700', color: THEME.primary, textAlign: 'center', marginBottom: 12 },
    subtitle: { fontSize: 15, color: THEME.muted, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    titleAbsolute: { position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', fontSize: 24, fontWeight: '700', color: THEME.primary, zIndex: 10 },
    
    inputLabel: { color: THEME.primary, fontSize: 16, marginBottom: 12, textAlign: 'center' },
    inputWrap: { width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    input: { width: '100%', paddingVertical: 18, paddingHorizontal: 20, color: THEME.primary, fontSize: 16 },
    
    fullBgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', resizeMode: 'cover' },
    globalBottomGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.6 },
    darkOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
    
    personalityBox: { position: 'absolute', bottom: 170, left: 24, right: 24, backgroundColor: 'rgba(0,0,0,0.6)', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    personalityText: { color: 'rgba(255,255,255,0.95)', fontSize: 15, textAlign: 'center', lineHeight: 22, fontWeight: '500' },

    carouselContainer: { position: 'absolute', bottom: 40, left: 0, right: 0 },
    addBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: THEME.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: THEME.bg },
    proBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
    avatarThumbWrap: { width: 64, height: 64 * (16/9), borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', opacity: 0.6 },
    avatarThumbSelected: { borderColor: THEME.primary, opacity: 1, shadowColor: THEME.primary, shadowOffset: {width: 0, height: 0}, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 },
    avatarThumb: { width: '100%', height: '100%', resizeMode: 'cover' },

    customContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingBottom: 24, paddingTop: 60 },
    sectionLabel: { color: THEME.primary, fontSize: 16, fontWeight: '600', marginBottom: 12 },
    slidersWrapperInline: { gap: 24, marginBottom: 24 },
    
    sliderContainer: { width: '100%' },
    sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    sliderLabel: { color: THEME.primary, fontSize: 15, fontWeight: '500' },
    sliderTrackHitArea: { height: 40, justifyContent: 'center', position: 'relative' },
    sliderTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, width: '100%' },
    sliderFill: { position: 'absolute', left: 0, height: '100%', backgroundColor: THEME.accent, borderRadius: 2 },
    sliderThumb: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: THEME.primary, top: 8, marginLeft: -12, elevation: 4, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.3, shadowRadius: 3 },

    textArea: { width: '100%', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', color: THEME.primary, fontSize: 16, padding: 16, textAlignVertical: 'top' },

    girlNameWrapper: { position: 'absolute', bottom: 40, left: 24, right: 24 },
    transparentInput: { width: '100%', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', color: THEME.primary, fontSize: 18, paddingVertical: 18, paddingHorizontal: 24 },

    goalsContainer: { width: '100%', alignItems: 'center', gap: 16 },
    goalPill: { width: '100%', paddingVertical: 18, borderRadius: 30, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center' },
    goalPillSelected: { backgroundColor: THEME.primary, borderColor: THEME.primary },
    goalText: { color: THEME.primary, fontSize: 16, fontWeight: '600' },
    goalTextSelected: { color: THEME.bg },

    creatingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    creatingTitle: { fontSize: 24, fontWeight: '700', color: THEME.primary, marginBottom: 40 },
    spinnerWrap: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 50 },
    spinnerRing: { position: 'absolute', width: '100%', height: '100%', borderRadius: 60, borderWidth: 4, borderColor: THEME.primary, borderLeftColor: 'transparent', transform: [{ rotate: '45deg' }] },
    spinnerText: { color: THEME.primary, fontSize: 18, fontWeight: '700' },
    progressList: { width: '100%', gap: 20 },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    progressCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    progressCircleActive: { backgroundColor: THEME.primary },
    progressLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '500' },
    progressLabelActive: { color: THEME.primary, fontWeight: '700' },

    bottomControls: { paddingHorizontal: 24, paddingTop: 16, backgroundColor: 'transparent' },
    primaryBtn: { backgroundColor: THEME.primary, paddingVertical: 18, borderRadius: 30, alignItems: 'center' },
    primaryBtnText: { color: THEME.bg, fontSize: 18, fontWeight: '700' },
});
