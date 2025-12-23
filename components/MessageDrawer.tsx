'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface MessageDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'error' | 'success' | 'info';
}

export default function MessageDrawer({ isOpen, onClose, title, message, type = 'info' }: MessageDrawerProps) {
  const getColor = () => {
    switch (type) {
      case 'error': return 'text-rose-400';
      case 'success': return 'text-emerald-400';
      default: return 'text-blue-400';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'error': return <AlertTriangle className={`w-6 h-6 ${getColor()}`} />;
      case 'success': return <CheckCircle className={`w-6 h-6 ${getColor()}`} />;
      default: return <Info className={`w-6 h-6 ${getColor()}`} />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            key="drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 max-h-[50vh] bg-[#0a0a0a] border-t border-white/10 rounded-t-3xl z-50 overflow-hidden shadow-2xl glass-panel pb-12"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5 backdrop-blur-md">
              <div className="flex items-center gap-4">
                {getIcon()}
                <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 flex flex-col items-center text-center">
              <p className="text-neutral-300 text-lg mb-8 max-w-md">{message}</p>

              <button
                onClick={onClose}
                className="bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-8 rounded-full transition-all duration-300 border border-white/10"
              >
                Go Back
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
