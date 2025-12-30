'use client';

import { useState } from 'react';
import MessageDrawer from './MessageDrawer';

export function useMessageDrawer() {
  const [drawerState, setDrawerState] = useState<{ isOpen: boolean; title: string; message: string; type: 'error' | 'success' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showMessage = ({ title, message, type = 'info' }: { title: string; message: string; type?: 'error' | 'success' | 'info' }) => {
    setDrawerState({ isOpen: true, title, message, type });
  };

  const closeMessage = () => {
    setDrawerState(prev => ({ ...prev, isOpen: false }));
  };

  const DrawerComponent = () => (
    <MessageDrawer
      isOpen={drawerState.isOpen}
      onClose={closeMessage}
      title={drawerState.title}
      message={drawerState.message}
      type={drawerState.type}
    />
  );

  return {
    showMessage,
    closeMessage,
    DrawerComponent
  };
}

export { default as MessageDrawer } from './MessageDrawer';
