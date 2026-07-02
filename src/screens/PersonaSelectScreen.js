import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useStore from '../store/useStore';

const { height } = Dimensions.get('window');

const THEME = {
    bg: '#040b16',
    primary: '#fff',
    accent: '#0ea5e9',
    card: '#0f172a',
};

export default function PersonaSelectScreen({ navigation }) {
    const { personas, selectedPersona, setSelectedPersona, fetchPersonas } = useStore();
    const insets = useSafeAreaInsets();
    const [tempSelected, setTempSelected] = useState(selectedPersona);

    React.useEffect(() => {
        fetchPersonas();
    }, []);

    const handleSelect = async () => {
        if (!tempSelected) return;

        if (tempSelected.id === 'custom') {
            // Load saved custom data if available
            const customDataStr = await AsyncStorage.getItem('purescan_custom_persona_data');
            if (customDataStr) {
                try {
                    setSelectedPersona(JSON.parse(customDataStr));
                    navigation.replace('CustomizePersona');
                    return;
                } catch (e) {}
            }
            setSelectedPersona({
                id: 'custom',
                name: 'Custom Girl',
                image_url: personas?.[0]?.image_url,
                personality: { shyFlirty: 0.5, pessOpt: 0.5, ordMyst: 0.5 },
            });
            navigation.replace('CustomizePersona');
        } else {
            setSelectedPersona(tempSelected);
            navigation.goBack();
        }
    };

    // Resolve the background image URL for the temp selection
    const bgImageUrl = tempSelected?.id === 'custom'
        ? (personas?.[0]?.image_url)
        : tempSelected?.image_url;

    const firstLine = tempSelected?.extra_demand ? tempSelected.extra_demand.split('.')[0] + '.' : '';

    return (
        <View style={styles.container}>
            {/* Full-screen background image of selected avatar */}
            {bgImageUrl && (
                <Image source={{ uri: bgImageUrl }} style={styles.fullBgImage} />
            )}

            {/* Bottom gradient overlay */}
            <LinearGradient
                colors={['transparent', 'rgba(4,11,22,0.9)', THEME.bg]}
                style={styles.globalBottomGradient}
            />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Choose your Girl</Text>
                <View style={{ width: 40 }} />
            </View>

            {!!firstLine && tempSelected?.id !== 'custom' && (
                <View style={styles.personalityBox}>
                    <Text style={styles.personalityText}>{firstLine}</Text>
                </View>
            )}

            {/* Content area (spacer) */}
            <View style={{ flex: 1 }} />

            {/* Carousel at the bottom — same as onboarding */}
            <View style={styles.carouselContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 24, alignItems: 'center', gap: 16 }}
                >
                    {personas?.filter(a => a.name !== 'Custom Girl' && a.id !== 'custom_girl').map((avatar) => {
                        const isSelected = tempSelected?.id === avatar.id;
                        return (
                            <TouchableOpacity
                                key={avatar.id}
                                onPress={() => setTempSelected(avatar)}
                                style={[styles.avatarThumbWrap, isSelected && styles.avatarThumbSelected]}
                            >
                                <Image source={{ uri: avatar.image_url }} style={styles.avatarThumb} />
                            </TouchableOpacity>
                        );
                    })}
                    {/* Custom Option */}
                    <TouchableOpacity
                        onPress={() => setTempSelected({ id: 'custom', image_url: personas?.[0]?.image_url, name: 'Custom' })}
                        style={[
                            styles.avatarThumbWrap,
                            tempSelected?.id === 'custom' && styles.avatarThumbSelected,
                            { backgroundColor: THEME.card, justifyContent: 'center', alignItems: 'center' },
                        ]}
                    >
                        <Ionicons name="add" size={28} color="#fff" />
                        <View style={styles.proBadge}>
                            <Ionicons name="star" size={10} color="#fff" />
                        </View>
                        <Text style={{ color: '#fff', fontSize: 10, position: 'absolute', bottom: 4 }}>Custom</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {/* Bottom button */}
            <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                <TouchableOpacity onPress={handleSelect} style={styles.primaryBtn} activeOpacity={0.8}>
                    <Text style={styles.primaryBtnText}>
                        {tempSelected?.id === 'custom' ? 'Make Custom AI Girl' : 'Select'}
                    </Text>
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

    personalityBox: { position: 'absolute', bottom: 230, left: 24, right: 24, backgroundColor: 'rgba(0,0,0,0.6)', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    personalityText: { color: 'rgba(255,255,255,0.95)', fontSize: 15, textAlign: 'center', lineHeight: 22, fontWeight: '500' },

    carouselContainer: { position: 'absolute', bottom: 100, left: 0, right: 0 },

    avatarThumbWrap: {
        width: 64, height: 64 * (16 / 9), borderRadius: 16, overflow: 'hidden',
        borderWidth: 2, borderColor: 'transparent', opacity: 0.6,
    },
    avatarThumbSelected: { borderColor: THEME.primary, opacity: 1, shadowColor: THEME.primary, shadowOffset: {width: 0, height: 0}, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 },
    avatarThumb: { width: '100%', height: '100%', resizeMode: 'cover' },

    proBadge: {
        position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444',
        borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    },

    bottomControls: { paddingHorizontal: 24, paddingTop: 16, backgroundColor: 'transparent' },
    primaryBtn: { backgroundColor: THEME.primary, paddingVertical: 18, borderRadius: 30, alignItems: 'center' },
    primaryBtnText: { color: THEME.bg, fontSize: 18, fontWeight: '700' },
});
