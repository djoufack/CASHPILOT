import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, X, Zap, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

/* ------------------------------------------------------------------ */
/*  Quick-action chips                                                 */
/* ------------------------------------------------------------------ */
const QUICK_ACTIONS = [
  { label: 'Solde congés', message: 'Quel est mon solde de congés ?' },
  { label: 'Demander un congé', message: 'Je souhaite demander un congé.' },
  { label: 'Mon bulletin', message: 'Peux-tu me montrer mon dernier bulletin de paie ?' },
];

/* ------------------------------------------------------------------ */
/*  Chat bubble                                                        */
/* ------------------------------------------------------------------ */
function ChatBubble({ role, content }) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-orange-400/20 text-orange-100 rounded-br-md'
            : 'bg-white/5 border border-white/10 text-gray-200 rounded-bl-md'
        }`}
      >
        {content}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Typing indicator                                                   */
/* ------------------------------------------------------------------ */
function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main overlay component                                             */
/* ------------------------------------------------------------------ */
function HrChatbotOverlay() {
  const { user: _user } = useAuth();
  const { activeCompanyId } = useCompanyScope();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Bonjour ! Je suis votre assistant RH. Comment puis-je vous aider ?',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  /* Auto-scroll to bottom */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  /* Focus input on open */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  /* ---------------------------------------------------------------- */
  /*  Send message                                                     */
  /* ---------------------------------------------------------------- */
  const sendMessage = useCallback(
    async (text) => {
      const trimmed = (text ?? input).trim();
      if (!trimmed || sending) return;

      const userMsg = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setSending(true);

      try {
        const { data, error } = await supabase.functions.invoke('ai-hr-chatbot', {
          body: {
            action: 'chat',
            message: trimmed,
            company_id: activeCompanyId,
          },
        });

        if (error) throw error;

        const reply =
          data?.reply ??
          data?.message ??
          data?.response ??
          data?.answer ??
          "Désolé, je n'ai pas pu traiter votre demande.";

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: reply,
          },
        ]);
      } catch (err) {
        console.error('HrChatbot error:', err);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `Une erreur est survenue : ${err.message || 'erreur inconnue'}. Veuillez réessayer.`,
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [input, sending, activeCompanyId]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <>
      {/* ---- Floating toggle button ---- */}
      <button
        onClick={() => setOpen((p) => !p)}
        aria-label={open ? 'Fermer le chatbot RH' : 'Ouvrir le chatbot RH'}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center
                    shadow-lg shadow-orange-400/20 transition-all duration-300
                    ${
                      open
                        ? 'bg-white/10 border border-white/20 rotate-0'
                        : 'bg-orange-400 hover:bg-orange-500 rotate-0'
                    }`}
      >
        {open ? <X className="w-5 h-5 text-gray-300" /> : <Bot className="w-6 h-6 text-white" />}
      </button>

      {/* ---- Chat panel ---- */}
      <div
        className={`fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)]
                    flex flex-col rounded-2xl overflow-hidden
                    bg-[#0f1528]/95 border border-white/10 backdrop-blur-xl
                    shadow-2xl shadow-black/40
                    transition-all duration-300 origin-bottom-right
                    ${
                      open
                        ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                        : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
                    }`}
        style={{ height: '520px' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-[#141c33]/80">
          <div className="w-8 h-8 rounded-full bg-orange-400/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white text-sm font-semibold">Assistant RH</h3>
            <p className="text-[11px] text-gray-500">Propulsé par l'IA CashPilot</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0 scrollbar-thin scrollbar-thumb-white/10">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {sending && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick actions */}
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {QUICK_ACTIONS.map((qa) => (
            <button
              key={qa.label}
              onClick={() => sendMessage(qa.message)}
              disabled={sending}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium
                         bg-white/5 border border-white/10 text-gray-400
                         hover:bg-orange-400/10 hover:text-orange-400 hover:border-orange-400/30
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              <Zap className="w-3 h-3" />
              {qa.label}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <div className="px-4 pb-4 pt-2">
          <div
            className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2
                          focus-within:border-orange-400/40 transition-colors"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question..."
              disabled={sending}
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-500
                         outline-none disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || sending}
              className="p-2 rounded-lg bg-orange-400 hover:bg-orange-500 text-white
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Envoyer"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export { HrChatbotOverlay };
