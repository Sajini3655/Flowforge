import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  ShieldCheck, 
  Trash2, 
  AlertCircle, 
  Layers,
  Terminal,
  Check
} from 'lucide-react';
import { useShowcase } from '../../context/ShowcaseContext';
import { ApiDefinition, ApiLifecycleStatus } from '../../types';
import { Badge } from '../common/Badge';
import { Modal } from '../layout/Modal';

export const ApiManagementView: React.FC = () => {
  const { apis, registerApi, updateApiStatus, deleteApi, selectApi, selectedApiId } = useShowcase();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [apiToDelete, setApiToDelete] = useState<ApiDefinition | null>(null);
  const [testInvocationResult, setTestInvocationResult] = useState<{ apiId: string; response: string } | null>(null);

  // New API Form state
  const [newName, setNewName] = useState('');
  const [newVersion, setNewVersion] = useState('v1');
  const [newBasePath, setNewBasePath] = useState('/api/v1/');
  const [newBackendUrl, setNewBackendUrl] = useState('http://backend:8080/api');
  const [newDescription, setNewDescription] = useState('');
  const [newStatus, setNewStatus] = useState<ApiLifecycleStatus>('PUBLISHED');
  const [formError, setFormError] = useState('');

  const selectedApi = apis.find(a => a.id === selectedApiId) || null;

  const filteredApis = apis.filter(api => {
    const matchesSearch = api.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          api.basePath.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          api.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || api.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setFormError('API Name is required.');
      return;
    }
    if (!newBasePath.startsWith('/')) {
      setFormError('Base path must start with a leading slash (/ e.g. /payments)');
      return;
    }
    if (!newBackendUrl.startsWith('http://') && !newBackendUrl.startsWith('https://')) {
      setFormError('Backend URL must start with http:// or https://');
      return;
    }

    registerApi({
      name: newName.trim(),
      version: newVersion.trim(),
      basePath: newBasePath.trim(),
      backendUrl: newBackendUrl.trim(),
      description: newDescription.trim() || 'Custom registered enterprise service endpoint',
      status: newStatus,
    });

    // Reset and close
    setNewName('');
    setNewBasePath('/api/v1/');
    setNewDescription('');
    setFormError('');
    setShowCreateModal(false);
  };

  const handleTestInvoke = (api: ApiDefinition) => {
    const responsePayload = JSON.stringify({
      gateway: "WSO2 API Manager 4.7.0 Gateway",
      status: 200,
      api: api.name,
      version: api.version,
      matchedRoute: `${api.basePath}/${api.version}/*`,
      upstreamBackend: api.backendUrl,
      jwtAuth: {
        issuer: "https://auth.flowforge.local",
        algorithm: "RS256",
        validation: "SUCCESS_JWKS"
      },
      timestamp: new Date().toISOString()
    }, null, 2);

    setTestInvocationResult({ apiId: api.id, response: responsePayload });
  };

  return (
    <div className="space-y-6">
      {/* Header with Search and Actions */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-700" />
            <span>API Catalog & Gateway Routing</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Service definitions modeled after WSO2 API Manager 4.7.0 Publisher & Gateway on port 8243.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Register New API</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-sm text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by API name or base path..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-slate-400 text-[11px] font-medium mr-1 font-mono uppercase">Filter:</span>
          {['ALL', 'PUBLISHED', 'DRAFT', 'DEPRECATED', 'RETIRED'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`
                px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer shrink-0
                ${statusFilter === status 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
              `}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* API Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 tracking-wider border-b border-slate-100 font-mono">
              <tr>
                <th className="px-4 py-2.5">API Name & Version</th>
                <th className="px-4 py-2.5">Gateway Path</th>
                <th className="px-4 py-2.5">Upstream Backend</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">WSO2 Gateway URL</th>
                <th className="px-4 py-2.5 text-right font-sans">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredApis.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-sans">
                    No APIs match the selected search or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredApis.map(api => (
                  <tr 
                    key={api.id}
                    className={`hover:bg-slate-50/80 transition-colors ${selectedApiId === api.id ? 'bg-slate-50' : ''}`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-900 font-sans text-xs flex items-center gap-1.5">
                        {api.name}
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                          {api.version}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-sans truncate max-w-xs mt-0.5">
                        {api.description}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-800 font-semibold">
                      {api.basePath}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-[11px] truncate max-w-[160px]">
                      {api.backendUrl}
                    </td>
                    <td className="px-4 py-2.5 font-sans">
                      <Badge status={api.status} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">
                      {api.gatewayUrl ? (
                        <span className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {api.gatewayUrl}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Not deployed to gateway</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right space-x-1.5 font-sans">
                      <button
                        onClick={() => selectApi(api.id)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
                      >
                        Inspect
                      </button>
                      {api.status === 'PUBLISHED' && (
                        <button
                          onClick={() => handleTestInvoke(api)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-medium text-xs transition-colors cursor-pointer"
                          title="Simulate WSO2 Gateway curl invocation"
                        >
                          Invoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected API Inspection Drawer / Details */}
      {selectedApi && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-mono font-semibold uppercase text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                WSO2 Gateway Details
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-1">{selectedApi.name}</h3>
              <p className="text-xs text-slate-500">{selectedApi.description}</p>
            </div>
            
            <div className="flex items-center gap-2">
              {selectedApi.status === 'DRAFT' && (
                <button
                  onClick={() => updateApiStatus(selectedApi.id, 'PUBLISHED')}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  Publish & Deploy Revision
                </button>
              )}
              {selectedApi.status === 'PUBLISHED' && (
                <button
                  onClick={() => updateApiStatus(selectedApi.id, 'DEPRECATED')}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  Deprecate API
                </button>
              )}
              {selectedApi.status === 'DEPRECATED' && (
                <button
                  onClick={() => updateApiStatus(selectedApi.id, 'RETIRED')}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  Retire API
                </button>
              )}
              <button
                onClick={() => setApiToDelete(selectedApi)}
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                title="Delete API definition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
              <div className="text-slate-500 font-medium">Gateway Context Path</div>
              <div className="text-slate-900 font-mono font-bold mt-1 text-sm">{selectedApi.basePath}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Version: {selectedApi.version}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
              <div className="text-slate-500 font-medium">Upstream Backend Target</div>
              <div className="text-slate-900 font-mono font-bold mt-1 truncate">{selectedApi.backendUrl}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">HTTP/1.1 Upstream Proxy</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
              <div className="text-slate-500 font-medium">WSO2 Publisher API ID</div>
              <div className="text-slate-900 font-mono font-bold mt-1 truncate">
                {selectedApi.wso2ApiId || 'N/A (Draft)'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Publisher REST API v4</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
              <div className="text-slate-500 font-medium">Authentication Policy</div>
              <div className="text-emerald-700 font-bold mt-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                RS256 JWT Verification
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Validated against JWKS endpoint</div>
            </div>
          </div>

          {/* Gateway Curl Command Example */}
          <div className="p-3.5 bg-navy-950 rounded-lg border border-navy-800 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
              <span className="flex items-center gap-1.5 text-teal-400">
                <Terminal className="w-3.5 h-3.5" />
                Verified WSO2 Gateway Invocation Command
              </span>
              <span className="text-slate-400">Port 8243 (TLS)</span>
            </div>
            <pre className="font-mono text-emerald-400 text-xs overflow-x-auto p-1 leading-relaxed">
              <code>{`curl -k -i -H "Authorization: Bearer $RS256_TOKEN" \\
  https://localhost:8243${selectedApi.basePath}/${selectedApi.version}/ready`}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Simulated Gateway Invocation Output Modal */}
      {testInvocationResult && (
        <Modal
          isOpen={true}
          onClose={() => setTestInvocationResult(null)}
          title="WSO2 Gateway Proxy Invocation"
          subtitle="Simulated HTTPS response returned from WSO2 Gateway port 8243"
        >
          <div className="space-y-3">
            <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>HTTP/1.1 200 OK — Asymmetric RS256 token signature validated against FlowForge JWKS</span>
            </div>
            <pre className="p-3 rounded-lg bg-navy-950 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed border border-navy-800 max-h-64">
              <code>{testInvocationResult.response}</code>
            </pre>
            <div className="flex justify-end">
              <button
                onClick={() => setTestInvocationResult(null)}
                className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close Output
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create API Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Register New API Definition"
        subtitle="Registers service with FlowForge database and publishes to WSO2 API Manager"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">API Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Risk Assessment API"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Version</label>
              <input
                type="text"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Gateway Base Path *</label>
              <input
                type="text"
                required
                value={newBasePath}
                onChange={(e) => setNewBasePath(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Upstream Backend URL *</label>
            <input
              type="text"
              required
              value={newBackendUrl}
              onChange={(e) => setNewBackendUrl(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Initial Lifecycle Status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as ApiLifecycleStatus)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs"
            >
              <option value="PUBLISHED">PUBLISHED (Deploy live revision to WSO2 Gateway)</option>
              <option value="DRAFT">DRAFT (Save definition only)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Brief description of the service and capabilities..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Register & Publish
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {apiToDelete && (
        <Modal
          isOpen={true}
          onClose={() => setApiToDelete(null)}
          title="Delete API Definition"
          subtitle="Are you sure you want to remove this API from the catalog?"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              This will remove <strong>{apiToDelete.name}</strong> ({apiToDelete.basePath}) from FlowForge. 
              Active upstream services will no longer be routed through this configuration.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setApiToDelete(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteApi(apiToDelete.id);
                  setApiToDelete(null);
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-semibold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
