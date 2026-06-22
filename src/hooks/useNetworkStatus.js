import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Lightweight network status hook.
 * Returns { isConnected, isInternetReachable }.
 * Components can use this to guard network-dependent actions.
 */
export default function useNetworkStatus() {
    const [status, setStatus] = useState({ isConnected: true, isInternetReachable: true });

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            setStatus({
                isConnected: state.isConnected ?? true,
                isInternetReachable: state.isInternetReachable ?? state.isConnected ?? true,
            });
        });
        return unsubscribe;
    }, []);

    return status;
}
