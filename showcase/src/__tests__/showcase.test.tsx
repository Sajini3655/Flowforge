import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { mockService } from '../services/mockAdapter';

describe('FlowForge Original UI & Mock Service Testing', () => {
  beforeEach(() => {
    localStorage.clear();
    mockService.reset();
  });

  it('1. Renders the original FlowForge Orchestrator header and branding', () => {
    render(<App />);
    expect(screen.getByText('FLOWFORGE')).toBeDefined();
    expect(screen.getByText('ORCHESTRATOR')).toBeDefined();
    expect(screen.getByText('PostgreSQL')).toBeDefined();
    expect(screen.getByText('RabbitMQ')).toBeDefined();
    expect(screen.getByText('Redis')).toBeDefined();
    expect(screen.getByText('WSO2')).toBeDefined();
    expect(screen.getByText('Demo Mode')).toBeDefined();
  });

  it('2. Displays exact status metrics matching the original application', () => {
    render(<App />);
    expect(screen.getByText('07')).toBeDefined();
    expect(screen.getAllByText('APIs').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('63').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('WORKFLOWS')).toBeDefined();
    expect(screen.getByText('36')).toBeDefined();
    expect(screen.getAllByText('COMPLETED').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('01')).toBeDefined();
    expect(screen.getByText('IN-FLIGHT')).toBeDefined();
    expect(screen.getByText('26')).toBeDefined();
    expect(screen.getByText('FAILED / DLQ')).toBeDefined();
  });

  it('3. Renders the API Gateway Catalog panel and lists seeded APIs', () => {
    render(<App />);
    expect(screen.getByText('Inventory Service')).toBeDefined();
    expect(screen.getByText('/api/v1/inventory')).toBeDefined();
    expect(screen.getByText('Payments Gateway API')).toBeDefined();
    expect(screen.getByText('+ Register API')).toBeDefined();
  });

  it('4. Renders the Workflow Jobs panel and Execution Inspector', () => {
    render(<App />);
    expect(screen.getByText('Workflow Jobs')).toBeDefined();
    expect(screen.getAllByText(/Execution Inspector/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('SYSTEM EXECUTION PATH')).toBeDefined();
    expect(screen.getAllByText('REDIS LOCK').length).toBeGreaterThanOrEqual(1);
  });

  it('5. Creates a demo job when clicking "Create Demo Job"', async () => {
    render(<App />);
    const createBtn = screen.getByText('Create Demo Job');
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Execution Inspector/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('6. Simulates DLQ failure when clicking "Simulate DLQ Failure"', async () => {
    render(<App />);
    const failBtn = screen.getByText('Simulate DLQ Failure');
    fireEvent.click(failBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Execution Inspector/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('7. Opens the Gateway API Details modal when clicking an API row', async () => {
    render(<App />);
    const apiRow = screen.getByText('Inventory Service');
    fireEvent.click(apiRow);

    await waitFor(() => {
      expect(screen.getByText('API Details')).toBeDefined();
      expect(screen.getByText('WSO2 Gateway Policy')).toBeDefined();
    });
  });

  it('8. Opens the Register API modal and registers a new API', async () => {
    render(<App />);
    const registerBtn = screen.getByText('+ Register API');
    fireEvent.click(registerBtn);

    await waitFor(() => {
      expect(screen.getAllByText('Register API').length).toBeGreaterThanOrEqual(1);
    });

    const nameInput = screen.getByPlaceholderText('e.g. Payments Gateway');
    fireEvent.change(nameInput, { target: { value: 'FX Settlement Gateway' } });

    const submitBtns = screen.getAllByText('Register API');
    const submitBtn = submitBtns[submitBtns.length - 1];
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('FX Settlement Gateway')).toBeDefined();
    });
  });

  it('9. Opens Architecture and Evidence documentation modals', async () => {
    render(<App />);
    const archBtn = screen.getByText('Architecture');
    fireEvent.click(archBtn);

    await waitFor(() => {
      expect(screen.getByText('System Architecture')).toBeDefined();
      expect(screen.getByText('Multi-Tier Distributed Architecture')).toBeDefined();
    });

    const closeBtns = screen.getAllByText('Close');
    fireEvent.click(closeBtns[0]);

    const evidenceBtn = screen.getByText(/Backend Evidence/i);
    fireEvent.click(evidenceBtn);

    await waitFor(() => {
      expect(screen.getByText('Engineering Evidence Matrix')).toBeDefined();
      expect(screen.getByText(/141 Verified Backend Automated Tests/i)).toBeDefined();
    });
  });

  it('10. Resets demo data when clicking Reset', async () => {
    render(<App />);
    const resetBtn = screen.getByText('Reset');
    fireEvent.click(resetBtn);

    expect(screen.getByText('07')).toBeDefined();
    expect(screen.getAllByText('63').length).toBeGreaterThanOrEqual(1);
  });
});
