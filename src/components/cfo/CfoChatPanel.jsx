import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Trash2, Loader2, Bot, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCfoChat } from '@/hooks/useCfoChat';

const CfoChatPanel = () => {
  const { t } = useTranslation();
  const { messages, loading, suggestions, sendMessage, clearHistory } = useCfoChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    if (loading) return;
    sendMessage(suggestion);
  };

  const defaultSuggestions = [
    t('cfo.suggestions.health', 'Quelle est ma sante financiere ?'),
    t('cfo.suggestions.risk', 'Quels clients sont a risque ?'),
    t('cfo.suggestions.forecast', 'Previsions de tresorerie a 30 jours ?'),
  ];

  const displaySuggestions = suggestions.length > 0 ? suggestions : defaultSuggestions;

  return (
    <div className="flex flex-col h-full bg-[#0f1528]/80 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#141c33]/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              {t('cfo.chat.title', 'Agent IA CFO (Directeur Financier)')}
            </h3>
            <p className="text-xs text-gray-400">{t('cfo.chat.subtitle', 'Votre directeur financier virtuel')}</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistory}
            className="text-gray-400 hover:text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-blue-400" />
            </div>
            <h4 className="text-white font-medium mb-2">{t('cfo.chat.welcome', 'Bienvenue')}</h4>
            <p className="text-gray-400 text-sm max-w-xs mb-6">
              {t('cfo.chat.welcomeMessage', 'Posez vos questions sur la sante financiere de votre entreprise.')}
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {displaySuggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(suggestion)}
                  disabled={loading}
                  className="text-left px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mt-1">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600/30 text-white border border-blue-500/30'
                  : msg.isError
                    ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                    : 'bg-white/5 text-gray-200 border border-white/10'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              {msg.timestamp && (
                <div className="text-xs text-gray-500 mt-2">
                  {new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gray-600/50 flex items-center justify-center mt-1">
                <User className="w-3.5 h-3.5 text-gray-300" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mt-1">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-white/5 rounded-xl px-4 py-3 border border-white/10">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('cfo.chat.thinking', 'Analyse en cours...')}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions after messages */}
      {messages.length > 0 && displaySuggestions.length > 0 && !loading && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {displaySuggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => handleSuggestionClick(suggestion)}
              className="text-xs px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/10 bg-[#141c33]/40">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('cfo.chat.placeholder', 'Posez une question a votre CFO...')}
            rows={1}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-3 self-end"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CfoChatPanel;
