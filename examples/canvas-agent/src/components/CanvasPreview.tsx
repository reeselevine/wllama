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
<script>
${code.js}
</script>
</body>
</html>`;
}

export default function CanvasPreview({ code }: Props) {
  const isEmpty = !code.html && !code.css && !code.js;

  return (
    <div className="flex-1 overflow-hidden relative bg-black min-h-0">
      {isEmpty ? (
        <div className="flex items-center justify-center h-full text-base-content/20 text-sm select-none">
          preview will appear here
        </div>
      ) : (
        <iframe
          key={code.html + code.css + code.js}
          className="w-full h-full border-0"
          sandbox="allow-scripts"
          srcDoc={buildSrcDoc(code)}
          title="preview"
        />
      )}
    </div>
  );
}
