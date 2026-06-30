import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useStore from '../store/useStore';

export default function PersonaSelectScreen({ navigation }) {
    const { personas, selectedPersona, setSelectedPersona } = useStore();

    const renderItem = ({ item }) => {
        const isSelected = selectedPersona?.id === item.id;
        
        return (
            <TouchableOpacity 
                style={[styles.personaCard, isSelected && styles.selectedCard]}
                onPress={() => {
                    setSelectedPersona(item);
                    navigation.goBack();
                }}
            >
                <Image source={{ uri: item.image_url }} style={styles.personaImage} />
                <View style={styles.personaInfo}>
                    <Text style={styles.personaName}>{item.name}</Text>
                    <Text style={styles.personaDesc} numberOfLines={2}>{item.extra_demand || 'Ready to chat!'}</Text>
                </View>
                {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color="#D586F9" style={styles.checkIcon} />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Select Your Girl</Text>
                <View style={styles.backBtn} />
            </View>

            <FlatList 
                data={personas}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContainer}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#3a2b47' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn: { width: 40, alignItems: 'flex-start' },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
    listContainer: { padding: 16 },
    personaCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 12,
        marginBottom: 16,
        alignItems: 'center'
    },
    selectedCard: {
        borderColor: '#D586F9',
        borderWidth: 2,
        backgroundColor: 'rgba(213, 134, 249, 0.15)'
    },
    personaImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 16
    },
    personaInfo: {
        flex: 1
    },
    personaName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4
    },
    personaDesc: {
        color: '#ccc',
        fontSize: 14
    },
    checkIcon: {
        marginLeft: 12
    }
});
