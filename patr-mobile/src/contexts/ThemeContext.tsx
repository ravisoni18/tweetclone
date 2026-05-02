import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeName = 'dark' | 'aurora' | 'sunset' | 'forest' | 'light' | 'cyber';

export interface Theme {
  name: string;
  bg: string;
  bgSecondary: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
  accentHover: string;
  accentText: string;
  hover: string;
  activeBg: string;
  widget: string;
  searchBg: string;
}

export const themes: Record<ThemeName, Theme> = {
  dark: {
    name: '🌑 Dark',
    bg: '#000000',
    bgSecondary: '#16181c',
    border: '#2f3336',
    text: '#e7e9ea',
    textDim: '#71767b',
    accent: '#1d9bf0',
    accentHover: '#1a8cd8',
    accentText: '#ffffff',
    hover: 'rgba(255,255,255,0.10)',
    activeBg: 'rgba(29,155,240,0.18)',
    widget: '#16181c',
    searchBg: '#202327',
  },
  aurora: {
    name: '🌌 Aurora',
    bg: '#080b14',
    bgSecondary: '#0e1220',
    border: '#1a2440',
    text: '#d4e8ff',
    textDim: '#5a7a9a',
    accent: '#38bdf8',
    accentHover: '#0ea5e9',
    accentText: '#0c1a2e',
    hover: 'rgba(56,189,248,0.12)',
    activeBg: 'rgba(56,189,248,0.22)',
    widget: '#0e1220',
    searchBg: '#131825',
  },
  sunset: {
    name: '🌅 Sunset',
    bg: '#0f0a08',
    bgSecondary: '#1a1008',
    border: '#2a1a10',
    text: '#f5e8d5',
    textDim: '#7a5a40',
    accent: '#f97316',
    accentHover: '#ea6d10',
    accentText: '#ffffff',
    hover: 'rgba(249,115,22,0.13)',
    activeBg: 'rgba(249,115,22,0.24)',
    widget: '#1a1008',
    searchBg: '#1f1510',
  },
  forest: {
    name: '🌿 Forest',
    bg: '#060e09',
    bgSecondary: '#0a1a0d',
    border: '#0e2012',
    text: '#d1fae5',
    textDim: '#4a7a57',
    accent: '#22c55e',
    accentHover: '#16a34a',
    accentText: '#ffffff',
    hover: 'rgba(34,197,94,0.13)',
    activeBg: 'rgba(34,197,94,0.24)',
    widget: '#0a1a0d',
    searchBg: '#0e2012',
  },
  light: {
    name: '☀️ Paper',
    bg: '#f9f7f4',
    bgSecondary: '#f0ede8',
    border: '#d4cfc8',
    text: '#1a1614',
    textDim: '#4a3d36',
    accent: '#7c3aed',
    accentHover: '#6d28d9',
    accentText: '#ffffff',
    hover: 'rgba(124,58,237,0.12)',
    activeBg: 'rgba(124,58,237,0.22)',
    widget: '#f0ede8',
    searchBg: '#ebe8e2',
  },
  cyber: {
    name: '⚡ Cyber',
    bg: '#030308',
    bgSecondary: '#07070f',
    border: '#0a1520',
    text: '#ccfff8',
    textDim: '#3a7a6a',
    accent: '#00ffc8',
    accentHover: '#00e6b4',
    accentText: '#030308',
    hover: 'rgba(0,255,200,0.12)',
    activeBg: 'rgba(0,255,200,0.22)',
    widget: '#07070f',
    searchBg: '#0a0a18',
  },
};

interface ThemeContextType {
  themeName: ThemeName;
  theme: Theme;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeName: 'dark',
  theme: themes.dark,
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeName, setThemeName] = useState<ThemeName>('dark');

  useEffect(() => {
    AsyncStorage.getItem('patr-theme').then(saved => {
      if (saved && themes[saved as ThemeName]) {
        setThemeName(saved as ThemeName);
      }
    });
  }, []);

  const setTheme = async (name: ThemeName) => {
    setThemeName(name);
    await AsyncStorage.setItem('patr-theme', name);
  };

  return (
    <ThemeContext.Provider value={{ themeName, theme: themes[themeName], setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
