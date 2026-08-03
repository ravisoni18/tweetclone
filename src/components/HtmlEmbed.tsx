import React, { useState } from 'react';
import { Play, ShieldCheck, Maximize2, Minimize2 } from 'lucide-react';

interface HtmlEmbedProps {
  html: string;
}

// Renders untrusted, user-authored HTML5 content (e.g. a small game).
//
// SECURITY: `html` is never sanitized and must never be trusted — the only
// safety guarantee is the iframe `sandbox` attribute below. It intentionally
// omits:
//   - allow-same-origin  -> keeps the iframe on an opaque/null origin, so its
//                           script cannot read Patr's cookies, localStorage,
//                           or DOM, and authenticated fetch/XHR calls to our
//                           own API will fail
//   - allow-top-navigation -> can't redirect/hijack the parent tab
//   - allow-popups          -> can't open windows
//   - allow-forms           -> no form submission out of the sandbox
// `allow-scripts` alone is kept because canvas/WebGL games need JS to run.
// Do not add other sandbox tokens without re-checking this reasoning.
const HtmlEmbed: React.FC<HtmlEmbedProps> = ({ html }) => {
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="mt-3 w-full rounded-2xl overflow-hidden border border-gray-700"
      style={{ background: 'var(--bg-secondary, #16181c)' }}
    >
      {running ? (
        <div className="relative">
          <iframe
            title="HTML5 content"
            srcDoc={html}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            loading="lazy"
            style={{
              width: '100%',
              height: expanded ? '640px' : '420px',
              border: 'none',
              display: 'block',
              background: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(v => !v);
            }}
            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 rounded-full p-2 transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <Minimize2 className="w-4 h-4 text-white" />
            ) : (
              <Maximize2 className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setRunning(true);
          }}
          className="w-full flex flex-col items-center justify-center gap-2 py-10 transition-colors hover:opacity-90"
          style={{ color: 'var(--text, #e7e9ea)' }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent, #1d9bf0)' }}
          >
            <Play className="w-5 h-5" style={{ color: 'var(--accent-text, #fff)' }} />
          </div>
          <span className="font-semibold text-sm">Run HTML5 content</span>
          <span
            className="flex items-center gap-1 text-xs"
            style={{ color: 'var(--text-dim, #71767b)' }}
          >
            <ShieldCheck className="w-3 h-3" />
            Runs sandboxed — no access to your account or data
          </span>
        </button>
      )}
    </div>
  );
};

export default HtmlEmbed;
