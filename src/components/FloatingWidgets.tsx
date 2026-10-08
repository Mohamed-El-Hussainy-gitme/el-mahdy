'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle, ArrowUp, PhoneCall, HelpCircle } from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { buildWhatsAppUrl } from '@/utils/phoneUtils';

export default function FloatingWidgets() {
  const { currentUser, setIsShortageModalOpen, storeSettings, staffMembers } = useStore();
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

  const assignedRep = React.useMemo(() => {
    if (!currentUser?.assigned_sales_rep_id) return null;
    return staffMembers.find((s) => s.id === currentUser.assigned_sales_rep_id) || null;
  }, [currentUser?.assigned_sales_rep_id, staffMembers]);

  const hasAssignedRep = !!currentUser && !!currentUser.assigned_sales_rep_id;
  const repPhone = currentUser?.assigned_sales_rep_phone || assignedRep?.phone;
  const repName = currentUser?.assigned_sales_rep_name || assignedRep?.full_name || 'مندوبك المعتمد';

  const rawPhone = hasAssignedRep
    ? (repPhone || storeSettings?.whatsapp_number || '201012345678')
    : (storeSettings?.whatsapp_number || '201012345678');

  const message = hasAssignedRep
    ? `السلام عليكم، أتواصل معك بصفتك مندوبي المعتمد (${repName}) في متجر MH EL MAHDY.`
    : (storeSettings?.whatsapp_message || 'السلام عليكم، أتواصل معك من متجر MH EL MAHDY.');
  const whatsappUrl = buildWhatsAppUrl(rawPhone, message);

  const buttonTitle = hasAssignedRep
    ? `تواصل مباشر عبر واتساب مع مندوبك (${repName})`
    : 'تواصل معنا عبر واتساب';
  const buttonLabel = hasAssignedRep ? `واتساب ${repName.split(' ')[0]}` : 'تواصل معنا';

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
