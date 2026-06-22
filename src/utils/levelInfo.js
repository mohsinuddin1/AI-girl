/**
 * Shared level calculation utility.
 * Used by HomeScreen, SettingsScreen, and any future screen that needs level info.
 */
export function getLevelInfo(xp) {
    if (xp < 50) return { name: 'Beginner', current: xp, max: 50, level: 1, emoji: '🌱' };
    if (xp < 150) return { name: 'Explorer', current: xp - 50, max: 100, level: 2, emoji: '🔍' };
    if (xp < 300) return { name: 'Detective', current: xp - 150, max: 150, level: 3, emoji: '🕵️' };
    if (xp < 500) return { name: 'Expert', current: xp - 300, max: 200, level: 4, emoji: '⚡' };
    return { name: 'Master', current: xp - 500, max: 500, level: 5, emoji: '👑' };
}
