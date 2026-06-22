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
    Switch
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale, height } from '../utils/responsive';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    ZoomIn,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as StoreReview from 'expo-store-review';
import { Colors, Radii, Shadows } from '../theme';
import { useAuth } from '../features/auth/AuthProvider';
import useStore from '../store/useStore';
import { posthog } from '../lib/posthog';

// ─── Custom Pill Component ───
function SelectablePill({ label, isSelected, onPress, icon }) {
    return (
        <Animated.View entering={FadeInDown.springify().mass(0.6)} style={{ width: '100%', marginBottom: 12 }}>
            <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.pill, isSelected && styles.pillSelected]}>
                {icon && <Ionicons name={icon} size={20} color={isSelected ? Colors.accent : Colors.textSecondary} style={{ marginRight: 12 }} />}
                <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>{label}</Text>
                {isSelected && <Ionicons name="checkmark-circle" size={20} color={Colors.accent} style={{ marginLeft: 'auto' }} />}
            </TouchableOpacity>
        </Animated.View>
    );
}

// ════════════════════════════════
// NEW SLIDE FUNNEL
// ════════════════════════════════

const MASONRY_ITEMS = [
    { type: 'text', title: 'My doctor said my iron is low, now what?', tag: 'Lab results' },
    { type: 'image', source: { uri: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=600&auto=format&fit=crop' } },
    { type: 'text', title: 'Why do I always feel tired after eating?', tag: 'Symptom check' },
    { type: 'text', title: 'Is this amount of stress normal?', tag: 'Mental health' },
    { type: 'text', title: '#1 Medical AI Worldwide', tag: 'Global' },
    { type: 'image', source: { uri: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=600&auto=format&fit=crop' } },
    { type: 'text', title: 'My doctor said my iron is low, now what?', tag: 'Lab results' },
    { type: 'text', title: 'Why do I always feel tired after eating?', tag: 'Symptom check' },
    { type: 'text', title: 'Is this amount of stress normal?', tag: 'Mental health' },
    { type: 'text', title: '#1 Medical AI Worldwide', tag: 'Global' },
];

function ScrollingMasonry() {
    const translateY = useSharedValue(0);

    useEffect(() => {
        translateY.value = withRepeat(
            withTiming(-400, { duration: 15000, easing: Easing.linear }),
            -1,
            false
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value }]
        };
    });

    const leftCol = MASONRY_ITEMS.filter((_, i) => i % 2 === 0);
    const rightCol = MASONRY_ITEMS.filter((_, i) => i % 2 !== 0);

    const renderCard = (item, idx) => {
        if (item.type === 'text') {
            return (
                <View key={idx} style={styles.masonryCard}>
                    {item.tag && (
                        <View style={styles.masonryTag}>
                            <Text style={styles.masonryTagText}>{item.tag}</Text>
                        </View>
                    )}
                    <Text style={styles.masonryTitle}>{item.title}</Text>
                </View>
            );
        }
        return (
            <Image key={idx} source={item.source} style={styles.masonryImage} />
        );
    };

    return (
        <View style={styles.masonryWrapper}>
            <Animated.View style={[styles.masonryColumns, animatedStyle]}>
                <View style={styles.masonryCol}>
                    {leftCol.map(renderCard)}
                </View>
                <View style={[styles.masonryCol, { marginTop: 40 }]}>
                    {rightCol.map(renderCard)}
                </View>
            </Animated.View>
            <LinearGradient
                colors={['transparent', '#FCFBF8']}
                style={styles.masonryGradientBottom}
                pointerEvents="none"
            />
        </View>
    );
}

function SlideWelcome() {
    return (
        <View style={[styles.slideContent, { justifyContent: 'flex-end', paddingTop: 0 }]}>
            <View style={styles.masonryAbsolute}>
                <ScrollingMasonry />
            </View>
            <View style={styles.welcomeTextOverlay}>
                <Animated.Text entering={FadeInDown.delay(200)} style={[styles.superText, { color: Colors.textMuted }]}>
                    #1 Medical AI Worldwide
                </Animated.Text>
                <Animated.Text entering={FadeInUp.delay(500)} style={styles.slideTitle}>
                    MedGPT, a health companion that actually knows you
                </Animated.Text>
                <Animated.Text entering={FadeInUp.delay(700)} style={styles.slideSubtext}>
                    Healthcare that finally puts you first. Personal. Accurate. Available when you need it.
                </Animated.Text>
            </View>
        </View>
    );
}

const FloatingBubble = ({ text, top, left, right, delay = 0 }) => {
    return (
        <Animated.View
            entering={FadeInDown.delay(delay).springify().damping(12)}
            style={{
                position: 'absolute',
                top,
                left,
                right,
                backgroundColor: 'rgba(255, 255, 255, 0.85)', // translucent
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 24,
                ...Shadows.soft,
            }}
        >
            <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: '500' }}>{text}</Text>
        </Animated.View>
    );
};

function SlideClarity() {
    return (
        <View style={[styles.slideContent, { justifyContent: 'flex-end', paddingTop: 0 }]}>
            <View style={styles.masonryAbsolute}>
                <Image source={{ uri: 'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?q=80&w=800&auto=format&fit=crop' }} style={{ width: '100%', height: '100%', resizeMode: 'cover', opacity: 0.8 }} />
                <LinearGradient
                    colors={['transparent', '#FCFBF8']}
                    style={styles.masonryGradientBottom}
                    pointerEvents="none"
                />
                <FloatingBubble text="No fracture, mild inflammation" top="20%" right={20} delay={300} />
                <FloatingBubble text="Dyslipidemia = high cholesterol" top="45%" left={10} delay={600} />
                <FloatingBubble text="WBC count looks healthy" top="70%" right={10} delay={900} />
            </View>
            <View style={styles.welcomeTextOverlay}>
                <Animated.View entering={FadeInDown.delay(200)} style={styles.pillBadge}>
                    <Ionicons name="bulb-outline" size={16} color={Colors.accent} />
                    <Text style={styles.pillBadgeText}>CLARITY</Text>
                </Animated.View>
                <Animated.Text entering={FadeInDown.delay(400)} style={styles.slideTitle}>
                    I speak doctor.{'\n'}Without the jargon.
                </Animated.Text>
                <Animated.Text entering={FadeInDown.delay(500)} style={styles.slideSubtext}>
                    Lab results, prescriptions, imaging reports - send them over. I'll explain what matters and keep it all simple and easy to find.
                </Animated.Text>
            </View>
        </View>
    );
}

function SlideAvailability() {
    return (
        <View style={[styles.slideContent, { justifyContent: 'flex-end', paddingTop: 0 }]}>
            <View style={styles.masonryAbsolute}>
                <Image source={{ uri: 'https://images.unsplash.com/photo-1516841273335-e39b37888115?q=80&w=800&auto=format&fit=crop' }} style={{ width: '100%', height: '100%', resizeMode: 'cover', opacity: 0.6 }} />
                <LinearGradient
                    colors={['transparent', '#FCFBF8']}
                    style={styles.masonryGradientBottom}
                    pointerEvents="none"
                />
                <FloatingBubble text="Is it normal to feel this tired?" top="25%" left={20} delay={300} />
                <FloatingBubble text="Can I take this with food?" top="50%" right={20} delay={600} />
                <FloatingBubble text="My head is throbbing..." top="75%" left={30} delay={900} />
            </View>
            <View style={styles.welcomeTextOverlay}>
                <Animated.View entering={FadeInDown.delay(200)} style={[styles.pillBadge, { borderColor: '#E5A4B1' }]}>
                    <Ionicons name="heart-outline" size={16} color="#E5A4B1" />
                    <Text style={[styles.pillBadgeText, { color: '#E5A4B1' }]}>ALWAYS HERE</Text>
                </Animated.View>
                <Animated.Text entering={FadeInDown.delay(400)} style={styles.slideTitle}>
                    No rush.{'\n'}I'll be here.
                </Animated.Text>
                <Animated.Text entering={FadeInDown.delay(500)} style={styles.slideSubtext}>
                    Ask me a question at 2am. Come back after months of silence. There's no wrong time for this, and I'm not going anywhere.
                </Animated.Text>
            </View>
        </View>
    );
}

function SlideProfile({ name, setName, age, setAge, sex, setSex }) {
    return (
        <View style={styles.slideContent}>
            <Animated.View entering={FadeInDown.delay(200)} style={styles.pillBadge}>
                <Ionicons name="person-outline" size={16} color={Colors.accent} />
                <Text style={styles.pillBadgeText}>PROFILE</Text>
            </Animated.View>
            <Animated.Text entering={FadeInDown.delay(300)} style={styles.slideTitle}>
                Tell me about yourself
            </Animated.Text>
            <Animated.Text entering={FadeInDown.delay(400)} style={styles.slideSubtext}>
                This helps me provide more accurate and personalized medical advice.
            </Animated.Text>

            <Animated.View entering={FadeInDown.delay(500)} style={{ width: '100%', gap: 16, marginTop: 24 }}>
                <View style={styles.inputWrap}>
                    <Ionicons name="person-circle-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="Your Name" placeholderTextColor={Colors.textMuted} value={name} onChangeText={setName} />
                </View>
                <View style={styles.inputWrap}>
                    <Ionicons name="calendar-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="Age" placeholderTextColor={Colors.textMuted} value={age} onChangeText={setAge} keyboardType="numeric" maxLength={3} />
                </View>

                <Text style={{ fontSize: 13, color: Colors.textMuted, fontWeight: '600', marginTop: 8 }}>BIOLOGICAL SEX</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity style={[styles.sexPill, sex === 'Male' && styles.sexPillSelected]} onPress={() => setSex('Male')}>
                        <Text style={[styles.sexPillText, sex === 'Male' && styles.sexPillTextSelected]}>Male</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.sexPill, sex === 'Female' && styles.sexPillSelected]} onPress={() => setSex('Female')}>
                        <Text style={[styles.sexPillText, sex === 'Female' && styles.sexPillTextSelected]}>Female</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );
}

function SlideHealth({ diseases, setDiseases }) {
    const DISEASES = [
        'PCOS', 'Infertility', 'Early Puberty', 'Breast Cancer',
        'Birth Defects', 'Thyroid Issues', 'Eczema / Psoriasis', 'Hormonal Acne',
    ];

    const [customInput, setCustomInput] = useState('');
    const [isAddingCustom, setIsAddingCustom] = useState(false);

    const toggleArrayItem = (item) => {
        setDiseases(prev => {
            if (item === 'None') return [];
            const fresh = prev.filter(p => p !== 'None');
            if (fresh.includes(item)) return fresh.filter(i => i !== item);
            return [...fresh, item];
        });
    };

    const handleAddCustom = () => {
        const trimmed = customInput.trim();
        if (trimmed && !diseases.includes(trimmed)) {
            setDiseases(prev => [...prev.filter(p => p !== 'None'), trimmed]);
        }
        setCustomInput('');
        setIsAddingCustom(false);
    };

    return (
        <View style={styles.slideContent}>
            <Animated.View entering={FadeInDown.delay(200)} style={[styles.pillBadge, { borderColor: '#ef4444' }]}>
                <Ionicons name="medical-outline" size={16} color="#ef4444" />
                <Text style={[styles.pillBadgeText, { color: '#ef4444' }]}>HEALTH</Text>
            </Animated.View>
            <Animated.Text entering={FadeInDown.delay(300)} style={styles.slideTitle}>
                Any health concerns?
            </Animated.Text>
            <Animated.Text entering={FadeInDown.delay(400)} style={styles.slideSubtext}>
                Select any conditions you want the AI to watch out for when analyzing your results.
            </Animated.Text>

            <Animated.View entering={FadeInDown.delay(500)} style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 24 }}>
                {DISEASES.map(d => (
                    <TouchableOpacity key={d} style={[styles.miniPill, diseases.includes(d) && styles.miniPillSelected]} onPress={() => toggleArrayItem(d)}>
                        <Text style={[styles.miniPillText, diseases.includes(d) && styles.miniPillTextSelected]}>{d}</Text>
                    </TouchableOpacity>
                ))}
                {/* Show user-added custom conditions */}
                {diseases.filter(d => !DISEASES.includes(d) && d !== 'None').map(custom => (
                    <TouchableOpacity key={custom} style={[styles.miniPill, styles.miniPillSelected]} onPress={() => toggleArrayItem(custom)}>
                        <Text style={[styles.miniPillText, styles.miniPillTextSelected]}>{custom}</Text>
                    </TouchableOpacity>
                ))}
                {/* Add custom input pill */}
                {isAddingCustom ? (
                    <View style={[styles.miniPill, { borderColor: Colors.accent, borderStyle: 'solid', minWidth: 120 }]}>
                        <TextInput
                            style={{ fontSize: 14, fontWeight: '600', color: Colors.primary, flex: 1, paddingVertical: 0 }}
                            autoFocus
                            placeholder="Type here..."
                            placeholderTextColor={Colors.textMuted}
                            value={customInput}
                            onChangeText={setCustomInput}
                            onSubmitEditing={handleAddCustom}
                            onBlur={() => { setIsAddingCustom(false); setCustomInput(''); }}
                            returnKeyType="done"
                        />
                    </View>
                ) : (
                    <TouchableOpacity style={[styles.miniPill, { borderColor: Colors.accent, borderStyle: 'dashed' }]} onPress={() => setIsAddingCustom(true)}>
                        <Ionicons name="add" size={14} color={Colors.accent} />
                        <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.accent, marginLeft: 4 }}>Add</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.miniPill, diseases.includes('None') && styles.miniPillSelected]} onPress={() => toggleArrayItem('None')}>
                    <Text style={[styles.miniPillText, diseases.includes('None') && styles.miniPillTextSelected]}>None of the above</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

// ════════════════════════════════
// AUTHENTICATION & PAYWALL
// ════════════════════════════════
function AuthScreen({ onResetOnboarding }) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const insets = useSafeAreaInsets();

    const { signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail } = useAuth();
    const { setOnboarded, setGuestMode } = useStore();

    const handleAuthSuccess = (method, isNewUser = false) => {
        if (isNewUser) {
            posthog.capture('user signed up', { signup_method: method });
        } else {
            posthog.capture('user logged in', { login_method: method });
        }
    };

    const handleGoogleSignIn = async () => {
        if (loading) return;
        setLoading(true);
        posthog.capture('signup_attempted', { method: 'google' });
        try {
            setError('');
            const data = await signInWithGoogle();
            if (data?.session || data?.user) {
                const isNewUser = new Date(data.user?.created_at).getTime() > Date.now() - 60000;
                handleAuthSuccess('google', isNewUser);
            }
        } catch (err) {
            const errorMsg = err.message?.includes('provider') ? 'Google sign-in is not enabled yet.' : err.message;
            posthog.capture('auth failed', { method: 'google', reason: errorMsg, error_code: err?.code });
            posthog.capture('signup_failed', { method: 'google', error_code: err?.code, error_message: errorMsg });
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleAppleSignIn = async () => {
        if (loading) return;
        setLoading(true);
        posthog.capture('signup_attempted', { method: 'apple' });
        try {
            setError('');
            const data = await signInWithApple();
            if (data?.session || data?.user) {
                const isNewUser = new Date(data.user?.created_at).getTime() > Date.now() - 60000;
                handleAuthSuccess('apple', isNewUser);
            }
        } catch (err) {
            posthog.capture('auth failed', { method: 'apple', reason: err.message, error_code: err?.code });
            posthog.capture('signup_failed', { method: 'apple', error_code: err?.code, error_message: err.message });
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEmailAuth = async () => {
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password) {
            setError('Please enter both email and password.');
            return;
        }

        setError('');
        setLoading(true);
        posthog.capture(isLogin ? 'login_attempted' : 'signup_attempted', { method: 'email' });

        try {
            if (isLogin) {
                const data = await signInWithEmail(trimmedEmail, password);
                if (data?.session || data?.user) {
                    handleAuthSuccess('email', false);
                }
            } else {
                const data = await signUpWithEmail(trimmedEmail, password);
                if (data?.session) {
                    handleAuthSuccess('email', true);
                } else if (data?.user) {
                    setError('Account created! Please check your email to verify.');
                }
            }
        } catch (err) {
            posthog.capture('auth failed', { method: 'email', is_login: isLogin, reason: err.message, error_code: err?.code });
            posthog.capture(isLogin ? 'login_failed' : 'signup_failed', { method: 'email', error_code: err?.code, error_message: err.message });
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGuestSignIn = async () => {
        await setGuestMode(true);
        await setOnboarded();
        posthog.capture('guest_mode_entered');
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.authContainer}>
            <ScrollView contentContainerStyle={[styles.authScrollContent, { paddingBottom: 40 + insets.bottom }]} keyboardShouldPersistTaps="handled">
                <Animated.View entering={ZoomIn.springify()} style={styles.authBrand}>
                    <Image source={require('../../assets/appinside1.png')} style={{ width: 140, height: 140, borderRadius: 24, marginBottom: 16, resizeMode: 'contain' }} />
                    <Text style={styles.authBrandText}>Med<Text style={styles.authAccent}>GPT</Text></Text>
                </Animated.View>
                <Animated.Text entering={FadeInDown.delay(100)} style={styles.authSubtitle}>{isLogin ? 'Welcome back' : 'Create your account'}</Animated.Text>

                <Animated.View entering={FadeInDown.delay(200)}>
                    <TouchableOpacity onPress={handleGoogleSignIn} style={styles.googleBtn} activeOpacity={0.8}>
                        <Ionicons name="logo-google" size={20} color="#4285F4" />
                        <Text style={styles.googleBtnText}>Continue with Google</Text>
                    </TouchableOpacity>

                    {Platform.OS === 'ios' && (
                        <AppleAuthentication.AppleAuthenticationButton
                            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                            cornerRadius={Radii.button}
                            style={styles.appleBtn}
                            onPress={handleAppleSignIn}
                        />
                    )}

                    <TouchableOpacity onPress={handleGuestSignIn} style={[styles.googleBtn, { marginTop: Platform.OS === 'ios' ? 0 : 0 }]} activeOpacity={0.8}>
                        <Ionicons name="person-outline" size={20} color={Colors.primary} />
                        <Text style={styles.googleBtnText}>Continue as Guest</Text>
                    </TouchableOpacity>
                </Animated.View>

                <Animated.View entering={FadeIn.delay(300)} style={styles.divider}>
                    <View style={styles.dividerLine} /><Text style={styles.dividerText}>or</Text><View style={styles.dividerLine} />
                </Animated.View>
                <Animated.View entering={FadeInDown.delay(350)} style={styles.inputWrap}>
                    <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                    <TextInput value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor={Colors.textMuted} keyboardType="email-address" autoCapitalize="none" style={styles.input} />
                </Animated.View>
                <Animated.View entering={FadeInDown.delay(400)} style={styles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                    <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={Colors.textMuted} secureTextEntry={!showPassword} style={styles.input} />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4, marginLeft: 'auto' }}>
                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.textMuted} />
                    </TouchableOpacity>
                </Animated.View>
                {error ? <Animated.Text entering={FadeIn} style={styles.errorText}>{error}</Animated.Text> : null}
                <Animated.View entering={FadeInDown.delay(450)}>
                    <TouchableOpacity onPress={handleEmailAuth} style={[styles.primaryBtn, loading && { opacity: 0.5 }]} disabled={loading} activeOpacity={0.8}>
                        <Text style={styles.primaryBtnText}>{loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}</Text>
                    </TouchableOpacity>
                </Animated.View>
                <Animated.View entering={FadeIn.delay(500)} style={styles.toggleRow}>
                    <Text style={styles.toggleText}>{isLogin ? "Don't have an account? " : 'Already have an account? '}</Text>
                    <TouchableOpacity onPress={() => { setIsLogin(!isLogin); setError(''); }}><Text style={styles.toggleLink}>{isLogin ? 'Sign Up' : 'Sign In'}</Text></TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const RATING_CARDS = [
    { text: "It read my complex lab reports and explained everything in simple terms. A complete lifesaver!" },
    { text: "Love having a health companion available 24/7 that answers all my concerns without any judgment." },
    { text: "Gives highly accurate answers and breaks down doctor jargon clearly. Highly recommend!" },
];

function SlideAppreciation({ onRatingGiven }) {
    const [rating, setRating] = useState(0);
    const [hasRated, setHasRated] = useState(false);

    const handleStarPress = (stars) => {
        if (hasRated) return; // Prevent multiple clicks
        setRating(stars);
        setHasRated(true);
        posthog.capture('onboarding_rating_given', { stars });
        if (onRatingGiven) {
            onRatingGiven(stars);
        }
    };

    return (
        <View style={styles.slideContent}>
            <Animated.Image
                entering={FadeInDown.delay(100)}
                source={require('../../assets/rating_header_banner.png')}
                style={styles.ratingBanner}
            />

            <Animated.View entering={FadeInDown.delay(200)} style={styles.ratingMissionBadge}>
                <Ionicons name="heart" size={14} color="#ef4444" />
                <Text style={styles.ratingMissionText}>OUR MISSION</Text>
            </Animated.View>

            <Animated.Text entering={FadeInDown.delay(300)} style={[styles.slideTitle, { textAlign: 'center', marginBottom: verticalScale(12) }]}>
                Built for you,{'\n'}with care
            </Animated.Text>

            <Animated.Text entering={FadeInDown.delay(400)} style={[styles.slideSubtext, { textAlign: 'center', marginBottom: 20 }]}>
                Our team puts immense effort into making MedGPT truly useful. We are working hard to build a health companion that genuinely cares about your well-being. <Text style={{ fontWeight: '700' }}>Your privacy and security matter to us.</Text>
            </Animated.Text>

            {/* Interactive Stars */}
            <Animated.Text entering={FadeInDown.delay(450)} style={{ fontSize: 13, fontWeight: '800', color: Colors.primary, marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Tap 5 stars to continue ❤️
            </Animated.Text>
            
            <Animated.View entering={ZoomIn.delay(500).springify()} style={styles.ratingStarsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                        key={star}
                        onPress={() => !hasRated && handleStarPress(star)}
                        activeOpacity={0.7}
                        style={styles.ratingStarBtn}
                    >
                        <Ionicons
                            name={star <= rating ? 'star' : 'star-outline'}
                            size={38}
                            color={star <= rating ? '#F5A623' : '#d1d5db'}
                        />
                    </TouchableOpacity>
                ))}
            </Animated.View>

            {hasRated && (
                <Animated.Text entering={FadeIn.duration(300)} style={styles.ratingThankYou}>
                    {rating === 5 ? "You're amazing! Thank you! 🎉" : 'Thank you for your feedback! ❤️'}
                </Animated.Text>
            )}

            {/* Slim Social Proof Cards */}
            <Animated.View entering={FadeInDown.delay(600)} style={styles.ratingReviewsWrap}>
                {RATING_CARDS.map((card, idx) => (
                    <View key={idx} style={styles.ratingReviewCard}>
                        <View style={styles.ratingReviewStarsRow}>
                            {[1, 2, 3, 4, 5].map(s => (
                                <Ionicons key={s} name="star" size={11} color="#F5A623" style={{ marginRight: 2 }} />
                            ))}
                        </View>
                        <Text style={styles.ratingReviewText} numberOfLines={2}>{card.text}</Text>
                    </View>
                ))}
            </Animated.View>
        </View>
    );
}

// ════════════════════════════════
// NEW AI TERMS SLIDE
// ════════════════════════════════
function SlideAITerms({ acceptedTerms, setAcceptedTerms }) {
    return (
        <View style={styles.slideContent}>
            <Animated.View entering={ZoomIn.duration(400).springify()} style={[styles.pillBadge, { borderColor: '#10B981', backgroundColor: '#F0FDF4', marginBottom: 16 }]}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={[styles.pillBadgeText, { color: '#10B981' }]}>READY TO GO</Text>
            </Animated.View>

            <Animated.Text entering={FadeInDown.delay(200)} style={[styles.slideTitle, { textAlign: 'center', marginBottom: 12 }]}>
                Your personalized health assistant is ready
            </Animated.Text>
            <Animated.Text entering={FadeInDown.delay(300)} style={[styles.slideSubtext, { textAlign: 'center', marginBottom: 32 }]}>
                Based on your health profile and goals
            </Animated.Text>

            <Animated.View entering={FadeInDown.delay(400)} style={{ width: '100%', gap: 16, marginBottom: 32 }}>
                <View style={styles.featureCard}>
                    <View style={styles.featureIconWrap}>
                        <Ionicons name="time" size={24} color={Colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.featureCardTitle}>24/7 Availability</Text>
                        <Text style={styles.featureCardDesc}>Your health assistant is always here.</Text>
                    </View>
                </View>

                <View style={styles.featureCard}>
                    <View style={[styles.featureIconWrap, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="flash" size={24} color="#F5A623" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.featureCardTitle}>Instant Analysis</Text>
                        <Text style={styles.featureCardDesc}>Fast and accurate insights from your medical reports.</Text>
                    </View>
                </View>

                <View style={styles.featureCard}>
                    <View style={[styles.featureIconWrap, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="shield-checkmark" size={24} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.featureCardTitle}>Privacy First</Text>
                        <Text style={styles.featureCardDesc}>Your data is secure and never stored.</Text>
                    </View>
                </View>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(500)} style={styles.termsBox}>
                <TouchableOpacity onPress={() => setAcceptedTerms(!acceptedTerms)} style={styles.termsCheckRow} activeOpacity={0.8}>
                    <View style={{ paddingTop: 2 }}>
                        <Ionicons 
                            name={acceptedTerms ? 'checkmark-circle' : 'ellipse-outline'} 
                            size={24} 
                            color={acceptedTerms ? Colors.accent : Colors.textMuted} 
                        />
                    </View>
                    <Text style={styles.termsText}>
                        I agree that MedGPT uses third-party AI services (like Google Models and Groq Models) to analyze my health data and provide insights. Data is{' '}
                        <Text style={styles.termsHighlight}>deleted after analysis</Text>
                        {' '}and not stored. By continuing, I agree to share chat messages and scanned reports with these providers.
                    </Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

// ════════════════════════════════
// ROOT ONBOARDING CONTAINER
// ════════════════════════════════
export default function OnboardingScreen() {
    const guestRequiresAuth = useStore(state => state.guestRequiresAuth);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [showAuth, setShowAuth] = useState(guestRequiresAuth);
    const [hasShownReview, setHasShownReview] = useState(false);
    const insets = useSafeAreaInsets();

    // Profiles
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [sex, setSex] = useState('');

    // Health Prefs
    const [diseases, setDiseases] = useState([]);

    // AI Terms
    const [acceptedAITerms, setAcceptedAITerms] = useState(false);

    const totalSlides = Platform.OS === 'ios' ? 7 : 6;

    const handleBack = () => {
        if (currentSlide > 0) {
            setCurrentSlide(prev => prev - 1);
        }
    };

    const finishOnboarding = async () => {
        const payload = {
            name: name.trim(),
            age: age.trim(),
            sex,
            diseases
        };
        useStore.getState().setHealthPreferences(payload);
        await useStore.getState().setAcceptedAITerms(true);
        posthog.capture('onboarding completed', { age, sex, diseases });
        setShowAuth(true);
    };

    const handleRatingGiven = async (stars) => {
        if (stars === 5) {
            try {
                if (await StoreReview.hasAction()) {
                    await StoreReview.requestReview();
                }
            } catch (error) {
                console.log(error);
            }
            setTimeout(() => {
                if (Platform.OS === 'ios') setCurrentSlide(6);
                else finishOnboarding();
            }, 1500);
        } else {
            setTimeout(() => {
                if (Platform.OS === 'ios') setCurrentSlide(6);
                else finishOnboarding();
            }, 1200);
        }
    };

    const handleNext = async () => {
        if (currentSlide < totalSlides - 1) {
            if (currentSlide === 3) {
                if (!name.trim() || !age.trim() || !sex) {
                    Alert.alert('Please complete', 'Please provide your name, age, and sex.');
                    return;
                }
            }
            setCurrentSlide(prev => prev + 1);
        } else {
            if (Platform.OS === 'ios' && currentSlide === 6 && !acceptedAITerms) {
                Alert.alert('Terms Required', 'Please accept the AI Data Privacy terms to continue.');
                return;
            }
            finishOnboarding();
        }
    };

    if (showAuth) {
        return (
            <AuthScreen
                onResetOnboarding={async () => {
                    await useStore.getState().clearOnboarding();
                    useStore.getState().setGuestRequiresAuth(false);
                    setShowAuth(false);
                    setCurrentSlide(0);
                }}
            />
        );
    }

    const renderSlide = () => {
        switch (currentSlide) {
            case 0: return <SlideWelcome />;
            case 1: return <SlideClarity />;
            case 2: return <SlideAvailability />;
            case 3: return <SlideProfile name={name} setName={setName} age={age} setAge={setAge} sex={sex} setSex={setSex} />;
            case 4: return <SlideHealth diseases={diseases} setDiseases={setDiseases} />;
            case 5: return <SlideAppreciation onRatingGiven={handleRatingGiven} />;
            case 6: return <SlideAITerms acceptedTerms={acceptedAITerms} setAcceptedTerms={setAcceptedAITerms} />;
            default: return <SlideWelcome />;
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.skipRow}>
                <Text style={styles.stepText}>{currentSlide + 1} / {totalSlides}</Text>
            </View>
            <ScrollView contentContainerStyle={styles.slideScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {renderSlide()}
            </ScrollView>
            <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? verticalScale(30) : verticalScale(20)) }]}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    {currentSlide > 0 && (
                        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.8}>
                            <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={handleNext} style={[styles.ctaBtn, { flex: 1, opacity: (Platform.OS === 'ios' && currentSlide === 6 && !acceptedAITerms) ? 0.5 : 1 }]} activeOpacity={0.8} disabled={Platform.OS === 'ios' && currentSlide === 6 && !acceptedAITerms}>
                        <Text style={styles.ctaBtnText}>
                            {currentSlide === totalSlides - 1 ? (Platform.OS === 'ios' ? 'I want my assistant now' : 'Commit for better health') : 'Continue'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FCFBF8' },
    skipRow: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: scale(16), paddingTop: Platform.OS === 'ios' ? verticalScale(56) : verticalScale(40), marginBottom: 20 },
    stepText: { color: Colors.textMuted, fontSize: moderateScale(14), fontWeight: '700', letterSpacing: 2 },
    slideScroll: { flexGrow: 1, paddingHorizontal: scale(24), paddingBottom: verticalScale(20) },
    slideContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: verticalScale(12) },

    // Masonry
    masonryAbsolute: { position: 'absolute', top: -50, left: -24, right: -24, height: height * 0.55 },
    masonryWrapper: { flex: 1, overflow: 'hidden' },
    masonryColumns: { flexDirection: 'row', paddingHorizontal: 16, gap: 12 },
    masonryCol: { flex: 1, gap: 12 },
    masonryCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, ...Shadows.soft },
    masonryTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 8 },
    masonryTagText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
    masonryTitle: { fontSize: 16, fontWeight: '600', color: Colors.primary, lineHeight: 22 },
    masonryImage: { width: '100%', height: 160, borderRadius: 16, resizeMode: 'cover' },
    masonryGradientBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 150 },
    welcomeTextOverlay: { zIndex: 10, width: '100%', backgroundColor: '#FCFBF8', paddingTop: 20, paddingBottom: 20 },

    // Pills
    pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 18, borderRadius: Radii.card, backgroundColor: Colors.white, borderWidth: 2, borderColor: 'transparent', ...Shadows.soft },
    pillSelected: { borderColor: '#2E7D5B', backgroundColor: '#F0FDF4' },
    pillText: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
    pillTextSelected: { color: '#2E7D5B', fontWeight: '700' },

    // Mini Pills
    miniPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: Radii.pill, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.borderLight },
    miniPillSelected: { backgroundColor: '#F0FDF4', borderColor: '#2E7D5B' },
    miniPillText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
    miniPillTextSelected: { color: '#2E7D5B', fontWeight: '700' },

    sexPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: Radii.button, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.borderLight },
    sexPillSelected: { backgroundColor: '#F0FDF4', borderColor: '#2E7D5B' },
    sexPillText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
    sexPillTextSelected: { color: '#2E7D5B', fontWeight: '700' },

    // Slides
    slideTitle: { fontSize: moderateScale(36), fontWeight: '500', color: Colors.primary, textAlign: 'left', lineHeight: moderateScale(42), letterSpacing: -1, marginBottom: verticalScale(16), width: '100%' },
    slideSubtext: { fontSize: moderateScale(17), color: '#555', textAlign: 'left', lineHeight: moderateScale(26), width: '100%' },
    superText: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16, width: '100%', fontWeight: '600' },
    pillBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#A2C4DD', marginBottom: 24 },
    pillBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginLeft: 6, color: '#A2C4DD' },

    // Controls
    bottomControls: { paddingHorizontal: scale(24), paddingBottom: Platform.OS === 'ios' ? verticalScale(40) : verticalScale(24), paddingTop: verticalScale(16), backgroundColor: 'transparent' },
    ctaBtn: { backgroundColor: Colors.accent, paddingVertical: verticalScale(18), borderRadius: Radii.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    ctaBtnText: { color: Colors.white, fontSize: moderateScale(16), fontWeight: '500' },
    backBtn: { backgroundColor: 'transparent', width: scale(60), alignItems: 'center', justifyContent: 'center' },
    reviewCard: { backgroundColor: Colors.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.soft },
    reviewCardText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

    // Auth
    authContainer: { flex: 1, backgroundColor: '#FCFBF8' },
    authScrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
    authBrand: { alignItems: 'center', marginBottom: 8 },
    authBrandText: { fontSize: 28, fontWeight: '900', color: Colors.primary, letterSpacing: -1 },
    authAccent: { color: '#2E7D5B' },
    authSubtitle: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', marginBottom: 32, fontWeight: '500' },
    googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Colors.white, paddingVertical: 16, borderRadius: Radii.button, borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 12, ...Shadows.soft },
    googleBtnText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
    appleBtn: { width: '100%', height: 50, marginBottom: 12 },
    divider: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 24 },
    dividerLine: { flex: 1, height: 1, backgroundColor: Colors.borderLight },
    dividerText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
    inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: Radii.input, paddingHorizontal: 16, ...Shadows.soft },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, paddingVertical: 16, fontSize: 15, color: Colors.primary, fontWeight: '500' },
    primaryBtn: { backgroundColor: '#2E7D5B', paddingVertical: 18, borderRadius: Radii.button, alignItems: 'center', marginTop: 12, ...Shadows.elevated },
    primaryBtnText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
    toggleRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
    toggleText: { fontSize: 14, color: Colors.textSecondary },
    toggleLink: { fontSize: 14, fontWeight: '700', color: '#2E7D5B' },
    errorText: { color: Colors.danger, fontSize: 13, marginBottom: 16, textAlign: 'center' },

    // Rating Slide Styles
    ratingBanner: { width: '100%', height: verticalScale(140), resizeMode: 'contain', marginBottom: verticalScale(12) },
    ratingMissionBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', backgroundColor: 'rgba(239, 68, 68, 0.04)', marginBottom: verticalScale(12), gap: 6 },
    ratingMissionText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: '#ef4444' },
    ratingStarsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: verticalScale(8) },
    ratingStarBtn: { padding: 6 },
    ratingThankYou: { fontSize: 14, fontWeight: '700', color: '#10B981', textAlign: 'center', marginBottom: verticalScale(12) },
    ratingReviewsWrap: { width: '100%', gap: 8, marginTop: verticalScale(4) },
    ratingReviewCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight, gap: 10 },
    ratingReviewStarsRow: { flexDirection: 'row', flexShrink: 0 },
    ratingReviewText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17, flex: 1 },

    // AI Terms Slide Styles
    featureCard: { flexDirection: 'row', backgroundColor: Colors.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.soft, alignItems: 'center' },
    featureIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    featureCardTitle: { fontSize: 16, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
    featureCardDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
    termsBox: { width: '100%', padding: 16, borderRadius: 16, backgroundColor: 'rgba(46, 125, 91, 0.05)', borderWidth: 1, borderColor: 'rgba(46, 125, 91, 0.2)' },
    termsCheckRow: { flexDirection: 'row', alignItems: 'flex-start' },
    termsText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginLeft: 12 },
    termsHighlight: { color: '#ef4444', fontWeight: '800' },
});
