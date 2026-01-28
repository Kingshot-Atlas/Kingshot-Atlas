import { render, screen } from '@testing-library/react';
import App from './App';

test('renders kingshot atlas', () => {
  render(<App />);
  const titleElement = screen.getByText(/kingshot atlas/i);
  expect(titleElement).toBeInTheDocument();
});
