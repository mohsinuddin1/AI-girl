import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { posthog } from '../lib/posthog';
import { ReportService } from '../services/ReportService';
import {
    registerForPushNotificationsAsync,
    savePushTokenToSupabase,
    scheduleDailyScanReminder,
    scheduleStreakSaverReminder,
    saveNotificationPreferences,
    loadNotificationPreferences,
    DEFAULT_NOTIFICATION_PREFS,
} from '../utils/notifications';
import { maybeRequestReview } from '../utils/reviewPrompt';

// ─── Feature Flag: Free Scans ───
// These are now fetched dynamically from the app_settings table in Supabase.
// Default fallback values:
const DEFAULT_APP_SETTINGS = {
    free_daily_limit: 1,
    free_scans_enabled: true
};

// Build a date-keyed hashmap from a flat scan array for O(1) lookups
function buildDateMap(scans) {
    const map = {};
    for (const s of scans) {
        if (!s.created_at) continue;
        const d = new Date(s.created_at);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!map[key]) map[key] = [];
        map[key].push(s);
    }
    return map;
}

const useStore = create((set, get) => ({
    // Auth state
    user: null,
    profile: null,
    session: null,
    loading: true,
    appSettings: DEFAULT_APP_SETTINGS,

    // Scan state
    companionProfile: null,
    scanResult: null,
    isAnalyzing: false,
    scanHistory: [],
    scanHistoryByDate: {},
    scanHistoryHasMore: true,
    scanHistoryLoading: false,

    // Medical Reports state
    medicalReports: [],
    medicalReportsLoading: false,
    medicalReportsHasMore: true,

    // UI state
    hasSeenOnboarding: false,
    onboardingLoaded: false,
    showReviewPrompt: false,
    showUpgradeModal: false,
    pendingFirstScan: false,
    hasAcceptedAITerms: false,
    setAcceptedAITerms: async (val) => {
        try {
            await AsyncStorage.setItem('purescan_accepted_ai_terms', val ? 'true' : 'false');
            set({ hasAcceptedAITerms: val });
        } catch (e) {
            console.error('Failed to set accepted AI terms:', e);
        }
    },
    setShowReviewPrompt: (visible) => set({ showReviewPrompt: visible }),
    setShowUpgradeModal: (visible) => set({ showUpgradeModal: visible }),
    setPendingFirstScan: (val) => set({ pendingFirstScan: val }),

    // Guest mode (Apple Guideline 5.1.1v — allow access without registration)
    isGuestMode: false,

    // Notification state
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
    expoPushToken: null,

    // Guest Auth Routing
    guestRequiresAuth: false,

    // Health preferences (from personalized onboarding)
    healthPreferences: null,

    // App Preferences
    showMascot: true,
    skipNotFoundModal: false,

    // Persona state
    personas: [],
    selectedPersona: null,
    
    fetchPersonas: async () => {
        try {
            const { data, error } = await supabase.from('ai_personas').select('*').eq('is_visible', true).order('created_at', { ascending: true });
            
            let finalPersonas = [];
            if (!error && data && data.length > 0) {
                finalPersonas = data;
            } else {
                finalPersonas = [
                    { id: 'fb1', name: 'Luna', image_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=540&h=960&fit=crop', personality: {shyFlirty: 0.8, pessOpt: 0.6, ordMyst: 0.9}, extra_demand: 'I love talking about the universe and stars.' },
                    { id: 'fb2', name: 'Emma', image_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=540&h=960&fit=crop', personality: {shyFlirty: 0.4, pessOpt: 0.9, ordMyst: 0.3}, extra_demand: 'I am very practical and optimistic.' },
                    { id: 'custom_girl', name: 'Custom Girl', image_url: 'https://images.unsplash.com/photo-1525875975471-999f65706a10?w=540&h=960&fit=crop', personality: {shyFlirty: 0.5, pessOpt: 0.5, ordMyst: 0.5}, extra_demand: 'I am a custom AI persona.' }
                ];
            }
            
            set({ personas: finalPersonas });
            
            // If we have a saved ID, select it
            const savedId = await AsyncStorage.getItem('purescan_selected_persona_id');
            
            if (savedId === 'custom') {
                const customDataStr = await AsyncStorage.getItem('purescan_custom_persona_data');
                if (customDataStr) {
                    try {
                        const customData = JSON.parse(customDataStr);
                        set({ selectedPersona: customData });
                        return;
                    } catch (e) {
                        console.error('Failed to parse custom persona data', e);
                    }
                }
            }
            
            if (savedId) {
                const found = finalPersonas.find(p => p.id === savedId);
                if (found) set({ selectedPersona: found });
            } else if (finalPersonas.length > 0) {
                // Default to first persona
                set({ selectedPersona: finalPersonas[0] });
            }
        } catch (e) {
            console.error('Failed to fetch personas', e);
            const fallback = [
                { id: 'fb1', name: 'Luna', image_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=540&h=960&fit=crop', personality: {shyFlirty: 0.8, pessOpt: 0.6, ordMyst: 0.9}, extra_demand: 'I love talking about the universe and stars.' },
                { id: 'fb2', name: 'Emma', image_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=540&h=960&fit=crop', personality: {shyFlirty: 0.4, pessOpt: 0.9, ordMyst: 0.3}, extra_demand: 'I am very practical and optimistic.' },
                { id: 'custom_girl', name: 'Custom Girl', image_url: 'https://images.unsplash.com/photo-1525875975471-999f65706a10?w=540&h=960&fit=crop', personality: {shyFlirty: 0.5, pessOpt: 0.5, ordMyst: 0.5}, extra_demand: 'I am a custom AI persona.' }
            ];
            set({ personas: fallback });
            if (!get().selectedPersona) {
                set({ selectedPersona: fallback[0] });
            }
        }
    },
    
    setSelectedPersona: async (persona) => {
        set({ selectedPersona: persona });
        if (persona?.id) {
            await AsyncStorage.setItem('purescan_selected_persona_id', persona.id);
            if (persona.id === 'custom') {
                await AsyncStorage.setItem('purescan_custom_persona_data', JSON.stringify(persona));
            }
        }
    },
    
    updateCustomPersona: async (customData) => {
        const { selectedPersona } = get();
        if (selectedPersona && selectedPersona.id === 'custom') {
            const updated = { 
                ...selectedPersona, 
                ...customData,
                personality: customData.personality 
                    ? { ...selectedPersona.personality, ...customData.personality }
                    : selectedPersona.personality
            };
            get().setSelectedPersona(updated);
        }
    },

    // Init onboarding check
    checkOnboarding: async () => {
        try {
            const onboarded = await AsyncStorage.getItem('purescan_onboarded');
            const mascot = await AsyncStorage.getItem('purescan_show_mascot');
            const guest = await AsyncStorage.getItem('purescan_guest_mode');
            const skipModal = await AsyncStorage.getItem('purescan_skip_not_found_modal');
            const acceptedAITerms = await AsyncStorage.getItem('purescan_accepted_ai_terms');
            set({
                hasSeenOnboarding: onboarded === 'true',
                onboardingLoaded: true,
                showMascot: mascot !== 'false', // Default to true
                isGuestMode: guest === 'true',
                skipNotFoundModal: skipModal === 'true',
                hasAcceptedAITerms: acceptedAITerms === 'true',
            });
            // Fetch personas right after initialization
            get().fetchPersonas();
        } catch (e) {
            console.error('Failed to read onboarding state:', e);
            set({ onboardingLoaded: true }); // Prevent infinite loading
        }
    },

    // Auth actions
    setUser: (user) => set({ user }),
    setSession: (session) => set({ session }),
    setLoading: (loading) => set({ loading }),

    setOnboarded: async () => {
        try {
            await AsyncStorage.setItem('purescan_onboarded', 'true');
            set({ hasSeenOnboarding: true });
        } catch (e) {
            console.error('Failed to set onboarded state:', e);
        }
    },

    toggleSkipNotFoundModal: async (val) => {
        try {
            await AsyncStorage.setItem('purescan_skip_not_found_modal', val ? 'true' : 'false');
            set({ skipNotFoundModal: val });
        } catch (e) {
            console.error('Failed to set skip modal preference:', e);
        }
    },
    setGuestMode: async (val) => {
        try {
            await AsyncStorage.setItem('purescan_guest_mode', val ? 'true' : 'false');
        } catch (e) {
            console.error('Failed to save guest mode state:', e);
        }
        set({ isGuestMode: val });
    },

    setGuestRequiresAuth: (val) => set({ guestRequiresAuth: val }),

    clearOnboarding: async () => {
        try {
            await AsyncStorage.removeItem('purescan_onboarded');
        } catch (e) {
            console.error('Failed to clear onboarding state:', e);
        }
        set({ hasSeenOnboarding: false });
    },

    setShowMascot: async (val) => {
        try {
            await AsyncStorage.setItem('purescan_show_mascot', val ? 'true' : 'false');
        } catch (e) {
            console.error('Failed to save mascot state:', e);
        }
        set({ showMascot: val });
    },

    setHealthPreferences: async (prefs) => {
        // prefs: { diseases: [], allergies: [], goals: [] }
        await AsyncStorage.setItem('purescan_health_prefs', JSON.stringify(prefs));
        set({ healthPreferences: prefs });

        // Also update local profile cache so HealthPreferencesScreen reads fresh data
        const { profile } = get();
        if (profile) {
            set({ profile: { ...profile, health_preferences: prefs } });
        }

        // If user is logged in, sync to Supabase
        const { user } = get();
        if (user && supabase) {
            try {
                await supabase
                    .from('aigirl_users')
                    .update({ health_preferences: prefs })
                    .eq('id', user.id);
            } catch (err) {
                console.error('Failed to sync health prefs to Supabase', err);
                posthog.capture('health prefs sync failed', { reason: err.message });
            }
        }
    },

    loadHealthPreferences: async () => {
        try {
            const val = await AsyncStorage.getItem('purescan_health_prefs');
            if (val) {
                const parsed = JSON.parse(val);
                // Normalize: ensure it's an object with arrays, not a raw array
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    set({ healthPreferences: parsed });
                }
            }
        } catch (err) {
            console.error('Error loading health prefs from storage:', err);
        }
    },

    fetchProfile: async (userId) => {
        if (!supabase) {
            console.warn('[PureScan] Supabase unavailable, skipping profile fetch.');
            return null;
        }
        try {
            const { data, error } = await supabase
                .from('aigirl_users')
                .select('*')
                .eq('id', userId)
                .single();

            let currentData = null;

            if (error && error.code === 'PGRST116') {
                const prefs = get().healthPreferences;
                const { data: newProfile, error: createError } = await supabase
                    .from('aigirl_users')
                    .upsert({
                        id: userId,
                        email: get().user?.email,
                        name: get().companionProfile?.userName || null,
                        daily_scans: 0,
                        current_streak: 0,
                        level_xp: 0,
                        is_pro: false,
                        health_preferences: prefs || null,
                    }, { onConflict: 'id', ignoreDuplicates: true })
                    .select()
                    .single();

                if (createError) {
                    // ignoreDuplicates + single() can return PGRST116 if row existed
                    // and was skipped — just re-fetch the existing row
                    const { data: existing } = await supabase
                        .from('aigirl_users')
                        .select('*')
                        .eq('id', userId)
                        .single();
                    currentData = existing;
                } else {
                    currentData = newProfile;
                }
            } else if (error) {
                throw error;
            } else {
                currentData = data;
            }

            // Initialize and sync rate limiting schema using RPC
            const { data: usageData, error: usageError } = await supabase.rpc('get_aigirl_scan_usage', { p_user_id: userId });

            // Re-sync legacy daily_scans fields just in case it diverged, but let RPC handle the resets
            if (usageData && !usageError) {
                if (currentData.daily_scans !== usageData.daily_scans || currentData.last_scan_date !== usageData.last_reset_day) {
                    const { data: updated } = await supabase
                        .from('aigirl_users')
                        .update({ daily_scans: usageData.daily_scans, last_scan_date: usageData.last_reset_day })
                        .eq('id', userId)
                        .select()
                        .single();

                    currentData = updated || currentData;
                }
            }

            const finalProfile = { ...currentData, scan_usage: usageData || null };
            set({ profile: finalProfile });

            // Fetch app settings for dynamic limits
            const { data: settingsData, error: settingsError } = await supabase
                .from('aigirl_app_settings')
                .select('*')
                .limit(1)
                .single();

            if (settingsData && !settingsError) {
                set({ appSettings: settingsData });
            }

            // Sync health_preferences from Supabase → store + AsyncStorage
            let hp = finalProfile.health_preferences;
            if (typeof hp === 'string') {
                try { hp = JSON.parse(hp); } catch (e) { hp = null; }
            }
            if (hp && typeof hp === 'object' && !Array.isArray(hp)) {
                set({ healthPreferences: hp });
                try { await AsyncStorage.setItem('purescan_health_prefs', JSON.stringify(hp)); } catch (e) { /* non-critical */ }
            }

            return finalProfile;

            // this code was merged above
        } catch (err) {
            console.error('Error fetching profile:', err);
            if (err?.name === 'AuthApiError' || err?.message?.includes('Refresh Token')) {
                get().signOut();
            }
            return null;
        }
    },

    // Scan actions
    canScan: () => {
        const { profile, user, appSettings } = get();
        if (!profile || !user) return true;

        if (user.email === 'tester@medicalgpt.ai') return true;

        const usage = profile.scan_usage;
        if (!usage) return true; // Failsafe

        if (profile.is_pro) {
            return (
                usage.daily_scans < 40 &&
                usage.weekly_scans < 150 &&
                usage.monthly_scans < 520
            );
        } else {
            if (!appSettings.free_scans_enabled) return false;
            return usage.daily_scans < appSettings.free_daily_limit;
        }
    },

    getRemainingScans: () => {
        const { profile, user, appSettings } = get();
        if (!profile || !user) return 0;

        if (user.email === 'tester@medicalgpt.ai') return 9999;

        const usage = profile.scan_usage;
        if (!usage) return profile.is_pro ? 40 : (appSettings.free_scans_enabled ? appSettings.free_daily_limit : 0);

        if (profile.is_pro) {
            return Math.max(0, 40 - (usage.daily_scans || 0));
        } else {
            if (!appSettings.free_scans_enabled) return 0;
            return Math.max(0, appSettings.free_daily_limit - (usage.daily_scans || 0));
        }
    },

    setScanResult: (result) => set({ scanResult: result }),
    setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),

    incrementScan: async () => {
        const { profile, user } = get();
        if (!profile || !user) return;

        // Backend enforcement: Usage relies on the backend now that we successfully invoked the edge function
        // We just fetch the updated usage so the UI updates
        const { data: usageData, error: usageError } = await supabase.rpc('get_aigirl_scan_usage', { p_user_id: user.id });

        if (usageError) {
            console.error('Failed to get updated scan usage', usageError);
        }

        // Check if this is the very first scan ever completed
        if ((profile.level_xp || 0) === 0 && (!profile.scan_usage || profile.scan_usage.daily_scans === 0)) {
            posthog.capture('first_scan_completed');
        }

        const today = new Date().toISOString().split('T')[0];
        const newXp = (profile.level_xp || 0) + 10;

        let newStreak = profile.current_streak || 0;
        if (profile.last_scan_date !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            newStreak = profile.last_scan_date === yesterdayStr ? newStreak + 1 : 1;
        }

        // Streak updates back to users table
        const { data } = await supabase
            .from('aigirl_users')
            .update({
                current_streak: newStreak,
                level_xp: newXp,
            })
            .eq('id', user.id)
            .select()
            .single();

        if (data) {
            set({ profile: { ...data, scan_usage: usageData || profile.scan_usage } });
        }
    },

    saveScan: async (scanData) => {
        const { user } = get();
        if (!user || !supabase) return null;

        const { data, error } = await supabase
            .from('scans')
            .insert({
                user_id: user.id,
                image_url: scanData.imageUrl,
                product_name: scanData.productName,
                ingredients: scanData.ingredients,
                harmful_chemicals: scanData.harmfulChemicals,
                grade: scanData.grade,
                score: scanData.score,
                scan_type: scanData.scan_type,
                method: scanData.method,
                nutriscore: scanData.nutriscore,
                nova_group: scanData.nova_group,
                macros: scanData.macros,
                nutrient_levels: scanData.nutrient_levels,
                health_scores: scanData.healthScores || null,
                allergens: scanData.allergens || [],
                additives: scanData.additives || [],
                traces: scanData.traces || [],
                micros: scanData.micros || null,
                ingredients_analysis_tags: scanData.ingredients_analysis_tags || [],
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving scan:', error);
            return null;
        }

        // Trigger native review prompt on good grade scans
        maybeRequestReview(scanData.grade);

        return data;
    },

    processScan: async (barcode, category, navigation) => {
        const { user, profile, saveScan, incrementScan, setScanResult, setIsAnalyzing } = get();

        try {
            setIsAnalyzing(true);
            setScanResult(null); // Clear stale result from previous scans

            // Phase 2: Instant Basic Info from OpenFoodFacts
            let partialResult = null;
            let clientIngredientsText = '';
            let ingredientPercents = {};
            const apiUrl = category === 'Cosmetic'
                ? `https://world.openbeautyfacts.org/api/v2/product/${barcode}`
                : `https://world.openfoodfacts.org/api/v2/product/${barcode}`;

            try {
                const apiResponse = await fetch(apiUrl);
                if (apiResponse.ok) {
                    const apiData = await apiResponse.json();
                    if (apiData.product) {
                        const product = apiData.product;
                        const rawText = product.ingredients_text_en_imported || product.ingredients_text_en || product.ingredients_text || '';
                        const extractNames = (ings) => {
                            let names = [];
                            for (const ing of ings) {
                                if (ing.text) names.push(ing.text.split(/\s+\/\s+/)[0].trim());
                                else if (ing.id) names.push(ing.id.replace('en:', '').replace(/-/g, ' '));

                                if (ing.ingredients && ing.ingredients.length > 0) {
                                    names = names.concat(extractNames(ing.ingredients));
                                }
                            }
                            return names;
                        };
                        const apiIngredientNames = product.ingredients_text_en_imported ? [] : extractNames(product.ingredients || []).filter(Boolean);

                        // Extract percent_estimate map for the edge function
                        ingredientPercents = {};
                        const extractPercents = (ings) => {
                            for (const ing of ings) {
                                const name = (ing.text || (ing.id ? ing.id.replace('en:', '').replace(/-/g, ' ') : '')).split(/\s+\/\s+/)[0].trim();
                                if (name && ing.percent_estimate != null) {
                                    ingredientPercents[name.toLowerCase()] = Math.round(ing.percent_estimate * 10) / 10;
                                }
                                if (ing.ingredients?.length > 0) extractPercents(ing.ingredients);
                            }
                        };
                        if (product.ingredients?.length > 0) extractPercents(product.ingredients);

                        // Prefer clean array parsing over messy string block
                        clientIngredientsText = product.ingredients_text_en_imported ? product.ingredients_text_en_imported : (apiIngredientNames.length > 0 ? apiIngredientNames.join(', ') : rawText);

                        // Extract ingredients with percentage objects if available to show instantly
                        let initialIngredients = [];
                        if (product.ingredients && product.ingredients.length > 0) {
                            initialIngredients = product.ingredients.map(ing => ({
                                name: ing.text || (ing.id ? ing.id.replace('en:', '').replace(/-/g, ' ') : 'Unknown'),
                                explanation: null,
                                toxicity: 'low',
                                percent: ing.percent_estimate ? Math.round(ing.percent_estimate) : null,
                            }));
                        }

                        let parsedMicros = {};
                        if (product.nutriments) {
                            parsedMicros = {
                                vitaminA: product.nutriments['vitamin-a_100g'] || product.nutriments['vitamin-a_value'] || null,
                                vitaminC: product.nutriments['vitamin-c_100g'] || product.nutriments['vitamin-c_value'] || null,
                                vitaminD: product.nutriments['vitamin-d_100g'] || product.nutriments['vitamin-d_value'] || null,
                                vitaminE: product.nutriments['vitamin-e_100g'] || product.nutriments['vitamin-e_value'] || null,
                                vitaminB1: product.nutriments['vitamin-b1_100g'] || product.nutriments['vitamin-b1_value'] || null,
                                vitaminB2: product.nutriments['vitamin-b2_100g'] || product.nutriments['vitamin-b2_value'] || null,
                                vitaminB3: product.nutriments['vitamin-pp_100g'] || product.nutriments['vitamin-pp_value'] || product.nutriments['niacin_100g'] || product.nutriments['niacin_value'] || null,
                                vitaminB6: product.nutriments['vitamin-b6_100g'] || product.nutriments['vitamin-b6_value'] || null,
                                vitaminB9: product.nutriments['vitamin-b9_100g'] || product.nutriments['vitamin-b9_value'] || product.nutriments['folates_100g'] || product.nutriments['folates_value'] || null,
                                vitaminB12: product.nutriments['vitamin-b12_100g'] || product.nutriments['vitamin-b12_value'] || null,
                                pantothenicAcid: product.nutriments['pantothenic-acid_100g'] || product.nutriments['pantothenic-acid_value'] || null,
                                calcium: product.nutriments['calcium_100g'] || product.nutriments['calcium_value'] || null,
                                iron: product.nutriments['iron_100g'] || product.nutriments['iron_value'] || null,
                                zinc: product.nutriments['zinc_100g'] || product.nutriments['zinc_value'] || null,
                                magnesium: product.nutriments['magnesium_100g'] || product.nutriments['magnesium_value'] || null,
                                potassium: product.nutriments['potassium_100g'] || product.nutriments['potassium_value'] || null,
                                phosphorus: product.nutriments['phosphorus_100g'] || product.nutriments['phosphorus_value'] || null,
                                copper: product.nutriments['copper_100g'] || product.nutriments['copper_value'] || null,
                                manganese: product.nutriments['manganese_100g'] || product.nutriments['manganese_value'] || null,
                                selenium: product.nutriments['selenium_100g'] || product.nutriments['selenium_value'] || null,
                                iodine: product.nutriments['iodine_100g'] || product.nutriments['iodine_value'] || null,
                            };
                            Object.keys(parsedMicros).forEach(k => { if (parsedMicros[k] === null || parsedMicros[k] === undefined) delete parsedMicros[k] });
                        }

                        partialResult = {
                            method: 'barcode',
                            productName: product.product_name || product.product_name_en || 'Unknown Product',
                            brand: product.brands || '',
                            imageUrl: product.image_front_url || product.image_url || null,
                            barcode: barcode,
                            productType: category === 'Cosmetic' ? 'cosmetic' : 'food',
                            ingredients: initialIngredients, // Hydrate instantly if possible
                            harmfulChemicals: [],
                            score: 0,
                            grade: '-',
                            // Phase 2.5: Instant Open Data
                            nutriscore: product.nutriscore_grade || null,
                            novaGroup: product.nova_group || null,
                            ecoscore: product.ecoscore_grade || null,
                            macros: product.nutriments ? {
                                calories: Math.round(product.nutriments['energy-kcal_100g'] || product.nutriments['energy-kcal'] || 0),
                                protein: Math.round((product.nutriments.proteins_100g || product.nutriments.proteins || 0) * 10) / 10,
                                carbs: Math.round((product.nutriments.carbohydrates_100g || product.nutriments.carbohydrates || 0) * 10) / 10,
                                sugar: Math.round((product.nutriments.sugars_100g || product.nutriments.sugars || 0) * 10) / 10,
                                fats: Math.round((product.nutriments.fat_100g || product.nutriments.fat || 0) * 10) / 10,
                                saturatedFat: Math.round((product.nutriments['saturated-fat_100g'] || 0) * 10) / 10,
                                salt: Math.round((product.nutriments.salt_100g || product.nutriments.salt || 0) * 100) / 100,
                                fiber: Math.round((product.nutriments.fiber_100g || product.nutriments.fiber || 0) * 10) / 10,
                            } : null,
                            micros: parsedMicros,
                            nutrientLevels: product.nutrient_levels || null,
                            additives: (product.additives_tags || []).map(t => t.replace('en:', '').replace(/-/g, ' ')),
                            allergens: (product.allergens_tags || []).map(t => t.replace('en:', '').replace(/-/g, ' ')),
                            traces: (product.traces_tags || []).map(t => t.replace('en:', '')),
                            categories: product.categories || '',
                            ingredients_analysis_tags: (product.ingredients_analysis_tags || []).map(t => t.replace('en:', '').replace(/-/g, ' ')),
                        };
                        // Guard: If OFF found the product but it has zero ingredients,
                        // throw immediately so ScanScreen can show the "switch to ingredient mode" modal
                        // BEFORE navigating to the Result screen.
                        if (!clientIngredientsText && (!product.ingredients || product.ingredients.length === 0)) {
                            throw new Error('no_ingredients');
                        }

                        // Immediately show UI
                        setScanResult(partialResult);
                        if (navigation) {
                            navigation.replace('Result', { result: partialResult, imageUrl: partialResult.imageUrl });
                        }
                    }
                }
            } catch (e) {
                // Re-throw no_ingredients so ScanScreen can show the modal
                if (e.message === 'no_ingredients') throw e;
                console.warn('Phase 2 Fast Fetch Failed', e);
            }

            // Phase 3: Background AI Analysis
            // Forward client-side OFF data so edge function skips redundant OFF API call
            const edgeBody = {
                barcode,
                category: category === 'Cosmetic' ? 'cosmetics' : 'food',
            };
            // Forward client health prefs so server skips DB call
            const { healthPreferences } = get();
            if (healthPreferences) {
                edgeBody.healthPreferences = {
                    diseases: healthPreferences.diseases || [],
                    allergies: healthPreferences.allergens || healthPreferences.allergies || [],
                    goals: healthPreferences.goals || [],
                };
            }
            if (partialResult && clientIngredientsText) {
                edgeBody.clientData = {
                    ingredientsText: clientIngredientsText,
                    productName: partialResult.productName,
                    brand: partialResult.brand || '',
                    imageUrl: partialResult.imageUrl,
                    macros: partialResult.macros,
                    micros: partialResult.micros || {},
                    nutriscore: partialResult.nutriscore,
                    novaGroup: partialResult.novaGroup,
                    nutrientLevels: partialResult.nutrientLevels,
                    additives: partialResult.additives || [],
                    allergens: partialResult.allergens || [],
                    traces: partialResult.traces || [],
                    categories: partialResult.categories || '',
                    ingredients_analysis_tags: partialResult.ingredients_analysis_tags || [],
                    ingredientPercents: ingredientPercents || {},
                };
            }
            const response = await supabase.functions.invoke('scan-barcode9', {
                body: edgeBody,
            });

            // Detect server-side upgrade paywall (FREE_TIER_ENABLED=false or rate limit)
            if (response.data?.upgradeRequired) {
                setIsAnalyzing(false);
                // If Phase 2 already navigated away from ScanScreen (partialResult exists),
                // pass the upgradeRequired flag to the ResultScreen via scanResult
                if (partialResult && navigation) {
                    setScanResult({ ...partialResult, upgradeRequired: true });
                    get().setShowUpgradeModal(true);
                    return;
                }
                get().setShowUpgradeModal(true);
                throw new Error('upgrade_required');
            }

            // Detect server-side errors returned as 200 (Product not found, no ingredients, etc.)
            if (response.data?.error) {
                setIsAnalyzing(false);
                if (response.data.noIngredients) {
                    throw new Error('no_ingredients');
                }
                if (response.data.error.includes('RATE_LIMIT_EXCEEDED') || response.data.error.includes('rate limit')) {
                    get().setShowUpgradeModal(true);
                    throw new Error('rate_limit_exceeded');
                }
                throw new Error(response.data.error);
            }

            if (response.error) {
                setIsAnalyzing(false);
                if (response.error.message && (response.error.message.includes('RATE_LIMIT_EXCEEDED') || response.error.message.includes('rate limit'))) {
                    get().setShowUpgradeModal(true);
                }
                throw new Error(response.error.message || 'Scan failed');
            }

            const result = response.data;

            if (!result || !result.ingredients) {
                setIsAnalyzing(false);

                // Bug fix: Server found the barcode but has no ingredients
                if (result?.noIngredients) {
                    throw new Error('no_ingredients');
                }

                // If we have a partial result (product found in OpenFoodFacts/OpenBeautyFacts)
                // show it with a fallback message instead of failing silently
                if (partialResult) {
                    const fallbackResult = {
                        ...partialResult,
                        ingredients: [],
                        harmfulChemicals: [],
                        grade: partialResult.nutriscore ? partialResult.nutriscore.toUpperCase() : 'N/A',
                        score: 0,
                        ingredientsFallback: true, // Flag to show "ingredients not available" in UI
                    };

                    // Save the partial scan so it appears in history
                    await saveScan({
                        imageUrl: fallbackResult.imageUrl || '',
                        productName: fallbackResult.productName || 'Unknown Product',
                        ingredients: [],
                        harmfulChemicals: [],
                        grade: fallbackResult.grade || 'N/A',
                        score: 0,
                        scan_type: fallbackResult.productType || 'food',
                        method: fallbackResult.method || 'barcode',
                        nutriscore: fallbackResult.nutriscore || null,
                        nova_group: fallbackResult.novaGroup || null,
                        macros: fallbackResult.macros || null,
                        micros: fallbackResult.micros || null,
                        nutrient_levels: fallbackResult.nutrientLevels || null,
                        allergens: fallbackResult.allergens || [],
                        additives: fallbackResult.additives || [],
                        traces: fallbackResult.traces || [],
                        ingredients_analysis_tags: fallbackResult.ingredients_analysis_tags || [],
                    });
                    // Backend did NOT increment usage (edge function failed/returned fallback).
                    // Refresh local usage data + update XP/streak — do NOT increment scan count.
                    const { data: refreshedUsage } = await supabase.rpc('get_aigirl_scan_usage', { p_user_id: user.id });
                    if (profile) {
                        const today = new Date().toISOString().split('T')[0];
                        const freshXp = (profile.level_xp || 0) + 10;
                        let freshStreak = profile.current_streak || 0;
                        if (profile.last_scan_date !== today) {
                            const yesterday = new Date();
                            yesterday.setDate(yesterday.getDate() - 1);
                            freshStreak = profile.last_scan_date === yesterday.toISOString().split('T')[0] ? freshStreak + 1 : 1;
                        }
                        const { data: updatedProfile } = await supabase
                            .from('aigirl_users')
                            .update({ current_streak: freshStreak, level_xp: freshXp })
                            .eq('id', user.id)
                            .select()
                            .single();
                        if (updatedProfile) {
                            set({ profile: { ...updatedProfile, scan_usage: refreshedUsage || profile.scan_usage } });
                        }
                    }

                    setScanResult(fallbackResult);
                    return;
                }

                if (!partialResult && navigation) {
                    throw new Error("Product not found");
                }
                return;
            }

            // Graft exact API percentage over AI position-based estimations (if available)
            const cleanedIngredients = (result.ingredients || []).map((ing, index) => {
                let percent = ing.percent;

                // Fallback cleanup if the string somehow sneaks in
                const match = ing.name.match(/\s*\(approx\s+(\d+)%\)/i);
                if (match) {
                    ing.name = ing.name.replace(match[0], '').trim();
                    if (!percent) percent = parseInt(match[1], 10);
                }

                // Strictly map the raw API percent estimate to the AI output
                if (!percent && partialResult && partialResult.ingredients) {
                    const initial = partialResult.ingredients.find(i => {
                        const iLower = i.name.toLowerCase();
                        const nLower = ing.name.toLowerCase();
                        return iLower === nLower ||
                            (iLower.length > 4 && nLower.includes(iLower.substring(0, 5))) ||
                            (nLower.length > 4 && iLower.includes(nLower.substring(0, 5)));
                    });

                    if (initial && initial.percent) {
                        percent = initial.percent;
                    } else if (partialResult.ingredients[index]?.percent) {
                        // Fallback: positional mapping since UI sorts ingredients by position anyway
                        percent = partialResult.ingredients[index].percent;
                    }
                }

                return {
                    ...ing,
                    percent,
                };
            });

            const finalResult = {
                ...partialResult,
                ...result, // AI analysis overwrites partial defaults
                ingredients: cleanedIngredients,
                imageUrl: result.imageUrl || partialResult?.imageUrl || '',
                productName: result.productName || partialResult?.productName || 'Scanned Product',
                // Preserve open data — use .length check because [] is truthy
                allergens: (result.allergens?.length ? result.allergens : partialResult?.allergens) || [],
                traces: (result.traces?.length ? result.traces : partialResult?.traces) || [],
                additives: (result.additives?.length ? result.additives : partialResult?.additives) || [],
                ingredients_analysis_tags: (result.ingredients_analysis_tags?.length ? result.ingredients_analysis_tags : partialResult?.ingredients_analysis_tags) || [],
                // Preserve micros — server may return empty {} when using clientData path
                micros: (result.micros && Object.keys(result.micros).length > 0) ? result.micros : (partialResult?.micros || null),
            };

            const savedScan = await saveScan({
                imageUrl: finalResult.imageUrl,
                productName: finalResult.productName,
                ingredients: finalResult.ingredients || [],
                harmfulChemicals: finalResult.harmful_chemicals || finalResult.harmfulChemicals || [],
                grade: finalResult.grade || finalResult.overallGrade || 'C',
                score: finalResult.score ?? finalResult.toxicityScore ?? 50,
                scan_type: finalResult.productType || 'food',
                method: finalResult.method || 'barcode',
                nutriscore: finalResult.nutriscore || null,
                nova_group: finalResult.novaGroup || null,
                macros: finalResult.macros || null,
                nutrient_levels: finalResult.nutrientLevels || null,
                healthScores: finalResult.healthScores || null,
                allergens: finalResult.allergens || [],
                additives: finalResult.additives || [],
                traces: finalResult.traces || [],
                micros: finalResult.micros || null,
                ingredients_analysis_tags: finalResult.ingredients_analysis_tags || [],
            });

            await incrementScan();

            posthog.capture('scan completed', {
                method: 'barcode',
                category: finalResult.productType || 'food',
                product: finalResult.productName || 'Unknown',
                grade: finalResult.grade || 'N/A',
            });

            // Update global state which ResultScreen listens to
            setScanResult(finalResult);
            setIsAnalyzing(false);

            // If Phase 2 failed and we didn't navigate yet, navigate now
            if (!partialResult && navigation) {
                navigation.replace('Result', { result: result, imageUrl: result.imageUrl });
            }

        } catch (error) {
            if (error?.name === 'AuthApiError' || error?.message?.includes('Refresh Token')) {
                console.warn('Auth Error during scan, signing out.');
                get().signOut();
            } else if (error.message && error.message.toLowerCase().includes('not found')) {
                console.log('ℹ️ processScan result:', error.message);
            } else {
                console.error('🚨 processScan error:', error);
            }
            setIsAnalyzing(false);
            throw error;
        }
    },

    fetchScanHistory: async () => {
        const { user } = get();
        if (!user || !supabase) return;

        set({ scanHistoryLoading: true });
        const PAGE_SIZE = 20;
        const { data } = await supabase
            .from('scans')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(PAGE_SIZE);

        if (data === null || data === undefined) {
            const { error } = await supabase.from('scans').select('*').limit(1);
            if (error?.name === 'AuthApiError' || error?.message?.includes('Refresh Token')) {
                get().signOut();
            }
        }

        const scans = data || [];
        set({
            scanHistory: scans,
            scanHistoryByDate: buildDateMap(scans),
            scanHistoryHasMore: scans.length >= PAGE_SIZE,
            scanHistoryLoading: false,
        });
    },

    fetchMoreScans: async () => {
        const { user, scanHistory, scanHistoryHasMore, scanHistoryLoading } = get();
        if (!user || !supabase || !scanHistoryHasMore || scanHistoryLoading) return;

        const PAGE_SIZE = 20;
        const lastScan = scanHistory[scanHistory.length - 1];
        if (!lastScan?.created_at) return;

        set({ scanHistoryLoading: true });
        const { data } = await supabase
            .from('scans')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .lt('created_at', lastScan.created_at)
            .limit(PAGE_SIZE);

        const newScans = data || [];
        const merged = [...scanHistory, ...newScans];
        set({
            scanHistory: merged,
            scanHistoryByDate: buildDateMap(merged),
            scanHistoryHasMore: newScans.length >= PAGE_SIZE,
            scanHistoryLoading: false,
        });
    },

    // ─── Notification Actions ───
    initNotifications: async () => {
        const { user } = get();
        if (!user) return;

        try {
            // 1. Register for push notifications & get token
            const token = await registerForPushNotificationsAsync();
            if (token) {
                set({ expoPushToken: token });
                await savePushTokenToSupabase(user.id, token);
            }

            // 2. Load saved preferences from Supabase
            const savedPrefs = await loadNotificationPreferences(user.id);
            const prefs = savedPrefs || { ...DEFAULT_NOTIFICATION_PREFS, push_enabled: !!token };
            set({ notificationPrefs: prefs });

            // 3. Schedule local notifications based on preferences
            await scheduleDailyScanReminder(prefs.daily_reminder);
            await scheduleStreakSaverReminder(prefs.streak_saver);
        } catch (err) {
            console.error('Error initializing notifications:', err);
        }
    },

    updateNotificationPref: async (key, value) => {
        const { user, notificationPrefs } = get();
        const updatedPrefs = { ...notificationPrefs, [key]: value };
        set({ notificationPrefs: updatedPrefs });

        // Schedule/cancel local notifications based on toggle
        if (key === 'daily_reminder') {
            await scheduleDailyScanReminder(value);
        } else if (key === 'streak_saver') {
            await scheduleStreakSaverReminder(value);
        }

        // Persist to Supabase
        if (user) {
            await saveNotificationPreferences(user.id, updatedPrefs);
        }
    },

    // ─── Medical Reports Actions ───
    fetchMedicalReports: async () => {
        const { user } = get();
        if (!user) return;

        set({ medicalReportsLoading: true });
        try {
            const reports = await ReportService.fetchReports(user.id);
            set({
                medicalReports: reports,
                medicalReportsHasMore: reports.length >= 20,
                medicalReportsLoading: false,
            });
        } catch (error) {
            console.error('[Store] fetchMedicalReports error:', error);
            set({ medicalReportsLoading: false });
        }
    },

    fetchMoreMedicalReports: async () => {
        const { user, medicalReports, medicalReportsHasMore, medicalReportsLoading } = get();
        if (!user || !medicalReportsHasMore || medicalReportsLoading) return;

        const lastReport = medicalReports[medicalReports.length - 1];
        if (!lastReport?.created_at) return;

        set({ medicalReportsLoading: true });
        try {
            const newReports = await ReportService.fetchMoreReports(user.id, lastReport.created_at);
            const merged = [...medicalReports, ...newReports];
            set({
                medicalReports: merged,
                medicalReportsHasMore: newReports.length >= 20,
                medicalReportsLoading: false,
            });
        } catch (error) {
            console.error('[Store] fetchMoreMedicalReports error:', error);
            set({ medicalReportsLoading: false });
        }
    },

    addMedicalReport: (report) => {
        const { medicalReports } = get();
        set({ medicalReports: [report, ...medicalReports] });
    },

    removeMedicalReport: (reportId) => {
        const { medicalReports } = get();
        set({ medicalReports: medicalReports.filter(r => r.id !== reportId) });
    },

    updateMedicalReport: (reportId, updates) => {
        const { medicalReports } = get();
        set({
            medicalReports: medicalReports.map(r =>
                r.id === reportId ? { ...r, ...updates, updated_at: new Date().toISOString() } : r
            ),
        });
    },

    // Sign out — clears local state and signs out from Supabase.
    // Called both by AuthProvider.signOut() and directly by screens (Settings, Account).
    signOut: async () => {
        posthog.reset();

        // 1. Clear persistence first
        try {
            await AsyncStorage.removeItem('purescan_onboarded');
            await AsyncStorage.removeItem('purescan_guest_mode');
            console.log('Onboarding status cleared');
        } catch (e) {
            console.error('Error clearing onboarding status:', e);
        }

        // 2. Clear ALL state in ONE go to avoid race conditions with navigation effects
        set({
            user: null,
            profile: null,
            session: null,
            hasSeenOnboarding: false,
            isGuestMode: false,
            guestRequiresAuth: false,
            scanHistory: [],
            scanHistoryByDate: {},
            medicalReports: [],
            medicalReportsHasMore: true,
            notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
            expoPushToken: null
        });

        // 3. Official sign out
        try {
            if (supabase) await supabase.auth.signOut();
        } catch (_) {
            // Suppress AuthApiError: Invalid Refresh Token — expected when token is stale or already revoked
            try { if (supabase) await supabase.auth.signOut({ scope: 'local' }); } catch (_) { }
        }
    },
}));

export default useStore;