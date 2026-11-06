'use client';

import { useEffect, useLayoutEffect, useState, useTransition } from 'react';
import Hero from '@/components/Hero';
import dynamic from 'next/dynamic';
import PurposeSection from '@/components/PurposeSection';
import type { Tab } from '@/components/AppView';

// The quiz and the app views only render after "Browse market" / "Get started", so their code
// (and the storage, validation and query libraries they use) stays out of the landing bundle.
const loading = () => <div role="status" aria-label="Loading" className="p-6 text-sm text-muted">Loading...</div>;
const QuizScreen = dynamic(() => import('@/components/QuizScreen'), { loading });
const AppView = dynamic(() => import('@/components/AppView'), { loading });
import { AnimatePresence, m as motion } from 'framer-motion';
import Footer from '@/components/Footer';
import { EASE } from '@/components/motion/Reveal';

type ViewMode = 'LANDING' | 'INTRO_QUIZ' | 'APP';

const TAB_PARAM: Record<Tab, string> = {
  TRENDING: 'trending',
  PORTFOLIO: 'portfolio',
  ETFS: 'etfs',
  STOCKS: 'stocks',
};
const TAB_FROM_PARAM = Object.fromEntries(
  Object.entries(TAB_PARAM).map(([tab, param]) => [param, tab]),
) as Record<string, Tab>;

/** The landing page has no view parameter, so a plain address is the landing page. */
function viewFromParam(view: string | null): ViewMode {
  if (view === 'app') return 'APP';
  if (view === 'quiz') return 'INTRO_QUIZ';
  return 'LANDING';
}

/** The address that shows this view and tab, keeping any other parameters. */
function addressFor(view: ViewMode, tab: Tab): string {
  const url = new URL(window.location.href);
  if (view === 'LANDING') url.searchParams.delete('view');
  else url.searchParams.set('view', view === 'APP' ? 'app' : 'quiz');
  if (view === 'APP') url.searchParams.set('tab', TAB_PARAM[tab]);
  else url.searchParams.delete('tab');
  return url.pathname + url.search + url.hash;
}

export default function Home() {
  // Server and first client render both show the landing; the URL is read after mount.
  const [viewMode, setViewMode] = useState<ViewMode>('LANDING');
  const [activeTab, setActiveTab] = useState<Tab>('TRENDING');
  const [, startTransition] = useTransition();

  // While the visitor reads the landing page, fetch the Markets code in the background so "Browse market" opens quickly.
  // Skipped on data saver and slow connections.
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '')) return;
    const warm = () => {
      void import('@/components/AppView');
      void import('@/components/TrendingTab');
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const id = idle ? idle(warm) : window.setTimeout(warm, 2000);
    return () => {
      if (!idle) window.clearTimeout(id);
    };
  }, []);

  // Read the address before paint so a deep link does not flash the landing page.
  // Back and forward move between the views and tabs this page pushed.
  useLayoutEffect(() => {
    const readAddress = () => {
      const params = new URLSearchParams(window.location.search);
      setViewMode(viewFromParam(params.get('view')));
      setActiveTab(TAB_FROM_PARAM[params.get('tab') ?? ''] ?? 'TRENDING');
      // The early script in app/layout.tsx hid the landing for a deep link; the view is known now.
      document.documentElement.removeAttribute('data-deeplink');
    };
    readAddress();
    window.addEventListener('popstate', readAddress);
    return () => window.removeEventListener('popstate', readAddress);
  }, []);

  const pushAddress = (view: ViewMode, tab: Tab) => {
    const next = addressFor(view, tab);
    if (next !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.pushState(null, '', next);
    }
  };

  const showView = (view: ViewMode) => {
    setViewMode(view);
    pushAddress(view, activeTab);
  };

  const handleStart = () => {
    showView('INTRO_QUIZ');
  };

  const handleViewMarket = () => {
    showView('APP');
  };

  const handleQuizDone = (destination: 'PORTFOLIO' | 'APP') => {
    if (destination === 'PORTFOLIO') {
      setActiveTab('PORTFOLIO');
      setViewMode('APP');
      pushAddress('APP', 'PORTFOLIO');
    } else {
      showView('APP');
    }
  };

  const switchTab = (tab: Tab) => {
    startTransition(() => setActiveTab(tab));
    pushAddress('APP', tab);
  };

  return (
    <main className="min-h-dvh bg-canvas overflow-hidden relative">
      <AnimatePresence mode="wait" initial={false}>
        {viewMode === 'LANDING' ? (
          <motion.div
            key="landing"
            id="top"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="overflow-y-auto h-dvh custom-scrollbar"
          >
            <Hero onStart={handleStart} onViewMarket={handleViewMarket} />
            <PurposeSection />
            <Footer />
          </motion.div>
        ) : viewMode === 'INTRO_QUIZ' ? (
          <motion.div
            key="intro-quiz"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="min-h-dvh flex items-center justify-center overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
              className="w-full flex items-center justify-center"
            >
              <QuizScreen onDone={handleQuizDone} />
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="h-dvh flex flex-col bg-canvas p-2 gap-2"
          >
            <AppView
              activeTab={activeTab}
              onTabChange={switchTab}
              onBackToLanding={() => showView('LANDING')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
