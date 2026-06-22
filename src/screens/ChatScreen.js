import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Modal, TouchableWithoutFeedback, Keyboard, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme';
import Animated, { FadeInDown, FadeIn, SlideInDown, SlideOutDown, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay } from 'react-native-reanimated';
import { ChatService } from '../services/ChatService';
import useStore from '../store/useStore';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import GuestAuthModal from '../components/GuestAuthModal';

// Animated typing dots component
function TypingDots() {
    const dot1 = useSharedValue(0);
    const dot2 = useSharedValue(0);
    const dot3 = useSharedValue(0);

    useEffect(() => {
        const bounce = (sv, delay) => {
            sv.value = withDelay(delay, withRepeat(
                withSequence(
                    withTiming(-6, { duration: 300 }),
                    withTiming(0, { duration: 300 }),
                ),
                -1, // infinite
                false
            ));
        };
        bounce(dot1, 0);
        bounce(dot2, 150);
        bounce(dot3, 300);
    }, []);

    const style1 = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
    const style2 = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
    const style3 = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));

    return (
        <View style={styles.dotWrap}>
            <Animated.View style={[styles.typingDot, style1]} />
            <Animated.View style={[styles.typingDot, style2]} />
            <Animated.View style={[styles.typingDot, style3]} />
        </View>
    );
}

// Image with fallback — if the cloud URL is expired or file is deleted, shows a placeholder
function ChatImage({ uri }) {
    const [failed, setFailed] = React.useState(false);

    if (failed || !uri) {
        return (
            <View style={{ width: '100%', height: 120, borderRadius: 12, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="image-outline" size={32} color="rgba(255,255,255,0.5)" />
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 6, fontWeight: '500' }}>Image no longer available</Text>
            </View>
        );
    }

    return (
        <Image 
            source={{ uri }} 
            style={{ width: '100%', height: 160, borderRadius: 12, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.15)' }} 
            resizeMode="cover"
            onError={() => setFailed(true)}
        />
    );
}

export default function ChatScreen({ route, navigation }) {
    const [messages, setMessages] = useState([{ id: 1, role: 'assistant', text: "Hello! I'm MedGPT, your personal health companion. I remember your uploaded medical reports. How can I help you today?" }]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const scrollViewRef = useRef();
    const isProcessingRef = useRef(false);
    const { profile, user, isGuestMode } = useStore();
    const insets = useSafeAreaInsets();
    const [showGuestAuth, setShowGuestAuth] = useState(false);

    useEffect(() => {
        const loadHistory = async () => {
            const history = await ChatService.getChatHistory();
            if (history && history.length > 0) {
                setMessages(history);
            }
        };
        loadHistory();

        const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    useEffect(() => {
        if (route.params?.openUploadModal) {
            setTimeout(() => {
                checkAIConsent(() => setShowUploadModal(true));
            }, 300);
            navigation.setParams({ openUploadModal: undefined });
        }
    }, [route.params?.openUploadModal]);

    const checkAIConsent = (onSuccess) => {
        if (Platform.OS === 'android' || useStore.getState().hasAcceptedAITerms) {
            onSuccess();
            return;
        }
        Alert.alert(
            'AI Data Privacy',
            'MedGPT uses third-party AI services (like Google Models and Groq Models) to analyze your health data and provide insights and it is deleted after analyze not stored . By continuing, you agree to share your chat messages and scanned reports with these providers.',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'I Agree', 
                    style: 'default', 
                    onPress: () => {
                        useStore.getState().setAcceptedAITerms(true);
                        onSuccess();
                    }
                }
            ]
        );
    };

    const handleCopyToClipboard = async (text) => {
        await Clipboard.setStringAsync(text);
        Alert.alert('Copied', 'Message copied to clipboard.');
    };

    const handleGuestSignIn = () => {
        setShowGuestAuth(false);
        useStore.getState().setGuestRequiresAuth(true);
        useStore.getState().setGuestMode(false);
        useStore.getState().clearOnboarding();
    };

    const handleClearChat = () => {
        Alert.alert(
            "Clear Chat",
            "Are you sure you want to delete all chats?",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: async () => {
                        await ChatService.clearChatHistory();
                        setMessages([{ id: Date.now(), role: 'assistant', text: "Chat history cleared. How can I help you today?" }]);
                    }
                }
            ]
        );
    };

    const processDocumentAndChat = async (uri, mimeType, name, isImage) => {
        if (isGuestMode && !user) {
            setShowGuestAuth(true);
            return;
        }
        if (isProcessingRef.current) return;
        if (!uri) {
            Alert.alert('Error', 'No file selected. Please try again.');
            return;
        }
        isProcessingRef.current = true;

        // 1. Optimistic UI: Immediately show the image using the local phone URI
        const optimisticId = Date.now().toString() + Math.random().toString();
        const userMsg = { 
            id: optimisticId, 
            role: 'user', 
            text: `Uploaded: ${name}`, 
            isImage: isImage, 
            uri: uri, // local URI so it renders instantly
        };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true); // Shows typing dots

        try {
            // 2. processScan now: checks limit → uploads → gets cloud URL → analyzes
            const analysisData = await ChatService.processScan(uri, mimeType, name);

            // 3. Save user message to DB (store the cloud storagePath, not local URI)
            await ChatService.saveMessage('user', `Uploaded: ${name}`, isImage, analysisData.storagePath || null);

            // 4. Build AI response message
            const aiMsg = { 
                id: Date.now().toString() + Math.random().toString(), 
                role: 'assistant', 
                text: analysisData.summary || `I've analyzed your ${analysisData.report_type || 'document'}.` 
            };
            setMessages(prev => [...prev, aiMsg]);

            // 5. Save AI response to DB
            await ChatService.saveMessage('assistant', aiMsg.text);

        } catch (error) {
            console.error('Scan processing error:', error);
            let errorText = "I'm sorry, I couldn't analyze this document right now. Please try again.";
            
            if (error.message && (error.message.includes('RATE_LIMIT_EXCEEDED') || error.message.includes('rate limit') || error.message.includes('upgrade_required'))) {
                // Upgrade modal is already shown by ChatService — just add a gentle message
                useStore.getState().setShowUpgradeModal(true);
                errorText = "You've reached your daily scan limit. Upgrade to keep scanning!";
            } else if (error.message?.includes('Could not read')) {
                errorText = "I couldn't read the file. Please make sure it's a valid image or PDF and try again.";
            } else if (error.message?.includes('No file data') || error.message?.includes('No file')) {
                errorText = "The file couldn't be prepared for analysis. Please try uploading again.";
            } else if (error.message?.includes('Supabase not initialized')) {
                errorText = "Connection error. Please check your internet and try again.";
            } else if (error.message?.includes('upload') || error.message?.includes('Upload')) {
                errorText = "Failed to upload the file. Please check your connection and try again.";
            } else if (error.message?.includes('too large')) {
                errorText = error.message;
            }
            const errorMsg = { 
                id: Date.now().toString() + Math.random().toString(), 
                role: 'assistant', 
                text: errorText 
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
            isProcessingRef.current = false;
        }
    };

    useEffect(() => {
        if (route.params?.scanImageUri) {
            const { scanImageUri, scanMimeType } = route.params;
            
            // Clear the param so it doesn't trigger again
            navigation.setParams({ scanImageUri: undefined, scanMimeType: undefined });
            
            processDocumentAndChat(scanImageUri, scanMimeType || 'image/jpeg', 'Camera Capture', true);
        }
    }, [route.params?.scanImageUri]);

    const handleSend = async () => {
        if (isGuestMode && !user) {
            setShowGuestAuth(true);
            return;
        }
        if (!inputText.trim() || isProcessingRef.current) return;
        
        checkAIConsent(async () => {
            isProcessingRef.current = true;
            const userMsg = { id: Date.now().toString() + Math.random().toString(), role: 'user', text: inputText.trim() };
            setMessages(prev => [...prev, userMsg]);
            setInputText('');
            setIsLoading(true);

            try {
                const aiResponse = await ChatService.sendMessage(userMsg.text, messages);
                
                const aiMsg = { 
                    id: Date.now().toString() + Math.random().toString(), 
                    role: 'assistant', 
                    text: aiResponse.text || "I didn't quite catch that."
                };
                setMessages(prev => [...prev, aiMsg]);
            } catch (error) {
                console.error('Failed to send message:', error);
                let errorText = "I'm having trouble connecting right now.";
                
                if (error.message && (error.message.includes('RATE_LIMIT_EXCEEDED') || error.message.includes('rate limit') || error.message.includes('upgrade_required'))) {
                    useStore.getState().setShowUpgradeModal(true);
                    errorText = "You've reached your limit. Please upgrade to continue.";
                }

                const errorMsg = { 
                    id: Date.now().toString() + Math.random().toString(), 
                    role: 'assistant', 
                    text: errorText
                };
                setMessages(prev => [...prev, errorMsg]);
            } finally {
                setIsLoading(false);
                isProcessingRef.current = false;
            }
        });
    };

    const handleUploadFile = async () => {
        setShowUploadModal(false);
        if (isGuestMode && !user) {
            setShowGuestAuth(true);
            return;
        }
        if (isProcessingRef.current) return;
        setTimeout(async () => {
            try {
                const result = await DocumentPicker.getDocumentAsync({
                    type: ['application/pdf', 'image/*'],
                    copyToCacheDirectory: true,
                });
                if (!result.canceled && result.assets[0]) {
                    const asset = result.assets[0];
                    // Limit to 10MB to prevent React Native out-of-memory crashes
                    const sizeInBytes = asset.size || 0;
                    if (sizeInBytes > 10 * 1024 * 1024) {
                        const errorMsg = { 
                            id: Date.now().toString() + Math.random().toString(), 
                            role: 'assistant', 
                            text: `The file "${asset.name}" is too large (${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB). Please upload a file smaller than 10MB. Gemini works best with documents under this size.`
                        };
                        setMessages(prev => [...prev, errorMsg]);
                        return;
                    }
                    const mimeType = asset.mimeType || 'application/pdf';
                    const isImage = mimeType.startsWith('image/');
                    await processDocumentAndChat(asset.uri, mimeType, asset.name, isImage);
                }
            } catch (err) {
                console.log('Document picker error:', err);
            }
        }, 400);
    };

    const handleGallery = async () => {
        setShowUploadModal(false);
        if (isGuestMode && !user) {
            setShowGuestAuth(true);
            return;
        }
        if (isProcessingRef.current) return;
        setTimeout(async () => {
            try {
                const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    quality: 0.8,
                });
                if (!result.canceled && result.assets[0]) {
                    const asset = result.assets[0];
                    const sizeInBytes = asset.fileSize || 0;
                    if (sizeInBytes > 10 * 1024 * 1024) {
                        const errorMsg = { 
                            id: Date.now().toString() + Math.random().toString(), 
                            role: 'assistant', 
                            text: `This image is too large (${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB). Please upload an image smaller than 10MB.`
                        };
                        setMessages(prev => [...prev, errorMsg]);
                        return;
                    }
                    await processDocumentAndChat(asset.uri, asset.mimeType || 'image/jpeg', 'Gallery Image', true);
                }
            } catch (err) {
                console.log(err);
            }
        }, 400);
    };

    const handleCapture = () => {
        setShowUploadModal(false);
        if (isGuestMode && !user) {
            setShowGuestAuth(true);
            return;
        }
        navigation.navigate('Scan');
    };

    useEffect(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
    }, [messages, isLoading]);

    // Calculate exact tab bar height taking up space at bottom
    const bottomInset = Math.max(insets.bottom, 0);
    const tabBarHeight = 68;
    const tabBarMargin = Platform.OS === 'ios' ? 24 : 16;
    const totalTabBarSpace = tabBarHeight + tabBarMargin + bottomInset;
    // When keyboard is visible, KAV handles the offset — we only need minimal padding.
    // When hidden, we need enough to clear the floating tab bar.
    const inputPaddingBottom = keyboardVisible ? 8 : Math.max(16, totalTabBarSpace - 24);

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView 
                style={styles.keyboardAvoid} 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
            >
                <View style={styles.header}>
                    <View style={styles.headerTitleWrap}>
                        <Image source={require('../../assets/appinside1.png')} style={{ width: 66, height: 66, borderRadius: 8, marginRight: -12, resizeMode: 'contain' }} />
                        <Text style={styles.headerTitle}>MedGPT</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity onPress={handleClearChat} style={styles.memoryBtn}>
                            <Ionicons name="trash-outline" size={20} color={Colors.error || '#FF4444'} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => navigation.navigate('History')} style={[styles.memoryBtn, { marginLeft: 8 }]}>
                            <Ionicons name="folder-outline" size={20} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView 
                    ref={scrollViewRef}
                    contentContainerStyle={[styles.chatScroll, { paddingBottom: inputPaddingBottom + 80 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {messages.map((msg, index) => (
                        <Animated.View 
                            key={msg.id} 
                            entering={FadeInDown.delay(100).springify().damping(18)}
                            style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}
                        >
                            {msg.role === 'assistant' && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <View style={styles.aiIconWrap}>
                                        <Ionicons name="medical" size={14} color="#2E7D5B" />
                                    </View>
                                    <TouchableOpacity onPress={() => handleCopyToClipboard(msg.text)} style={styles.copyBtn}>
                                        <Ionicons name="copy-outline" size={16} color={Colors.textSecondary} />
                                        <Text style={styles.copyText}>Copy</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            {msg.role === 'user' ? (
                                <View>
                                    {msg.uri && msg.isImage ? (
                                        <ChatImage uri={msg.uri} />
                                    ) : msg.uri && !msg.isImage ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', padding: 12, borderRadius: 12, marginBottom: 8 }}>
                                            <Ionicons name="document-text" size={28} color="#fff" />
                                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', marginLeft: 10, flex: 1 }} numberOfLines={1}>PDF Document</Text>
                                        </View>
                                    ) : null}
                                    <Text style={[styles.messageText, styles.userText]}>
                                        {msg.text}
                                    </Text>
                                </View>
                            ) : (
                                <Markdown style={markdownStyles}>
                                    {msg.text}
                                </Markdown>
                            )}
                        </Animated.View>
                    ))}

                    {/* Example questions — shown only when no user messages exist yet */}
                    {messages.length === 1 && messages[0].role === 'assistant' && !isLoading && (
                        <Animated.View entering={FadeInDown.delay(300).springify().damping(18)} style={styles.suggestionsWrap}>
                            {[
                                { icon: 'heart-outline', text: 'What does my blood report mean?' },
                                { icon: 'fitness-outline', text: 'How can I improve my health?' },
                                { icon: 'medkit-outline', text: 'Explain my prescription to me' },
                            ].map((q, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={styles.suggestionChip}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        checkAIConsent(() => {
                                            setInputText(q.text);
                                            setTimeout(() => {
                                                const userMsg = { id: Date.now().toString() + Math.random().toString(), role: 'user', text: q.text };
                                                setMessages(prev => [...prev, userMsg]);
                                                setIsLoading(true);
                                                isProcessingRef.current = true;
                                                ChatService.sendMessage(q.text, messages).then(aiResponse => {
                                                    const aiMsg = { id: Date.now().toString() + Math.random().toString(), role: 'assistant', text: aiResponse.text || "I didn't quite catch that." };
                                                    setMessages(prev => [...prev, aiMsg]);
                                                }).catch((err) => {
                                                    let errText = "I'm having trouble connecting right now.";
                                                    if (err.message && (err.message.includes('RATE_LIMIT_EXCEEDED') || err.message.includes('rate limit') || err.message.includes('upgrade_required'))) {
                                                        useStore.getState().setShowUpgradeModal(true);
                                                        errText = "You've reached your limit. Please upgrade to continue.";
                                                    }
                                                    const errorMsg = { id: Date.now().toString() + Math.random().toString(), role: 'assistant', text: errText };
                                                    setMessages(prev => [...prev, errorMsg]);
                                                }).finally(() => {
                                                    setIsLoading(false);
                                                    isProcessingRef.current = false;
                                                    setInputText('');
                                                });
                                            }, 50);
                                        });
                                    }}
                                >
                                    <Ionicons name={q.icon} size={16} color={Colors.accent} style={{ marginRight: 8 }} />
                                    <Text style={styles.suggestionText}>{q.text}</Text>
                                </TouchableOpacity>
                            ))}
                        </Animated.View>
                    )}
                    
                    {isLoading && (
                        <Animated.View entering={FadeIn} style={[styles.messageBubble, styles.aiBubble, { width: 70 }]}>
                            <TypingDots />
                        </Animated.View>
                    )}
                </ScrollView>

                <View style={[styles.inputContainer, { paddingBottom: inputPaddingBottom }]}>
                    <TouchableOpacity style={styles.attachBtn} onPress={() => checkAIConsent(() => setShowUploadModal(true))}>
                        <Ionicons name="add" size={28} color={Colors.primary} />
                    </TouchableOpacity>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Ask MedGPT..."
                        placeholderTextColor={Colors.textMuted}
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />
                    <TouchableOpacity 
                        style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]} 
                        onPress={handleSend}
                        disabled={!inputText.trim()}
                    >
                        <Ionicons name="arrow-up" size={20} color={Colors.white} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Upload Modal */}
            <Modal
                visible={showUploadModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowUploadModal(false)}
            >
                <TouchableWithoutFeedback onPress={() => setShowUploadModal(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <Animated.View entering={SlideInDown.springify().damping(20)} exiting={SlideOutDown} style={styles.modalContent}>
                                <View style={styles.modalHandle} />
                                <View style={styles.modalActionsRow}>
                                    
                                    <TouchableOpacity style={styles.modalActionBtn} onPress={handleUploadFile}>
                                        <View style={styles.modalIconWrap}>
                                            <Ionicons name="document-outline" size={24} color={Colors.primary} />
                                        </View>
                                        <Text style={styles.modalActionText}>Upload file</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.modalActionBtn} onPress={handleCapture}>
                                        <View style={styles.modalIconWrap}>
                                            <Ionicons name="camera-outline" size={24} color={Colors.primary} />
                                        </View>
                                        <Text style={styles.modalActionText}>Capture</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.modalActionBtn} onPress={handleGallery}>
                                        <View style={styles.modalIconWrap}>
                                            <Ionicons name="images-outline" size={24} color={Colors.primary} />
                                        </View>
                                        <Text style={styles.modalActionText}>Gallery</Text>
                                    </TouchableOpacity>
                                    
                                </View>
                            </Animated.View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
            
            <GuestAuthModal 
                visible={showGuestAuth} 
                onSignIn={handleGuestSignIn}
                onDismiss={() => setShowGuestAuth(false)} 
            />
        </SafeAreaView>
    );
}

const markdownStyles = {
    body: {
        fontSize: 16,
        lineHeight: 24,
        color: Colors.primary,
        fontWeight: '500',
    },
    paragraph: {
        marginTop: 0,
        marginBottom: 8,
    },
    heading1: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
        color: Colors.primary,
    },
    heading2: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        color: Colors.primary,
    },
    list_item: {
        marginBottom: 4,
    },
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#EBEBE5' }, // Soft sage/cream background
    keyboardAvoid: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        backgroundColor: '#EBEBE5',
    },
    headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 0 },
    headerTitle: { fontSize: 22, fontWeight: '600', color: Colors.primary, letterSpacing: -0.5, marginTop: -4 },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    memoryBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
    
    chatScroll: { paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 100 },
    messageBubble: { maxWidth: '85%', padding: 18, borderRadius: 24, marginBottom: 16, ...Shadows.soft },
    userBubble: { alignSelf: 'flex-end', backgroundColor: Colors.accent, borderBottomRightRadius: 8 },
    aiBubble: { alignSelf: 'flex-start', backgroundColor: Colors.white, borderBottomLeftRadius: 8 },
    
    messageText: { fontSize: 16, lineHeight: 24 },
    userText: { color: Colors.white, fontWeight: '500' },
    aiText: { color: Colors.primary, fontWeight: '500' },
    
    aiIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
    copyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.03)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
    copyText: { fontSize: 12, color: Colors.textSecondary, marginLeft: 4, fontWeight: '600' },
    
    inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 16, backgroundColor: '#EBEBE5', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
    attachBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', marginRight: 8, marginBottom: 2, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
    textInput: { flex: 1, maxHeight: 120, minHeight: 48, backgroundColor: Colors.white, borderRadius: 24, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, fontSize: 16, color: Colors.primary, ...Shadows.soft },
    sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginLeft: 8, marginBottom: 0, ...Shadows.elevated },
    
    dotWrap: { flexDirection: 'row', gap: 6, paddingVertical: 4, alignItems: 'center', justifyContent: 'center' },
    typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.textMuted },

    // Suggestion Chips
    suggestionsWrap: { alignSelf: 'stretch', gap: 10, marginBottom: 16, marginTop: 4 },
    suggestionChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: 'rgba(46,125,91,0.15)', ...Shadows.soft },
    suggestionText: { fontSize: 14, fontWeight: '600', color: Colors.primary, flex: 1 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#F8F9F5', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingTop: 12, paddingHorizontal: 24 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 24 },
    modalActionsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
    modalActionBtn: { alignItems: 'center', flex: 1 },
    modalIconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', marginBottom: 12, ...Shadows.soft },
    modalActionText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
});
