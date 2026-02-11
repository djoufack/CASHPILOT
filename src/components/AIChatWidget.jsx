import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Trash2, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAIChat } from '@/hooks/useAIChat';
import { useCredits } from '@/hooks/useCredits';
import { motion, AnimatePresence } from 'framer-motion';

const AIChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [position, setPosition] = useState(() => {
    // Charger la position depuis localStorage ou utiliser la position par défaut
    const saved = localStorage.getItem('aiChatPosition');
    return saved ? JSON.parse(saved) : { x: window.innerWidth - 420, y: window.innerHeight - 530 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, hasMoved: false });

  const { messages, isLoading, sendMessage, clearChat } = useAIChat();
  const { fetchCredits } = useCredits();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Sauvegarder la position dans localStorage
  useEffect(() => {
    localStorage.setItem('aiChatPosition', JSON.stringify(position));
  }, [position]);

  // Gestion du drag & drop pour le bouton flottant
  const handleButtonDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y
    };
  };

  // Gestion du drag & drop pour le header du panneau
  const handleHeaderDrag = (e) => {
    // Ne pas commencer le drag si on clique sur un bouton du header
    if (e.target.closest('button')) return;

    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;

      const newX = dragRef.current.initialX + deltaX;
      const newY = dragRef.current.initialY + deltaY;

      // Limiter la position pour garder le widget visible
      const maxX = window.innerWidth - (isOpen ? 384 : 56); // 384px = w-96, 56px = bouton
      const maxY = window.innerHeight - (isOpen ? 500 : 56);

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });

      // Marquer qu'on a bougé
      dragRef.current.hasMoved = true;
    };

    const handleMouseUp = (e) => {
      const wasDragging = isDragging;
      setIsDragging(false);

      // Si c'était le bouton et qu'on n'a pas bougé, ouvrir le panneau
      if (wasDragging && !isOpen && !dragRef.current.hasMoved) {
        setIsOpen(true);
      }

      dragRef.current.hasMoved = false;
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isOpen]);

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
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onMouseDown={handleButtonDrag}
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            className="fixed z-50 w-14 h-14 bg-orange-500 hover:bg-orange-600 rounded-full shadow-lg flex items-center justify-center text-white transition-colors"
          >
            <MessageCircle className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`
            }}
            className="fixed z-50 w-96 h-[500px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div
              onMouseDown={handleHeaderDrag}
              className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 cursor-move select-none"
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
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
