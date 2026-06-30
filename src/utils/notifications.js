import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// ─── Configure how notifications appear when app is in foreground ───
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

// ─── Request Permissions & Get Push Token ───
export async function registerForPushNotificationsAsync() {
    let token = null;

    // Push notifications only work on physical devices
    if (!Device.isDevice) {
        console.log('Push notifications require a physical device.');
        return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Ask for permission if not already granted
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Notification permission not granted.');
        return null;
    }

    // Get the Expo push token
    try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig?.extra?.eas?.projectId ?? '19807809-797a-4216-a728-0a8463f1d495',
        });
        token = tokenData.data;
    } catch (err) {
        console.error('Error getting push token:', err);
        return null;
    }

    // Android-specific notification channel
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'AIGirl',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#e8a838',
        });
    }

    return token;
}

// ─── Save Push Token to Supabase (for admin-triggered pushes) ───
export async function savePushTokenToSupabase(userId, expoPushToken) {
    if (!userId || !expoPushToken) {
        console.log('⚠️ Skipping push token save: missing userId or token');
        return;
    }

    try {
        console.log(`[Push API] Attempting to save Token for user ${userId}...`);
        
        // Upsert so we don't duplicate tokens for the same device
        const { error, data } = await supabase
            .from('push_tokens')
            .upsert(
                {
                    user_id: userId,
                    expo_push_token: expoPushToken,
                    platform: Platform.OS,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,expo_push_token' }
            )
            .select();

        if (error) {
            console.error('❌ Supabase Error saving push token:', error.message, error.details);
        } else {
            console.log('✅ Push Token successfully saved/verified in DB. Row ID:', data?.[0]?.id);
        }
    } catch (err) {
        console.error('❌ Failed to execute push token save:', err);
    }
}

// ─── Schedule Daily Scan Reminder (Local Notification) ───
export async function scheduleDailyScanReminder(enabled) {
    // First, cancel any existing daily reminders
    await cancelScheduledNotification('daily-scan-reminder');

    if (!enabled) return;

    // Schedule for 10:00 AM every day
    await Notifications.scheduleNotificationAsync({
        identifier: 'daily-scan-reminder',
        content: {
            title: '🌿 A gentle reminder for your health',
            body: 'Good morning! Whenever you have a moment, we\'re here to help you stay on top of your well-being today.',
            sound: true,
            data: { type: 'daily_reminder' },
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: 10,
            minute: 0,
        },
    });
}

// ─── Schedule Streak Saver Reminder (Local Notification) ───
export async function scheduleStreakSaverReminder(enabled) {
    // Cancel existing streak reminders
    await cancelScheduledNotification('streak-saver-reminder');

    if (!enabled) return;

    // Schedule for 8:00 PM every day (evening reminder to not lose streak)
    await Notifications.scheduleNotificationAsync({
        identifier: 'streak-saver-reminder',
        content: {
            title: '🌟 Just checking in on you',
            body: 'We noticed you haven\'t scanned today. If you have a moment, we\'d love to help you keep your healthy streak going!',
            sound: true,
            data: { type: 'streak_saver' },
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: 20,
            minute: 0,
        },
    });
}

// ─── Cancel a Specific Scheduled Notification ───
export async function cancelScheduledNotification(identifier) {
    try {
        await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch (err) {
        // Notification may not exist — safe to ignore
    }
}

// ─── Cancel ALL Scheduled Notifications ───
export async function cancelAllScheduledNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─── Save Notification Preferences to Supabase ───
export async function saveNotificationPreferences(userId, preferences) {
    if (!userId) return;

    try {
        const { error } = await supabase
            .from('aigirl_users')
            .update({ notification_preferences: preferences })
            .eq('id', userId);

        if (error) console.error('Error saving notification prefs:', error);
    } catch (err) {
        console.error('Failed to save notification prefs:', err);
    }
}

// ─── Load Notification Preferences from Supabase ───
export async function loadNotificationPreferences(userId) {
    if (!userId) return null;

    try {
        const { data, error } = await supabase
            .from('aigirl_users')
            .select('notification_preferences')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error loading notification prefs:', error);
            return null;
        }

        return data?.notification_preferences || null;
    } catch (err) {
        console.error('Failed to load notification prefs:', err);
        return null;
    }
}

// ─── Default Notification Preferences ───
export const DEFAULT_NOTIFICATION_PREFS = {
    daily_reminder: true,
    streak_saver: true,
    new_features: false,
    push_enabled: false,   // Whether the user has granted push permission
};
