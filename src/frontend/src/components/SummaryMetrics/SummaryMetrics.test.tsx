import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SummaryMetrics } from './SummaryMetrics';

describe('SummaryMetrics', () => {
  it('renders all 4 metric cards', () => {
    render(<SummaryMetrics total={10} critical={3} pending={5} resolved={5} />);
    expect(screen.getByText('Total anomalies')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Pending review')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('renders correct values', () => {
    render(<SummaryMetrics total={10} critical={3} pending={5} resolved={5} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    const fives = screen.getAllByText('5');
    expect(fives.length).toBe(2);
  });

  it('renders zero values', () => {
    render(<SummaryMetrics total={0} critical={0} pending={0} resolved={0} />);
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBe(4);
  });
});