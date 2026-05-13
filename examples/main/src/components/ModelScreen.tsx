import { ModelState, Screen } from '../utils/types';
import { useWllama } from '../utils/wllama.context';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTrashAlt,
  faXmark,
  faWarning,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import { DEFAULT_INFERENCE_PARAMS } from '../config';
import {
  getWebGPUMemoryBudget,
  toHumanReadableSize,
  useDebounce,
} from '../utils/utils';
import { useEffect, useState } from 'react';
import ScreenWrapper from './ScreenWrapper';
import { DisplayedModel } from '../utils/displayed-model';
import { isValidGgufFile } from '@reeselevine/wllama-webgpu';
import { benchmark, perplexity } from '../utils/benchmark';

type BenchmarkResultTable = {
  headers: string[];
  rows: string[][];
};

const SPLIT_GGUF_REGEX = /^(.*)-(\d{5})-of-(\d{5})\.gguf$/;

function parseSplitFile(file: string) {
  const match = file.match(SPLIT_GGUF_REGEX);
  if (!match) {
    return null;
  }

  return {
    current: Number(match[2]),
    total: Number(match[3]),
  };
}

function getSelectableGgufFiles(files: string[]) {
  return files
    .filter((file) => {
      const split = parseSplitFile(file);
      return !split || split.current === 1;
    })
    .sort((a, b) => a.localeCompare(b));
}

function getGgufOptionLabel(file: string) {
  const split = parseSplitFile(file);
  if (!split) {
    return file;
  }

  return `${file} (${split.total} shards)`;
}

export default function ModelScreen() {
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [webgpuMemoryBudget, setWebgpuMemoryBudget] = useState<
    number | undefined
  >();
  const [benchmarkBusy, setBenchmarkBusy] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [benchmarkOutput, setBenchmarkOutput] =
    useState<BenchmarkResultTable | null>(null);
  const {
    models,
    removeCachedModel,
    isLoadingModel,
    isDownloading,
    getWllamaInstance,
    loadedModel,
    currParams,
    setParams,
  } = useWllama();
  const [paramInputs, setParamInputs] = useState({
    nThreads: currParams.nThreads < 1 ? '' : currParams.nThreads.toString(),
    nContext: currParams.nContext.toString(),
    nPredict: currParams.nPredict.toString(),
    temperature: currParams.temperature.toString(),
  });

  const blockModelBtn = !!(loadedModel || isDownloading || isLoadingModel);
  const benchmarkBlocked =
    benchmarkBusy || isDownloading || isLoadingModel || !loadedModel;
  const effectiveWebGPUMemoryBudget = webgpuMemoryBudget
    ? Math.floor(webgpuMemoryBudget * 0.8)
    : undefined;

  useEffect(() => {
    let cancelled = false;

    getWebGPUMemoryBudget()
      .then((budget) => {
        if (!cancelled) {
          setWebgpuMemoryBudget(budget);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWebgpuMemoryBudget(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setParamInputs({
      nThreads: currParams.nThreads < 1 ? '' : currParams.nThreads.toString(),
      nContext: currParams.nContext.toString(),
      nPredict: currParams.nPredict.toString(),
      temperature: currParams.temperature.toString(),
    });
  }, [currParams]);

  const onChange =
    (key: 'nThreads' | 'nContext' | 'nPredict' | 'temperature') => (e: any) => {
      const value = e.target.value;
      setParamInputs((prev) => ({ ...prev, [key]: value }));

      if (value === '') {
        if (key === 'nThreads') {
          setParams({ ...currParams, nThreads: -1 });
        }
        return;
      }

      const nextValue = parseFloat(value);
      if (Number.isNaN(nextValue)) return;
      setParams({ ...currParams, [key]: nextValue });
    };

  const onBlur =
    (key: 'nThreads' | 'nContext' | 'nPredict' | 'temperature') => () => {
      if (paramInputs[key] !== '') return;
      const defaultValue = DEFAULT_INFERENCE_PARAMS[key];
      setParams({ ...currParams, [key]: defaultValue });
      setParamInputs((prev) => ({
        ...prev,
        [key]:
          key === 'nThreads' && defaultValue < 1 ? '' : defaultValue.toString(),
      }));
    };

  const runBenchmarkAction = async (action: 'benchmark' | 'perplexity') => {
    if (benchmarkBlocked || !loadedModel) return;
    setBenchmarkBusy(true);
    setBenchmarkError(null);
    setBenchmarkOutput(null);
    try {
      const result =
        action === 'benchmark'
          ? await benchmark(
              getWllamaInstance(),
              loadedModel.hfModel,
              currParams
            )
          : await perplexity(
              getWllamaInstance(),
              loadedModel.hfModel,
              currParams
            );
      setBenchmarkOutput({
        headers: result.output[0],
        rows: result.output.slice(2),
      });
    } catch (e) {
      setBenchmarkError((e as any)?.message ?? `Failed to run ${action}`);
    } finally {
      setBenchmarkBusy(false);
    }
  };

  return (
    <ScreenWrapper>
      <div className="inference-params pt-8">
        <h1 className="text-2xl mb-4">Inference parameters</h1>
        <label className="input input-bordered flex items-center gap-2 mb-2">
          # threads
          <input
            type="number"
            className="grow"
            placeholder="(auto detected)"
            min="1"
            max="100"
            step="1"
            onChange={onChange('nThreads')}
            onBlur={onBlur('nThreads')}
            value={paramInputs.nThreads}
            disabled={blockModelBtn}
          />
        </label>

        <label className="input input-bordered flex items-center gap-2 mb-2">
          Context size
          <input
            type="number"
            className="grow"
            min="128"
            step="1"
            onChange={onChange('nContext')}
            onBlur={onBlur('nContext')}
            value={paramInputs.nContext}
            disabled={blockModelBtn}
          />
        </label>

        <label className="input input-bordered flex items-center gap-2 mb-2">
          Max generated tokens
          <input
            type="number"
            className="grow"
            min="10"
            step="1"
            onChange={onChange('nPredict')}
            onBlur={onBlur('nPredict')}
            value={paramInputs.nPredict}
          />
        </label>

        <label className="input input-bordered flex items-center gap-2 mb-2">
          Temperature
          <input
            type="number"
            className="grow"
            min="0.0"
            step="0.05"
            onChange={onChange('temperature')}
            onBlur={onBlur('temperature')}
            value={paramInputs.temperature}
          />
        </label>

        <label className="label cursor-pointer justify-start gap-3 mb-2">
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={currParams.backend === 'webgpu'}
            onChange={(e) =>
              setParams({
                ...currParams,
                backend: e.target.checked ? 'webgpu' : 'cpu',
              })
            }
            disabled={blockModelBtn}
          />
          <span className="label-text">Use WebGPU backend</span>
        </label>

        {currParams.backend === 'webgpu' && effectiveWebGPUMemoryBudget && (
          <div className="text-sm opacity-80 mb-2">
            Usable WebGPU Budget:{' '}
            {toHumanReadableSize(effectiveWebGPUMemoryBudget)}
          </div>
        )}

        <button
          className="btn btn-sm mr-2"
          onClick={() => setParams(DEFAULT_INFERENCE_PARAMS)}
        >
          Reset params
        </button>
        <button
          className="btn btn-sm mr-2"
          onClick={async () => {
            if (
              confirm(
                'This will remove all downloaded model files from cache. Continue?'
              )
            ) {
              for (const m of models) {
                await removeCachedModel(m);
              }
            }
          }}
          disabled={blockModelBtn}
        >
          Clear cache
        </button>

        <div className="mt-6 rounded-box border border-base-300 p-4">
          <h2 className="text-xl mb-2">Benchmark</h2>
          <p className="text-sm opacity-80 mb-3">
            Runs against the currently loaded model. Prefill is run with 512
            tokens and decode with 64 tokens. Each test does 1 warmup run and 3
            measured runs.
          </p>
          {!loadedModel && (
            <p className="text-sm opacity-80 mb-3">
              Load a model first to run benchmark or perplexity.
            </p>
          )}
          {benchmarkError && (
            <div className="alert alert-error mb-3">
              <span>{benchmarkError}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              className="btn btn-sm btn-outline"
              disabled={benchmarkBlocked}
              onClick={() => runBenchmarkAction('benchmark')}
            >
              {benchmarkBusy ? 'Running...' : 'Run benchmark'}
            </button>
            <button
              className="btn btn-sm btn-outline"
              disabled={benchmarkBlocked}
              onClick={() => runBenchmarkAction('perplexity')}
            >
              {benchmarkBusy ? 'Running...' : 'Run perplexity'}
            </button>
          </div>
          {benchmarkOutput && (
            <div className="rounded-box border border-base-300 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table table-zebra table-sm">
                  <thead>
                    <tr>
                      {benchmarkOutput.headers.map((header) => (
                        <th
                          key={header}
                          className="font-semibold uppercase text-[11px] tracking-wide"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {benchmarkOutput.rows.map((row, rowIndex) => (
                      <tr key={`${row[0]}-${rowIndex}`}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={`${rowIndex}-${cellIndex}`}
                            className="whitespace-nowrap"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="model-management">
        <h1 className="text-2xl mt-6 mb-4">
          Custom models
          <button
            className="btn btn-primary btn-outline btn-sm ml-6"
            onClick={() => setShowAddCustom(true)}
          >
            + Add GGUF
          </button>
        </h1>

        {models
          .filter((m) => m.isUserAdded)
          .map((m) => (
            <ModelCard
              key={m.url}
              model={m}
              blockModelBtn={blockModelBtn}
              backend={currParams.backend}
              webgpuMemoryBudget={effectiveWebGPUMemoryBudget}
            />
          ))}
      </div>

      <div className="model-management">
        <h1 className="text-2xl mt-6 mb-4">Recommended models</h1>

        {models
          .filter((m) => !m.isUserAdded)
          .map((m) => (
            <ModelCard
              key={m.url}
              model={m}
              blockModelBtn={blockModelBtn}
              backend={currParams.backend}
              webgpuMemoryBudget={effectiveWebGPUMemoryBudget}
            />
          ))}
      </div>

      <div className="h-10" />

      {showAddCustom && (
        <AddCustomModelDialog onClose={() => setShowAddCustom(false)} />
      )}
    </ScreenWrapper>
  );
}

function AddCustomModelDialog({ onClose }: { onClose(): void }) {
  const { isLoadingModel, addCustomModel } = useWllama();
  const [hfRepo, setHfRepo] = useState<string>('');
  const [hfFile, setHfFile] = useState<string>('');
  const [hfFiles, setHfFiles] = useState<string[]>([]);
  const [abortSignal, setAbortSignal] = useState<AbortController>(
    new AbortController()
  );
  const [err, setErr] = useState<string>();

  useDebounce(
    async () => {
      if (hfRepo.length < 2) {
        setHfFiles([]);
        return;
      }
      try {
        const res = await fetch(`https://huggingface.co/api/models/${hfRepo}`, {
          signal: abortSignal.signal,
        });
        const data: { siblings?: { rfilename: string }[] } = await res.json();
        if (data.siblings) {
          setHfFiles(
            getSelectableGgufFiles(
              data.siblings
                .map((s) => s.rfilename)
                .filter((f) => isValidGgufFile(f))
            )
          );
          setErr('');
        } else {
          setErr('no model found or it is private');
          setHfFiles([]);
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setErr((e as any)?.message ?? 'unknown error');
          setHfFiles([]);
        }
      }
    },
    [hfRepo],
    500
  );

  useEffect(() => {
    if (hfFiles.length === 0) {
      setHfFile('');
    }
  }, [hfFiles]);

  const onSubmit = async () => {
    try {
      await addCustomModel(
        `https://huggingface.co/${hfRepo}/resolve/main/${hfFile}`
      );
      onClose();
    } catch (e) {
      setErr((e as any)?.message ?? 'unknown error');
    }
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Add custom GGUF</h3>
        <div className="mt-4">
          Max GGUF file size is 2GB. If your model is bigger than 2GB, please{' '}
          <a
            href="https://github.com/ngxson/wllama?tab=readme-ov-file#split-model"
            target="_blank"
            rel="noopener"
            className="text-primary"
          >
            follow this guide
          </a>{' '}
          to split it into smaller shards.
        </div>
        <div className="mt-2 text-sm opacity-80">
          For split models, select the first shard only, for example
          <code> -00001-of-00003.gguf</code>. The remaining shards will be
          loaded automatically.
        </div>
        <div className="mt-4">
          <label className="input input-bordered flex items-center gap-2 mb-2">
            HF repo
            <input
              type="text"
              className="grow"
              placeholder="{username}/{repo}"
              value={hfRepo}
              onChange={(e) => {
                abortSignal.abort();
                setHfRepo(e.target.value);
                setAbortSignal(new AbortController());
              }}
            />
          </label>
          <select
            className="select select-bordered w-full"
            value={hfFile}
            onChange={(e) => setHfFile(e.target.value)}
          >
            <option value="">Select a model file</option>
            {hfFiles.map((f) => (
              <option key={f} value={f}>
                {getGgufOptionLabel(f)}
              </option>
            ))}
          </select>
        </div>
        {hfFiles.length > 0 && (
          <div className="text-sm opacity-80">
            Showing single GGUF files and first shards only.
          </div>
        )}
        {err && <div className="mt-4 text-error">Error: {err}</div>}
        <div className="modal-action">
          <button
            className="btn btn-primary"
            disabled={isLoadingModel || hfRepo.length < 2 || hfFile.length < 5}
            onClick={onSubmit}
          >
            {isLoadingModel && (
              <span className="loading loading-spinner"></span>
            )}
            Add model
          </button>
          <button className="btn" disabled={isLoadingModel} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}

function ModelCard({
  model,
  blockModelBtn,
  backend,
  webgpuMemoryBudget,
}: {
  model: DisplayedModel;
  blockModelBtn: boolean;
  backend: 'cpu' | 'webgpu';
  webgpuMemoryBudget?: number;
}) {
  const {
    downloadModel,
    removeCachedModel,
    loadModel,
    unloadModel,
    removeCustomModel,
    currRuntimeInfo,
    navigateTo,
  } = useWllama();

  const m = model;
  const percent = parseInt(Math.round(m.downloadPercent * 100).toString());
  const exceedsWebGPUBudget = !!(
    backend === 'webgpu' &&
    webgpuMemoryBudget &&
    m.size > webgpuMemoryBudget
  );
  const webgpuWarningLabel = exceedsWebGPUBudget
    ? `Model exceeds the current WebGPU budget (${toHumanReadableSize(webgpuMemoryBudget!)}); loading may fail`
    : undefined;
  return (
    <div
      className={`card bg-base-100 w-full mb-2 ${
        m.state === ModelState.LOADED ? 'border-2 border-primary' : ''
      }`}
      key={m.url}
    >
      <div className="card-body p-4 flex flex-row">
        <div className="grow">
          <b>{m.hfPath.replace(/-\d{5}-of-\d{5}/, '-(shards)')}</b>
          <br />
          <small>
            HF repo: {m.hfModel}
            <br />
            Size: {toHumanReadableSize(m.size)}
            {m.state == ModelState.DOWNLOADING
              ? ` - Downloaded: ${percent}%`
              : ''}
          </small>

          {exceedsWebGPUBudget && (
            <div className="text-sm text-warning mt-1">
              <FontAwesomeIcon icon={faWarning} className="mr-2" />
              Model size exceeds the current WebGPU budget and may fail to
              load.
            </div>
          )}

          {m.state === ModelState.LOADED && currRuntimeInfo && (
            <>
              <br />
              <InfoOnOffDisplay
                text="Multithread"
                on={currRuntimeInfo.isMultithread}
              />
              &nbsp;&nbsp;&nbsp;&nbsp;
              <InfoOnOffDisplay
                text="WebGPU"
                on={currRuntimeInfo.usingWebGPU}
              />
              &nbsp;&nbsp;&nbsp;&nbsp;
              <InfoOnOffDisplay
                text="Chat template"
                on={currRuntimeInfo.hasChatTemplate}
              />
            </>
          )}

          {m.state === ModelState.DOWNLOADING && (
            <div>
              <progress
                className="progress progress-primary w-full"
                value={percent}
                max="100"
              ></progress>
            </div>
          )}

          {m.state === ModelState.LOADING && (
            <div>
              <progress className="progress progress-primary w-full"></progress>
            </div>
          )}
        </div>
        <div>
          {m.state === ModelState.NOT_DOWNLOADED && (
            <button
              className="btn btn-primary btn-sm mr-2"
              onClick={() => downloadModel(m)}
              disabled={blockModelBtn}
              title={webgpuWarningLabel}
            >
              Download
            </button>
          )}
          {m.state === ModelState.READY && (
            <>
              <button
                className="btn btn-primary btn-sm mr-2"
                onClick={() => loadModel(m)}
                disabled={blockModelBtn}
                title={webgpuWarningLabel}
              >
                Load model
              </button>
              <button
                className="btn btn-outline btn-error btn-sm mr-2"
                onClick={() => {
                  if (
                    confirm('Are you sure to remove this model from cache?')
                  ) {
                    removeCachedModel(m);
                  }
                }}
                disabled={blockModelBtn}
              >
                <FontAwesomeIcon icon={faTrashAlt} />
              </button>
            </>
          )}
          {m.state === ModelState.LOADED && (
            <>
              <button
                className="btn btn-primary btn-sm mr-2"
                onClick={() => navigateTo(Screen.CHAT)}
              >
                Start chat
              </button>
              <button
                className="btn btn-outline btn-primary btn-sm mr-2"
                onClick={() => unloadModel()}
              >
                Unload
              </button>
            </>
          )}
          {m.state === ModelState.NOT_DOWNLOADED && m.isUserAdded && (
            <button
              className="btn btn-outline btn-error btn-sm mr-2"
              onClick={() => {
                if (
                  confirm('Are you sure to remove this model from the list?')
                ) {
                  removeCustomModel(m);
                }
              }}
              disabled={blockModelBtn}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          )}
          {m.state == ModelState.DOWNLOADING && (
            <span className="loading loading-spinner"></span>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoOnOffDisplay({ text, on }: { text: string; on: boolean }) {
  return (
    <>
      {on ? (
        <span className="text-green-300">
          <FontAwesomeIcon icon={faCheck} />
        </span>
      ) : (
        <span className="text-red-400">
          <FontAwesomeIcon icon={faXmark} />
        </span>
      )}
      <span className="text-sm">&nbsp;{text}</span>
    </>
  );
}
