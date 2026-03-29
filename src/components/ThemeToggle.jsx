
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

const ThemeToggle = ({ className = '' }) => {
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const actionLabel = isDark
    ? t('common.switchToLightMode', 'Switch to light mode')
    : t('common.switchToDarkMode', 'Switch to dark mode');

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={`h-9 w-9 p-0 text-gray-400 hover:text-white hover:bg-gray-800 ${className}`}
      title={actionLabel}
      aria-label={actionLabel}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
};

export default ThemeToggle;
