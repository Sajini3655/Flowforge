import React, { useState } from 'react';
import { ExternalLink, Server, CheckCircle2, ShieldCheck, Cpu } from 'lucide-react';
import { Modal } from './Modal';

export const DisclaimerBanner: React.FC = () => {
  const [showInfoModal, setShowInfoModal] = useState(false);

  return (
    <>
      <aside aria-label="Demo environment status" className="bg-slate-100 border-b border-slate-200/90 text-slate-700 text-xs px-4 py-1.5 flex items-center justify-between gap-3 z-30">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200 font-mono">
            Demo Mode
          </span>
          <span className="text-slate-600 text-xs hidden sm:inline">
            Client-side interactive simulation. Full backend implementation and automated test suites reside in repository.
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={() => setShowInfoModal(true)}
            className="text-slate-600 hover:text-slate-900 underline underline-offset-2 transition-colors cursor-pointer"
          >
            Architecture Note
          </button>
          <span className="text-slate-300">|</span>
          <a
            href="https://github.com/Sajini3655/Flowforge"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 hover:text-slate-900 font-medium inline-flex items-center gap-1"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </aside>

      {/* Information Modal */}
      <Modal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title="FlowForge Architecture & Runtime Note"
        subtitle="Distinguishing client-side demonstration from the repository backend codebase"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
            <h4 className="font-semibold text-xs text-slate-900 flex items-center gap-1.5 mb-1">
              <Server className="w-4 h-4 text-slate-700" />
              Interactive Showcase Purpose
            </h4>
            <p className="text-xs leading-relaxed text-slate-600">
              FlowForge is an enterprise distributed workflow platform designed to run on 
              Java 21, Spring Boot 3.5, PostgreSQL 16, RabbitMQ 3.13, Redis 7.4, and WSO2 API Manager 4.7.0. 
              To allow technical reviewers and recruiters to explore the system without provisioning local infrastructure, 
              this showcase simulates state machine transitions, delayed retry policies, idempotency checks, 
              and distributed locking directly in the browser.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 text-xs mb-2">Verified Implemented Backend (in Repository):</h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <li className="flex items-start gap-2 p-2 rounded bg-slate-50 border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Transactional Outbox:</strong> Atomic PostgreSQL dual write + scheduled polling publisher.</span>
              </li>
              <li className="flex items-start gap-2 p-2 rounded bg-slate-50 border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>RabbitMQ Retry & DLQ:</strong> 5-second TTL delayed retry queue + dead-letter exchange.</span>
              </li>
              <li className="flex items-start gap-2 p-2 rounded bg-slate-50 border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Redis Distributed Locking:</strong> <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">SET NX PX</code> + Lua compare-and-delete.</span>
              </li>
              <li className="flex items-start gap-2 p-2 rounded bg-slate-50 border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>WSO2 APIM Gateway:</strong> Dynamic API registration & revision deployment on port 8243.</span>
              </li>
              <li className="flex items-start gap-2 p-2 rounded bg-slate-50 border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Strict Idempotency:</strong> SHA-256 payload fingerprinting on <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">Idempotency-Key</code>.</span>
              </li>
              <li className="flex items-start gap-2 p-2 rounded bg-slate-50 border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>141 Automated Tests:</strong> 110 Unit Tests + 31 Testcontainers Integration Tests (100% passing).</span>
              </li>
            </ul>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border border-slate-200">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              RS256 JWKS endpoint: <code className="font-mono text-slate-800">/api/.well-known/jwks.json</code>
            </span>
            <span className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-slate-500" />
              Prometheus metrics: <code className="font-mono text-slate-800">/actuator/prometheus</code>
            </span>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setShowInfoModal(false)}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
