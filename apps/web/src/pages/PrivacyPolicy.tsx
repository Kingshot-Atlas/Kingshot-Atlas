import React from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useIsMobile } from '../hooks/useMediaQuery';
import { colors, FONT_DISPLAY } from '../utils/styles';
import { useTranslation } from 'react-i18next';

const PrivacyPolicy: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('privacy.pageTitle', 'Privacy Policy'));
  const isMobile = useIsMobile();

  const sectionStyle: React.CSSProperties = {
    marginBottom: '1.5rem',
  };
  const headingStyle: React.CSSProperties = {
    color: '#e5e7eb',
    fontSize: '1rem',
    fontWeight: '700',
    marginBottom: '0.5rem',
  };
  const paraStyle: React.CSSProperties = {
    color: '#9ca3af',
    fontSize: '0.85rem',
    lineHeight: 1.7,
    margin: '0 0 0.5rem',
  };
  const listItemStyle: React.CSSProperties = {
    marginBottom: '0.3rem',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '1.5rem 1rem 1rem' : '2rem 2rem 1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #0f1520 0%, #0a0a0a 100%)',
      }}>
        <h1 style={{
          fontSize: isMobile ? '1.4rem' : '1.8rem',
          fontWeight: 'bold',
          fontFamily: FONT_DISPLAY,
          letterSpacing: '0.04em',
          color: '#e5e7eb',
          marginBottom: '0.25rem',
        }}>
          Privacy Policy
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>
          Last updated: February 18, 2026
        </p>
      </div>

      <div style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: isMobile ? '1.25rem 1rem 2rem' : '1.5rem 2rem 2rem',
      }}>
        {/* 1. Introduction */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>1. Introduction</h2>
          <p style={paraStyle}>
            Kingshot Atlas ("Atlas", "we", "us", "our") operates the website at{' '}
            <a href="https://ks-atlas.com" style={{ color: '#22d3ee', textDecoration: 'none' }}>ks-atlas.com</a>
            {' '}and the Atlas Discord Bot. This Privacy Policy explains what information we collect, how we use it, and your rights regarding your data.
          </p>
          <p style={paraStyle}>
            By using Atlas — whether through the website, Discord bot, or any associated services — you agree to the collection and use of information as described in this policy. If you do not agree, please discontinue use.
          </p>
        </div>

        {/* 2. Information We Collect */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>2. Information We Collect</h2>

          <p style={{ ...paraStyle, color: '#d1d5db', fontWeight: '600', marginTop: '0.75rem' }}>
            2.1 Website Authentication
          </p>
          <p style={paraStyle}>
            When you sign in via Google or Discord OAuth, we receive:
          </p>
          <ul style={{ ...paraStyle, paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
            <li style={listItemStyle}>Display name and avatar</li>
            <li style={listItemStyle}>Email address</li>
            <li style={listItemStyle}>OAuth provider user ID</li>
          </ul>

          <p style={{ ...paraStyle, color: '#d1d5db', fontWeight: '600', marginTop: '0.75rem' }}>
            2.2 Atlas Discord Bot
          </p>
          <p style={paraStyle}>
            When you interact with the Atlas Bot in Discord, we may collect:
          </p>
          <ul style={{ ...paraStyle, paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Discord User ID</strong> — to identify your account and link it to your Atlas profile</li>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Discord Server (Guild) ID</strong> — to provide server-specific features and configuration</li>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Command inputs</strong> — the commands and arguments you provide to the bot (e.g., kingdom lookups, KvK queries)</li>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Linked Kingshot Player ID</strong> — if you choose to link your in-game identity</li>
          </ul>
          <p style={paraStyle}>
            The Atlas Bot does <strong style={{ color: '#e5e7eb' }}>not</strong> read or store message content outside of explicit bot commands. We do not monitor conversations, DMs, or any messages that are not direct interactions with the bot.
          </p>

          <p style={{ ...paraStyle, color: '#d1d5db', fontWeight: '600', marginTop: '0.75rem' }}>
            2.3 User-Submitted Content
          </p>
          <p style={paraStyle}>
            You may submit KvK results, screenshots, kingdom data corrections, transfer profiles, and other community contributions. This content is stored to maintain and improve the Atlas database.
          </p>

          <p style={{ ...paraStyle, color: '#d1d5db', fontWeight: '600', marginTop: '0.75rem' }}>
            2.4 Analytics
          </p>
          <p style={paraStyle}>
            We use <a href="https://plausible.io" target="_blank" rel="noopener noreferrer" style={{ color: '#22d3ee', textDecoration: 'none' }}>Plausible Analytics</a>, a privacy-focused, cookie-free analytics tool. It collects no personal data and does not track individual users. All analytics data is aggregated and anonymous.
          </p>

          <p style={{ ...paraStyle, color: '#d1d5db', fontWeight: '600', marginTop: '0.75rem' }}>
            2.5 Payment Information
          </p>
          <p style={paraStyle}>
            Payments for Atlas Supporter subscriptions and Kingdom Fund contributions are processed by <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#22d3ee', textDecoration: 'none' }}>Stripe</a>. We do not store credit card numbers or full payment details on our servers. Stripe handles all payment data in compliance with PCI-DSS standards.
          </p>
        </div>

        {/* 3. How We Use Your Information */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>3. How We Use Your Information</h2>
          <p style={paraStyle}>We use collected information to:</p>
          <ul style={{ ...paraStyle, paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
            <li style={listItemStyle}>Provide, maintain, and improve Atlas features</li>
            <li style={listItemStyle}>Authenticate your identity and manage your account</li>
            <li style={listItemStyle}>Link your Discord identity to your Atlas profile (when you opt in)</li>
            <li style={listItemStyle}>Deliver bot responses and server-specific features in Discord</li>
            <li style={listItemStyle}>Process subscription payments and manage billing</li>
            <li style={listItemStyle}>Display community-sourced kingdom data and analytics</li>
            <li style={listItemStyle}>Communicate service updates, if applicable</li>
          </ul>
        </div>

        {/* 4. Data Storage & Security */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>4. Data Storage & Security</h2>
          <p style={paraStyle}>
            Your data is stored in <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" style={{ color: '#22d3ee', textDecoration: 'none' }}>Supabase</a> with row-level security (RLS) policies to ensure users can only access data they're authorized to see. Our infrastructure is hosted on Cloudflare (frontend), Render (API), and Cloudflare Workers (Discord bot proxy).
          </p>
          <p style={paraStyle}>
            We take reasonable measures to protect your data, including encrypted connections (HTTPS/TLS), secure authentication tokens, and access controls. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.
          </p>
        </div>

        {/* 5. Data Sharing */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>5. Data Sharing</h2>
          <p style={paraStyle}>
            <strong style={{ color: '#e5e7eb' }}>We do not sell your personal data.</strong> We only share data with third parties as necessary to operate Atlas:
          </p>
          <ul style={{ ...paraStyle, paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Supabase</strong> — Database hosting and authentication</li>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Stripe</strong> — Payment processing</li>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Google / Discord</strong> — OAuth authentication providers</li>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Plausible</strong> — Anonymous, cookie-free analytics</li>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Cloudflare / Render</strong> — Infrastructure hosting</li>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Sentry</strong> — Error tracking (anonymous crash reports)</li>
          </ul>
          <p style={paraStyle}>
            We may disclose information if required by law or to protect the rights and safety of Atlas and its users.
          </p>
        </div>

        {/* 6. Discord Bot Permissions */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>6. Discord Bot Permissions</h2>
          <p style={paraStyle}>
            The Atlas Bot requests only the permissions necessary to function:
          </p>
          <ul style={{ ...paraStyle, paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Send Messages / Embed Links</strong> — To respond to commands with formatted data</li>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Use Slash Commands</strong> — To register and respond to bot commands</li>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Manage Roles</strong> — To assign verification roles (e.g., Settler role for linked players)</li>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Read Message History</strong> — Only where required for command context</li>
          </ul>
          <p style={paraStyle}>
            The bot does not request or use permissions to read all messages, manage channels, ban users, or access any data beyond what is needed for its stated features.
          </p>
        </div>

        {/* 7. Data Retention */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>7. Data Retention</h2>
          <p style={paraStyle}>
            We retain your data for as long as your account is active or as needed to provide our services. If you delete your account or request data removal, we will delete your personal data within 30 days, except where retention is required by law or for legitimate business purposes (e.g., anonymized analytics or community-submitted kingdom data).
          </p>
          <p style={paraStyle}>
            Community-submitted data (KvK results, kingdom statistics) may be retained in anonymized form even after account deletion, as this data serves the broader community.
          </p>
        </div>

        {/* 8. Your Rights */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>8. Your Rights</h2>
          <p style={paraStyle}>You have the right to:</p>
          <ul style={{ ...paraStyle, paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Access</strong> — Request a copy of the personal data we hold about you</li>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Correction</strong> — Request correction of inaccurate data</li>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Deletion</strong> — Request deletion of your account and personal data</li>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Portability</strong> — Request your data in a portable format</li>
            <li style={listItemStyle}><strong style={{ color: '#d1d5db' }}>Opt-out</strong> — Unlink your Discord or Player ID at any time from your profile settings</li>
          </ul>
          <p style={paraStyle}>
            To exercise any of these rights, contact us via our{' '}
            <a href="https://discord.gg/cajcacDzGd" target="_blank" rel="noopener noreferrer" style={{ color: '#22d3ee', textDecoration: 'none' }}>Discord community</a>
            {' '}or email us at{' '}
            <a href="mailto:support@ks-atlas.com" style={{ color: '#22d3ee', textDecoration: 'none' }}>support@ks-atlas.com</a>.
          </p>
        </div>

        {/* 9. Children's Privacy */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>9. Children's Privacy</h2>
          <p style={paraStyle}>
            Atlas is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal data, please contact us and we will promptly delete it.
          </p>
        </div>

        {/* 10. Cookies */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>10. Cookies & Local Storage</h2>
          <p style={paraStyle}>
            Atlas uses <strong style={{ color: '#e5e7eb' }}>no tracking cookies</strong>. We use browser local storage solely for authentication tokens, user preferences (theme, language), and session management. Our analytics provider (Plausible) is fully cookie-free.
          </p>
        </div>

        {/* 11. International Users */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>11. International Users</h2>
          <p style={paraStyle}>
            Atlas is operated from the United States. If you access Atlas from outside the US, your data may be transferred to and processed in the US. By using Atlas, you consent to this transfer. We aim to handle data in compliance with applicable privacy regulations, including GDPR for EU users.
          </p>
        </div>

        {/* 12. Changes to This Policy */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>12. Changes to This Policy</h2>
          <p style={paraStyle}>
            We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last updated" date. Continued use of Atlas after changes constitutes acceptance of the revised policy. For significant changes, we will make reasonable efforts to notify users.
          </p>
        </div>

        {/* 13. Contact */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>13. Contact</h2>
          <p style={paraStyle}>
            If you have questions or concerns about this Privacy Policy, please reach out via our{' '}
            <a href="https://discord.gg/cajcacDzGd" target="_blank" rel="noopener noreferrer" style={{ color: '#22d3ee', textDecoration: 'none' }}>Discord community</a>
            {' '}or email us at{' '}
            <a href="mailto:support@ks-atlas.com" style={{ color: '#22d3ee', textDecoration: 'none' }}>support@ks-atlas.com</a>.
          </p>
        </div>

        {/* Back links */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '1.5rem',
          marginTop: '2rem', paddingTop: '1rem',
          borderTop: '1px solid #1a1a1a',
        }}>
          <Link to="/terms" style={{ color: colors.textSecondary, textDecoration: 'none', fontSize: '0.8rem' }}>
            Terms of Service
          </Link>
          <Link to="/about" style={{ color: colors.textSecondary, textDecoration: 'none', fontSize: '0.8rem' }}>
            About Atlas
          </Link>
          <Link to="/" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
