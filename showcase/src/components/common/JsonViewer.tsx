import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface JsonViewerProps {
  data: unknown;
  maxHeight?: string;
  title?: string;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ 
  data, 
  maxHeight = 'max-h-72',
  title
}) => {
  const [copied, setCopied] = useState(false);

  let formatted = '';
  try {
    formatted = typeof data === 'string' ? JSON.stringify(JSON.parse(data), null, 2) : JSON.stringify(data, null, 2);
  } catch {
    formatted = String(data);
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-lg border border-slate-800 bg-navy-950 overflow-hidden text-xs">
      {title && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-navy-900 border-b border-navy-800 text-slate-400 font-mono text-[11px]">
          <span>{title}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Copy to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      )}
      {!title && (
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded bg-navy-800/80 hover:bg-navy-700 text-slate-400 hover:text-white transition-colors z-10"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      )}
      <pre className={`p-3 font-mono overflow-x-auto text-emerald-400/90 leading-relaxed ${maxHeight}`}>
        <code>{formatted}</code>
      </pre>
    </div>
  );
};
