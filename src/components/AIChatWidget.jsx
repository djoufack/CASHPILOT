import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Trash2, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAIChat } from '@/hooks/useAIChat';
import { useCredits } from '@/hooks/useCredits';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';

const AIChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('aiChatPosition');
    if (saved) {
      return JSON.parse(saved);
    }
    return { x: 0, y: 0 };
  });

  const { messages, isLoading, sendMessage, clearChat } = useAIChat();
  const { fetchCredits } = useCredits();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const panelDragControls = useDragControls();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleDragEnd = (event, info) => {
    const newPosition = {
      x: position.x + info.offset.x,
      y: position.y + info.offset.y
    };
    setPosition(newPosition);
    localStorage.setItem('aiChatPosition', JSON.stringify(newPosition));
  };

  const handleButtonClick = () => {
    setIsOpen(true);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput('');
    await sendMessage(text);
    // Refresh credits after message sent
    fetchCredits();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            drag
            dragMomentum={false}
            dragElastic={0}
            onDragEnd={handleDragEnd}
            onClick={handleButtonClick}
            initial={{ scale: 0 }}
            animate={{ scale: 1, x: position.x, y: position.y }}
            exit={{ scale: 0 }}
            whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
            className="fixed top-0 left-0 z-50 w-14 h-14 bg-orange-500 hover:bg-orange-600 rounded-full shadow-lg flex items-center justify-center text-white cursor-grab"
          >
            <MessageCircle className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            drag
            dragMomentum={false}
            dragElastic={0}
            dragListener={false}
            dragControls={panelDragControls}
            onDragEnd={handleDragEnd}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1, x: position.x, y: position.y }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-0 left-0 z-50 w-96 h-[500px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div
              onPointerDown={(e) => {
                // Ne pas drag si on clique sur un bouton
                if (e.target.closest('button')) return;
                panelDragControls.start(e);
              }}
              className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 cursor-grab select-none active:cursor-grabbing"
            >
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-orange-400" />
                <span className="text-white font-semibold text-sm">Assistant IA</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={clearChat} className="text-gray-400 hover:text-white p-1" title="Effacer">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 text-sm mt-8">
                  <Bot className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p>Bonjour ! Je suis votre assistant comptable IA.</p>
                  <p className="mt-1">Posez-moi une question sur vos finances.</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role !== 'user' && (
                    <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-orange-400" />
                    </div>
                  )}
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-orange-500 text-white'
                      : msg.isError
                      ? 'bg-red-500/10 text-red-300 border border-red-500/30'
                      : 'bg-gray-800 text-gray-200'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-1">
                      <User className="w-4 h-4 text-gray-300" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-orange-400" />
                  </div>
                  <div className="bg-gray-800 px-3 py-2 rounded-xl">
                    <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-gray-800 border-t border-gray-700">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Posez votre question..."
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 px-3"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIChatWidget;
