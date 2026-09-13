'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already running in standalone mode (installed PWA)
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    ) {
      setIsStandalone(true);
      return;
    }

    // Check if previously dismissed in this session
    const dismissed = sessionStorage.getItem('mh_pwa_dismissed');
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('mh_pwa_dismissed', 'true');
  };

  if (isStandalone || !isVisible) {
    return null;
  }

  return (
    <aside
      aria-label="تثبيت التطبيق"
      className="md:hidden bg-gradient-to-r from-slate-900 to-[#0F172A] text-white p-3 border-b border-[#0099DD]/30 shadow-md flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-[#0099DD] shrink-0 border border-white/20 shadow-sm flex items-center justify-center">
          <Image src="/logo.png" alt="App Icon" width={40} height={40} className="object-cover" />
        </div>
        <div className="text-right min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs font-black text-white truncate">تطبيق MH EL MAHDY</h4>
            <span className="bg-[#0099DD] text-white text-[9px] font-bold px-1.5 py-0.2 rounded">B2B</span>
          </div>
          <p className="text-[10px] text-slate-300 truncate">تصفح أسرع وإشعارات وتجربة تطبيق مستقل</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleInstallClick}
          className="flex items-center gap-1 bg-[#0099DD] hover:bg-[#007BB3] text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow transition active:scale-95 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>تثبيت</span>
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-slate-400 hover:text-white p-1 rounded-md transition"
          title="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
