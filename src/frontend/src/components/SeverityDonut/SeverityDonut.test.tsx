import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeverityDonut } from './SeverityDonut';

describe('SeverityDonut', () => {
  it('renders the total count in the center', () => {
    render(<SeverityDonut critical={5} high={3} medium={2} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('total')).toBeInTheDocument();
  });

  it('renders the legend with all severity labels', () => {
    render(<SeverityDonut critical={5} high={3} medium={2} />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('renders correct counts in legend', () => {
    render(<SeverityDonut critical={5} high={3} medium={2} />);
    const counts = screen.getAllByText(/^[532]$/);
    expect(counts.length).toBeGreaterThanOrEqual(3);
  });

  it('shows empty state when no anomalies', () => {
    render(<SeverityDonut critical={0} high={0} medium={0} />);
    expect(screen.getByText(/No anomalies to display/i)).toBeInTheDocument();
  });

  it('renders SVG donut chart', () => {
    const { container } = render(<SeverityDonut critical={5} high={3} medium={2} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});