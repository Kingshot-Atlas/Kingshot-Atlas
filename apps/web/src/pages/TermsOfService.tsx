import React from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useIsMobile } from '../hooks/useMediaQuery';
import { colors, FONT_DISPLAY } from '../utils/styles';
import { useTranslation } from 'react-i18next';

const TermsOfService: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('tos.pageTitle', 'Terms of Service'));
  useMetaTags(PAGE_META_TAGS.terms);
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
          Terms of Service
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      <div style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: isMobile ? '1.25rem 1rem 2rem' : '1.5rem 2rem 2rem',
      }}>
        {/* 1. Acceptance */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>1. Acceptance of Terms</h2>
          <p style={paraStyle}>
            By accessing or using Kingshot Atlas (&quot;Atlas&quot;, &quot;we&quot;, &quot;us&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the service. We may update these terms at any time; continued use after changes constitutes acceptance.
          </p>
        </div>

        {/* 2. What Atlas Is */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>2. About Kingshot Atlas</h2>
          <p style={paraStyle}>
            Kingshot Atlas is an independent, community-built analytics platform for the mobile game Kingshot™. We are <strong style={{ color: '#e5e7eb' }}>not affiliated with, endorsed, sponsored, or approved by Century Games</strong> or any of its subsidiaries. Kingshot™ is a trademark of Century Games. All game content, names, and materials referenced on this site are trademarks and copyrights of their respective owners.
          </p>
          <p style={paraStyle}>
            Atlas provides kingdom rankings, KvK analytics, transfer tools, and community features. All data is community-sourced — we do not scrape or access game servers.
          </p>
        </div>

        {/* 3. User Accounts */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>3. User Accounts</h2>
          <p style={paraStyle}>
            You may sign in using a third-party OAuth provider (Google or Discord). By signing in, you authorize us to access basic profile information (display name, email, avatar) from that provider. You are responsible for maintaining the security of your account.
          </p>
          <p style={paraStyle}>
            You may link your Kingshot Player ID to your Atlas profile. This is voluntary and used solely to display your in-game identity within Atlas features.
          </p>
          <p style={paraStyle}>
            The Atlas Discord Bot may collect your Discord User ID and server information to provide bot features. See our{' '}
            <Link to="/privacy" style={{ color: '#22d3ee', textDecoration: 'none' }}>Privacy Policy</Link>
            {' '}for full details on data collected by the bot.
          </p>
        </div>

        {/* 4. User-Submitted Content */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>4. User-Submitted Content</h2>
          <p style={paraStyle}>
            You may submit content including KvK results, screenshots, kingdom data corrections, and other community contributions. By submitting content, you:
          </p>
          <ul style={{ ...paraStyle, paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
            <li style={{ marginBottom: '0.3rem' }}>Confirm that screenshots are your own in-game captures</li>
            <li style={{ marginBottom: '0.3rem' }}>Acknowledge that all game content depicted remains the property of Century Games</li>
            <li style={{ marginBottom: '0.3rem' }}>Grant Kingshot Atlas a non-exclusive, royalty-free license to store, display, and use your submissions for community data and analytics purposes</li>
            <li style={{ marginBottom: '0.3rem' }}>Agree not to submit false, misleading, or malicious content</li>
          </ul>
          <p style={paraStyle}>
            We reserve the right to remove any user-submitted content at our discretion.
          </p>
        </div>

        {/* 5. Intellectual Property */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>5. Intellectual Property</h2>
          <p style={paraStyle}>
            The Atlas platform itself — including its design, code, analytics algorithms, and original content — is the intellectual property of the Kingshot Atlas project. All game-related content, names, logos, and imagery belong to their respective copyright holders (Century Games and others).
          </p>
          <p style={paraStyle}>
            You may not reproduce, distribute, or create derivative works from Atlas&apos;s proprietary content without permission. Game content is used under fair use for community analytics purposes.
          </p>
        </div>

        {/* 6. Prohibited Conduct */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>6. Prohibited Conduct</h2>
          <p style={paraStyle}>You agree not to:</p>
          <ul style={{ ...paraStyle, paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
            <li style={{ marginBottom: '0.3rem' }}>Use Atlas for any unlawful purpose or in violation of any game&apos;s terms of service</li>
            <li style={{ marginBottom: '0.3rem' }}>Attempt to gain unauthorized access to Atlas systems or other users&apos; accounts</li>
            <li style={{ marginBottom: '0.3rem' }}>Scrape, crawl, or automatically extract data from Atlas beyond normal use</li>
            <li style={{ marginBottom: '0.3rem' }}>Submit false data, spam, or content intended to manipulate rankings</li>
            <li style={{ marginBottom: '0.3rem' }}>Impersonate other players or kingdoms</li>
            <li style={{ marginBottom: '0.3rem' }}>Use Atlas to harass, abuse, or target other players</li>
          </ul>
        </div>

        {/* 7. Subscriptions & Payments */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>7. Subscriptions & Payments</h2>
          <p style={paraStyle}>
            Atlas offers optional paid subscriptions (&quot;Atlas Supporter&quot;) processed through Stripe. Subscriptions auto-renew unless canceled. You may cancel at any time from your profile or via the Stripe customer portal. Refunds are handled on a case-by-case basis.
          </p>
          <p style={paraStyle}>
            We reserve the right to change subscription pricing with reasonable notice. Existing subscribers will be notified before any price changes take effect.
          </p>
        </div>

        {/* 8. Data & Privacy */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>8. Data & Privacy</h2>
          <p style={paraStyle}>
            We collect and store the minimum data necessary to provide our services:
          </p>
          <ul style={{ ...paraStyle, paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
            <li style={{ marginBottom: '0.3rem' }}><strong style={{ color: '#d1d5db' }}>Authentication data:</strong> Email, display name, and avatar from OAuth providers</li>
            <li style={{ marginBottom: '0.3rem' }}><strong style={{ color: '#d1d5db' }}>Profile data:</strong> Linked Player ID, kingdom affiliation, preferences</li>
            <li style={{ marginBottom: '0.3rem' }}><strong style={{ color: '#d1d5db' }}>Usage data:</strong> Anonymous analytics (via Plausible) for feature improvement</li>
            <li style={{ marginBottom: '0.3rem' }}><strong style={{ color: '#d1d5db' }}>Submissions:</strong> KvK results, screenshots, and community contributions</li>
          </ul>
          <p style={paraStyle}>
            We do not sell your personal data. We use Supabase for data storage with row-level security. You may request deletion of your account and associated data by contacting us. For full details, see our{' '}
            <Link to="/privacy" style={{ color: '#22d3ee', textDecoration: 'none' }}>Privacy Policy</Link>.
          </p>
        </div>

        {/* 9. Third-Party Services */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>9. Third-Party Services</h2>
          <p style={paraStyle}>
            Atlas integrates with third-party services including Supabase (database), Stripe (payments), Google and Discord (authentication), Plausible (analytics), and Render (hosting). Your use of these services is subject to their respective terms and privacy policies.
          </p>
        </div>

        {/* 10. Disclaimers */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>10. Disclaimers</h2>
          <p style={paraStyle}>
            Atlas is provided &quot;as is&quot; without warranty of any kind. We do not guarantee the accuracy, completeness, or timeliness of any data displayed. Kingdom rankings, scores, and analytics are based on community-submitted data and may contain errors.
          </p>
          <p style={paraStyle}>
            We are not responsible for any actions taken by Century Games or any game developer in response to your use of Atlas. Use of Atlas is at your own risk.
          </p>
        </div>

        {/* 11. Limitation of Liability */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>11. Limitation of Liability</h2>
          <p style={paraStyle}>
            To the maximum extent permitted by law, Kingshot Atlas and its contributors shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service.
          </p>
        </div>

        {/* 12. Termination */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>12. Termination</h2>
          <p style={paraStyle}>
            We may suspend or terminate your access to Atlas at any time for violation of these terms or for any reason at our discretion. Upon termination, your right to use the service ceases immediately.
          </p>
        </div>

        {/* 13. Contact */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>13. Contact</h2>
          <p style={paraStyle}>
            For questions about these terms, please reach out via our{' '}
            <a href="https://discord.gg/cajcacDzGd" target="_blank" rel="noopener noreferrer" style={{ color: '#22d3ee', textDecoration: 'none' }}>Discord community</a>
            {' '}or the feedback widget on the site.
          </p>
        </div>

        {/* Back links */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '1.5rem',
          marginTop: '2rem', paddingTop: '1rem',
          borderTop: '1px solid #1a1a1a',
        }}>
          <Link to="/privacy" style={{ color: colors.textSecondary, textDecoration: 'none', fontSize: '0.8rem' }}>
            Privacy Policy
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

export default TermsOfService;
