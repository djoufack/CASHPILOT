
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';
import './LanguageSwitcher.css';

const LANGUAGES = [
  { code: 'fr', shortLabel: 'FR', label: 'Français', flag: '🇫🇷' },
  { code: 'en', shortLabel: 'EN', label: 'English', flag: '🇬🇧' },
  { code: 'nl', shortLabel: 'NL', label: 'Nederlands', flag: '🇳🇱' }
];

const LanguageSwitcher = ({ variant = 'dropdown', className = '', fullWidth = false }) => {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const currentLanguageCode = String(i18n.resolvedLanguage || i18n.language || 'en')
    .toLowerCase()
    .split('-')[0];
  const currentLang = LANGUAGES.find((language) => language.code === currentLanguageCode) || LANGUAGES[0];
  const activeIndex = Math.max(
    0,
    LANGUAGES.findIndex((language) => language.code === currentLanguageCode)
  );

  if (variant === 'segmented') {
    return (
      <div
        className={`segmented-language-switcher${fullWidth ? ' segmented-language-switcher--full' : ''} ${className}`.trim()}
        role="radiogroup"
        aria-label={t('common.language', 'Language')}
        style={{ '--active-index': activeIndex }}
      >
        <span className="segmented-language-switcher__thumb" aria-hidden="true" />
        {LANGUAGES.map((language) => (
          <button
            key={language.code}
            type="button"
            onClick={() => changeLanguage(language.code)}
            className={`segmented-language-switcher__option${currentLanguageCode === language.code ? ' is-active' : ''}`}
            role="radio"
            aria-checked={currentLanguageCode === language.code}
            aria-label={language.label}
          >
            {language.shortLabel}
          </button>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start md:justify-center md:w-auto text-gray-400 hover:text-white"
          aria-label={t('common.language', 'Language')}
        >
          <Globe className="w-4 h-4 mr-2" />
          <span className="md:hidden lg:inline">{currentLang.label}</span>
          <span className="hidden md:inline lg:hidden">{currentLang.code.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-white">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem 
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className="hover:bg-gray-800 cursor-pointer flex items-center gap-2"
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
