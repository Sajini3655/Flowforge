import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShowcaseProvider } from '../context/ShowcaseContext';
import { ApiManagementView } from '../components/views/ApiManagementView';
import { WorkflowsView } from '../components/views/WorkflowsView';
import { ObservabilityView } from '../components/views/ObservabilityView';

describe('FlowForge Showcase — UI Interactions & Forms', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. Searches and filters APIs by status in ApiManagementView', async () => {
    render(
      <ShowcaseProvider>
        <ApiManagementView />
      </ShowcaseProvider>
    );

    // Initial render has table rows
    expect(screen.getByText(/API Catalog & Gateway Routing/i)).toBeDefined();

    // Type in search box
    const searchInput = screen.getByPlaceholderText(/Search by API name or base path/i);
    fireEvent.change(searchInput, { target: { value: 'Payment' } });

    // Should find payments
    expect(screen.getByText(/Payments Gateway API/i)).toBeDefined();

    // Filter by DRAFT
    const draftFilterBtn = screen.getByRole('button', { name: 'DRAFT' });
    fireEvent.click(draftFilterBtn);

    // Should show no matches if Payments is PUBLISHED
    expect(screen.getByText(/No APIs match the selected search or filter criteria/i)).toBeDefined();
  });

  it('2. Enforces validation when registering a new API', async () => {
    render(
      <ShowcaseProvider>
        <ApiManagementView />
      </ShowcaseProvider>
    );

    // Open Register Modal
    const registerBtn = screen.getByRole('button', { name: /Register New API/i });
    fireEvent.click(registerBtn);

    expect(screen.getByText(/Register New API Definition/i)).toBeDefined();

    // Submit without name
    const submitBtn = screen.getByRole('button', { name: /Register & Publish/i });
    fireEvent.click(submitBtn);

    // Form prevents empty submission
    const nameInput = screen.getByPlaceholderText(/e.g. Risk Assessment API/i) as HTMLInputElement;
    expect(nameInput.required).toBe(true);

    // Enter name and submit
    fireEvent.change(nameInput, { target: { value: 'Market Depth Feed' } });
    fireEvent.click(submitBtn);

    // Modal closes and new API appears
    await waitFor(() => {
      expect(screen.getByText(/Market Depth Feed/i)).toBeDefined();
    });
  });

  it('3. Opens workflow execution trigger modal and fills defaults', async () => {
    render(
      <ShowcaseProvider>
        <WorkflowsView />
      </ShowcaseProvider>
    );

    expect(screen.getByText(/Workflow Definitions/i)).toBeDefined();

    // Click "Run Workflow" on first available workflow
    const runButtons = screen.getAllByRole('button', { name: /Run Workflow/i });
    expect(runButtons.length).toBeGreaterThan(0);
    fireEvent.click(runButtons[0]);

    // Modal should be visible with Idempotency Key input
    expect(screen.getByText(/Dispatch Workflow:/i)).toBeDefined();
    expect(screen.getByText(/Idempotency-Key Header/i)).toBeDefined();
  });

  it('4. Renders Prometheus Scrape endpoint preview and custom metrics in ObservabilityView', () => {
    render(
      <ShowcaseProvider>
        <ObservabilityView />
      </ShowcaseProvider>
    );

    expect(screen.getByText(/Observability & Telemetry Center/i)).toBeDefined();
    expect(screen.getByText(/jobs_submitted_total/i)).toBeDefined();
    expect(screen.getByText(/Inspect \/actuator\/prometheus/i)).toBeDefined();
  });
});
