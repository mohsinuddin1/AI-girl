import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// RevenueCat API keys loaded from .env
const REVENUECAT_API_KEY_IOS = process.env.REVENUECAT_IOS_KEY;
const REVENUECAT_API_KEY_ANDROID = process.env.REVENUECAT_ANDROID_KEY;

export async function initializePurchases(userId) {
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

    if (!apiKey) {
        console.warn('[PureScan] RevenueCat API key missing, skipping purchases init.');
        return;
    }

    const configured = await Purchases.isConfigured();
    if (configured) {
        try {
            if (userId) {
                await Purchases.logIn(userId);
            }
        } catch (e) {
            // Transfer errors are expected when switching accounts —
            // the SDK continues to work after this, just log and move on.
            console.warn('RevenueCat logIn error (may be a user transfer):', e);
        }
        return;
    }

    // Enable debug logs so RevenueCat prints the ACTUAL underlying store error to the terminal
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey, appUserID: userId });
}

export async function logoutPurchases() {
    try {
        const configured = await Purchases.isConfigured();
        if (configured) {
            await Purchases.logOut();
        }
    } catch (e) {
        console.warn('RevenueCat logOut error:', e);
    }
}

export async function getOfferings() {
    try {
        const offerings = await Purchases.getOfferings();
        if (offerings.current) {
            return offerings.current;
        }
        return null;
    } catch (e) {
        console.error('Error fetching offerings:', e);
        return null;
    }
}

export async function purchasePackage(pkg) {
    try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        const isPro = isEntitlementActive(customerInfo);
        await syncProStatus(isPro);
        return { success: isPro, customerInfo };
    } catch (e) {
        if (e.userCancelled) {
            return { success: false, cancelled: true };
        }
        throw e;
    }
}

export async function restorePurchases() {
    try {
        // Purchases.restorePurchases returns customerInfo directly, not wrapped inside an object
        const customerInfo = await Purchases.restorePurchases();
        const isPro = isEntitlementActive(customerInfo);
        await syncProStatus(isPro);
        return { success: isPro, customerInfo };
    } catch (e) {
        console.error('Error restoring purchases:', e);
        throw e;
    }
}

export async function checkProStatus() {
    try {
        const customerInfo = await Purchases.getCustomerInfo();
        return isEntitlementActive(customerInfo);
    } catch (e) {
        console.error('Error checking pro status:', e);
        return false;
    }
}

/**
 * Master function: checks RevenueCat entitlement and syncs the result to Supabase.
 * Call this on every app launch / auth change to keep is_pro accurate.
 * Returns the current isPro boolean.
 */
export async function checkAndSyncProStatus() {
    try {
        const configured = await Purchases.isConfigured();
        if (!configured) return false;

        // FETCH_CURRENT forces a fresh network call to RevenueCat (not cache).
        // This runs in the background so it never blocks the UI.
        const customerInfo = await Purchases.getCustomerInfo({ fetchPolicy: 'FETCH_CURRENT' });
        const isPro = isEntitlementActive(customerInfo);

        // Always sync — this handles both granting AND revoking
        await syncProStatus(isPro);

        return isPro;
    } catch (e) {
        console.warn('checkAndSyncProStatus error:', e);
        return false;
    }
}

// ─── Internal helpers ───

/**
 * Checks if the 'pro' entitlement is truly active.
 * Handles trial periods, grace periods, and expired/cancelled states.
 */
function isEntitlementActive(customerInfo) {
    if (!customerInfo?.entitlements?.active) return false;

    const proEntitlement = customerInfo.entitlements.active['pro'];
    if (!proEntitlement) return false;

    // The entitlement is in the 'active' dict — RevenueCat only places
    // truly active entitlements there (including trials + grace periods).
    // A cancelled subscription that hasn't expired yet is still "active"
    // until the billing period ends. Once it expires, RevenueCat removes
    // it from `active` automatically. So this check is sufficient:
    return true;
}

// Sync RevenueCat pro status to Supabase users table
async function syncProStatus(isPro) {
    try {
        if (!supabase) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase
                .from('users')
                .update({ is_pro: isPro })
                .eq('id', user.id);
        }
    } catch (e) {
        console.error('Error syncing pro status:', e);
    }
}
