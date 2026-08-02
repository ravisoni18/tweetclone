import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeName = 'dark' | 'aurora' | 'sunset' | 'forest' | 'light' | 'cyber';

interface Theme {
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
  activeBg: string;  // background for the currently-selected sidebar item
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
    activeBg: 'rgba(29,155,240,0.18)',   // blue-tinted pill for active item
    widget: '#16181c',
    searchBg: '#202327',
  },
  aurora: {
    name: '🌌 Aurora',
    bg: '#080b14',
    bgSecondary: '#0e1220',
    border: 'rgba(100,200,255,0.08)',
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
    border: 'rgba(255,140,60,0.1)',
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
    border: 'rgba(74,222,128,0.08)',
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
    hover: '#f0e7fc',      // opaque pale purple — alpha blends washed-out/grey on this light bg
    activeBg: '#e3d1fa',   // opaque, more saturated purple pill for active item
    widget: '#f0ede8',
    searchBg: '#ebe8e2',
  },
  cyber: {
    name: '⚡ Cyber',
    bg: '#030308',
    bgSecondary: '#07070f',
    border: 'rgba(0,255,200,0.1)',
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
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    return (localStorage.getItem('patr-theme') as ThemeName) || 'dark';
  });

  const setTheme = (name: ThemeName) => {
    setThemeName(name);
    localStorage.setItem('patr-theme', name);
  };

  // Apply CSS variables to root for global use
  useEffect(() => {
    const t = themes[themeName];
    const root = document.documentElement;
    root.style.setProperty('--bg', t.bg);
    root.style.setProperty('--bg-secondary', t.bgSecondary);
    root.style.setProperty('--border', t.border);
    root.style.setProperty('--text', t.text);
    root.style.setProperty('--text-dim', t.textDim);
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-hover', t.accentHover);
    root.style.setProperty('--accent-text', t.accentText);
    root.style.setProperty('--hover', t.hover);
    root.style.setProperty('--active-bg', t.activeBg);
    root.style.setProperty('--widget', t.widget);
    root.style.setProperty('--search-bg', t.searchBg);
    document.body.style.backgroundColor = t.bg;
    document.body.style.color = t.text;
  }, [themeName]);

  return (
    <ThemeContext.Provider value={{ themeName, theme: themes[themeName], setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
