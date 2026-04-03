import { useState } from 'react';
import type { CodeState } from '../App';

interface Props {
  code: CodeState;
}

function buildSrcDoc(code: CodeState): string {
  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: 100vw; height: 100vh; overflow: hidden; background: #000; }
${code.css}
</style>
</head>
<body>
${code.html}
</body>
</html>`;
}

export default function CanvasPreview({ code }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const isEmpty = !code.html && !code.css;
  const srcDoc = buildSrcDoc(code);

  return (
    <div className="flex-1 overflow-hidden relative bg-black min-h-0">
      {isEmpty ? (
        <div className="flex items-center justify-center h-full text-base-content/20 text-sm select-none">
          preview will appear here
        </div>
      ) : (
        <>
          <iframe
            key={srcDoc + refreshKey}
            className="w-full h-full border-0"
            srcDoc={srcDoc}
            title="preview"
          />
          <button
            className="absolute top-2 right-2 btn btn-xs btn-ghost opacity-40 hover:opacity-100"
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Reload preview"
          >
            ↺
          </button>
        </>
      )}
    </div>
  );
}
