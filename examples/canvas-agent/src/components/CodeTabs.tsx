import { useState } from 'react';
import type { CodeState } from '../App';

type Tab = 'html' | 'css' | 'js';

interface Props {
  code: CodeState;
}

export default function CodeTabs({ code }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('html');

  const tabs: Tab[] = ['html', 'css', 'js'];
  const content = code[activeTab];

  return (
    <div className="flex flex-col border-t border-base-300 h-[38%] min-h-0">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-base-300">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`px-4 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-primary text-primary'
                : 'text-base-content/50 hover:text-base-content/80'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Code display */}
      <div className="flex-1 overflow-auto bg-base-200">
        <pre className="p-3 text-xs font-mono text-base-content/80 leading-relaxed">
          {content || (
            <span className="text-base-content/30 italic">no code yet</span>
          )}
        </pre>
      </div>
    </div>
  );
}
