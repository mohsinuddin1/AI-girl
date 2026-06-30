import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Image, Alert, Linking, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import useStore from '../store/useStore';
import { supabase } from '../lib/supabase';

export default function SettingsScreen({ navigation }) {
    const { user, profile, signOut, isGuestMode, setGuestMode, clearOnboarding, selectedPersona, updateCustomPersona } = useStore();
    const [notificationsEnabled, setNotificationsEnabled] = React.useState(false);

    const updateCustom = (key, value) => {
        if (!selectedPersona?.personality) return;
        updateCustomPersona({ personality: { ...selectedPersona.personality, [key]: value } });
    };

    const updateDemand = (text) => {
        updateCustomPersona({ extra_demand: text });
    };

    const handleSignOut = async () => {
        if (isGuestMode && !user) {
            await setGuestMode(false);
            await clearOnboarding();
            return;
        }
        Alert.alert('Log out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: async () => await signOut() },
        ]);
    };

    const handleDeleteAccount = () => {
        Alert.alert('Delete Account', 'Are you sure you want to permanently delete your account?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                    await supabase?.rpc('aigirl_delete_user_account');
                    await signOut();
                    Alert.alert('Account Deleted');
                } catch (e) {
                    Alert.alert('Notice', 'Please contact support or sign out for now.');
                    await signOut();
                }
            }},
        ]);
    };

    const SettingRow = ({ label, rightText, isSwitch, onPress, isDestructive }) => (
        <TouchableOpacity style={styles.settingRow} onPress={onPress} disabled={isSwitch || !onPress}>
            <Text style={[styles.settingLabel, isDestructive && { color: '#ff4d4f' }]}>{label}</Text>
            {isSwitch ? (
                <Switch
                    value={notificationsEnabled}
                    onValueChange={setNotificationsEnabled}
                    trackColor={{ false: '#555', true: '#fff' }}
                    thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
                />
            ) : rightText ? (
                <View style={styles.rightContent}>
                    <Text style={styles.rightText}>{rightText}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#aaa" />
                </View>
            ) : (
                <Ionicons name="chevron-forward" size={16} color={isDestructive ? '#ff4d4f' : "#aaa"} />
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={styles.backBtn} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {(isGuestMode && !user) && (
                    <View style={styles.guestBanner}>
                        <Text style={styles.guestTitle}>You're in a guest mode</Text>
                        <Text style={styles.guestSub}>Create an account to save your data and use it across multiple devices.</Text>
                        <TouchableOpacity style={styles.createAccountBtn}>
                            <Text style={styles.createAccountText}>Create account</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.profileSection}>
                    <Image source={selectedPersona?.image_url ? { uri: selectedPersona.image_url } : require('../../assets/appinside1.png')} style={styles.profileImage} />
                    <LinearGradient
                        colors={['#8A73F7', '#D586F9']}
                        start={{x: 0, y: 0}} end={{x: 1, y: 0}}
                        style={styles.profileBtnGradient}
                    >
                        <TouchableOpacity style={styles.profileBtn}>
                            <Text style={styles.profileBtnText}>{selectedPersona?.name || 'AIGirl'}'s profile</Text>
                        </TouchableOpacity>
                    </LinearGradient>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>AI Persona</Text>
                    <View style={styles.sectionCard}>
                        <SettingRow label="Chat with another girl" onPress={() => navigation.navigate('PersonaSelect')} />
                    </View>
                </View>

                {selectedPersona?.name === 'Custom Girl' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Customize Behavior</Text>
                        <View style={styles.sectionCard}>
                            <View style={styles.customContainer}>
                                <Text style={styles.customLabel}>Flirty vs Shy</Text>
                                <Slider
                                    style={styles.slider}
                                    minimumValue={0}
                                    maximumValue={1}
                                    value={selectedPersona.personality?.shyFlirty || 0.5}
                                    onSlidingComplete={(val) => updateCustom('shyFlirty', val)}
                                    minimumTrackTintColor="#D586F9"
                                    maximumTrackTintColor="#555"
                                />
                                <Text style={styles.customLabel}>Pessimistic vs Optimistic</Text>
                                <Slider
                                    style={styles.slider}
                                    minimumValue={0}
                                    maximumValue={1}
                                    value={selectedPersona.personality?.pessOpt || 0.5}
                                    onSlidingComplete={(val) => updateCustom('pessOpt', val)}
                                    minimumTrackTintColor="#D586F9"
                                    maximumTrackTintColor="#555"
                                />
                                <Text style={styles.customLabel}>Ordinary vs Mysterious</Text>
                                <Slider
                                    style={styles.slider}
                                    minimumValue={0}
                                    maximumValue={1}
                                    value={selectedPersona.personality?.ordMyst || 0.5}
                                    onSlidingComplete={(val) => updateCustom('ordMyst', val)}
                                    minimumTrackTintColor="#D586F9"
                                    maximumTrackTintColor="#555"
                                />
                                <Text style={[styles.customLabel, { marginTop: 12 }]}>Extra Demand</Text>
                                <TextInput
                                    style={styles.demandInput}
                                    multiline
                                    placeholder="Type specific instructions..."
                                    placeholderTextColor="#888"
                                    defaultValue={selectedPersona.extra_demand || ''}
                                    onEndEditing={(e) => updateDemand(e.nativeEvent.text)}
                                />
                            </View>
                        </View>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <View style={styles.sectionCard}>
                        <SettingRow label="Your name" rightText="mnmmm" />
                        <View style={styles.divider} />
                        <SettingRow label="Your pronouns" rightText="He" />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Subscription</Text>
                    <View style={styles.sectionCard}>
                        <SettingRow label="Upgrade to Premium" onPress={() => navigation.navigate('Paywall')} rightText={profile?.is_pro ? "Active" : ""} />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>App</Text>
                    <View style={styles.sectionCard}>
                        <SettingRow label="Notifications" isSwitch />
                        <View style={styles.divider} />
                        <SettingRow label="Set PIN code" />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Help</Text>
                    <View style={styles.sectionCard}>
                        <SettingRow label="Feedback" onPress={() => navigation.navigate('Feedback')} />
                        <View style={styles.divider} />
                        <SettingRow label="Contact Email" onPress={() => Linking.openURL('mailto:purescanai@outlook.com')} />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Legal</Text>
                    <View style={styles.sectionCard}>
                        <SettingRow label="Terms and Conditions" onPress={() => Linking.openURL('https://webpure-scan-ai.vercel.app/terms')} />
                        <View style={styles.divider} />
                        <SettingRow label="Privacy Policy" onPress={() => Linking.openURL('https://webpure-scan-ai.vercel.app/privacy')} />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Other</Text>
                    <View style={styles.sectionCard}>
                        <SettingRow label="Delete chat history" />
                        <View style={styles.divider} />
                        <SettingRow label="Delete account" onPress={handleDeleteAccount} />
                        <View style={styles.divider} />
                        <SettingRow label="Log out" onPress={handleSignOut} isDestructive />
                    </View>
                </View>

                <Text style={styles.versionText}>2.61.8 (5910)</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#3a2b47' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn: { width: 40, alignItems: 'flex-start' },
    headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
    scroll: { paddingBottom: 40 },
    
    guestBanner: { alignItems: 'center', paddingHorizontal: 40, marginTop: 10, marginBottom: 20 },
    guestTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
    guestSub: { color: '#ccc', textAlign: 'center', fontSize: 14, marginBottom: 16, lineHeight: 20 },
    createAccountBtn: { backgroundColor: '#a463b2', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
    createAccountText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    
    profileSection: { alignItems: 'center', marginBottom: 32 },
    profileImage: { width: '85%', height: 260, borderRadius: 24, resizeMode: 'cover' },
    profileBtnGradient: { marginTop: -20, borderRadius: 24, width: '70%', padding: 2, zIndex: 2 },
    profileBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
    profileBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    
    section: { marginBottom: 24, paddingHorizontal: 20 },
    sectionTitle: { color: '#aaa', fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
    sectionCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' },
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16 },
    settingLabel: { color: '#fff', fontSize: 15, fontWeight: '500' },
    rightContent: { flexDirection: 'row', alignItems: 'center' },
    rightText: { color: '#ccc', fontSize: 15, marginRight: 8 },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: 16 },
    
    customContainer: { padding: 16 },
    customLabel: { color: '#fff', fontSize: 14, fontWeight: '500', marginBottom: 8 },
    slider: { width: '100%', height: 40, marginBottom: 16 },
    demandInput: { backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top' },
    
    versionText: { color: '#888', textAlign: 'center', fontSize: 13, marginTop: 16 }
});
