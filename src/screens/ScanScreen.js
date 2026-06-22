import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Platform,
    Vibration,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
    useAnimatedStyle,
    withRepeat,
    withTiming,
    useSharedValue,
    withSequence,
    withDelay,
} from 'react-native-reanimated';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radii } from '../theme';
import useStore from '../store/useStore';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';
import AnalyzingOverlay from '../components/AnalyzingOverlay';

export default function ScanScreen({ navigation }) {
    const [permission, requestPermission] = useCameraPermissions();
    const [analyzing, setAnalyzing] = useState(false);
    const [scanPhase, setScanPhase] = useState('');
    const [torchOn, setTorchOn] = useState(false);
    const cameraRef = useRef(null);

    const { user, healthPreferences } = useStore();

    // ── Animations ──
    const scanLineY = useSharedValue(0);
    const cornerGlow = useSharedValue(0.5);

    useEffect(() => {
        scanLineY.value = withRepeat(
            withTiming(1, { duration: 2200 }),
            -1,
            true
        );
        cornerGlow.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1200 }),
                withTiming(0.5, { duration: 1200 }),
            ),
            -1,
            false
        );
    }, []);

    const scanLineStyle = useAnimatedStyle(() => ({
        top: `${scanLineY.value * 80 + 10}%`,
    }));

    const cornerGlowStyle = useAnimatedStyle(() => ({
        opacity: cornerGlow.value,
    }));

    const triggerHaptic = () => {
        try {
            if (Platform.OS === 'android') {
                Vibration.vibrate([0, 50]);
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (_) {}
    };

    const handleCapture = async () => {
        if (!cameraRef.current) return;

        // Fallback for existing users who already passed Onboarding but haven't accepted terms
        if (Platform.OS !== 'android' && !useStore.getState().hasAcceptedAITerms) {
            Alert.alert(
                'AI Data Privacy',
                'MedGPT uses third-party AI services (like Google Models and Groq Models) to analyze your health data and provide insights. Data is deleted after analysis and not stored. By continuing, you agree to share your chat messages and scanned reports with these providers.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                        text: 'I Agree', 
                        style: 'default', 
                        onPress: () => {
                            useStore.getState().setAcceptedAITerms(true);
                            handleCapture();
                        }
                    }
                ]
            );
            return;
        }

        try {
            triggerHaptic();
            setAnalyzing(true);
            setScanPhase('Capturing image...');
            
            const photo = await cameraRef.current.takePictureAsync({
                base64: true,
                quality: 0.7,
            });
            
            // Resize and compress
            const manipResult = await ImageManipulator.manipulateAsync(
                photo.uri,
                [{ resize: { width: 1024 } }],
                { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );
            
            setScanPhase('Returning to chat...');
            
            // Return to chat with the image URI for processing
            navigation.navigate({
                name: 'Chat',
                params: { 
                    scanImageUri: manipResult.uri,
                    scanMimeType: 'image/jpeg'
                },
                merge: true,
            });

        } catch (err) {
            console.error('Capture error:', err);
            Alert.alert('Error', 'Failed to capture image.');
        } finally {
            setAnalyzing(false);
            setScanPhase('');
        }
    };

    if (!permission) {
        return <LoadingSpinner message="Requesting camera permission..." />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <Ionicons name="camera-outline" size={64} color={Colors.textMuted} />
                <Text style={styles.permissionTitle}>Camera Access Required</Text>
                <Text style={styles.permissionText}>
                    MedGPT needs camera access to scan medical documents.
                </Text>
                <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn}>
                    <Text style={styles.permissionBtnText}>Continue</Text>
                </TouchableOpacity>
                {!permission.canAskAgain && (
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Text style={styles.backBtnText}>Go Back</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    if (analyzing) {
        return (
            <AnalyzingOverlay
                scanPhase={scanPhase}
                onCancel={() => {
                    setAnalyzing(false);
                    setScanPhase('');
                }}
            />
        );
    }

    return (
        <View style={styles.container}>
            <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="back"
                autofocus="on"
                enableTorch={torchOn}
            />

            {/* Overlays */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <LinearGradient
                    colors={['rgba(0,0,0,0.4)', 'transparent', 'transparent', 'rgba(0,0,0,0.6)']}
                    locations={[0, 0.25, 0.65, 1]}
                    style={StyleSheet.absoluteFill}
                />

                {/* Scanning overlay */}
                <View style={styles.scanOverlay}>
                    <Animated.View style={[styles.scanLine, scanLineStyle]}>
                        <LinearGradient
                            colors={['transparent', Colors.accent, 'transparent']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.scanLineGradient}
                        />
                    </Animated.View>

                    <Animated.View style={[styles.corner, styles.cornerTL, cornerGlowStyle]} />
                    <Animated.View style={[styles.corner, styles.cornerTR, cornerGlowStyle]} />
                    <Animated.View style={[styles.corner, styles.cornerBL, cornerGlowStyle]} />
                    <Animated.View style={[styles.corner, styles.cornerBR, cornerGlowStyle]} />
                </View>
            </View>

            {/* Top bar */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBarBtn}>
                    <Ionicons name="arrow-back" size={22} color={Colors.white} />
                </TouchableOpacity>
                <Text style={styles.topBarTitle}>MedGPT Scanner</Text>
                <TouchableOpacity onPress={() => setTorchOn(!torchOn)} style={[styles.topBarBtn, torchOn && styles.topBarBtnActive]}>
                    <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={20} color={torchOn ? '#f0c060' : Colors.white} />
                </TouchableOpacity>
            </View>

            {/* Bottom controls */}
            <View style={styles.bottomControls}>
                <View style={{ width: 48 }} /> 
                <TouchableOpacity onPress={handleCapture} style={styles.captureBtn}>
                    <View style={styles.captureBtnInner} />
                </TouchableOpacity>
                <View style={{ width: 48 }} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    camera: { flex: 1 },

    permissionContainer: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
    permissionTitle: { fontSize: 20, fontWeight: '800', color: Colors.primary, marginTop: 20, marginBottom: 8 },
    permissionText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24 },
    permissionBtn: { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: Radii.button },
    permissionBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
    backBtn: { marginTop: 12, padding: 8 },
    backBtnText: { fontSize: 14, color: Colors.textMuted },

    topBar: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    topBarBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    topBarBtnActive: {
        backgroundColor: 'rgba(240,192,96,0.2)',
        borderColor: 'rgba(240,192,96,0.3)',
    },
    topBarTitle: { color: Colors.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

    scanOverlay: {
        position: 'absolute',
        top: '12%',
        left: '6%',
        right: '6%',
        bottom: '25%',
    },
    scanLine: {
        position: 'absolute',
        left: -4,
        right: -4,
        height: 3,
    },
    scanLineGradient: {
        flex: 1,
        height: 3,
        borderRadius: 2,
    },
    corner: {
        position: 'absolute', width: 36, height: 36,
        borderColor: Colors.white,
        shadowColor: Colors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 8,
    },
    cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
    cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
    cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
    cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },

    bottomControls: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 40 : 30,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    captureBtn: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        borderColor: Colors.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.white },
});