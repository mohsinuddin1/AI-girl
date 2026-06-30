import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { Colors } from '../theme';

export default function LoadingSpinner({ message = 'Loading...' }) {
    return (
        <View style={styles.container}>
            <View style={styles.brand}>
                <Image source={require('../../assets/appinside1.png')} style={styles.logo} />
                <Text style={{ fontSize: 24, fontWeight: '700', color: Colors.accent }}>AIGirl</Text>
            </View>
            <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 12 }} />
            {message && <Text style={styles.message}>{message}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    brand: {
        alignItems: 'center',
        gap: 8,
    },
    logo: {
        width: 180,
        height: 180,
        borderRadius: 36,
        resizeMode: 'contain',
        marginBottom: 16,
    },
    message: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.textSecondary,
        marginTop: 4,
    },
});
