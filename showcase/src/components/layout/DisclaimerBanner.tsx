import React, { useState } from 'react';
import { Info, ExternalLink, Server, CheckCircle2, ShieldCheck, Cpu } from 'lucide-react';
import { Modal } from './Modal';

export const DisclaimerBanner: React.FC = () => {
  const [showInfoModal, setShowInfoModal] = useState(false);

  return (
    <>
      <aside aria-label="Demo environment status" className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white text-xs px-4 py-2 border-b border-navy-700/60 shadow-inner flex flex-wrap items-center justify-between gap-2 z-30">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold bg-forge-teal/20 text-teal-300 border border-forge-teal/40 uppercase tracking-wider text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-forge-teal animate-pulse"></span>
            Interactive Demo — Simulated Data
          </span>
          <span className="text-slate-300 hidden md:inline">
            Client-side interactive simulation of FlowForge&apos;s distributed workflow engine.
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInfoModal(true)}
            className="inline-flex items-center gap-1 text-slate-300 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-teal-400" />
            <span>Real Backend Architecture</span>
          </button>
          <a
            href="https://github.com/Sajini3655/Flowforge"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300 font-medium transition-colors"
          >
            <span>GitHub Repository</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </aside>

      {/* Information Modal */}
      <Modal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title="FlowForge Architecture & Runtime Note"
        subtitle="Distinguishing this Client-Side Interactive Demo from the Production Backend"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-teal-50/60 border border-teal-200 text-teal-900">
            <h4 className="font-semibold text-sm flex items-center gap-2 mb-1">
              <Server className="w-4 h-4 text-forge-teal" />
              Why this Interactive Showcase exists
            </h4>
            <p className="text-xs leading-relaxed text-teal-800">
              FlowForge is a production-style distributed workflow platform requiring an enterprise runtime stack 
              (Java 21, Spring Boot, PostgreSQL 16, RabbitMQ 3.13, Redis 7.4, and WSO2 API Manager 4.7.0). 
              To allow recruiters, hiring managers, and interviewers to explore its concepts directly in the browser 
              without spinning up local Docker clusters or paying for expensive cloud hosting, this interactive showcase 
              simulates the exact finite-state transitions, retry pipelines, idempotency checks, and locking mechanisms in client-side TypeScript.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 text-sm mb-2">Verified Real Backend Capabilities (in Repo):</h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <li className="flex items-start gap-2 p-2 rounded bg-slate-50 border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Transactional Outbox:</strong> Atomic PostgreSQL commit + background polling publisher.</span>
              </li>
              <li className="flex items-start gap-2 p-2 rounded bg-slate-50 border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>RabbitMQ Retry & DLQ:</strong> 5-second TTL delayed retry queue + dead-letter exchange.</span>
              </li>
              <li className="flex items-start gap-2 p-2 rounded bg-slate-50 border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Redis Distributed Locking:</strong> Cluster-safe <code className="bg-slate-200 px-1 py-0.5 rounded">SET NX PX</code> + Lua compare-and-delete.</span>
              </li>
              <li className="flex items-start gap-2 p-2 rounded bg-slate-50 border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>WSO2 APIM 4.7.0 Gateway:</strong> Dynamic API registration & revision deployment.</span>
              </li>
              <li className="flex items-start gap-2 p-2 rounded bg-slate-50 border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Strict Idempotency:</strong> SHA-256 fingerprinting on <code className="bg-slate-200 px-1 py-0.5 rounded">Idempotency-Key</code> header.</span>
              </li>
              <li className="flex items-start gap-2 p-2 rounded bg-slate-50 border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>141 Automated Tests:</strong> 110 Unit Tests + 31 Testcontainers Integration Tests (100% passing).</span>
              </li>
            </ul>
          </div>

          <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-600 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              Public RSA JWKS endpoint at <code className="font-mono text-slate-800">/api/.well-known/jwks.json</code>
            </span>
            <span className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-slate-500" />
              15 Kubernetes Kustomize manifests in <code className="font-mono text-slate-800">k8s/</code>
            </span>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => setShowInfoModal(false)}
              className="px-4 py-2 bg-slate-900 text-white font-medium text-xs rounded-lg hover:bg-slate-800 transition-colors"
            >
              Continue to Interactive Showcase
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
