'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  MapPin,
  Phone,
  Clock,
  ShieldCheck,
  Truck,
  MessageCircle,
  Layers,
  Heart,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';

export default function Footer() {
  const { storeSettings, setIsShortageModalOpen } = useStore();

  const currentYear = new Date().getFullYear();

  const whatsappCleanNumber = storeSettings.whatsapp_number
    ? storeSettings.whatsapp_number.replace(/[^0-9]/g, '')
    : '201012345678';

  const whatsappUrl = `https://wa.me/${whatsappCleanNumber}?text=${encodeURIComponent(
    storeSettings.whatsapp_message || 'السلام عليكم، أرغب في الاستفسار عن طلب توريد بالجملة من متجر MH EL MAHDY'
  )}`;

  return (
    <footer className="bg-[#0F172A] text-white border-t border-slate-800 mt-16 text-xs">
      {/* 1. Operational Announcement Bar if present */}
      {storeSettings.announcement && (
        <div className="bg-[#0099DD]/10 border-b border-[#0099DD]/20 py-2.5 px-4 text-center">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-[11px] text-sky-200">
            <span className="w-2 h-2 rounded-full bg-[#0099DD] animate-ping shrink-0" />
            <span className="font-bold">{storeSettings.announcement}</span>
          </div>
        </div>
      )}

      {/* 2. Main 4-Column Grid */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          
          {/* Col 1: Brand & Tagline & Socials */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-[#0099DD] border border-white/20 shadow-sm">
                <Image
                  src="/logo.png"
                  alt={storeSettings.store_name || 'MH EL MAHDY Logo'}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-base tracking-wide text-white">
                  {storeSettings.store_name || 'MH EL MAHDY'}
                </span>
                <span className="text-[10px] text-[#38bdf8] font-bold -mt-0.5">
                  منظومة التوزيع المعتمدة B2B
                </span>
              </div>
            </div>

            <p className="text-slate-400 leading-relaxed text-[11px]">
              {storeSettings.tagline ||
                'المنظومة المعتمدة لتوزيع إكسسوارات الهواتف وحماية الشاشات والملحقات الأصلية لقطاع الأعمال والشركات.'}
            </p>

            {/* Social Media Links */}
            <div className="pt-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                تابعنا على منصات التواصل
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {storeSettings.facebook_url && (
                  <a
                    href={storeSettings.facebook_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-[#1877F2] text-slate-300 hover:text-white flex items-center justify-center transition"
                    title="Facebook"
                  >
                    <span className="font-black text-xs">f</span>
                  </a>
                )}
                {storeSettings.instagram_url && (
                  <a
                    href={storeSettings.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-[#E4405F] text-slate-300 hover:text-white flex items-center justify-center transition"
                    title="Instagram"
                  >
                    <span className="font-black text-xs">IG</span>
                  </a>
                )}
                {storeSettings.telegram_url && (
                  <a
                    href={storeSettings.telegram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-[#229ED9] text-slate-300 hover:text-white flex items-center justify-center transition"
                    title="Telegram"
                  >
                    <span className="font-black text-xs">TG</span>
                  </a>
                )}
                {storeSettings.tiktok_url && (
                  <a
                    href={storeSettings.tiktok_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-black text-slate-300 hover:text-white flex items-center justify-center transition border border-slate-700"
                    title="TikTok"
                  >
                    <span className="font-black text-[10px]">TT</span>
                  </a>
                )}
                {storeSettings.youtube_url && (
                  <a
                    href={storeSettings.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-[#FF0000] text-slate-300 hover:text-white flex items-center justify-center transition"
                    title="YouTube"
                  >
                    <span className="font-black text-[10px]">YT</span>
                  </a>
                )}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-[#25D366] text-slate-300 hover:text-white flex items-center justify-center transition"
                  title="WhatsApp"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                </a>
              </div>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-slate-200 text-sm border-b border-slate-800 pb-2">
              روابط المتجر السريعة
            </h4>
            <ul className="space-y-2 text-slate-400 text-[11px]">
              <li>
                <Link href="/" className="hover:text-[#38bdf8] transition flex items-center gap-1.5">
                  <span className="text-slate-600">›</span>
                  الصفحة الرئيسية
                </Link>
              </li>
              <li>
                <Link href="/catalogs" className="hover:text-[#38bdf8] transition flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#0099DD]" />
                  كتالوجات المنتجات الكاملة
                </Link>
              </li>
              <li>
                <Link href="/favorites" className="hover:text-[#38bdf8] transition flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  قائمة مفضلاتي (Wishlist)
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setIsShortageModalOpen(true)}
                  className="hover:text-[#38bdf8] transition flex items-center gap-1.5 text-right"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                  طلب تسجيل نواقص موديلات
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: B2B Operational Standards */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-slate-200 text-sm border-b border-slate-800 pb-2">
              ضمانات التوريد B2B
            </h4>
            <ul className="space-y-2 text-slate-400 text-[11px]">
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0099DD] shrink-0 mt-0.5" />
                <span>مراجعة وتدقيق يدوي لكل بوليصة وفاتورة من مندوب الحساب.</span>
              </li>
              <li className="flex items-start gap-2">
                <Truck className="w-4 h-4 text-[#0099DD] shrink-0 mt-0.5" />
                <span>شحن وتوصيل لجميع محافظات مصر مع بوليصة تتبع معتمدة.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>الحد الأدنى للطلب (MOQ): {storeSettings.default_moq || 5} قطع للطلب.</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Warehouse & Contact Information */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-slate-200 text-sm border-b border-slate-800 pb-2">
              العنوان ومواعيد العمل
            </h4>
            <div className="space-y-2.5 text-slate-400 text-[11px]">
              {storeSettings.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#0099DD] shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{storeSettings.address}</span>
                </div>
              )}

              {storeSettings.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <a
                    href={`tel:${storeSettings.phone}`}
                    dir="ltr"
                    className="hover:text-white font-mono transition text-right"
                  >
                    {storeSettings.phone}
                  </a>
                </div>
              )}

              {storeSettings.working_hours && (
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{storeSettings.working_hours}</span>
                </div>
              )}

              <div className="pt-2">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition text-xs shadow-md"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  <span>محادثة فورية عبر واتساب</span>
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 3. Bottom Copyright Bar */}
      <div className="border-t border-slate-800/80 py-4 px-4 bg-[#0A0F1D]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400 text-center sm:text-right">
          <div>
            جميع الحقوق محفوظة © {currentYear}{' '}
            <span className="font-bold text-slate-200">{storeSettings.store_name || 'MH EL MAHDY'}</span>{' '}
            - منظومة تجارة الجملة والتوريد
          </div>
          <div className="flex items-center gap-4 text-slate-400 text-[10px]">
            <span>نظام تجاري معتمد B2B</span>
            <span>•</span>
            <span>بنية تحتية آمنة ومحمية</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
