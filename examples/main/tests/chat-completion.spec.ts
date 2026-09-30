import { test, expect } from 'playwright/test';
import type { ChatCompletionChunk, ChatCompletionParams, Wllama } from '@wllama/wllama/esm/index.js';
import { completeChat } from '../src/utils/chat-completion';
import { getWeather } from '../src/utils/weather';
import type { InferenceParams, MessageUpdate } from '../src/utils/types';

type Request = ChatCompletionParams & { onData: (chunk: ChatCompletionChunk) => void };
const params: InferenceParams = { nThreads: 1, nContext: 4096, nBatch: 512, nPredict: 512, temperature: 0.2, backend: 'cpu', enableThinking: false, enableWeather: false };
const input = [{ id: 1, role: 'user' as const, content: 'Weather in Santa Cruz, CA?' }];
const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });

function emit(request: Request, delta: Record<string, unknown>, finish: 'stop' | 'length' | 'tool_calls' | null = null) {
  request.onData({ id: 'response', object: 'chat.completion.chunk', created: 0, model: 'test', choices: [{ index: 0, delta, finish_reason: finish, logprobs: null }] } as ChatCompletionChunk);
}

function fakeModel(rounds: ((request: Request) => void | Promise<void>)[]) {
  const requests: Request[] = [];
  return {
    requests,
    model: { createChatCompletion: async (request: Request) => {
      requests.push({ ...request, messages: structuredClone(request.messages) });
      await rounds[requests.length - 1](request);
    } } as unknown as Pick<Wllama, 'createChatCompletion'>,
  };
}

function weatherFetch() {
  const urls: URL[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    return Response.json(url.hostname.startsWith('geocoding') ? { results: [
      { name: 'Santa Cruz Park', admin1: 'California', country: 'United States', latitude: 1, longitude: 2 },
      { name: 'Santa Cruz', admin1: 'California', country: 'United States', latitude: 36.97, longitude: -122.03 },
    ] } : {
      timezone: 'America/Los_Angeles',
      current: { time: '2026-10-03T12:00', temperature_2m: 20, precipitation: 0, wind_speed_10m: 5 },
      daily: { time: ['2026-10-03'], temperature_2m_min: [12], temperature_2m_max: [22], precipitation_probability_max: [null], precipitation_sum: [0], wind_speed_10m_max: [10] },
    });
  };
  return urls;
}

function toolCall(request: Request, name = 'get_weather', args = '{"city":"Santa Cruz, CA"}') {
  emit(request, { tool_calls: [{ index: 0, id: 'call-1', function: { name, arguments: args } }] }, 'tool_calls');
}

test('ordinary chat sends reasoning preference and no tools', async () => {
  const { model, requests } = fakeModel([request => emit(request, { content: 'Hello.' }, 'stop')]);
  let result: MessageUpdate;
  await completeChat(model, input, params, new AbortController().signal, value => result = value, () => {});
  expect(requests[0].tools).toBeUndefined();
  expect(requests[0].chat_template_kwargs).toEqual({ enable_thinking: false });
  expect(result!.content).toBe('Hello.');
  expect(result!.status).toBeUndefined();
});

test('reasoning is streamed separately and token exhaustion is visible', async () => {
  const { model, requests } = fakeModel([request => emit(request, { reasoning_content: 'Checking the forecast.' }, 'length')]);
  let result: MessageUpdate;
  await completeChat(model, input, { ...params, enableThinking: true }, new AbortController().signal, value => result = value, () => {});
  expect(requests[0].chat_template_kwargs).toEqual({ enable_thinking: true });
  expect(result!.reasoning).toBe('Checking the forecast.');
  expect(result!.content).toBe('');
  expect(result!.status).toContain('Token limit reached');
});

test('fragmented tool arguments execute once and tool history survives a follow-up', async () => {
  const urls = weatherFetch();
  const { model, requests } = fakeModel([
    request => {
      emit(request, { tool_calls: [{ index: 0, id: 'call-1', function: { name: 'get_weather', arguments: '{"city":"Santa' } }] });
      emit(request, { tool_calls: [{ index: 0, function: { arguments: ' Cruz, CA"}' } }] }, 'tool_calls');
    },
    request => emit(request, { content: 'Saturday looks good.' }, 'stop'),
    request => emit(request, { content: 'The high is 22 C.' }, 'stop'),
  ]);
  let result: MessageUpdate;
  await completeChat(model, input, { ...params, enableWeather: true }, new AbortController().signal, value => result = value, () => {});
  expect(urls).toHaveLength(2);
  expect(urls[0].searchParams.get('name')).toBe('Santa Cruz, CA');
  expect(urls[1].searchParams.get('latitude')).toBe('36.97');
  expect(requests[1].messages.at(-1)?.role).toBe('tool');
  expect(result!.toolMessages).toHaveLength(2);
  expect(result!.toolMessages![1].content).toContain('Santa Cruz, California, United States');
  expect(result!.toolMessages![1].content).toContain('"rain_probability":null');
  const saved = JSON.parse(JSON.stringify({ id: 2, role: 'assistant', ...result! }));
  await completeChat(model, [...input, saved, { id: 3, role: 'user', content: 'What is the high?' }], params, new AbortController().signal, () => {}, () => {});
  expect(requests[2].messages.map(message => message.role)).toEqual(['user', 'assistant', 'tool', 'assistant', 'user']);
});

test('ambiguous locations do not fetch a forecast', async () => {
  let count = 0;
  globalThis.fetch = async () => { count++; return Response.json({ results: [
    { name: 'Santa Cruz', admin1: 'California', country: 'United States' },
    { name: 'Santa Cruz', admin1: 'Calabarzon', country: 'Philippines' },
  ] }); };
  const result = await getWeather({ city: 'Santa Cruz' }, new AbortController().signal);
  expect(result.error).toContain('Multiple locations');
  expect(count).toBe(1);
});

test('unknown tools and malformed arguments are returned as tool errors', async () => {
  globalThis.fetch = async () => { throw new Error('Fetch must not run'); };
  const { model, requests } = fakeModel([
    request => toolCall(request, 'other_tool'),
    request => toolCall(request, 'get_weather', '{invalid'),
    request => emit(request, { content: 'Could not look up weather.' }, 'stop'),
  ]);
  await completeChat(model, input, { ...params, enableWeather: true }, new AbortController().signal, () => {}, () => {});
  expect(requests[1].messages.at(-1)?.content).toContain('Unknown tool');
  expect(requests[2].messages.at(-1)?.content).toContain('Invalid weather arguments');
});

test('Stop aborts weather fetch and prevents another model round', async () => {
  const controller = new AbortController();
  globalThis.fetch = async (_, options) => new Promise((_, reject) => {
    options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), { once: true });
    controller.abort();
  });
  const { model, requests } = fakeModel([request => toolCall(request)]);
  let result: MessageUpdate;
  await completeChat(model, input, { ...params, enableWeather: true }, controller.signal, value => result = value, () => {});
  expect(requests).toHaveLength(1);
  expect(result!.status).toBe('Generation stopped.');
  expect(result!.toolMessages).toHaveLength(0);
});

test('repeated tool calls are bounded', async () => {
  weatherFetch();
  const { model, requests } = fakeModel(Array.from({ length: 4 }, () => (request: Request) => toolCall(request)));
  let result: MessageUpdate;
  await completeChat(model, input, { ...params, enableWeather: true }, new AbortController().signal, value => result = value, () => {});
  expect(requests).toHaveLength(4);
  expect(requests[3].tool_choice).toBe('none');
  expect(result!.status).toContain('Tool call limit');
});

test('weather errors are reported rather than presented as a forecast', async () => {
  globalThis.fetch = async () => new Response('', { status: 429 });
  expect((await getWeather({ city: 'Santa Cruz, CA' }, new AbortController().signal)).error).toContain('HTTP 429');
  globalThis.fetch = async () => Response.json({});
  expect((await getWeather({ city: 'Missing city' }, new AbortController().signal)).error).toContain('No location found');
});

test('Stop keeps partial text and incomplete tool calls are never executed', async () => {
  const controller = new AbortController();
  const { model } = fakeModel([request => {
    emit(request, { content: 'Partial answer' });
    controller.abort();
    throw controller.signal.reason;
  }]);
  let result: MessageUpdate;
  await completeChat(model, input, params, controller.signal, value => result = value, () => {});
  expect(result!.content).toBe('Partial answer');
  expect(result!.status).toBe('Generation stopped.');
  let fetchCount = 0;
  globalThis.fetch = async () => { fetchCount++; throw new Error('Fetch must not run'); };
  const truncated = fakeModel([request => emit(request, { tool_calls: [{ index: 0, id: 'call-1', function: { name: 'get_weather', arguments: '{"city":' } }] }, 'length')]);
  await completeChat(truncated.model, input, { ...params, enableWeather: true }, new AbortController().signal, value => result = value, () => {});
  expect(fetchCount).toBe(0);
  expect(result!.status).toContain('Token limit reached');
});
