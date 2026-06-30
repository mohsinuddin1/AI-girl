import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'aigirl_successful_scans';
const SHOWN_KEY = 'aigirl_review_shown';

/**
 * Call after every successful scan save.
 * Triggers the review modal after the user's 3rd completed scan.
 * Flow: Custom star modal → native in-app review → App Store fallback.
 *
 * NOTE: useStore is required lazily to avoid a circular dependency
 * (useStore -> reviewPrompt -> useStore).
 */
export async function maybeRequestReview(grade) {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        const count = (parseInt(raw, 10) || 0) + 1;
        await AsyncStorage.setItem(KEY, String(count));

        // Only show once
        const hasShown = await AsyncStorage.getItem(SHOWN_KEY);
        if (hasShown === 'true') return;

        // Trigger after 3 scans — user has seen enough value.
        // Skip D/E grades to avoid asking frustrated users.
        const safeGrade = !grade || !['D', 'E'].includes(grade);
        if (count >= 3 && safeGrade) {
            await AsyncStorage.setItem(SHOWN_KEY, 'true');
            const useStore = require('../store/useStore').default;
            useStore.getState().setShowReviewPrompt(true);
        }
    } catch {
        // Non-critical — swallow silently
    }
}
