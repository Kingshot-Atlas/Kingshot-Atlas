import { render } from '@testing-library/react';
import SkeletonCard from './SkeletonCard';

describe('SkeletonCard', () => {
  it('renders without crashing', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('has shimmer animation elements', () => {
    const { container } = render(<SkeletonCard />);
    const shimmerElements = container.querySelectorAll('.shimmer');
    expect(shimmerElements.length).toBeGreaterThan(0);
  });

  it('applies correct background color', () => {
    const { container } = render(<SkeletonCard />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveStyle({ backgroundColor: '#151515' });
  });
});
