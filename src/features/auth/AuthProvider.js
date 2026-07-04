import React, { createContext, useContext, useEffect, useState } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../lib/supabase';
import { posthog } from '../../lib/posthog';
import * as Sentry from '@sentry/react-native';
import useStore from '../../store/useStore';
import { initializePurchases, logoutPurchases, checkAndSyncProStatus } from '../../lib/purchases';

let isGoogleSignInInProgress = false;

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const { setUser, setSession, setLoading, fetchProfile } = useStore();
    const [initialized, setInitialized] = useState(false);
    const [purchasesInitialized, setPurchasesInitialized] = useState(false);

    useEffect(() => {
        // Initialize Google Sign-In
        GoogleSignin.configure({
            scopes: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
            webClientId: process.env.GOOGLE_WEB_CLIENT_ID,
            iosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
        });

        let isMounted = true;

        const safetyTimeout = setTimeout(() => {
            if (isMounted) {
                setLoading(false);
                setInitialized(true);
            }
        }, 3000);

        if (!supabase) {
            console.error('[PureScan] Supabase client unavailable — skipping auth init.');
            setLoading(false);
            setInitialized(true);
            return () => { isMounted = false; clearTimeout(safetyTimeout); };
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return;

            if (event === 'SIGNED_OUT') {
                // Reset analytics
                posthog.reset();
                Sentry.setUser(null);

                // Clear ALL auth-related state atomically to avoid race conditions
                // with AppNavigator's auto-onboard useEffect.
                // useStore.signOut() may also fire — duplicate null sets are harmless.
                useStore.setState({
                    user: null,
                    profile: null,
                    session: null,
                    hasSeenOnboarding: false,
                    isGuestMode: false,
                    expoPushToken: null,
                });
                setLoading(false);
                setInitialized(true);
                // Initialize RevenueCat anonymously so paywall doesn't hang
                initPurchasesBackground(null, isMounted, setPurchasesInitialized);
                return;
            }

            if (event === 'TOKEN_REFRESH_FAILED') {
                console.warn('[PureScan] Token refresh failed — flushing stale session.');
                logoutPurchases().catch(() => { });
                // Force local-only signout — server already rejected this token
                try { await supabase.auth.signOut({ scope: 'local' }); } catch (_) { }
                try { useStore.getState().signOut(); } catch (_) { }
                setLoading(false);
                setInitialized(true);
                setPurchasesInitialized(false);
                return;
            }

            if (session?.user) {
                setSession(session);
                setUser(session.user);

                // If the user is anonymous, keep guest mode true
                useStore.getState().setGuestMode(session.user.is_anonymous === true);

                // Identify user in PostHog
                posthog.identify(session.user.id, {
                    email: session.user.email,
                    name: session.user.user_metadata?.full_name,
                });

                // Identify user in Sentry
                Sentry.setUser({
                    id: session.user.id,
                    email: session.user.email,
                });

                // CRITICAL: Set loading=false and fetch profile FIRST.
                // RevenueCat init is non-blocking so it never delays the auth flow.
                setLoading(false);
                setInitialized(true);
                clearTimeout(safetyTimeout);

                // Fetch profile (non-blocking)
                fetchProfile(session.user.id).catch(err =>
                    console.warn('Offline: Profile fetch delayed', err)
                );

                // Initialize RevenueCat + sync subscription in background (non-blocking).
                // This never delays login, profile fetch, or scan history loading.
                initPurchasesBackground(session.user.id, isMounted, setPurchasesInitialized);

                return; // already cleared timeout above
            } else if (event === 'INITIAL_SESSION') {
                setUser(null);
                useStore.setState({ profile: null, session: null });
                setLoading(false);
                setInitialized(true);
                // Initialize RevenueCat anonymously so paywall doesn't hang for guests
                initPurchasesBackground(null, isMounted, setPurchasesInitialized);
            }

            clearTimeout(safetyTimeout);
        });

        return () => {
            isMounted = false;
            clearTimeout(safetyTimeout);
            subscription.unsubscribe();
        };
    }, []);

    const signInWithGoogle = async () => {
        if (isGoogleSignInInProgress) {
            console.warn('Google Sign-In is already in progress.');
            return;
        }
        isGoogleSignInInProgress = true;
        try {
            // Force clear previous session to show account picker
            try { await GoogleSignin.signOut(); } catch (_) { }

            // Logout RevenueCat so new user gets clean state
            try { await logoutPurchases(); } catch (_) { }

            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

            const response = await GoogleSignin.signIn();

            let idToken = null;
            if (response?.data?.idToken) {
                idToken = response.data.idToken;
            } else if (response?.idToken) {
                idToken = response.idToken;
            } else if (response?.data?.serverAuthCode) {
                throw new Error('Got serverAuthCode but no idToken. Verify your webClientId in Google Cloud Console.');
            }

            if (!idToken) {
                console.error('Google Sign-In response:', JSON.stringify(response, null, 2));
                throw new Error('No ID token received from Google Sign-In. Please check your Google Cloud Console OAuth configuration.');
            }

            const { data, error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: idToken,
            });

            if (error) throw error;
            return data;
        } catch (error) {
            if (error?.code === 'SIGN_IN_CANCELLED' || error?.code === '12501') {
                console.log('User cancelled Google Sign-In');
                return null;
            }
            console.error('Google Sign-In Error:', error);
            throw error;
        } finally {
            isGoogleSignInInProgress = false;
        }
    };

    const signInWithApple = async () => {
        try {
            // Logout RevenueCat so new user gets clean state
            try { await logoutPurchases(); } catch (_) { }

            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            if (credential.identityToken) {
                const { data, error } = await supabase.auth.signInWithIdToken({
                    provider: 'apple',
                    token: credential.identityToken,
                });

                if (error) throw error;

                // Apple only sends fullName on the VERY FIRST sign-in.
                // Capture it now or it's lost forever.
                if (credential.fullName) {
                    const givenName = credential.fullName.givenName || '';
                    const familyName = credential.fullName.familyName || '';
                    const fullName = [givenName, familyName].filter(Boolean).join(' ');
                    if (fullName) {
                        supabase.auth.updateUser({
                            data: { full_name: fullName },
                        }).catch(err => console.warn('Failed to save Apple user name:', err?.message));
                    }
                }

                return data;
            } else {
                throw new Error('No identityToken received from Apple Sign-In.');
            }
        } catch (error) {
            if (error?.code === 'ERR_CANCELED') {
                console.log('User cancelled Apple Sign-In');
                return null;
            }
            console.error('Apple Sign-In Error:', error);
            throw error;
        }
    };

    const signInWithEmail = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    };

    const signUpWithEmail = async (email, password) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: 'aigirl://auth-callback',
            },
        });
        if (error) throw error;
        return data;
    };

    const signOut = async () => {
        // 1. Logout purchases FIRST (while session is still valid)
        try { await logoutPurchases(); } catch (_) { }

        // 2. Sign out from Supabase — catch stale token errors gracefully
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.warn('Supabase signOut error, forcing local signout:', e?.message || e);
            try { await supabase.auth.signOut({ scope: 'local' }); } catch (_) { }
        }

        // 3. Clear local state
        useStore.getState().signOut();
    };

    const signInAnonymously = async () => {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        return data;
    };

    return (
        <AuthContext.Provider
            value={{
                signInWithGoogle,
                signInWithApple,
                signInWithEmail,
                signUpWithEmail,
                signInAnonymously,
                signOut,
                initialized,
                purchasesInitialized,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Background RevenueCat init + pro status sync.
 * Runs AFTER auth is fully established so it never blocks login or profile fetch.
 */
async function initPurchasesBackground(userId, isMounted, setPurchasesInitialized) {
    try {
        await initializePurchases(userId);
        if (!isMounted) return;

        // Check & sync pro status with DB.
        // Handles: trial expiry, cancellation, grace period end, account switching.
        const isPro = await checkAndSyncProStatus();
        if (!isMounted) return;

        // Update local profile cache if it's already loaded and differs
        const currentProfile = useStore.getState().profile;
        if (currentProfile && currentProfile.is_pro !== isPro) {
            useStore.setState({ profile: { ...currentProfile, is_pro: isPro } });
        }
    } catch (e) {
        // RevenueCat unavailable (e.g. Expo Go, missing native module) — non-fatal
        console.warn('[PureScan] RevenueCat init/sync skipped:', e?.message || e);
    } finally {
        if (isMounted) {
            setPurchasesInitialized(true);
        }
    }
}
