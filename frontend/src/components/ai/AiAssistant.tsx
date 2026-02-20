import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useServerStore } from '@/stores/serverStore';
import api from '@/lib/api';
import { Send, Sparkles, FileText, BarChart3, Compass, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function AiAssistant() {
  const { t } = useTranslation();
  const { activeServer, activeChannel } = useServerStore();
  const [messages, setMessages] = useState<AiMessage[]>([
    { role: 'assistant', content: t('ai.greeting') },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;
    const userMsg: AiMessage = { role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await api.aiChat(content, messages);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.response || res.message || 'I encountered an error processing your request.' }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    }
    setIsLoading(false);
  };

  const handleSummarize = async () => {
    if (!activeChannel) return;
    setMessages((prev) => [...prev, { role: 'user', content: `Summarize the recent discussion in #${activeChannel.name}` }]);
    setIsLoading(true);
    try {
      const res = await api.summarizeChannel(activeChannel.id, 50);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.summary || 'No recent messages to summarize.' }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Failed to summarize. Make sure the channel has messages.' }]);
    }
    setIsLoading(false);
  };

  return (
    <div className="w-60 bg-[#0D1117] border-l border-rally-border flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-rally-border flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
          <Bot className="w-4 h-4 text-rally-purple" />
        </div>
        <div>
          <h3 className="text-xs font-display font-bold uppercase tracking-wider text-rally-purple">{t('ai.rallyAi')}</h3>
          <p className="text-[10px] text-rally-text-muted">{t('ai.poweredBy')}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-2 border-b border-rally-border flex flex-wrap gap-1">
        <button onClick={handleSummarize} disabled={!activeChannel || isLoading} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-40">
          <FileText className="w-3 h-3" />{t('ai.summarize')}
        </button>
        <button onClick={() => sendMessage('Generate an activity report for this server')} disabled={isLoading} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-rally-blue/10 text-rally-blue hover:bg-rally-blue/20 transition-colors disabled:opacity-40">
          <BarChart3 className="w-3 h-3" />{t('ai.report')}
        </button>
        <button onClick={() => sendMessage('Suggest channels based on recent conversations')} disabled={isLoading} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-rally-green/10 text-rally-green hover:bg-rally-green/20 transition-colors disabled:opacity-40">
          <Compass className="w-3 h-3" />{t('ai.suggest')}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {messages.map((msg, i) => (
          <div key={i} className={cn('text-xs leading-relaxed', msg.role === 'user' ? 'text-right' : '')}>
            <div className={cn(
              'inline-block px-2.5 py-1.5 rounded-lg max-w-[95%] text-left',
              msg.role === 'user'
                ? 'bg-rally-blue/10 text-rally-text border border-rally-blue/20'
                : 'bg-purple-500/10 text-rally-text border border-purple-500/20'
            )}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="text-xs">
            <div className="inline-block px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <span className="flex gap-1">
                <span className="w-1 h-1 bg-rally-purple rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-rally-purple rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-rally-purple rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-rally-border">
        <div className="flex gap-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage(input))}
            placeholder={t('ai.askPlaceholder')}
            className="flex-1 bg-white/5 border border-rally-border rounded px-2 py-1.5 text-xs text-rally-text placeholder-rally-text-muted outline-none focus:border-rally-purple/50"
          />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} className="p-1.5 rounded bg-rally-purple/20 text-rally-purple hover:bg-rally-purple/30 transition-colors disabled:opacity-40">
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
