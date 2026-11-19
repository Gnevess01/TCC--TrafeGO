import { MD3LightTheme } from 'react-native-paper';

export const cores = {
    charcoal: '#595959',
    grey: '#7f7f7f',
    silver: '#a5a5a5',
    dustGrey: '#cccccc',
    platinum: '#f2f2f2',
    white: '#FFFFFF',
    black: '#1E1E1E',
    error: '#E53E3E',
    success: '#22C55E',
    warning: '#F59E0B',
    info: '#3B82F6',
    primary: '#595959',
    secondary: '#7f7f7f',
    accent: '#a5a5a5',
};

export const theme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        primary: cores.charcoal,
        secondary: cores.grey,
        tertiary: cores.silver,
        background: cores.platinum,
        surface: cores.white,
        text: cores.charcoal,
        onSurface: cores.grey,
        accent: cores.silver,
        error: cores.error,
        success: cores.success,
    },
    roundness: 24,
};