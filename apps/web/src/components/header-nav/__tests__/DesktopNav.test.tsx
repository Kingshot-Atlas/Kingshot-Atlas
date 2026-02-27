import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'nav.home': 'Home',
        'nav.rankings': 'Rankings',
        'nav.tools': 'Tools',
        'nav.community': 'Community',
        'nav.seasons': 'KvK Seasons',
        'nav.transferHub': 'Transfer Hub',
        'nav.compare': 'Compare',
        'nav.scoreSimulator': 'Score Simulator',
        'nav.about': 'About',
        'nav.discord': 'Discord',
        'nav.feedback': 'Feedback',
        'nav.allianceBaseDesigner': 'Base Designer',
        'nav.battlePlanner': 'Battle Planner',
        'nav.prepScheduler': 'Prep Scheduler',
        'nav.language': 'Language',
      };
      return translations[key] || key;
    },
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}));

// Mock analytics
vi.mock('../../../hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    trackButton: vi.fn(),
    trackPage: vi.fn(),
  }),
}));

// Mock styles
vi.mock('../../../utils/styles', () => ({
  neonGlow: () => ({}),
}));

// Mock i18n config
vi.mock('../../../i18n', () => ({
  SUPPORTED_LANGUAGES: ['en', 'es'],
  LANGUAGE_META: {
    en: { flag: '🇺🇸', nativeName: 'English', name: 'English' },
    es: { flag: '🇪🇸', nativeName: 'Español', name: 'Spanish' },
  },
}));

// Mock NotificationBell component
vi.mock('../../NotificationBell', () => ({
  default: () => React.createElement('div', { 'data-testid': 'notification-bell' }),
}));

import DesktopNav from '../DesktopNav';

describe('DesktopNav', () => {
  const defaultProps = {
    isActive: (path: string) => path === '/',
    user: false,
    changeLanguage: vi.fn(),
    children: React.createElement('div', { 'data-testid': 'user-menu' }, 'User Menu'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <DesktopNav {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('renders Home link', () => {
    render(
      <MemoryRouter>
        <DesktopNav {...defaultProps} />
      </MemoryRouter>
    );
    const homeLink = screen.getByText('Home');
    expect(homeLink).toBeInTheDocument();
    expect(homeLink.tagName).toBe('A');
  });

  it('renders Rankings link', () => {
    render(
      <MemoryRouter>
        <DesktopNav {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByText('Rankings')).toBeInTheDocument();
  });

  it('renders user menu children slot', () => {
    render(
      <MemoryRouter>
        <DesktopNav {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByTestId('user-menu')).toBeInTheDocument();
  });

  it('highlights active route', () => {
    render(
      <MemoryRouter>
        <DesktopNav {...defaultProps} isActive={(path) => path === '/'} />
      </MemoryRouter>
    );
    const homeLink = screen.getByText('Home');
    // Active route gets cyan color and bold weight
    expect(homeLink).toHaveStyle({ color: '#22d3ee', fontWeight: '600' });
  });

  it('does not highlight inactive routes', () => {
    render(
      <MemoryRouter>
        <DesktopNav {...defaultProps} isActive={() => false} />
      </MemoryRouter>
    );
    const homeLink = screen.getByText('Home');
    expect(homeLink).toHaveStyle({ color: '#9ca3af', fontWeight: '400' });
  });

  it('renders as a nav element', () => {
    const { container } = render(
      <MemoryRouter>
        <DesktopNav {...defaultProps} />
      </MemoryRouter>
    );
    const nav = container.querySelector('nav');
    expect(nav).toBeInTheDocument();
  });
});
