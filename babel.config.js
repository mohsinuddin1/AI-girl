module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            'react-native-reanimated/plugin',
            ['transform-inline-environment-variables', {
                include: [
                    'SUPABASE_URL',
                    'SUPABASE_ANON_KEY',
                    'MED_SUPABASE_URL',
                    'MED_SUPABASE_ANON_KEY',
                    'REVENUECAT_IOS_KEY',
                    'REVENUECAT_ANDROID_KEY',
                    'GOOGLE_WEB_CLIENT_ID',
                    'GOOGLE_IOS_CLIENT_ID',
                    'POSTHOG_KEY',
                    'POSTHOG_HOST',
                    'POSTHOG_ENABLED',
                    'SENTRY_DSN',
                ]
            }]
        ],
    };
};
