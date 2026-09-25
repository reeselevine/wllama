import { useState } from 'react';
import { useMessages } from '../utils/messages.context';
import { useWllama } from '../utils/wllama.context';
import { Message, Screen } from '../utils/types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStop } from '@fortawesome/free-solid-svg-icons';
import ScreenWrapper from './ScreenWrapper';
import { useIntervalWhen } from '../utils/use-interval-when';
import { MarkdownMessage } from './MarkdownMessage';

export default function ChatScreen() {
  const [input, setInput] = useState('');
  const {
    currentConvId,
    isGenerating,
    createCompletion,
    navigateTo,
    loadedModel,
    timings,
    resetTimings,
    stopCompletion,
  } = useWllama();
  const {
    getConversationById,
    addMessageToConversation,
    editMessageInConversation,
    newConversation,
  } = useMessages();

  useIntervalWhen(chatScrollToBottom, 500, isGenerating, true);

  const currConv = getConversationById(currentConvId);

  const onSubmit = async () => {
    if (isGenerating) return;

    // copy input and create messages
    const currHistory = currConv?.messages ?? [];
    const userInput = input;
    setInput('');
    const userMsg: Message = {
      id: Date.now(),
      content: userInput,
      role: 'user',
    };
    const assistantMsg: Message = {
      id: Date.now() + 1,
      content: '',
      role: 'assistant',
    };

    // process conversation
    let convId = currConv?.id;
    if (!convId) {
      // need to create new conversation
      const newConv = newConversation(userMsg);
      convId = newConv.id;
      navigateTo(Screen.CHAT, convId);
      addMessageToConversation(convId, assistantMsg);
    } else {
      // append to current conversation
      addMessageToConversation(convId, userMsg);
      addMessageToConversation(convId, assistantMsg);
    }

    // generate response
    if (!loadedModel) {
      throw new Error('loadedModel is null');
    }
    try {
      await createCompletion([...currHistory, userMsg], (newContent) => {
        editMessageInConversation(convId, assistantMsg.id, newContent);
      });
    } catch (error) {
      alert(`Generation failed: ${(error as Error).message}`);
    }
  };

  return (
    <ScreenWrapper fitScreen>
      <div className="chat-messages grow overflow-auto" id="chat-history">
        <div className="h-10" />

        {currConv ? (
          <>
            {currConv.messages.map((msg) =>
              msg.role === 'user' ? (
                <div className="chat chat-end" key={msg.id}>
                  <div className="chat-bubble">
                    {msg.content.length > 0 && (
                      <MarkdownMessage content={msg.content} />
                    )}
                  </div>
                </div>
              ) : (
                <div className="chat chat-start" key={msg.id}>
                  <div className="chat-bubble bg-base-100 text-base-content">
                    {msg.content.length === 0 && isGenerating && (
                      <span className="loading loading-dots"></span>
                    )}
                    {msg.content.length > 0 && (
                      <MarkdownMessage content={msg.content} />
                    )}
                  </div>
                </div>
              )
            )}
          </>
        ) : (
          <div className="pt-24 text-center text-xl">Ask me something 👋</div>
        )}
      </div>
      <div className="flex flex-col input-message py-4">
        {isGenerating && (
          <div className="text-center">
            <button
              className="btn btn-outline btn-sm mb-4"
              onClick={stopCompletion}
            >
              <FontAwesomeIcon icon={faStop} />
              Stop generation
            </button>
          </div>
        )}

        {loadedModel && (
          <>
            <textarea
              className="textarea textarea-bordered w-full"
              placeholder="Your message..."
              disabled={isGenerating}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.keyCode == 13 && e.shiftKey == false) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
            />
            <div className="mt-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <div>
                    Prefill: {(timings?.prompt_per_second ?? 0).toFixed(1)}{' '}
                    tok/s, Decode:{' '}
                    {(timings?.predicted_per_second ?? 0).toFixed(1)} tok/s
                  </div>
                </div>
                <button
                  className="btn btn-xs btn-outline"
                  disabled={isGenerating}
                  onClick={resetTimings}
                >
                  Reset
                </button>
              </div>
            </div>
          </>
        )}

        {!loadedModel && <WarnNoModel />}

        <small className="text-center mx-auto opacity-70 pt-2">
          wllama may generate inaccurate information. Use with your own risk.
        </small>
      </div>
    </ScreenWrapper>
  );
}

function WarnNoModel() {
  const { navigateTo } = useWllama();

  return (
    <div role="alert" className="alert">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6 shrink-0 stroke-current"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span>Model is not loaded</span>
      <div>
        <button
          className="btn btn-sm btn-primary"
          onClick={() => navigateTo(Screen.MODEL)}
        >
          Select model
        </button>
      </div>
    </div>
  );
}

const chatScrollToBottom = () => {
  const elem = document.getElementById('chat-history');
  elem?.scrollTo({
    top: elem.scrollHeight,
    behavior: 'smooth',
  });
};
