/**
 * Theme Toggle Component
 * Переключение между светлой и тёмной темой
 *
 * Темы:
 * - Light: "Дневная стройка" - текстурированный бетон
 * - Dark: "Ночная стройка" - индустриальный бункер с glow эффектами
 */

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('stavagent-theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, []);

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('stavagent-theme', newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className="c-theme-toggle"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <>
          <Moon size={16} />
          <span>Tmavý režim</span>
        </>
      ) : (
        <>
          <Sun size={16} />
          <span>Světlý režim</span>
        </>
      )}
    </button>
  );
}
