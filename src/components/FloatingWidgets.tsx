'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle, ArrowUp, PhoneCall, HelpCircle } from 'lucide-react';
import { useStore } from '@/context/StoreContext';

export default function FloatingWidgets() {
  const { currentUser, setIsShortageModalOpen, storeSettings } = useStore();
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', checkScroll);
    return () => window.removeEventListener('scroll', checkScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasAssignedRep = !!currentUser && !!currentUser.assigned_sales_rep_id;

  const rawPhone = hasAssignedRep
    ? (currentUser!.assigned_sales_rep_phone || storeSettings?.whatsapp_number || '201012345678')
    : (storeSettings?.whatsapp_number || '201012345678');
  const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

  const message = hasAssignedRep
    ? `السلام عليكم، أتواصل معك بصفتك مندوبي المعتمد (${currentUser!.assigned_sales_rep_name}) في متجر MH EL MAHDY.`
    : (storeSettings?.whatsapp_message || 'السلام عليكم، أتواصل معك من متجر MH EL MAHDY.');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  const buttonTitle = hasAssignedRep
    ? `تواصل مباشر عبر واتساب مع مندوبك (${currentUser!.assigned_sales_rep_name})`
    : 'تواصل معنا عبر واتساب';
  const buttonLabel = hasAssignedRep ? 'واتساب مندوبك' : 'تواصل معنا';

  return (
    <>
      {/* 1. WhatsApp Floating Action Button on Right Edge */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed right-4 bottom-24 md:bottom-20 z-40 bg-[#25D366] hover:bg-[#20bd5a] text-white p-3 rounded-full shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center group active:scale-95"
        title={buttonTitle}
      >
        <MessageCircle className="w-5 h-5 md:w-6 md:h-6 fill-current" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out text-xs font-bold px-0 group-hover:px-2">
          {buttonLabel}
        </span>
      </a>

      {/* 2. Customer Chat Bubble on Bottom Left (Matching yasbas Image 1 & 2) */}
      <button
        type="button"
        onClick={() => setIsShortageModalOpen(true)}
        className="fixed left-4 bottom-24 md:bottom-6 z-40 bg-[#0099DD] hover:bg-[#007BB3] text-white p-3 rounded-full shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center group active:scale-95"
        title="طلب مساعدة أو تسجيل نواقص"
      >
        <HelpCircle className="w-5 h-5 md:w-6 md:h-6" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out text-xs font-bold px-0 group-hover:px-2">
          تسجيل نواقص الكتالوج
        </span>
      </button>

      {/* 3. Scroll to Top Button */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed left-4 bottom-36 md:bottom-20 z-40 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 p-2.5 rounded-full shadow-md transition-all duration-200 active:scale-95"
          title="الرجوع للأعلى"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}
    </>
  );
}
