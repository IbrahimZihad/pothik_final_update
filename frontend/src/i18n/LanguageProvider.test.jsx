import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider, useI18n } from './LanguageProvider';

function Probe() {
  const { t, lang, setLang } = useI18n();
  return (
    <div>
      <span data-testid="home">{t('common.home')}</span>
      <span data-testid="missing">{t('common.doesNotExist')}</span>
      <span data-testid="lang">{lang}</span>
      <button type="button" onClick={() => setLang('bn')}>Bangla</button>
      <button type="button" onClick={() => setLang('en')}>English</button>
    </div>
  );
}

describe('LanguageProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
  });

  it('defaults to English and falls back to the key when missing', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByTestId('home')).toHaveTextContent('Home');
    expect(screen.getByTestId('missing')).toHaveTextContent('common.doesNotExist');
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
  });

  it('switches to Bangla, persists the choice and updates the document language', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Bangla' }));
    expect(screen.getByTestId('home')).toHaveTextContent('হোম');
    expect(screen.getByTestId('lang')).toHaveTextContent('bn');
    expect(localStorage.getItem('pothik_lang')).toBe('bn');
    expect(document.documentElement.lang).toBe('bn');

    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByTestId('home')).toHaveTextContent('Home');
    expect(localStorage.getItem('pothik_lang')).toBe('en');
  });

  it('restores the persisted language on mount', () => {
    localStorage.setItem('pothik_lang', 'bn');
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByTestId('home')).toHaveTextContent('হোম');
  });
});
