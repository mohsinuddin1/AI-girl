/**
 * PostHog Analytics — Safe Wrapper
 *
 * HOW TO ACTIVATE:
 * 1. Set POSTHOG_KEY in .env
 * 2. Set POSTHOG_ENABLED=true in .env
 * 3. Rebuild: npx expo run:android (or run:ios)
 *
 * We gate behind POSTHOG_ENABLED because the posthog-react-native
 * SDK loads native modules at import time. If the native build was done before
 * the SDK was installed, those modules don't exist and the app crashes.
 */

const noOp = () => { };
const noOpPosthog = { capture: noOp, screen: noOp, identify: noOp, reset: noOp, flush: noOp, debug: noOp };

let posthogInstance = noOpPosthog;

// Only load the SDK if explicitly enabled (requires a native rebuild after install)
if (process.env.POSTHOG_ENABLED === 'true' && process.env.POSTHOG_KEY) {
    try {
        const PostHog = require('posthog-react-native').default;
        posthogInstance = new PostHog(process.env.POSTHOG_KEY, {
            host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
            flushAt: 20,
            flushInterval: 30000,
            captureAppLifecycleEvents: true,
            captureDeepLinks: true,
        });
    } catch (e) {
        console.warn('PostHog init failed, analytics disabled:', e.message);
        posthogInstance = noOpPosthog;
    }
}

export const posthog = posthogInstance;
