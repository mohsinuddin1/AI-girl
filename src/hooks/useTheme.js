import { Colors, Radii, Shadows } from '../theme';

// Centralized theme hook — extend with React Context for dark mode support
export default function useTheme() {
    return { Colors, Radii, Shadows };
}
