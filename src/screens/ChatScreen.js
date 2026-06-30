import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Modal, TouchableWithoutFeedback, Keyboard, Image, Alert, ImageBackground } from 'react-native';
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
    const [messages, setMessages] = useState([{ id: 1, role: 'assistant', text: "Hello! I'm AIGirl, your personal health companion. I remember your uploaded medical reports. How can I help you today?" }]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const scrollViewRef = useRef();
    const isProcessingRef = useRef(false);
    const { profile, user, isGuestMode, selectedPersona } = useStore();
    const insets = useSafeAreaInsets();
    const [showGuestAuth, setShowGuestAuth] = useState(false);
    const [showMemoryModal, setShowMemoryModal] = useState(false);
    const [memoryText, setMemoryText] = useState('');
    const [isSavingMemory, setIsSavingMemory] = useState(false);

    const handleOpenMemory = () => {
        if (isGuestMode && !user) {
            setShowGuestAuth(true);
            return;
        }
        setMemoryText(profile?.memory || '');
        setShowMemoryModal(true);
    };

    const handleSaveMemory = async () => {
        setIsSavingMemory(true);
        const success = await ChatService.updateUserMemory(memoryText);
        setIsSavingMemory(false);
        if (success) {
            setShowMemoryModal(false);
        } else {
            Alert.alert('Error', 'Failed to save memory. Please try again.');
        }
    };
    
    const handleClearMemory = async () => {
        setIsSavingMemory(true);
        const success = await ChatService.updateUserMemory('');
        setIsSavingMemory(false);
        if (success) {
            setMemoryText('');
            setShowMemoryModal(false);
        } else {
            Alert.alert('Error', 'Failed to clear memory. Please try again.');
        }
    };


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
            'AIGirl uses third-party AI services (like Google Models and Groq Models) to analyze your health data and provide insights and it is deleted after analyze not stored . By continuing, you agree to share your chat messages and scanned reports with these providers.',
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

    const bottomInset = Math.max(insets.bottom, 0);
    const inputPaddingBottom = keyboardVisible ? 12 : Math.max(16, bottomInset);

    return (
        <ImageBackground source={selectedPersona?.image_url ? { uri: selectedPersona.image_url } : require('../../assets/appinside1.png')} style={{ flex: 1 }} resizeMode="cover">
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView 
                    style={styles.keyboardAvoid} 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
                >
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>

                            <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={{marginRight: 12}}>
                                <Ionicons name="settings-outline" size={22} color="#fff" />
                            </TouchableOpacity>
                            
                            <View style={[styles.avatarMini, { overflow: 'hidden', backgroundColor: '#555' }]}>
                                <Image 
                                    source={selectedPersona?.image_url ? { uri: selectedPersona.image_url } : require('../../assets/appinside1.png')} 
                                    style={{ width: '100%', height: '200%', position: 'absolute', top: 0 }} 
                                    resizeMode="cover" 
                                />
                            </View>

                            <View style={styles.headerTitleGroup}>
                                <Text style={styles.headerName}>{selectedPersona?.name || 'AIGirl'}</Text>
                                <View style={styles.levelBadge}>
                                    <Ionicons name="diamond" size={10} color="#4ade80" />
                                    <Text style={styles.levelText}>LV1</Text>
                                </View>
                            </View>
                        </View>
                        <View style={styles.headerRight}>
                            <TouchableOpacity onPress={handleClearChat} style={{marginRight: 12}}>
                                <Ionicons name="trash-outline" size={22} color="#ff4d4f" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => navigation.navigate('Paywall')} style={styles.proBadge}>
                                <Ionicons name="star" size={14} color="#FFD700" />
                                <Text style={styles.proText}>PRO</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView 
                        ref={scrollViewRef}
                        style={{ flex: 1 }}
                        contentContainerStyle={[styles.chatScroll, { paddingBottom: 20 }]}
                        showsVerticalScrollIndicator={false}
                    >
                        {messages.map((msg, index) => (
                            <Animated.View 
                                key={msg.id} 
                                entering={FadeInDown.delay(100).springify().damping(18)}
                                style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}
                            >
                                {msg.role === 'user' ? (
                                    <View>
                                        <Text style={[styles.messageText, styles.userText]}>
                                            {msg.text}
                                        </Text>
                                    </View>
                                ) : (
                                    <View>
                                        <Markdown style={markdownStyles}>
                                            {msg.text}
                                        </Markdown>
                                        <View style={styles.aiMessageActions}>
                                            <TouchableOpacity style={styles.actionIconBtn}><Ionicons name="thumbs-up" size={16} color="#F5B041" /></TouchableOpacity>
                                            <TouchableOpacity style={styles.actionIconBtn}><Ionicons name="thumbs-down" size={16} color="#F5B041" /></TouchableOpacity>
                                            <TouchableOpacity style={styles.actionIconBtn}><Ionicons name="alert-circle" size={16} color="#E74C3C" /></TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </Animated.View>
                        ))}
                        
                        {isLoading && (
                            <Animated.View entering={FadeIn} style={[styles.messageBubble, styles.aiBubble, { width: 70 }]}>
                                <TypingDots />
                            </Animated.View>
                        )}
                    </ScrollView>

                    <View style={[styles.bottomContainer, { paddingBottom: inputPaddingBottom }]}>
                        <View style={styles.bottomTabs}>
                            <TouchableOpacity style={styles.iconBtnSquare}>
                                <Ionicons name="gift-outline" size={20} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.bottomTabBtn}>
                                <Ionicons name="chatbubble-outline" size={16} color="#fff" />
                                <Text style={styles.bottomTabText}>Messages</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.bottomTabBtn} onPress={handleOpenMemory}>
                                <Ionicons name="brain-outline" size={16} color="#fff" />
                                <Text style={styles.bottomTabText}>Memory</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.inputRowWrapper}>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={[styles.textInput, { paddingLeft: 12 }]}
                                    placeholder="Please enter"
                                    placeholderTextColor="#888"
                                    value={inputText}
                                    onChangeText={setInputText}
                                    multiline
                                />
                                <TouchableOpacity 
                                    style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]} 
                                    onPress={handleSend}
                                    disabled={!inputText.trim()}
                                >
                                    <Ionicons name="paper-plane" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>

                {/* Removed Upload Modal logic as attach feature is hidden */}
                
                <Modal visible={showMemoryModal} transparent animationType="slide" onRequestClose={() => setShowMemoryModal(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.memoryModalContainer}>
                            <View style={styles.memoryModalHeader}>
                                <Text style={styles.memoryModalTitle}>Personal Memory</Text>
                                <TouchableOpacity onPress={() => setShowMemoryModal(false)}>
                                    <Ionicons name="close" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.memoryModalDesc}>
                                Add notes or preferences you want AIGirl to remember during chats.
                            </Text>
                            <TextInput
                                style={styles.memoryInput}
                                placeholder="E.g., I'm allergic to peanuts, prefer concise answers..."
                                placeholderTextColor="#888"
                                value={memoryText}
                                onChangeText={setMemoryText}
                                multiline
                                textAlignVertical="top"
                            />
                            <View style={styles.memoryModalActions}>
                                <TouchableOpacity style={[styles.memoryBtn, styles.memoryBtnClear]} onPress={handleClearMemory} disabled={isSavingMemory}>
                                    <Text style={styles.memoryBtnClearText}>Clear</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.memoryBtn, styles.memoryBtnSave]} onPress={handleSaveMemory} disabled={isSavingMemory}>
                                    <Text style={styles.memoryBtnSaveText}>{isSavingMemory ? 'Saving...' : 'Save'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                <GuestAuthModal 
                    visible={showGuestAuth} 
                    onSignIn={handleGuestSignIn}
                    onDismiss={() => setShowGuestAuth(false)} 
                />
            </SafeAreaView>
        </ImageBackground>
    );
}

const markdownStyles = {
    body: { fontSize: 16, lineHeight: 24, color: '#e0e0e0', fontWeight: '400', fontStyle: 'italic' },
    paragraph: { marginTop: 0, marginBottom: 8 },
    heading1: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, color: '#fff' },
    heading2: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#fff' },
    list_item: { marginBottom: 4 },
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    keyboardAvoid: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'transparent',
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerTitleGroup: { marginLeft: 10 },
    headerName: { color: '#fff', fontSize: 18, fontWeight: '700' },
    levelBadge: { backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 2 },
    levelText: { color: '#4ade80', fontWeight: 'bold', marginLeft: 4, fontSize: 10 },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    avatarMini: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
    proBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#FFD700' },
    proText: { color: '#FFD700', fontWeight: 'bold', marginLeft: 4, fontSize: 12 },
    
    chatScroll: { paddingHorizontal: 16, paddingVertical: 24 },
    messageBubble: { maxWidth: '85%', padding: 14, marginBottom: 16 },
    userBubble: { alignSelf: 'flex-end', backgroundColor: 'rgba(40, 30, 45, 0.85)', borderRadius: 20 },
    aiBubble: { alignSelf: 'flex-start', backgroundColor: 'rgba(20, 20, 20, 0.8)', borderRadius: 20 },
    
    messageText: { fontSize: 16, lineHeight: 22 },
    userText: { color: '#FFFFFF', fontWeight: '400' },
    aiText: { color: '#e0e0e0', fontWeight: '400' },
    
    aiMessageActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    actionIconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
    
    bottomContainer: { backgroundColor: 'transparent', paddingHorizontal: 12, paddingTop: 12 },
    bottomTabs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    iconBtnSquare: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(30, 20, 30, 0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    bottomTabBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 44, borderRadius: 14, backgroundColor: 'rgba(30, 20, 30, 0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    bottomTabText: { color: '#ddd', fontSize: 13, fontWeight: '600', marginLeft: 6 },
    
    inputRowWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    sideIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    inputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 20, 30, 0.7)', borderRadius: 24, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    micBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    textInput: { flex: 1, minHeight: 36, maxHeight: 100, color: '#fff', fontSize: 15, paddingHorizontal: 4 },
    sendBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    
    dotWrap: { flexDirection: 'row', gap: 6, paddingVertical: 4, alignItems: 'center', justifyContent: 'center' },
    typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#888' },
    
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
    memoryModalContainer: { width: '90%', backgroundColor: '#1a1a24', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    memoryModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    memoryModalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    memoryModalDesc: { color: '#aaa', fontSize: 14, marginBottom: 16 },
    memoryInput: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 12, color: '#fff', fontSize: 15, minHeight: 120, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },
    memoryModalActions: { flexDirection: 'row', gap: 12 },
    memoryBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    memoryBtnClear: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ff4d4f' },
    memoryBtnSave: { backgroundColor: '#4ade80' },
    memoryBtnClearText: { color: '#ff4d4f', fontWeight: '600' },
    memoryBtnSaveText: { color: '#000', fontWeight: 'bold' },
});

