import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../App';

interface Props {
  messages: ChatMessage[];
  onSend: (prompt: string) => void;
  isGenerating: boolean;
}

function AssistantBubble({ msg }: { msg: Extract<ChatMessage, { role: 'assistant' }> }) {
  if (msg.status === 'loading') {
    return (
      <div className="chat chat-start">
        <div className="chat-bubble chat-bubble-neutral flex items-center gap-2 text-sm">
          <span className="loading loading-dots loading-xs" />
          <span className="text-base-content/60">Generating code…</span>
        </div>
      </div>
    );
  }
  if (msg.status === 'error') {
    return (
      <div className="chat chat-start">
        <div className="chat-bubble chat-bubble-error text-sm">
          ✗ Could not parse code output
        </div>
      </div>
    );
  }
  return (
    <div className="chat chat-start">
      <div className="chat-bubble chat-bubble-success text-sm">
        ✓ Code updated
      </div>
    </div>
  );
}

export default function ChatPanel({ messages, onSend, isGenerating }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;
    setInput('');
    onSend(trimmed);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-base-content/40 text-sm gap-2">
            <span className="text-3xl">💬</span>
            <p>Describe something to render.</p>
            <p className="text-xs">Try: "a spinning rainbow cube" or "starfield animation"</p>
          </div>
        )}
        {messages.map((msg, i) =>
          msg.role === 'user' ? (
            <div key={i} className="chat chat-end">
              <div className="chat-bubble chat-bubble-primary text-sm">
                {msg.content}
              </div>
            </div>
          ) : (
            <AssistantBubble key={i} msg={msg} />
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-base-300 p-3 flex gap-2">
        <textarea
          className="textarea textarea-bordered flex-1 resize-none text-sm min-h-[42px] max-h-32 leading-snug"
          placeholder="Describe what to render…"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={isGenerating}
        />
        <button
          className="btn btn-primary btn-sm self-end"
          onClick={submit}
          disabled={isGenerating || !input.trim()}
        >
          {isGenerating ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            '▶'
          )}
        </button>
      </div>
    </div>
  );
}
