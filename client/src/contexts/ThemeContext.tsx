import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setUserId: (userId: string | null) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<string | null>(null);
  
  const getThemeKey = (userId: string | null) => {
    return userId ? `theme_${userId}` : 'theme_default';
  };
  
  const getInitialTheme = (userId: string | null): Theme => {
    // Check for saved preference first (for both logged in and logged out users)
    const saved = localStorage.getItem(getThemeKey(userId)) as Theme;
    if (saved) return saved;
    
    // Default to dark theme for all users (matching current design)
    return 'dark';
  };
  
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme(userId));

  // Update theme when userId changes
  useEffect(() => {
    const newTheme = getInitialTheme(userId);
    if (newTheme !== theme) {
      setTheme(newTheme);
    }
  }, [userId]);
  
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('light', 'dark');
    
    // Add the current theme class
    root.classList.add(theme);
    
    // Save to localStorage with user-specific key
    localStorage.setItem(getThemeKey(userId), theme);
  }, [theme, userId]);
  
  const setUserId = (newUserId: string | null) => {
    setUserIdState(newUserId);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, setUserId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}