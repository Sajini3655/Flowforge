import React, { useState } from 'react';
import { 
  GitBranch, 
  Play, 
  Clock, 
  Settings, 
  Search, 
  Zap, 
  CheckCircle2 
} from 'lucide-react';
import { useShowcase } from '../../context/ShowcaseContext';
import { WorkflowDefinition } from '../../types';
import { Badge } from '../common/Badge';
import { Modal } from '../layout/Modal';

export const WorkflowsView: React.FC = () => {
  const { workflows, submitJob, setActiveView, selectJob } = useShowcase();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Trigger modal state
  const [triggerWorkflow, setTriggerWorkflow] = useState<WorkflowDefinition | null>(null);
  const [customPayload, setCustomPayload] = useState('');
  const [customIdempotencyKey, setCustomIdempotencyKey] = useState('');
  const [triggerFeedback, setTriggerFeedback] = useState<string | null>(null);

  const filteredWorkflows = workflows.filter(w => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openTriggerModal = (wf: WorkflowDefinition) => {
    setTriggerWorkflow(wf);
    setCustomPayload(wf.defaultPayload);
    setCustomIdempotencyKey(`idemp-${wf.code.toLowerCase()}-${Date.now().toString().slice(-4)}`);
    setTriggerFeedback(null);
  };

  const handleExecute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerWorkflow) return;

    const result = submitJob({
      type: triggerWorkflow.code,
      payload: customPayload,
      idempotencyKey: customIdempotencyKey.trim() || undefined,
      workflowId: triggerWorkflow.id
    });

    if (result.success && result.job) {
      setTriggerFeedback(`Dispatched Job ${result.job.id.substring(0, 8)} to Outbox & RabbitMQ`);
      setTimeout(() => {
        setTriggerWorkflow(null);
        selectJob(result.job!.id);
        setActiveView('jobs');
      }, 1000);
    } else {
      setTriggerFeedback(result.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-slate-700" />
            <span>Workflow Definitions</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configured distributed workflow handlers dispatched via transactional outbox to RabbitMQ worker consumers.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-mono">
          <Zap className="w-3.5 h-3.5 text-slate-500" />
          <span>Active Orchestrations: {workflows.filter(w => w.status === 'ACTIVE').length}</span>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-sm flex items-center gap-2.5">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Filter workflows by code, name, or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-xs bg-transparent focus:outline-none text-slate-800 placeholder-slate-400"
        />
      </div>

      {/* Workflows Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredWorkflows.map((wf) => (
          <div 
            key={wf.id}
            className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                      {wf.code}
                    </span>
                    <Badge status={wf.status} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-2">{wf.name}</h3>
                </div>

                <button
                  onClick={() => openTriggerModal(wf)}
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Run Workflow</span>
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {wf.description}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span className="flex items-center gap-1">
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                Trigger: <strong className="text-slate-700">{wf.triggerType}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Executions: <strong className="text-slate-700">{wf.totalExecutions}</strong>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Trigger Workflow Execution Modal */}
      {triggerWorkflow && (
        <Modal
          isOpen={true}
          onClose={() => setTriggerWorkflow(null)}
          title={`Dispatch Workflow: ${triggerWorkflow.name}`}
          subtitle={`Type: ${triggerWorkflow.code} • Dispatched via Transactional Outbox`}
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleExecute} className="space-y-4">
            {triggerFeedback && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{triggerFeedback}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
                <span>Idempotency-Key Header (Optional)</span>
                <span className="text-[11px] text-slate-400 font-mono">Guarantees execution deduplication</span>
              </label>
              <input
                type="text"
                value={customIdempotencyKey}
                onChange={(e) => setCustomIdempotencyKey(e.target.value)}
                placeholder="e.g. idemp-payment-001"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs font-mono text-slate-800 focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Request Payload (JSON)</label>
              <textarea
                rows={5}
                required
                value={customPayload}
                onChange={(e) => setCustomPayload(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-md font-mono text-xs text-slate-800 focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTriggerWorkflow(null)}
                className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Dispatch Workflow
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
