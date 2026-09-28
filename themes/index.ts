import type { ThemeModule } from '@/lib/types';
import DemoTheme from './demo/Theme';
import demoConfig from './demo/theme.config.json';
import ThottaraKitchenTheme from './thottara-kitchen/Theme';
import thottaraKitchenConfig from './thottara-kitchen/theme.config.json';
import BiteBurgTheme from './bite-burg/Theme';
import biteBurgConfig from './bite-burg/theme.config.json';

export const themes: Record<string, ThemeModule> = {
  demo: { Component: DemoTheme, config: demoConfig as ThemeModule['config'] },
  'thottara-kitchen': { Component: ThottaraKitchenTheme, config: thottaraKitchenConfig as ThemeModule['config'] },
  'bite-burg': { Component: BiteBurgTheme, config: biteBurgConfig as ThemeModule['config'] },
};

export function getTheme(key: string): ThemeModule {
  return themes[key] ?? themes.demo;
}

export function getThemeKeys(): string[] {
  return Object.keys(themes);
}
