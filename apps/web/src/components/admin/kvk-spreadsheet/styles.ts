import React from 'react';

export const cellStyle: React.CSSProperties = {
  padding: '0.4rem 0.5rem',
  fontSize: '0.82rem',
  borderBottom: '1px solid #1a1a1a',
  verticalAlign: 'middle',
};

export const inputStyle: React.CSSProperties = {
  backgroundColor: '#0a0a0a',
  border: '1px solid #2a2a2a',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '0.82rem',
  padding: '0.3rem 0.45rem',
  width: '100%',
  outline: 'none',
};

export const resultInputStyle: React.CSSProperties = {
  ...inputStyle,
  textAlign: 'center',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  cursor: 'text',
};

export const headerStyle: React.CSSProperties = {
  padding: '0.5rem',
  fontSize: '0.7rem',
  fontWeight: 600,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '2px solid #2a2a2a',
  textAlign: 'left',
};

export const btnSmall: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: '0.7rem',
  fontWeight: 600,
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
};
