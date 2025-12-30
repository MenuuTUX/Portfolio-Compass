'use client';

import { useState, useRef } from 'react';
import { Upload, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { decodePortfolioData } from '@/lib/steganography';
import { motion, AnimatePresence } from 'framer-motion';
import { PortfolioItem } from '@/types';

interface ImportPortfolioButtonProps {
    onImport: (portfolio: PortfolioItem[]) => void;
}

export default function ImportPortfolioButton({ onImport }: ImportPortfolioButtonProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setStatus('idle');
        setErrorMessage('');

        try {
            const data = await decodePortfolioData(file);

            if (data && data.type === 'PORTFOLIO_COMPASS_V1' && Array.isArray(data.portfolio)) {
                onImport(data.portfolio);
                setStatus('success');
                setTimeout(() => setStatus('idle'), 3000);
            } else {
                throw new Error("Invalid portfolio data structure found.");
            }
        } catch (error: any) {
            console.error("Import failed:", error);
            setStatus('error');
            setErrorMessage(error.message || "Failed to decode portfolio data.");
            setTimeout(() => setStatus('idle'), 5000);
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="relative">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png,image/jpeg" // Accept JPEG too just in case, though it might fail
                className="hidden"
            />

            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="group relative flex items-center justify-center p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Import Portfolio from Image"
            >
                {isProcessing ? (
                    <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                ) : status === 'success' ? (
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                ) : status === 'error' ? (
                    <AlertCircle className="w-6 h-6 text-rose-500" />
                ) : (
                    <Upload className="w-6 h-6 text-neutral-400 group-hover:text-emerald-400 transition-colors" />
                )}
            </button>

            {/* Error/Status Tooltip */}
            <AnimatePresence>
                {(status === 'error' || status === 'success') && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className={`absolute right-0 top-full mt-3 w-64 p-3 rounded-lg border backdrop-blur-md shadow-xl z-50 text-xs font-medium ${
                            status === 'error'
                                ? 'bg-rose-950/90 border-rose-500/30 text-rose-200'
                                : 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
                        }`}
                    >
                        {status === 'error' ? errorMessage : "Portfolio imported successfully!"}
                        <div className={`absolute top-0 right-4 w-3 h-3 -mt-1.5 rotate-45 border-t border-l ${
                             status === 'error'
                             ? 'bg-rose-950 border-rose-500/30'
                             : 'bg-emerald-950 border-emerald-500/30'
                        }`} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
