import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import useNetworkStatus from '../hooks/useNetworkStatus';

/**
 * Global offline banner — renders a thin bar at the top when the device
 * has no internet. Drop this once inside App and forget about it.
 */
export default function OfflineBanner() {
    const { isConnected, isInternetReachable } = useNetworkStatus();

    // Return invisible empty view instead of null to avoid
    // "SafeAreaProvider contains null child" crash on Android
    if (isConnected && isInternetReachable) return <View style={{ height: 0 }} />;

    return (
        <View style={styles.banner}>
            <WifiOff size={14} color="#fff" />
            <Text style={styles.text}>No internet connection</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        backgroundColor: '#E74C3C',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        gap: 6,
    },
    text: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
});
