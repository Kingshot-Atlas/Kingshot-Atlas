import React, { useState } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { colors } from '../utils/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import {
  Button,
  Chip,
  TierChip,
  ProChip,
  RecruiterChip,
  VerifiedChip,
  Input,
  TextArea,
  Select,
  Toggle,
  Checkbox,
  Card,
} from '../components/shared';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: '3rem' }}>
    <h2 style={{ 
      fontSize: '1.25rem', 
      fontWeight: 700, 
      color: colors.primary, 
      marginBottom: '1.5rem',
      paddingBottom: '0.5rem',
      borderBottom: `1px solid ${colors.border}`
    }}>
      {title}
    </h2>
    {children}
  </div>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: '1.5rem' }}>
    <div style={{ fontSize: '0.8rem', color: colors.textMuted, marginBottom: '0.75rem', fontWeight: 600 }}>
      {label}
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
      {children}
    </div>
  </div>
);

const CodeBlock: React.FC<{ code: string }> = ({ code }) => (
  <pre style={{
    backgroundColor: colors.surface,
    padding: '1rem',
    borderRadius: '8px',
    fontSize: '0.75rem',
    overflow: 'auto',
    border: `1px solid ${colors.border}`,
    color: colors.textSecondary,
    marginTop: '0.75rem',
  }}>
    <code>{code}</code>
  </pre>
);

const ComponentsDemo: React.FC = () => {
  useDocumentTitle('Component Library');
  const isMobile = useIsMobile();
  
  // Form state
  const [inputValue, setInputValue] = useState('');
  const [textAreaValue, setTextAreaValue] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [toggleValue, setToggleValue] = useState(false);
  const [checkboxValue, setCheckboxValue] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadingDemo = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <div style={{
      maxWidth: '900px',
      margin: '0 auto',
      padding: isMobile ? '1rem' : '2rem',
      paddingTop: '80px',
    }}>
      <h1 style={{ 
        fontSize: isMobile ? '1.5rem' : '2rem', 
        fontWeight: 800, 
        marginBottom: '0.5rem',
        fontFamily: "'Cinzel', serif"
      }}>
        Component Library
      </h1>
      <p style={{ color: colors.textSecondary, marginBottom: '2rem' }}>
        Shared UI components for consistent design across Kingshot Atlas.
      </p>

      {/* BUTTONS */}
      <Section title="Buttons">
        <Row label="Variants">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="success">Success</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="ghost">Ghost</Button>
        </Row>

        <Row label="Sizes">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Row>

        <Row label="With Icons">
          <Button icon={<span>🔍</span>}>Search</Button>
          <Button variant="secondary" icon={<span>📤</span>}>Share</Button>
          <Button variant="danger" icon={<span>🗑️</span>}>Delete</Button>
        </Row>

        <Row label="States">
          <Button disabled>Disabled</Button>
          <Button loading={isLoading} onClick={handleLoadingDemo}>
            {isLoading ? 'Loading...' : 'Click for Loading'}
          </Button>
          <Button fullWidth variant="secondary" style={{ maxWidth: '300px' }}>Full Width</Button>
        </Row>

        <CodeBlock code={`import { Button } from '../components/shared';

<Button variant="primary" size="md" icon={<Icon />} loading={false}>
  Click Me
</Button>`} />
      </Section>

      {/* CHIPS */}
      <Section title="Chips & Badges">
        <Row label="Variants">
          <Chip variant="primary">Primary</Chip>
          <Chip variant="success">Success</Chip>
          <Chip variant="warning">Warning</Chip>
          <Chip variant="error">Error</Chip>
          <Chip variant="neutral">Neutral</Chip>
          <Chip variant="purple">Purple</Chip>
          <Chip variant="gold">Gold</Chip>
        </Row>

        <Row label="Pre-built Chips">
          <TierChip tier="S" />
          <TierChip tier="A" />
          <TierChip tier="B" />
          <TierChip tier="C" />
          <TierChip tier="D" />
        </Row>

        <Row label="Role Chips">
          <ProChip />
          <RecruiterChip />
          <VerifiedChip />
        </Row>

        <Row label="Sizes">
          <Chip size="sm" variant="primary">Small</Chip>
          <Chip size="md" variant="primary">Medium</Chip>
        </Row>

        <Row label="With Icons">
          <Chip icon={<span>⚡</span>} variant="warning">Fast</Chip>
          <Chip icon={<span>🔒</span>} variant="error">Locked</Chip>
        </Row>

        <CodeBlock code={`import { Chip, TierChip, ProChip } from '../components/shared';

<Chip variant="success" size="md" icon={<Icon />}>
  Verified
</Chip>

<TierChip tier="S" />
<ProChip />`} />
      </Section>

      {/* INPUTS */}
      <Section title="Form Inputs">
        <Row label="Text Input">
          <div style={{ width: '100%', maxWidth: '400px' }}>
            <Input
              label="Username"
              placeholder="Enter your username"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              hint="Your display name in the app"
            />
          </div>
        </Row>

        <Row label="Input Sizes">
          <Input size="sm" placeholder="Small" style={{ maxWidth: '150px' }} />
          <Input size="md" placeholder="Medium" style={{ maxWidth: '150px' }} />
          <Input size="lg" placeholder="Large" style={{ maxWidth: '150px' }} />
        </Row>

        <Row label="Input States">
          <Input placeholder="With error" error="This field is required" style={{ maxWidth: '200px' }} />
          <Input placeholder="Disabled" disabled style={{ maxWidth: '200px' }} />
        </Row>

        <Row label="Input with Icons">
          <Input 
            placeholder="Search kingdoms..." 
            leftIcon={<span>🔍</span>}
            style={{ maxWidth: '250px' }}
          />
        </Row>

        <CodeBlock code={`import { Input } from '../components/shared';

<Input
  label="Email"
  placeholder="you@example.com"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  error="Invalid email"
  leftIcon={<MailIcon />}
/>`} />
      </Section>

      {/* TEXT AREA */}
      <Section title="Text Area">
        <Row label="Basic">
          <div style={{ width: '100%', maxWidth: '500px' }}>
            <TextArea
              label="Bio"
              placeholder="Tell us about yourself..."
              value={textAreaValue}
              onChange={(e) => setTextAreaValue(e.target.value)}
              showCharCount
              maxLength={200}
              hint="Displayed on your public profile"
            />
          </div>
        </Row>

        <CodeBlock code={`import { TextArea } from '../components/shared';

<TextArea
  label="Bio"
  value={bio}
  onChange={(e) => setBio(e.target.value)}
  showCharCount
  maxLength={200}
/>`} />
      </Section>

      {/* SELECT */}
      <Section title="Select Dropdown">
        <Row label="Basic">
          <div style={{ width: '100%', maxWidth: '300px' }}>
            <Select
              label="Kingdom"
              placeholder="Select a kingdom"
              value={selectValue}
              onChange={(e) => setSelectValue(e.target.value)}
              options={[
                { value: '172', label: 'Kingdom 172' },
                { value: '145', label: 'Kingdom 145' },
                { value: '386', label: 'Kingdom 386' },
                { value: '391', label: 'Kingdom 391' },
              ]}
            />
          </div>
        </Row>

        <Row label="Sizes">
          <Select size="sm" options={[{ value: '1', label: 'Small' }]} style={{ maxWidth: '120px' }} />
          <Select size="md" options={[{ value: '1', label: 'Medium' }]} style={{ maxWidth: '130px' }} />
          <Select size="lg" options={[{ value: '1', label: 'Large' }]} style={{ maxWidth: '140px' }} />
        </Row>

        <CodeBlock code={`import { Select } from '../components/shared';

<Select
  label="Region"
  placeholder="Select region"
  value={region}
  onChange={(e) => setRegion(e.target.value)}
  options={[
    { value: 'na', label: 'North America' },
    { value: 'eu', label: 'Europe' },
  ]}
/>`} />
      </Section>

      {/* TOGGLE & CHECKBOX */}
      <Section title="Toggle & Checkbox">
        <Row label="Toggle">
          <Toggle
            checked={toggleValue}
            onChange={setToggleValue}
            label="Enable notifications"
            description="Receive alerts for KvK events"
          />
        </Row>

        <Row label="Toggle Sizes">
          <Toggle checked={true} onChange={() => {}} size="sm" label="Small" />
          <Toggle checked={true} onChange={() => {}} size="md" label="Medium" />
        </Row>

        <Row label="Checkbox">
          <Checkbox
            checked={checkboxValue}
            onChange={setCheckboxValue}
            label="I agree to the terms"
            description="You must accept to continue"
          />
        </Row>

        <Row label="Checkbox States">
          <Checkbox checked={false} onChange={() => {}} label="Unchecked" />
          <Checkbox checked={true} onChange={() => {}} label="Checked" />
          <Checkbox checked={false} onChange={() => {}} indeterminate label="Indeterminate" />
        </Row>

        <CodeBlock code={`import { Toggle, Checkbox } from '../components/shared';

<Toggle
  checked={enabled}
  onChange={setEnabled}
  label="Dark mode"
/>

<Checkbox
  checked={agreed}
  onChange={setAgreed}
  label="I agree"
/>`} />
      </Section>

      {/* CARD */}
      <Section title="Card">
        <Row label="Basic Card">
          <Card style={{ maxWidth: '300px' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Card Title</h3>
            <p style={{ margin: 0, color: colors.textSecondary, fontSize: '0.85rem' }}>
              This is a basic card with some content inside.
            </p>
          </Card>
        </Row>

        <Row label="Hoverable Card">
          <Card hoverable style={{ maxWidth: '300px' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Hoverable</h3>
            <p style={{ margin: 0, color: colors.textSecondary, fontSize: '0.85rem' }}>
              Hover over me to see the effect.
            </p>
          </Card>
        </Row>

        <CodeBlock code={`import { Card } from '../components/shared';

<Card hoverable accentColor="#22c55e" padding="lg">
  Content here
</Card>`} />
      </Section>

      {/* IMPORT REFERENCE */}
      <Section title="Import Reference">
        <CodeBlock code={`// All components
import {
  Button,
  Chip, TierChip, ProChip, RecruiterChip, VerifiedChip,
  Input,
  TextArea,
  Select,
  Toggle, Checkbox,
  Card,
  Tooltip,
} from '../components/shared';

// Utilities
import { 
  colors, 
  buttonStyles, 
  chipStyles,
  getButtonStyles,
  getChipStyles,
  neonGlow,
} from '../utils/styles';`} />
      </Section>
    </div>
  );
};

export default ComponentsDemo;
