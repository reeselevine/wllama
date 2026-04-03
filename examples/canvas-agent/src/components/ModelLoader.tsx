interface Model {
  label: string;
  url: string;
  size: number;
}

interface Props {
  models: Model[];
  selectedIdx: number;
  onSelectIdx: (i: number) => void;
  onLoad: () => void;
  isLoading: boolean;
  progress: number;
}

function fmt(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(0) + ' MB';
}

export default function ModelLoader({
  models,
  selectedIdx,
  onSelectIdx,
  onLoad,
  isLoading,
  progress,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-1">Load a model to start</h2>
        <p className="text-sm text-base-content/60">
          Model runs entirely in your browser — no server, no data sent.
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-sm">
        {models.map((m, i) => (
          <label
            key={m.url}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedIdx === i
                ? 'border-primary bg-primary/10'
                : 'border-base-300 hover:border-base-content/30'
            }`}
          >
            <input
              type="radio"
              className="radio radio-primary radio-sm mt-0.5"
              checked={selectedIdx === i}
              onChange={() => onSelectIdx(i)}
            />
            <div>
              <div className="font-medium text-sm">{m.label.split('—')[0].trim()}</div>
              <div className="text-xs text-base-content/50">{fmt(m.size)}</div>
            </div>
          </label>
        ))}
      </div>

      {isLoading ? (
        <div className="w-full max-w-sm">
          <div className="flex justify-between text-xs mb-1">
            <span>Downloading…</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <progress
            className="progress progress-primary w-full"
            value={progress}
            max={1}
          />
        </div>
      ) : (
        <button className="btn btn-primary w-full max-w-sm" onClick={onLoad}>
          Load model
        </button>
      )}
    </div>
  );
}
