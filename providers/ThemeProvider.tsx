import React, { createContext, useState, useContext, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors'; // Adjust path if needed

type Theme = 'light' | 'dark';

// Define the shape of the context value
interface ThemeContextType {
  theme: Theme;
  colors: typeof Colors.light; // Use one mode as the type template
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

// Create the context with an undefined initial value
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Provides the theme context (light/dark mode) and corresponding colors to the application.
 * It detects the user's preferred color scheme and allows toggling or setting the theme.
 */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const [currentTheme, setCurrentTheme] = useState<Theme>(colorScheme);

  // Memoize the colors object to prevent unnecessary re-renders
  const themeColors = useMemo(() => Colors[currentTheme], [currentTheme]);

  /** Toggles the current theme between light and dark mode. */
  const toggleTheme = () => {
    setCurrentTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  /** Sets the theme to a specific value ('light' or 'dark'). */
  const setTheme = (theme: Theme) => {
    setCurrentTheme(theme);
  };

  // Memoize the context value object
  const value = useMemo(
    () => ({
      theme: currentTheme,
      colors: themeColors,
      toggleTheme,
      setTheme,
    }),
    [currentTheme, themeColors] // Dependencies for memoization
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

/**
 * Custom hook to access the theme context (theme and colors).
 * Throws an error if used outside of a ThemeProvider.
 * @returns {ThemeContextType} The theme context value.
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 