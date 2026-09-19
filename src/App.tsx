/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback, useRef, useReducer } from 'react';
import { createPortal } from 'react-dom';
import { getExamCategory } from './exam-utils';
import { 
  Landmark, 
  Trophy, 
  Search, 
  RotateCcw, 
  LogOut,
  ChevronDown, 
  ExternalLink,
  Send,
  Filter,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  FolderOpen,
  Lock,
  QrCode,
  KeyRound,
  Check,
  Sun,
  Moon,
  Menu,
  Crown,
  Sparkles,
  BookOpen,
  UserPlus,
  RefreshCw,
  IndianRupee,
  Link2,
  User,
  Mail,
  Phone,
  X,
  Database,
  Trash2,
  Pencil,
  MessageSquareText,
  BarChart3,
  Pin,
  PinOff,
  Bookmark,
  FilePlus,
  StickyNote,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  LayoutDashboard,
  Tag,
  Bold,
  List
} from 'lucide-react';
import { fallbackQuestions } from './questions_fallback.ts';
import { MainsQuestion, Question, SubjectColorMap, ToppersCopyQuestion } from './types.ts';
import { cn } from './lib/utils.ts';
// import { isValidCode } from './authorizedCodes';

const subjectColors: SubjectColorMap = {
  "Polity": "bg-gradient-to-r from-indigo-500 to-violet-500 text-white ring-white/15 shadow-sm shadow-indigo-500/20",
  "History": "bg-gradient-to-r from-blue-500 to-indigo-500 text-white ring-white/15 shadow-sm shadow-blue-500/20",
  "Geography": "bg-gradient-to-r from-sky-500 to-blue-500 text-white ring-white/15 shadow-sm shadow-sky-500/20",
  "Economy": "bg-gradient-to-r from-cyan-500 to-sky-500 text-white ring-white/15 shadow-sm shadow-cyan-500/20",
  "Environment": "bg-gradient-to-r from-teal-500 to-cyan-500 text-white ring-white/15 shadow-sm shadow-teal-500/20",
  "Science & Technology": "bg-gradient-to-r from-cyan-500 to-blue-500 text-white ring-white/15 shadow-sm shadow-cyan-500/20",
  "Art & Culture": "bg-gradient-to-r from-violet-500 to-purple-500 text-white ring-white/15 shadow-sm shadow-violet-500/20",
  "Current Affairs": "bg-gradient-to-r from-blue-500 to-cyan-500 text-white ring-white/15 shadow-sm shadow-blue-500/20",
  "International Relations": "bg-gradient-to-r from-sky-500 to-indigo-500 text-white ring-white/15 shadow-sm shadow-sky-500/20",
  "Default": "bg-gradient-to-r from-indigo-500 to-blue-500 text-white ring-white/15 shadow-sm shadow-indigo-500/20"
};

type PrelimsFilterPreferences = {
  exam: string;
  year: string;
  paper: string;
  subject: string;
  topic: string;
  sort?: string;
};

type CSATFilterPreferences = {
  year: string;
  subject: string;
  sort?: string;
};

function matchesQuestionId(id: string | number, query: string): boolean {
  const normalizedQuery = query
    .trim()
    .toLowerCase()
    .replace(/^question\s*#?\s*/, "")
    .replace(/^q\s*#?\s*/, "")
    .replace(/^#\s*/, "");
  return normalizedQuery !== "" && String(id).toLowerCase().includes(normalizedQuery);
}

// ── Business / legal details (used across policy pages & PayU) ──
const BUSINESS = {
  brand: "UPSC PYQ Powerhouse",
  owner: "Rajender Singh",
  email: "raj48354835@gmail.com",
  phone: "+91 76658 72210",
  location: "Kota, Rajasthan, India",
  telegramHelp: "https://telegram.me/UPSC_powerhouse_helpbot",
  telegramChannel: "https://t.me/+7DfVmsKSI4FmNzg1",
};

// Razorpay checkout script loader (loads once, resolves true when ready).
declare global {
  interface Window { Razorpay?: any }
}
let razorpayScriptPromise: Promise<boolean> | null = null;
function loadRazorpayScript(): Promise<boolean> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => { razorpayScriptPromise = null; resolve(false); };
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

const RELEASE_NOTES_VERSION = '2026-09-18';
const RELEASE_NOTES_STORAGE_KEY = 'release_notes_seen_version';

const LEGAL_TITLES: Record<string, string> = {
  about: "About Us",
  contact: "Contact Us",
  privacy: "Privacy Policy",
  terms: "Terms & Conditions",
  refund: "Cancellation & Refund Policy",
};

function LegalPageContent({ page }: { page: 'about' | 'contact' | 'privacy' | 'terms' | 'refund' }) {
  const h = "text-base font-bold text-slate-900 dark:text-white mt-5 mb-2";
  const p = "text-sm leading-relaxed text-slate-600 dark:text-slate-300 mb-3";
  const li = "text-sm leading-relaxed text-slate-600 dark:text-slate-300";
  const updated = "Last updated: 18 July 2026";

  if (page === 'about') {
    return (
      <div>
        <p className={p}>{BUSINESS.brand} is an education and practice platform built for Civil Service aspirants. We help candidates prepare for UPSC CSE, State PCS, CAPF, CDS, NDA and similar examinations through previous-year questions (PYQs), curated solutions, topper copies and all-in-one study ebooks.</p>
        <h3 className={h}>Our Mission</h3>
        <p className={p}>To make high-quality, exam-focused practice material affordable and accessible to every aspirant, so preparation depends on effort — not on expensive coaching.</p>
        <h3 className={h}>What We Offer</h3>
        <ul className="list-disc pl-5 space-y-1.5 mb-3">
          <li className={li}>Thousands of previous-year questions with detailed solutions.</li>
          <li className={li}>Prelims, Mains, CSAT and English practice sections.</li>
          <li className={li}>Topper answer copies and curated PowerHouse ebooks.</li>
          <li className={li}>Regular content updates and a supportive Telegram community.</li>
        </ul>
        <h3 className={h}>Who Runs This</h3>
        <p className={p}>This platform is owned and operated by {BUSINESS.owner}, based in {BUSINESS.location}. For any query, reach us at {BUSINESS.email} or {BUSINESS.phone}.</p>

        <h3 className={h}>A Note from the Founder</h3>
        <p className={p}>Every PYQ tells a story.</p>
        <p className={p}>During my preparation, I realized that UPSC rarely asks questions in isolation—it often revisits ideas in new ways. The more PYQs I solved, the more the exam started to make sense.</p>
        <p className={p}>That's why PowerHouse PYQ exists: to make quality PYQs simple, organized, and affordable, so every aspirant can spend less time searching and more time learning.</p>
        <p className={p}>
          — Rajendra<br />
          <span className="text-xs text-slate-500 dark:text-slate-400">UPSC Interview Candidate | 105+ in CSE Prelims 2025 | CAPF (AC), CDS, NDA Qualified</span>
        </p>
        <p className={p}>Built with ❤️</p>
        <p className={p}>Powered by my brother, a software engineer at Microsoft and an IIT Delhi alumnus, who brings the technology behind the platform while I bring the UPSC journey behind it.</p>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Built by aspirants, for aspirants.</p>

        <p className="text-xs text-slate-400 mt-6">{updated}</p>
      </div>
    );
  }

  if (page === 'contact') {
    return (
      <div>
        <p className={p}>We're happy to help with subscriptions, activation, content or any other question. The fastest way to reach us is Telegram, but you can also email or call.</p>
        <h3 className={h}>Reach Us</h3>
        <ul className="space-y-2 mb-3">
          <li className={li}><strong>Owner:</strong> {BUSINESS.owner}</li>
          <li className={li}><strong>Email:</strong> <a className="text-blue-600 dark:text-blue-400 underline" href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a></li>
          <li className={li}><strong>Phone / WhatsApp:</strong> <a className="text-blue-600 dark:text-blue-400 underline" href={`tel:${BUSINESS.phone.replace(/\s/g, '')}`}>{BUSINESS.phone}</a></li>
          <li className={li}><strong>Address:</strong> {BUSINESS.location}</li>
          <li className={li}><strong>Telegram (Support):</strong> <a className="text-blue-600 dark:text-blue-400 underline" href={BUSINESS.telegramHelp} target="_blank" rel="noopener noreferrer">Help Bot</a></li>
        </ul>
        <h3 className={h}>Support Hours</h3>
        <p className={p}>Monday to Saturday, 10:00 AM – 7:00 PM IST. We usually respond within 24 hours.</p>
        <p className="text-xs text-slate-400 mt-6">{updated}</p>
      </div>
    );
  }

  if (page === 'privacy') {
    return (
      <div>
        <p className={p}>This Privacy Policy explains how {BUSINESS.brand} ("we", "us") collects, uses and protects your information when you use our website and services.</p>
        <h3 className={h}>Information We Collect</h3>
        <ul className="list-disc pl-5 space-y-1.5 mb-3">
          <li className={li}>Your email address, which you provide to log in and to activate a subscription.</li>
          <li className={li}>Subscription and payment status (we store whether you are subscribed and the plan expiry date).</li>
          <li className={li}>Basic login activity (timestamps) used to keep your account secure.</li>
        </ul>
        <h3 className={h}>Payments</h3>
        <p className={p}>Online payments are processed by our payment partner, PayU. We do <strong>not</strong> collect or store your card, UPI or bank details on our servers — that information is handled directly and securely by PayU. We only receive the transaction status and a transaction reference.</p>
        <h3 className={h}>How We Use Your Information</h3>
        <ul className="list-disc pl-5 space-y-1.5 mb-3">
          <li className={li}>To create your account and grant access to purchased content.</li>
          <li className={li}>To verify payments and activate/renew subscriptions.</li>
          <li className={li}>To provide support and respond to your queries.</li>
        </ul>
        <h3 className={h}>Data Sharing</h3>
        <p className={p}>We do not sell or rent your personal data. We share data only with service providers strictly necessary to run the service (e.g. our database host and PayU for payments), or when required by law.</p>
        <h3 className={h}>Data Security & Retention</h3>
        <p className={p}>We use reasonable technical measures to protect your data and retain it only as long as needed to provide the service or as required by law. You may request deletion of your account data by emailing {BUSINESS.email}.</p>
        <h3 className={h}>Contact</h3>
        <p className={p}>For any privacy request, contact {BUSINESS.email} or {BUSINESS.phone}.</p>
        <p className="text-xs text-slate-400 mt-6">{updated}</p>
      </div>
    );
  }

  if (page === 'terms') {
    return (
      <div>
        <p className={p}>By accessing or using {BUSINESS.brand}, you agree to these Terms & Conditions. Please read them carefully.</p>
        <h3 className={h}>1. Service</h3>
        <p className={p}>We provide access to previous-year questions, solutions, topper copies and study ebooks for exam preparation. Content is for personal, non-commercial study use only.</p>
        <h3 className={h}>2. Accounts</h3>
        <p className={p}>You are responsible for the email/account you use to access the service and for keeping your access secure. You must provide accurate information.</p>
        <h3 className={h}>3. Subscriptions & Payments</h3>
        <ul className="list-disc pl-5 space-y-1.5 mb-3">
          <li className={li}>Paid plans grant access for a fixed duration (e.g. 1 year or 2 years) from the date of activation.</li>
          <li className={li}>Prices are listed in Indian Rupees (INR) and are inclusive of applicable taxes unless stated otherwise.</li>
          <li className={li}>Online payments are processed securely through PayU. Access is activated after the payment is confirmed.</li>
        </ul>
        <h3 className={h}>4. Acceptable Use</h3>
        <p className={p}>You may not copy, redistribute, resell, publicly share or upload our content elsewhere. Sharing account access or ebooks with others is prohibited and may result in termination without refund.</p>
        <h3 className={h}>5. Intellectual Property</h3>
        <p className={p}>All content, branding and materials on the platform are owned by {BUSINESS.owner} or respective rights-holders and are protected by law.</p>
        <h3 className={h}>6. Disclaimer</h3>
        <p className={p}>We strive for accuracy but do not guarantee that content is error-free or that it will lead to any particular exam result. The service is provided on an "as is" basis.</p>
        <h3 className={h}>7. Changes</h3>
        <p className={p}>We may update these terms or the service from time to time. Continued use after changes means you accept the updated terms.</p>
        <h3 className={h}>8. Contact</h3>
        <p className={p}>Questions about these terms? Email {BUSINESS.email} or call {BUSINESS.phone}.</p>
        <p className="text-xs text-slate-400 mt-6">{updated}</p>
      </div>
    );
  }

  // refund
  return (
    <div>
      <p className={p}>This Cancellation & Refund Policy applies to subscriptions and ebooks purchased on {BUSINESS.brand}.</p>
      <h3 className={h}>Nature of Products</h3>
      <p className={p}>Our products are digital and delivered instantly (online access and downloadable study material). Because access is granted immediately upon successful payment, purchases are generally <strong>non-refundable</strong> once activated.</p>
      <h3 className={h}>When You Are Eligible for a Refund</h3>
      <ul className="list-disc pl-5 space-y-1.5 mb-3">
        <li className={li}><strong>Duplicate payment:</strong> If you were charged more than once for the same order, the extra amount is fully refunded.</li>
        <li className={li}><strong>Payment deducted but access not granted:</strong> If money is debited but your subscription is not activated within 48 hours, you are eligible for a full refund (or, at your choice, activation of access).</li>
        <li className={li}><strong>Technical failure:</strong> If a verified technical fault on our side prevents you from accessing the purchased content and we are unable to resolve it, you may request a refund.</li>
      </ul>
      <h3 className={h}>Non-Refundable Cases</h3>
      <ul className="list-disc pl-5 space-y-1.5 mb-3">
        <li className={li}>Change of mind after the content/ebooks have been accessed or downloaded.</li>
        <li className={li}>Partial use of the subscription period.</li>
        <li className={li}>Violation of our Terms (e.g. sharing or redistributing content).</li>
      </ul>
      <h3 className={h}>Cancellation</h3>
      <p className={p}>Our plans are one-time purchases for a fixed period and do <strong>not</strong> auto-renew, so there is no recurring billing to cancel. You may choose not to renew at the end of your term.</p>
      <h3 className={h}>How to Request a Refund</h3>
      <p className={p}>Email {BUSINESS.email} (or message us on Telegram) within <strong>7 days</strong> of the transaction with your registered email and the payment reference. Approved refunds are processed back to the original payment method via PayU within <strong>5–7 business days</strong>.</p>
      <h3 className={h}>Contact</h3>
      <p className={p}>{BUSINESS.owner} — {BUSINESS.email} — {BUSINESS.phone} — {BUSINESS.location}.</p>
      <p className="text-xs text-slate-400 mt-6">{updated}</p>
    </div>
  );
}

interface FancyOption { value: string; label: string }
// Reusable modern dropdown: rounded control + rounded, themed options list box (replaces native <select>).
const FancySelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: FancyOption[];
  className?: string;
  buttonClassName?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}> = ({ value, onChange, options, className, buttonClassName, size = 'md', ariaLabel }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const selected = options.find(o => o.value === value);
  const pad = size === 'sm' ? 'px-2 py-1 text-[11px] font-bold' : 'text-xs p-2';
  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'w-full flex items-center justify-between gap-2 rounded-xl border bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white shadow-sm transition-colors hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring focus:ring-blue-500/20',
          pad,
          buttonClassName
        )}
      >
        <span className="truncate text-left">{selected ? selected.label : ''}</span>
        <ChevronDown className={cn('w-4 h-4 flex-shrink-0 text-slate-400 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-[80] max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl shadow-slate-900/10 dark:shadow-black/40 p-1.5 animate-modalPop"
        >
          {options.map(o => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn(
                  'w-full text-left rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                  active
                    ? 'bg-blue-500 text-white font-semibold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700'
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface SortOption { value: string; label: string; dir: 'asc' | 'desc' }
// Compact icon-only sort control: the arrow flips to match the active direction
// and the button lights up whenever a non-default order is applied.
const SortMenu: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: SortOption[];
  defaultValue: string;
}> = ({ value, onChange, options, defaultValue }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const selected = options.find(o => o.value === value) ?? options[0];
  const isCustom = value !== defaultValue;
  const Icon = selected.dir === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Sort: ${selected.label}`}
        title={`Sort: ${selected.label}`}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg border transition-all active:scale-95",
          isCustom || open
            ? "border-transparent bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25 hover:from-blue-500 hover:to-indigo-500"
            : "border-slate-200 bg-white/70 text-slate-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-500 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1.5 z-[80] w-40 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl shadow-slate-900/10 dark:shadow-black/40 p-1 animate-modalPop"
        >
          {options.map(o => {
            const active = o.value === value;
            const OptIcon = o.dir === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                  active
                    ? 'bg-blue-500 text-white font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700'
                )}
              >
                <OptIcon className={cn('h-3.5 w-3.5 flex-shrink-0', active ? 'text-white' : 'text-slate-400')} />
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Bookmark / notes "only" toggles with live counts. Shared by the Prelims, CSAT
// and English sidebars so all three behave and look identical.
const SavedFilterToggles: React.FC<{
  bookmarkedOnly: boolean;
  onToggleBookmarked: () => void;
  bookmarkedCount: number;
  notedOnly: boolean;
  onToggleNoted: () => void;
  notedCount: number;
}> = ({ bookmarkedOnly, onToggleBookmarked, bookmarkedCount, notedOnly, onToggleNoted, notedCount }) => {
  const toggleClass = (active: boolean) => cn(
    "relative flex h-7 w-7 items-center justify-center rounded-lg border transition-all active:scale-95",
    active
      ? "border-transparent bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25 hover:from-blue-500 hover:to-indigo-500"
      : "border-slate-200 bg-white/70 text-slate-400 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-500 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-400 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
  );
  const badgeClass = (active: boolean) => cn(
    "absolute -top-1.5 -right-1.5 min-w-[15px] rounded-full px-1 text-[9px] font-bold leading-[15px] tabular-nums ring-2",
    active
      ? "bg-white text-blue-700 ring-white/70 dark:ring-slate-800"
      : "bg-blue-600 text-white ring-white dark:ring-slate-800"
  );

  return (
    <>
      <button
        type="button"
        onClick={onToggleBookmarked}
        aria-pressed={bookmarkedOnly}
        title={bookmarkedOnly ? "Show all questions" : "Show bookmarked questions only"}
        aria-label={bookmarkedOnly ? "Show all questions" : "Show bookmarked questions only"}
        className={toggleClass(bookmarkedOnly)}
      >
        <Bookmark className={cn("h-3.5 w-3.5", bookmarkedOnly && "fill-current")} />
        {bookmarkedCount > 0 && (
          <span className={badgeClass(bookmarkedOnly)}>{bookmarkedCount > 99 ? "99+" : bookmarkedCount}</span>
        )}
      </button>
      <button
        type="button"
        onClick={onToggleNoted}
        aria-pressed={notedOnly}
        title={notedOnly ? "Show all questions" : "Show questions with notes only"}
        aria-label={notedOnly ? "Show all questions" : "Show questions with notes only"}
        className={toggleClass(notedOnly)}
      >
        <FilePlus className="h-3.5 w-3.5" />
        {notedCount > 0 && (
          <span className={badgeClass(notedOnly)}>{notedCount > 99 ? "99+" : notedCount}</span>
        )}
      </button>
    </>
  );
};

const QuestionCountToggle: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = ({ value, onChange }) => {  const options = [10, 20, 50, 100];
  const currentIndex = options.indexOf(value);
  const nextValue = options[(currentIndex + 1) % options.length];

  return (
    <button
      type="button"
      onClick={() => onChange(nextValue)}
      aria-label={`${value} random questions. Click to change to ${nextValue}.`}
      title={`${value} questions - click for ${nextValue}`}
      className="group flex h-7 items-center gap-1.5 rounded-lg bg-white/90 px-2 text-[10px] font-extrabold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 transition-all hover:text-blue-600 hover:ring-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-slate-800/90 dark:text-slate-200 dark:ring-slate-600 dark:hover:text-blue-300"
    >
      <span className="tabular-nums">{value}</span>
      <span className="text-[8px] uppercase tracking-wide text-slate-400 group-hover:text-blue-400">Qs</span>
      <RotateCcw className="h-2.5 w-2.5 text-slate-400 transition-transform duration-300 group-hover:rotate-180 group-hover:text-blue-500" />
    </button>
  );
};

// ── Bookmarks & notes sync (Cosmos `user-questions`) ─────────────────────────
// The signed-in user's email is the partition key, so everything a user has
// saved loads in one request and is shared across their devices. There is no
// local cache: a device-local copy would leak one account's notes to the next
// user on a shared device.
// The subset of a question needed to save workspace state. Accepting this
// rather than a full `Question` lets the workspace remove a bookmark or note
// for a question that is not in the currently loaded list.
type QuestionMeta = {
  id: number | string;
  subject?: string | null;
  topic?: string | null;
  exam?: string | null;
  year?: string | null;
};

type RemoteQuestionState = {
  isBookmarked: boolean;
  notes: string;
  noteTitle: string;
  attemptCount: number;
  correctCount: number;
  wrongCount: number;
  lastOption: string | null;
  lastIsCorrect: boolean | null;
  lastAttemptAt: string | null;
  subject: string | null;
  topic: string | null;
  exam: string | null;
  year: string | null;
  updatedAt: string | null;
};

const emptyRemoteQuestionState = (): RemoteQuestionState => ({
  isBookmarked: false,
  notes: "",
  noteTitle: "",
  attemptCount: 0,
  correctCount: 0,
  wrongCount: 0,
  lastOption: null,
  lastIsCorrect: null,
  lastAttemptAt: null,
  subject: null,
  topic: null,
  exam: null,
  year: null,
  updatedAt: null,
});

const remoteQuestionState = new Map<string, RemoteQuestionState>();
const remoteStateListeners = new Set<() => void>();
let remoteStateEmail: string | null = null;

const remoteStateKey = (questionType: string, questionId: number | string) =>
  `${questionType}:${questionId}`;

// The question feed contains repeated ids (13,092 rows / 12,454 distinct at the
// time of writing). Cards are keyed by `question.id`, and duplicate React keys
// make the list mis-reconcile — rows visibly multiply each time a filter toggles.
// Keep the first occurrence of every id.
const dedupeQuestionsById = <T extends { id: number | string }>(list: T[]): T[] => {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    const id = String(item.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
};

const notifyRemoteStateListeners = () => remoteStateListeners.forEach(listener => listener());

type QuestionSortMode = 'latest' | 'oldest' | 'score-asc' | 'score-desc' | 'attempts-desc' | 'attempts-asc';

const questionSortOptions: SortOption[] = [
  { value: 'latest', label: 'Latest', dir: 'desc' },
  { value: 'oldest', label: 'Oldest', dir: 'asc' },
  { value: 'score-desc', label: 'Score high', dir: 'desc' },
  { value: 'score-asc', label: 'Score low', dir: 'asc' },
  { value: 'attempts-desc', label: 'Most attempted', dir: 'desc' },
  { value: 'attempts-asc', label: 'Least attempted', dir: 'asc' },
];

// Bookmark / notes filtering, counting and sorting are identical for Prelims,
// CSAT and English, so all three share these helpers — a section's badge count
// can never drift from the rows it actually renders.
const matchesSavedFilters = (
  questionType: string,
  question: { id: number | string },
  bookmarkedOnly: boolean,
  notedOnly: boolean
) => {
  if (!bookmarkedOnly && !notedOnly) return true;
  const state = remoteQuestionState.get(remoteStateKey(questionType, question.id));
  if (bookmarkedOnly && state?.isBookmarked !== true) return false;
  if (notedOnly && (state?.notes || "").trim() === "") return false;
  return true;
};

const countSavedQuestions = <T extends { id: number | string }>(questionType: string, list: T[]) => {
  let bookmarks = 0;
  let notes = 0;
  for (const q of list) {
    const state = remoteQuestionState.get(remoteStateKey(questionType, q.id));
    if (!state) continue;
    if (state.isBookmarked) bookmarks += 1;
    if ((state.notes || "").trim() !== "") notes += 1;
  }
  return [bookmarks, notes] as const;
};

const sortQuestionsBy = <T extends { id: number | string; year?: string | number }>(
  list: T[],
  questionType: string,
  mode: QuestionSortMode
): T[] => {
  // Newest-first is the natural reading order and stays the tiebreaker for every
  // other mode, so questions never jump around unpredictably.
  const byRecency = (a: T, b: T) => {
    const yearComparison = String(b.year).localeCompare(String(a.year));
    if (yearComparison !== 0) return yearComparison;
    const aId = Number(a.id);
    const bId = Number(b.id);
    if (Number.isFinite(aId) && Number.isFinite(bId)) return bId - aId;
    return String(b.id).localeCompare(String(a.id));
  };
  const attemptsOf = (q: T) => {
    const s = remoteQuestionState.get(remoteStateKey(questionType, q.id));
    return (s?.correctCount ?? 0) + (s?.wrongCount ?? 0);
  };
  // Never-attempted questions have no score at all, so they sink to the bottom
  // in both directions instead of pretending to be 0%.
  const accuracyOf = (q: T) => {
    const total = attemptsOf(q);
    if (total === 0) return null;
    const s = remoteQuestionState.get(remoteStateKey(questionType, q.id))!;
    return (s.correctCount / total) * 100;
  };

  return [...list].sort((a, b) => {
    if (mode === 'latest') return byRecency(a, b);
    if (mode === 'oldest') return -byRecency(a, b);

    if (mode === 'attempts-desc' || mode === 'attempts-asc') {
      const aTotal = attemptsOf(a);
      const bTotal = attemptsOf(b);
      if (aTotal !== bTotal) return mode === 'attempts-desc' ? bTotal - aTotal : aTotal - bTotal;
      return byRecency(a, b);
    }

    const aScore = accuracyOf(a);
    const bScore = accuracyOf(b);
    if (aScore === null && bScore === null) return byRecency(a, b);
    if (aScore === null) return 1;
    if (bScore === null) return -1;
    if (aScore !== bScore) return mode === 'score-asc' ? aScore - bScore : bScore - aScore;
    return byRecency(a, b);
  });
};


async function loadRemoteQuestionState(email: string | null) {
  if (!email) {
    remoteStateEmail = null;
    remoteQuestionState.clear();
    remoteAttemptHistory.clear();
    notifyRemoteStateListeners();
    return;
  }
  if (remoteStateEmail === email) return;
  remoteStateEmail = email;
  remoteQuestionState.clear();
  remoteAttemptHistory.clear();
  notifyRemoteStateListeners();
  try {
    const res = await fetch(`/api/question-state?email=${encodeURIComponent(email)}`);
    if (!res.ok) return;
    const data = await res.json();
    // Ignore a response that lost the race to a newer login.
    if (remoteStateEmail !== email) return;
    for (const item of data.items || []) {
      remoteQuestionState.set(remoteStateKey(item.questionType, item.questionId), {
        isBookmarked: !!item.isBookmarked,
        notes: item.notes || "",
        noteTitle: item.noteTitle || "",
        attemptCount: item.attemptCount ?? 0,
        correctCount: item.correctCount ?? 0,
        wrongCount: item.wrongCount ?? 0,
        lastOption: item.lastOption ?? null,
        lastIsCorrect: item.lastIsCorrect ?? null,
        lastAttemptAt: item.lastAttemptAt ?? null,
        subject: item.subject ?? null,
        topic: item.topic ?? null,
        exam: item.exam ?? null,
        year: item.year ?? null,
        updatedAt: item.updatedAt ?? null,
      });
    }
    notifyRemoteStateListeners();
  } catch {
    // Network error: allow a later login to retry the fetch.
    remoteStateEmail = null;
  }
}

// Signed out, the same update is applied to the in-memory map and nothing is
// sent to the server: a guest gets the full bookmark/note experience for the
// session, and a refresh starts them clean rather than persisting anything.
function saveRemoteQuestionState(
  email: string | null | undefined,
  questionType: string,
  question: QuestionMeta,
  patch: { isBookmarked?: boolean; notes?: string; noteTitle?: string }
) {
  const key = remoteStateKey(questionType, question.id);
  const current = remoteQuestionState.get(key) || emptyRemoteQuestionState();
  remoteQuestionState.set(key, {
    ...current,
    ...patch,
    subject: question.subject ?? current.subject,
    topic: question.topic ?? current.topic,
    exam: question.exam ?? current.exam,
    year: question.year ?? current.year,
    updatedAt: new Date().toISOString(),
  });
  if (email) {
    fetch('/api/question-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        questionId: question.id,
        questionType,
        subject: question.subject,
        topic: question.topic,
        exam: question.exam,
        year: question.year,
        ...patch,
      }),
    }).catch(() => {});
  }
  notifyRemoteStateListeners();
}

// Bumps the local counters the moment an option is clicked so the attempt
// badge updates without waiting for (or re-fetching) the server. The server is
// the source of truth; `POST /api/attempts` performs the same increment there.
// Signed out there is no server copy, so the map is the only record and the
// tally lives until the page is refreshed.
function recordRemoteAttempt(
  email: string | null | undefined,
  questionType: string,
  questionId: number | string,
  option: string,
  isCorrect: boolean,
  attemptId: string | null = null
) {
  const key = remoteStateKey(questionType, questionId);
  const current = remoteQuestionState.get(key) || emptyRemoteQuestionState();
  const ts = new Date().toISOString();
  remoteQuestionState.set(key, {
    ...current,
    attemptCount: current.attemptCount + 1,
    correctCount: current.correctCount + (isCorrect ? 1 : 0),
    wrongCount: current.wrongCount + (isCorrect ? 0 : 1),
    lastOption: option,
    lastIsCorrect: isCorrect,
    lastAttemptAt: ts,
  });
  // Keep an already-loaded history in step so the panel does not need a refetch.
  // For a guest there is nothing to fetch, so the list is started here instead.
  const history = remoteAttemptHistory.get(key) ?? (email ? null : []);
  if (history) {
    remoteAttemptHistory.set(key, [{ attemptId, option, isCorrect, timeSpentMs: null, ts }, ...history]);
  }
  notifyRemoteStateListeners();
}

// Full per-attempt history is fetched lazily (one point read per question)
// because the `attempts` array is excluded from the Cosmos index and would
// bloat the bulk state response.
type QuestionAttempt = {
  attemptId: string | null;
  option: string | null;
  isCorrect: boolean;
  timeSpentMs: number | null;
  ts: string;
};

const remoteAttemptHistory = new Map<string, QuestionAttempt[]>();
const attemptHistoryInFlight = new Set<string>();

async function loadRemoteAttemptHistory(
  email: string | null | undefined,
  questionType: string,
  questionId: number | string
) {
  // A guest's history is built up by `recordRemoteAttempt`, so there is nothing
  // to fetch and the map already holds this session's attempts.
  if (!email) return;
  const key = remoteStateKey(questionType, questionId);
  if (remoteAttemptHistory.has(key) || attemptHistoryInFlight.has(key)) return;
  attemptHistoryInFlight.add(key);
  const requestedFor = email;
  try {
    const res = await fetch(
      `/api/question-attempts?email=${encodeURIComponent(email)}&questionId=${encodeURIComponent(
        String(questionId)
      )}&questionType=${encodeURIComponent(questionType)}`
    );
    if (!res.ok) return;
    const data = await res.json();
    // Ignore a response that lost the race to a newer login.
    if (remoteStateEmail !== requestedFor) return;
    remoteAttemptHistory.set(key, data.attempts || []);
    notifyRemoteStateListeners();
  } catch {
    // Leave it uncached so hovering again retries.
  } finally {
    attemptHistoryInFlight.delete(key);
  }
}

interface QuestionCardProps {
  question: Question;
  storageScope: 'prelims' | 'csat' | 'english';
  index: number;
  attemptedOption: string | undefined;
  isRevealed: boolean;
  onOptionClick: (option: string) => void;
  onToggleRevealed: () => void;
  isLocked?: boolean;
  userEmail?: string | null;
  onCheckStatus?: () => void;
  onOpenPremium?: () => void;
  onFeedback?: () => void;
  showNoteInline?: boolean;
  onSubjectClick?: (subject: string) => void;
  onTopicClick?: (topic: string) => void;
  onExamClick?: (exam: string) => void;
  onYearClick?: (year: string) => void;
  searchQuery?: string;
  isAdmin?: boolean;
  isEditor?: boolean;
  onUpdateQuestion?: (id: number, year: string, answer: string, explanation: string) => Promise<void>;
}

const formatAttemptTime = (ts: string | null | undefined) => {
  if (!ts) return "";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

// Shows the signed-in user's real attempt tally for a question, read from the
// `user-questions` container. The hover panel lists the five most recent
// attempts (newest first); clicking opens a modal with the full history. The
// per-attempt array is fetched lazily because it is excluded from the Cosmos
// index and is not returned by the bulk state endpoint.
const AttemptIndicator: React.FC<{
  question: Question;
  questionType: string;
  userEmail?: string | null;
}> = ({ question, questionType, userEmail }) => {
  const [, bumpRemoteStateVersion] = useReducer((n: number) => n + 1, 0);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    remoteStateListeners.add(bumpRemoteStateVersion);
    return () => {
      remoteStateListeners.delete(bumpRemoteStateVersion);
    };
  }, []);

  const remoteKey = remoteStateKey(questionType, question.id);
  const state = remoteQuestionState.get(remoteKey);
  const correctCount = state?.correctCount ?? 0;
  const wrongCount = state?.wrongCount ?? 0;
  const totalAttempts = correctCount + wrongCount;

  const history = remoteAttemptHistory.get(remoteKey);
  const isHistoryLoaded = !!history;

  useEffect(() => {
    if (!isHistoryOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsHistoryOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isHistoryOpen]);

  if (totalAttempts === 0) return null;

  const prefetchHistory = () => loadRemoteAttemptHistory(userEmail, questionType, question.id);
  const accuracy = Math.round((correctCount / totalAttempts) * 100);
  const recentAttempts = (history || []).slice(0, 5);

  const renderAttemptRow = (attempt: QuestionAttempt, position: number, showConnector: boolean) => (
    <div key={`${attempt.ts}-${position}`} className="relative flex gap-2 pb-2 last:pb-0">
      {showConnector && <span className="absolute left-[5px] top-3 h-full w-px bg-blue-100 dark:bg-slate-700" />}
      <span
        className={cn(
          "relative z-10 mt-0.5 flex h-3 w-3 shrink-0 items-center justify-center rounded-full ring-2 ring-white dark:ring-slate-900",
          attempt.isCorrect ? "bg-emerald-500" : "bg-rose-600"
        )}
      >
        {attempt.isCorrect ? <Check className="h-2 w-2 text-white" /> : <X className="h-2 w-2 text-white" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-[9px] font-bold",
              attempt.isCorrect ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"
            )}
          >
            {attempt.isCorrect ? "Correct" : "Wrong"} - Attempt {position}
          </span>
          <span className="shrink-0 text-[7px] font-medium text-slate-400">{formatAttemptTime(attempt.ts)}</span>
        </div>
        <p className="truncate text-[9px] text-slate-500 dark:text-slate-400" title={attempt.option || ""}>
          Selected: {attempt.option || "—"}
        </p>
      </div>
    </div>
  );

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${accuracy}% accuracy over ${totalAttempts} attempts by you: ${correctCount} correct and ${wrongCount} wrong. Open full history.`}
        onMouseEnter={prefetchHistory}
        onFocus={prefetchHistory}
        onClick={() => {
          prefetchHistory();
          setIsHistoryOpen(true);
        }}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            prefetchHistory();
            setIsHistoryOpen(true);
          }
        }}
        className="group/attempts relative flex w-fit cursor-pointer items-center rounded-full focus:outline-none"
      >
        <div className="flex items-center gap-1">
          <span
            title={`${accuracy}% accuracy across ${totalAttempts} attempts`}
            className={cn(
              "text-[9px] font-extrabold leading-none tabular-nums transition-transform group-hover/attempts:-translate-y-0.5",
              accuracy >= 50
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            )}
          >
            {accuracy}%
          </span>
          <span
            title={`${correctCount} correct attempts`}
            className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 text-[7px] font-extrabold leading-none text-white transition-transform group-hover/attempts:-translate-y-0.5 dark:bg-emerald-500"
          >
            {correctCount}
          </span>
          <span
            title={`${wrongCount} wrong attempts`}
            className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-rose-500 text-[7px] font-extrabold leading-none text-white transition-transform group-hover/attempts:-translate-y-0.5 dark:bg-rose-500"
          >
            {wrongCount}
          </span>
        </div>

        <div className="pointer-events-none invisible absolute right-0 top-full z-30 mt-1.5 w-60 translate-y-1 rounded-xl border border-blue-100 bg-white/95 p-2.5 opacity-0 shadow-xl shadow-blue-900/10 backdrop-blur-xl transition-all duration-200 group-hover/attempts:visible group-hover/attempts:translate-y-0 group-hover/attempts:opacity-100 group-focus/attempts:visible group-focus/attempts:translate-y-0 group-focus/attempts:opacity-100 dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/30">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold text-slate-800 dark:text-slate-100">Your attempts</p>
              <p className="text-[8px] font-medium text-slate-400">{accuracy}% accuracy</p>
            </div>
            <span className="rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-2 py-0.5 text-[8px] font-bold text-white">
              {totalAttempts} total
            </span>
          </div>

          {!isHistoryLoaded ? (
            <p className="py-1 text-[9px] font-medium text-slate-400">Loading history…</p>
          ) : (
            <>
              <div>
                {recentAttempts.map((attempt, attemptIndex) =>
                  renderAttemptRow(attempt, totalAttempts - attemptIndex, attemptIndex < recentAttempts.length - 1)
                )}
              </div>
              <p className="mt-1 border-t border-blue-100 pt-1.5 text-center text-[8px] font-semibold text-blue-600 dark:border-slate-700 dark:text-blue-400">
                {totalAttempts > 5 ? `Click to see all ${totalAttempts} attempts` : "Click to see full history"}
              </p>
            </>
          )}
        </div>
      </div>

      {isHistoryOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={() => setIsHistoryOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Attempt history for question ${question.id}`}
            className="flex max-h-[calc(100%-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold text-slate-900 dark:text-slate-100">Attempt history</p>
                <p className="truncate text-[10px] font-medium text-slate-400">
                  Q{question.id} · {totalAttempts} attempts · {accuracy}% accuracy
                </p>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                aria-label="Close attempt history"
                className="shrink-0 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 border-b border-slate-100 px-4 py-2.5 dark:border-slate-700">
              <div className="rounded-lg bg-slate-50 px-2 py-1 text-center dark:bg-slate-800">
                <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Total</p>
                <p className="text-[13px] font-extrabold text-slate-700 dark:text-slate-200">{totalAttempts}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 px-2 py-1 text-center dark:bg-emerald-500/10">
                <p className="text-[8px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Correct</p>
                <p className="text-[13px] font-extrabold text-emerald-700 dark:text-emerald-300">{correctCount}</p>
              </div>
              <div className="rounded-lg bg-rose-50 px-2 py-1 text-center dark:bg-rose-500/10">
                <p className="text-[8px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">Wrong</p>
                <p className="text-[13px] font-extrabold text-rose-700 dark:text-rose-300">{wrongCount}</p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {!isHistoryLoaded ? (
                <p className="py-4 text-center text-[11px] font-medium text-slate-400">Loading history…</p>
              ) : history!.length === 0 ? (
                <p className="py-4 text-center text-[11px] font-medium text-slate-400">No attempt details saved yet.</p>
              ) : (
                history!.map((attempt, attemptIndex) =>
                  renderAttemptRow(attempt, history!.length - attemptIndex, attemptIndex < history!.length - 1)
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// One saved question in My Workspace. Rendered for both the bookmarks and the
// notes tab; the notes tab passes the note body in as `children`.
type WorkspaceEntryShape = {
  key: string;
  questionId: number | string;
  questionType: string;
  question: Question | undefined;
  state: RemoteQuestionState;
};

const workspaceTypeLabel: Record<string, string> = {
  prelims: 'Prelims',
  csat: 'CSAT',
  english: 'English',
};

const getNoteTitle = (
  noteTitle: string | null | undefined,
  topic: string | null | undefined,
  subject: string | null | undefined
) => noteTitle?.trim() || topic?.trim() || subject?.trim() || 'Study note';

// Shown in the workspace while signed out. A guest's bookmarks, notes and
// attempts live only in this tab's memory, so the banner sets the expectation
// before they lose anything on a refresh.
const GuestSessionNotice: React.FC<{ onSignIn: () => void }> = ({ onSignIn }) => (
  <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 dark:border-amber-500/25 dark:bg-amber-500/10">
    <p className="text-[11.5px] font-medium leading-relaxed text-amber-800 dark:text-amber-200">
      You're browsing as a guest — these are saved on this page only and disappear when you refresh.
    </p>
    <button
      type="button"
      onClick={onSignIn}
      className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-amber-500"
    >
      Sign in to keep them
    </button>
  </div>
);

const noteInlineMarkdownToHtml = (text: string) => {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  return escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
};

const noteMarkdownToEditorHtml = (note: string) => {
  if (!note) return '';
  const lines = note.split(/\r?\n/);
  const blocks: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(`<ul>${listItems.map(item => `<li>${noteInlineMarkdownToHtml(item)}</li>`).join('')}</ul>`);
    listItems = [];
  };

  lines.forEach(line => {
    const bullet = line.match(/^\s*[-•]\s+(.*)$/);
    if (bullet) {
      listItems.push(bullet[1]);
      return;
    }
    flushList();
    blocks.push(line ? `<div>${noteInlineMarkdownToHtml(line)}</div>` : '<div><br></div>');
  });
  flushList();
  return blocks.join('');
};

const noteEditorToMarkdown = (root: HTMLElement) => {
  const serialize = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (!(node instanceof HTMLElement)) return '';

    const content = Array.from(node.childNodes).map(serialize).join('');
    switch (node.tagName) {
      case 'BR':
        return '\n';
      case 'B':
      case 'STRONG':
        return content ? `**${content}**` : '';
      case 'LI':
        return `- ${content.replace(/\n+/g, ' ').trim()}\n`;
      case 'DIV':
      case 'P':
        return `${content}\n`;
      default:
        return content;
    }
  };

  return Array.from(root.childNodes)
    .map(serialize)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n$/, '');
};

const NoteContent: React.FC<{ note: string; className?: string; bulletClassName?: string }> = ({
  note,
  className,
  bulletClassName = "bg-violet-500 shadow-violet-500/30",
}) => {
  const renderInline = (line: string, lineIndex: number) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) => {
      const isBold = part.startsWith('**') && part.endsWith('**');
      return isBold ? (
        <strong key={`${lineIndex}-${partIndex}`} className="font-bold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <React.Fragment key={`${lineIndex}-${partIndex}`}>{part}</React.Fragment>
      );
    });

  return (
    <div className={cn("space-y-2 whitespace-pre-wrap", className)}>
      {note.split(/\r?\n/).map((line, lineIndex) => {
        const bullet = line.match(/^\s*[-•]\s+(.+)$/);
        if (bullet) {
          return (
            <div key={lineIndex} className="flex items-start gap-2.5">
              <span className={cn("mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full shadow-sm", bulletClassName)} />
              <span className="min-w-0">{renderInline(bullet[1], lineIndex)}</span>
            </div>
          );
        }
        if (!line.trim()) return <div key={lineIndex} className="h-2" aria-hidden="true" />;
        return <div key={lineIndex}>{renderInline(line, lineIndex)}</div>;
      })}
    </div>
  );
};

const WorkspaceEntryCard: React.FC<{
  entry: WorkspaceEntryShape;
  onRemove: () => void;
  removeLabel: string;
  children?: React.ReactNode;
}> = ({ entry, onRemove, removeLabel, children }) => {
  const { state, question } = entry;
  const questionText = (question?.question || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const subject = question?.subject || state.subject;
  const topic = question?.topic || state.topic;
  const exam = question?.exam || state.exam;
  const year = question?.year || state.year;
  const totalAttempts = state.correctCount + state.wrongCount;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white px-4 py-4 shadow-sm shadow-slate-900/5 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-900/5 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-indigo-500/50">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 ring-1 ring-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
              Q{entry.questionId}
            </span>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              {workspaceTypeLabel[entry.questionType] || entry.questionType}
            </span>
            {subject && (
              <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                {subject}
              </span>
            )}
            {topic && (
              <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
                {topic}
              </span>
            )}
            {exam && year && (
              <span className="text-[10px] font-medium text-slate-400">{exam} · {year}</span>
            )}
          </div>

          <p className="text-[13px] font-medium leading-[21px] text-slate-700 dark:text-slate-200 line-clamp-3">
            {questionText || <span className="italic text-slate-400">Question not available in the current list.</span>}
          </p>

          {totalAttempts > 0 && (
            <div className="mt-2.5 flex items-center gap-2 text-[10px] font-semibold">
              <span className="text-emerald-600 dark:text-emerald-400">{state.correctCount} correct</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-rose-600 dark:text-rose-400">{state.wrongCount} wrong</span>
              {state.lastAttemptAt && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="font-medium text-slate-400">last {formatAttemptTime(state.lastAttemptAt)}</span>
                </>
              )}
            </div>
          )}

          {children}
        </div>

        <button
          onClick={onRemove}
          title={removeLabel}
          aria-label={removeLabel}
          className="shrink-0 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

const parseMarkdownBold = (text: string | undefined) => {
  if (!text) return '';
  let html = text;
  // Headings: a line starting with ## or # becomes a themed heading band (consumes its line break)
  html = html.replace(/^#\s+(.+?)[ \t]*(?:\r?\n|$)/gm, '<span class="block bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-sm px-3 py-1.5 rounded-lg shadow-sm mt-2 mb-1.5">$1</span>');
  html = html.replace(/^##\s+(.+?)[ \t]*(?:\r?\n|$)/gm, '<span class="block bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-200 font-bold text-[13px] px-2.5 py-1 rounded-md mt-2 mb-1">$1</span>');
  // Bold
  html = html.replace(/\*\*([^\*]+)\*\*/g, '<b>$1</b>');
  return html;
};

// Adds a little vertical breathing room around a numbered-statement list:
// a gap between the question stem and the first "1.", and between the last
// numbered point and the trailing "Select the correct answer…" line.
const spaceNumberedList = (html: string) => {
  const parts = html.split(/<br\s*\/?>/i);
  if (parts.length < 2) return html;
  const isNum = (s: string) => /^\s*\d+[.)]/.test(s.replace(/<[^>]*>/g, ''));
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const curNum = isNum(parts[i]);
    const prevNum = isNum(parts[i - 1]);
    let sep = '<br/>';
    if (curNum !== prevNum) sep = '<br/><span class="block h-3.5"></span>'; // list boundary
    else if (curNum && prevNum) sep = '<br/><span class="block h-1.5"></span>'; // between statements
    out += sep + parts[i];
  }
  return out;
};

// ---- "Match the following" detection & tabular rendering ----
// Many PYQs cram List-I / List-II into one text blob with mixed delimiters
// (":", "|", " - ", <br/>, or separate "List-I:" / "List-II:" blocks). This
// parses the common shapes into { intro, headers, rows, outro } so we can show
// them as a clean two-column table. Returns null when it can't confidently parse
// (caller then falls back to the normal text renderer).
type MatchData = { intro: string; headers: [string, string]; rows: { l: string; r: string }[]; outro: string };

const parseMatchTable = (raw: string | undefined): MatchData | null => {
  if (!raw || !/match|pair/i.test(raw)) return null;
  const lines = raw.replace(/<br\s*\/?>/gi, '\n').split('\n').map(s => s.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  const PAIR = /^([A-Za-z])[.)]\s*(.+?)(?:\s*[:|]\s*|\s+[-–]\s+)(\d+)[.)]?\s*(.+)$/;
  const headerRe = /list[\s.\-–]*i\b.*list[\s.\-–]*ii\b/i;
  const parens = (s: string) => (s.match(/\(([^)]+)\)/g) || []).map(x => x.slice(1, -1).trim());

  // Approach A: inline pair rows (one "left <delim> right" per line)
  const pairIdxs: number[] = [];
  lines.forEach((l, i) => { if (PAIR.test(l)) pairIdxs.push(i); });
  if (pairIdxs.length >= 2) {
    const rows = pairIdxs.map(i => {
      const m = lines[i].match(PAIR)!;
      return { l: `${m[1]}. ${m[2].trim()}`, r: `${m[3]}. ${m[4].trim()}` };
    });
    const first = pairIdxs[0], last = pairIdxs[pairIdxs.length - 1];
    let headers: [string, string] = ['List-I', 'List-II'];
    let introEnd = first;
    for (let i = first - 1; i >= 0; i--) {
      if (headerRe.test(lines[i])) {
        const p = parens(lines[i]);
        if (p.length >= 2) headers = [p[0], p[1]];
        introEnd = i;
        break;
      }
    }
    return {
      intro: lines.slice(0, introEnd).join('\n'),
      headers,
      rows,
      outro: lines.slice(last + 1).filter(l => !PAIR.test(l)).join('\n'),
    };
  }

  // Approach B: two separate "List-I …" / "List-II …" blocks
  const isI = (l: string) => /^list[\s.\-–]*i\b/i.test(l) && !/ii\b/i.test(l);
  const isII = (l: string) => /^list[\s.\-–]*ii\b/i.test(l);
  const iIdx = lines.findIndex(isI);
  const iiIdx = lines.findIndex(isII);
  if (iIdx !== -1 && iiIdx > iIdx) {
    const left: string[] = [];
    for (let i = iIdx + 1; i < iiIdx; i++) if (/^[A-Za-z][.)]/.test(lines[i])) left.push(lines[i]);
    const right: string[] = [];
    let k = iiIdx + 1;
    for (; k < lines.length; k++) { if (/^\d+[.)]/.test(lines[k])) right.push(lines[k]); else break; }
    if (left.length >= 2 && right.length >= 2) {
      const n = Math.max(left.length, right.length);
      const rows: { l: string; r: string }[] = [];
      for (let i = 0; i < n; i++) rows.push({ l: left[i] || '', r: right[i] || '' });
      return {
        intro: lines.slice(0, iIdx).join('\n'),
        headers: [parens(lines[iIdx])[0] || 'List-I', parens(lines[iiIdx])[0] || 'List-II'],
        rows,
        outro: lines.slice(k).filter(l => !/^\d+[.)]/.test(l)).join('\n'),
      };
    }
  }

  // Approach D: numbered/roman pair rows ("1. Left : Right", "1 .. Left : Right",
  // or "I. Left : Right"), as in "Consider the following pairs" questions.
  const NPAIR = /^(\d+|(?:IX|IV|VI{0,3}|I{1,3}|X))\s*(?:\.{1,2}|\))\s*(.+?)(?:\s*[:|]\s*|\s+[-–]\s+)(.+)$/;
  const nIdxs: number[] = [];
  lines.forEach((l, i) => { if (NPAIR.test(l)) nIdxs.push(i); });
  if (nIdxs.length >= 2) {
    const rows = nIdxs.map(i => {
      const m = lines[i].match(NPAIR)!;
      return { l: `${m[1]}. ${m[2].trim()}`, r: m[3].trim() };
    });
    const first = nIdxs[0], last = nIdxs[nIdxs.length - 1];
    let headers: [string, string] = ['List-I', 'List-II'];
    let introEnd = first;
    const h = first > 0 ? lines[first - 1] : '';
    if (h && !NPAIR.test(h) && !/^\d/.test(h)) {
      const hm = h.match(/^(.+?)(?:\s*[:|]\s*|\s+[-–]\s+)(.+)$/);
      if (hm && !/[.?]$/.test(h)) { headers = [hm[1].replace(/[:：]\s*$/, '').trim(), hm[2].trim()]; introEnd = first - 1; }
    }
    return {
      intro: lines.slice(0, introEnd).join('\n'),
      headers,
      rows,
      outro: lines.slice(last + 1).filter(l => !NPAIR.test(l)).join('\n'),
    };
  }

  // Approach F: letter-prefixed line pairs with a text right side ("A. X - Y"),
  // e.g. "A. Vishakhapatnam - Deepest". Requires sequential labels A,B,C… to be safe.
  const APAIR = /^([A-Za-z])\s*(?:\.{1,2}|\))\s*(.+?)(?:\s*[:|]\s*|\s+[-–]\s+)(.+)$/;
  const aIdxs: number[] = [];
  lines.forEach((l, i) => { if (APAIR.test(l)) aIdxs.push(i); });
  if (aIdxs.length >= 2) {
    const labels = aIdxs.map(i => lines[i].match(APAIR)![1].toUpperCase());
    const sequential = labels.every((c, i) => c.charCodeAt(0) === labels[0].charCodeAt(0) + i);
    if (sequential) {
      const rows = aIdxs.map(i => {
        const m = lines[i].match(APAIR)!;
        return { l: `${m[1]}. ${m[2].trim()}`, r: m[3].trim() };
      });
      const first = aIdxs[0], last = aIdxs[aIdxs.length - 1];
      let headers: [string, string] = ['List-I', 'List-II'];
      let introEnd = first;
      const h = first > 0 ? lines[first - 1] : '';
      if (h && !APAIR.test(h)) {
        const p = parens(h);
        if (p.length >= 2) { headers = [p[0], p[1]]; introEnd = first - 1; }
        else {
          const hm = h.match(/^(.+?)(?:\s*[:|]\s*|\s+[-–]\s+)(.+)$/);
          if (hm && !/[.?]$/.test(h)) { headers = [hm[1].replace(/[:：]\s*$/, '').trim(), hm[2].trim()]; introEnd = first - 1; }
        }
      }
      return {
        intro: lines.slice(0, introEnd).join('\n'),
        headers,
        rows,
        outro: lines.slice(last + 1).filter(l => !APAIR.test(l)).join('\n'),
      };
    }
  }

  // Approach G: two single-line comma-separated lists — a letter list (A. a, B. b, …)
  // and a number list (1. p, 2. q, …) — regardless of whether they carry a literal
  // "List-I/List-II" label. Uses sequential-label validation to avoid prose misfires.
  const commaItems = (line: string, re: RegExp) => {
    const parts = line.split(',').map(s => s.trim()).filter(Boolean);
    const out: string[] = [];
    let started = false;
    for (let p of parts) {
      if (!started) {
        const m = p.match(re);
        if (!m) continue;
        p = p.slice(p.indexOf(m[0])).trim();
        out.push(p); started = true;
      } else if (re.test(p)) out.push(p);
      else if (out.length) out[out.length - 1] += ', ' + p; // comma inside an item's text
    }
    return out;
  };
  const isSeqLetters = (items: string[]) => items.length >= 2 && items.every((it, i) => it[0].toUpperCase().charCodeAt(0) === items[0][0].toUpperCase().charCodeAt(0) + i);
  const isSeqNums = (items: string[]) => items.length >= 2 && items.every((it, i) => parseInt(it, 10) === i + 1);
  let letterLineIdx = -1, letterItems: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const it = commaItems(lines[i], /[A-Za-z][.)]\s/);
    if (isSeqLetters(it)) { letterLineIdx = i; letterItems = it; break; }
  }
  let numberLineIdx = -1, numberItems: string[] = [];
  for (let i = letterLineIdx + 1; i < lines.length; i++) {
    const it = commaItems(lines[i], /\d+[.)]\s/);
    if (isSeqNums(it)) { numberLineIdx = i; numberItems = it; break; }
  }
  if (letterLineIdx !== -1 && numberLineIdx !== -1) {
    const n = Math.max(letterItems.length, numberItems.length);
    const rows: { l: string; r: string }[] = [];
    for (let i = 0; i < n; i++) rows.push({ l: letterItems[i] || '', r: numberItems[i] || '' });
    // Use a parenthetical as a header only when it appears before the first item
    // marker on that line (a list label like "List-I (X):"), not inside an item.
    const headerFromLine = (line: string, markerRe: RegExp, fallback: string) => {
      const pm = line.match(/\(([^)]+)\)/);
      const mm = line.match(markerRe);
      if (pm && mm && line.indexOf(pm[0]) < line.indexOf(mm[0])) return pm[1].trim();
      return fallback;
    };
    return {
      intro: lines.slice(0, letterLineIdx).join('\n'),
      headers: [
        headerFromLine(lines[letterLineIdx], /[A-Za-z][.)]\s/, 'List-I'),
        headerFromLine(lines[numberLineIdx], /\d+[.)]\s/, 'List-II'),
      ],
      rows,
      outro: lines.slice(numberLineIdx + 1).join('\n'),
    };
  }
  return null;
};

const MatchQuestion: React.FC<{ data: MatchData; query: string; badge: React.ReactNode }> = ({ data, query, badge }) => (
  <div className="text-[13.5px] font-medium text-slate-900 dark:text-slate-100 mb-3.5 px-1">
    <div className="leading-[23px] mb-2 whitespace-pre-wrap">
      {badge}
      {data.intro && <span className="align-middle"><HighlightText text={data.intro} query={query} spaceLists /></span>}
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-600/70">
      <table className="w-full text-[12.5px] border-collapse">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-700/60">
            <th className="text-left font-bold text-slate-700 dark:text-slate-200 px-3 py-2 border-b border-slate-200 dark:border-slate-600/70 w-1/2">{data.headers[0]}</th>
            <th className="text-left font-bold text-slate-700 dark:text-slate-200 px-3 py-2 border-b border-l border-slate-200 dark:border-slate-600/70 w-1/2">{data.headers[1]}</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="odd:bg-white even:bg-slate-50/70 dark:odd:bg-transparent dark:even:bg-slate-700/20">
              <td className="align-top px-3 py-1.5 border-b border-slate-100 dark:border-slate-700/60 leading-[19px]"><HighlightText text={row.l} query={query} /></td>
              <td className="align-top px-3 py-1.5 border-b border-l border-slate-100 dark:border-slate-700/60 leading-[19px]"><HighlightText text={row.r} query={query} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {data.outro && <div className="mt-2 leading-[23px] whitespace-pre-wrap"><HighlightText text={data.outro} query={query} spaceLists /></div>}
  </div>
);

const HighlightText: React.FC<{ text: string | undefined; query: string; spaceLists?: boolean }> = ({ text, query, spaceLists }) => {
  if (!text) return null;
  // First convert markdown bold to HTML
  let htmlText = parseMarkdownBold(text);
  if (spaceLists) htmlText = spaceNumberedList(htmlText);
  
  if (!query.trim()) {
    return <span dangerouslySetInnerHTML={{ __html: htmlText }} />;
  }

  // Escape special regex characters
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  
  // Split by HTML tags to avoid highlighting inside tags
  const parts = htmlText.split(/(<[^>]*>)/g);
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("<") && part.endsWith(">")) {
          return <span key={index} dangerouslySetInnerHTML={{ __html: part }} />;
        }
        
        const subParts = part.split(regex);
        return (
          <React.Fragment key={index}>
            {subParts.map((subPart, subIndex) => 
              regex.test(subPart) ? (
                <mark key={subIndex} className="bg-yellow-200 dark:bg-yellow-500/40 text-slate-900 dark:text-white px-0.5 rounded-sm border-b border-yellow-400 dark:border-yellow-300/30 shadow-sm">
                  {subPart}
                </mark>
              ) : (
                <span key={subIndex}>{subPart}</span>
              )
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

// The bookmark and notes glyphs share one treatment so they stay identical:
// no pill or background, just an embossed icon that lifts on hover and presses
// on click. Colour comes from an SVG gradient rather than a flat text colour.
const cardIconButton =
  "rounded-md p-1.5 transition-transform duration-150 focus:outline-none hover:-translate-y-px hover:scale-110 active:translate-y-px active:scale-100";

// Three stacked shadows do the sculpting: a highlight off the top-left, a hard
// contact shadow to the bottom-right, then a soft blur underneath for depth.
// This has to be one arbitrary `filter` property because twMerge collapses
// repeated `drop-shadow-*` utilities into a single declaration.
// Only the filled (saved) state is sculpted — a white rim along the top-left
// plus a blue glow beneath. Unset icons stay flat.
const cardIcon3d =
  "[filter:drop-shadow(-0.5px_-0.5px_0_rgba(255,255,255,0.85))_drop-shadow(0_1.5px_2px_rgba(37,99,235,0.45))] dark:[filter:drop-shadow(-0.5px_-0.5px_0_rgba(255,255,255,0.25))_drop-shadow(0_1.5px_3px_rgba(59,130,246,0.6))]";

// Gradient definitions for the card action icons. An SVG `url(#id)` reference
// resolves document-wide, so these only need to be mounted once.
const CardIconGradients: React.FC = () => (
  <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute -z-10">
    <defs>
      {/* Matches the Reset button: blue-600 → indigo-600, brighter when set. */}
      <linearGradient id="pyqIconIdle" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#4f46e5" />
      </linearGradient>
      <linearGradient id="pyqIconActive" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#6366f1" />
      </linearGradient>
    </defs>
  </svg>
);

const QuestionCard: React.FC<QuestionCardProps> = ({ 
  question, 
  storageScope,
  index, 
  attemptedOption, 
  isRevealed, 
  onOptionClick, 
  onToggleRevealed,
  isLocked,
  userEmail,
  onCheckStatus,
  onOpenPremium,
  onFeedback,
  showNoteInline,
  onSubjectClick,
  onTopicClick,
  onExamClick,
  onYearClick,
  searchQuery = "",
  isAdmin,
  isEditor,
  onUpdateQuestion
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editAnswer, setEditAnswer] = useState("");
  const [editExplanation, setEditExplanation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const remoteKey = remoteStateKey(storageScope, question.id);
  const [isBookmarked, setIsBookmarked] = useState(() => remoteQuestionState.get(remoteKey)?.isBookmarked ?? false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isNotePreviewVisible, setIsNotePreviewVisible] = useState(false);
  const [questionNote, setQuestionNote] = useState(() => remoteQuestionState.get(remoteKey)?.notes ?? "");
  const [questionNoteTitle, setQuestionNoteTitle] = useState(() =>
    getNoteTitle(remoteQuestionState.get(remoteKey)?.noteTitle, question.topic, question.subject)
  );
  const notesButtonRef = useRef<HTMLButtonElement>(null);
  const noteEditorRef = useRef<HTMLDivElement>(null);
  const notePreviewCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTouchNotePreview, setIsTouchNotePreview] = useState(false);
  const [activeNoteFormats, setActiveNoteFormats] = useState({ bold: false, list: false });
  const [remoteStateVersion, bumpRemoteStateVersion] = useReducer((n: number) => n + 1, 0);
  const colorClasses = subjectColors[question.subject] || subjectColors["Default"];

  useEffect(() => {
    remoteStateListeners.add(bumpRemoteStateVersion);
    return () => {
      remoteStateListeners.delete(bumpRemoteStateVersion);
    };
  }, []);

  const toggleBookmark = () => {
    const next = !isBookmarked;
    setIsBookmarked(next);
    saveRemoteQuestionState(userEmail, storageScope, question, { isBookmarked: next });
  };

  const updateQuestionNote = (value: string) => {
    setQuestionNote(value);
  };

  // Notes are pushed once the editor closes rather than on every keystroke, so
  // a long note costs a single write instead of one per character. Read through
  // a ref because the Escape listener is bound once per open.
  const questionNoteRef = useRef(questionNote);
  questionNoteRef.current = questionNote;
  const questionNoteTitleRef = useRef(questionNoteTitle);
  questionNoteTitleRef.current = questionNoteTitle;

  const closeNotes = () => {
    setIsNotesOpen(false);
    const title = getNoteTitle(questionNoteTitleRef.current, question.topic, question.subject);
    setQuestionNoteTitle(title);
    questionNoteTitleRef.current = title;
    saveRemoteQuestionState(userEmail, storageScope, question, {
      notes: questionNoteRef.current,
      noteTitle: title,
    });
  };

  // Wipes the note immediately (rather than waiting for Done) so the workspace
  // and the card's note icon reflect the reset even if the user then hits
  // Escape. The editor stays open so they can start over without reopening it.
  const clearNote = () => {
    setQuestionNote("");
    questionNoteRef.current = "";
    if (noteEditorRef.current) noteEditorRef.current.innerHTML = "";
    saveRemoteQuestionState(userEmail, storageScope, question, { notes: "" });
  };

  const syncActiveNoteFormats = () => {
    setActiveNoteFormats({
      bold: document.queryCommandState('bold'),
      list: document.queryCommandState('insertUnorderedList'),
    });
  };

  const applyNoteFormat = (format: 'bold' | 'list') => {
    const editor = noteEditorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(format === 'bold' ? 'bold' : 'insertUnorderedList');
    const nextValue = noteEditorToMarkdown(editor);
    setQuestionNote(nextValue);
    questionNoteRef.current = nextValue;
    syncActiveNoteFormats();
  };

  const showNotePreview = (touch = false) => {
    if (notePreviewCloseTimerRef.current) clearTimeout(notePreviewCloseTimerRef.current);
    setIsTouchNotePreview(touch);
    setIsNotePreviewVisible(true);
  };

  const hideNotePreview = () => {
    if (isTouchNotePreview) return;
    if (notePreviewCloseTimerRef.current) clearTimeout(notePreviewCloseTimerRef.current);
    notePreviewCloseTimerRef.current = setTimeout(() => setIsNotePreviewVisible(false), 140);
  };

  const closeNotePreview = () => {
    if (notePreviewCloseTimerRef.current) clearTimeout(notePreviewCloseTimerRef.current);
    setIsNotePreviewVisible(false);
    setIsTouchNotePreview(false);
  };

  const openNoteEditor = () => {
    closeNotePreview();
    setIsNotesOpen(true);
  };

  // The signed-in user's saved state is the only source of truth, so re-sync
  // whenever it loads or the account changes. Clearing on a missing entry is
  // what stops one user's bookmarks leaking to the next on a shared device.
  // Skipped while the note editor is open so a late response cannot overwrite
  // what the user is typing.
  useEffect(() => {
    if (isNotesOpen) return;
    const remote = remoteQuestionState.get(remoteKey);
    setIsBookmarked(remote?.isBookmarked ?? false);
    setQuestionNote(remote?.notes ?? "");
    setQuestionNoteTitle(getNoteTitle(remote?.noteTitle, question.topic, question.subject));
  }, [remoteStateVersion, remoteKey]);

  useEffect(() => {
    if (!isNotesOpen) return;

    if (noteEditorRef.current) {
      noteEditorRef.current.innerHTML = noteMarkdownToEditorHtml(questionNoteRef.current);
      noteEditorRef.current.focus();
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNotes();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isNotesOpen]);

  useEffect(() => () => {
    if (notePreviewCloseTimerRef.current) clearTimeout(notePreviewCloseTimerRef.current);
  }, []);

  const notesButtonRect = isNotePreviewVisible
    ? notesButtonRef.current?.getBoundingClientRect()
    : null;
  const notePreviewOpensUp = !!notesButtonRect && notesButtonRect.bottom > window.innerHeight * 0.6;

  if (isLocked) {
    return (
      <div 
        className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden flex flex-col h-full"
      >
        <div className="absolute inset-0 bg-slate-50/10 dark:bg-slate-900/10 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-indigo-600 p-2 rounded-full mb-3 shadow-lg">
            <Lock className="w-4 h-4 text-white" />
          </div>
          <h4 className="text-[13px] font-bold text-slate-900 dark:text-white mb-2">Premium Question</h4>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-4 line-clamp-3">
            Questions from {question.year} are available for subscribed members only. 
          </p>
          
          <div className="w-full space-y-2">
            <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-left">
              <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-1.5 font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> What you unlock
              </p>
              <ul className="space-y-1">
                <li className="flex items-center gap-1.5 text-[9px] text-slate-500 dark:text-slate-400 leading-tight">
                  <Check className="w-2.5 h-2.5 shrink-0 text-emerald-500" /> All PYQs with detailed solutions
                </li>
                <li className="flex items-center gap-1.5 text-[9px] text-slate-500 dark:text-slate-400 leading-tight">
                  <Check className="w-2.5 h-2.5 shrink-0 text-emerald-500" /> Topper copies &amp; all-in-one ebooks
                </li>
                <li className="flex items-center gap-1.5 text-[9px] text-slate-500 dark:text-slate-400 leading-tight">
                  <Check className="w-2.5 h-2.5 shrink-0 text-emerald-500" /> Advanced filters, search &amp; bookmarks
                </li>
              </ul>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold text-center mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                1 Year ₹899 · 2 Years ₹1299
              </p>
            </div>
            <button 
              onClick={onOpenPremium}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg text-[10px] transition-colors shadow-md flex items-center justify-center gap-1.5"
            >
              <Crown className="w-3 h-3" /> View Premium Plans
            </button>
          </div>
        </div>

        {/* Blurred Background Content */}
        <div className="opacity-20 pointer-events-none filter blur-[1px]">
          <div className="flex justify-between items-start mb-3 gap-2">
            <div className="flex gap-1.5 items-center">
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-slate-200 dark:ring-slate-600/70">
                {question.exam}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap bg-slate-100/50 dark:bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/50">
              {question.year}
            </span>
          </div>
          <h3 className="text-[13px] font-normal text-slate-900 dark:text-slate-100 mb-1.5 leading-relaxed">
            {(question.question || '').substring(0, 50)}...
          </h3>
          <div className="space-y-1.5 mb-5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-full h-8 bg-slate-100 dark:bg-slate-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative bg-white dark:bg-slate-800/70 backdrop-blur-sm p-4 sm:p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_30px_-8px_rgba(59,130,246,0.25)] dark:shadow-black/10 ring-1 ring-slate-200/70 dark:ring-slate-700/70 hover:ring-blue-400/60 dark:hover:ring-blue-500/50 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full group animate-fadeInUp overflow-hidden"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms`, animationFillMode: 'both' }}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="mb-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span 
            onClick={() => onExamClick?.(question.exam)}
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-slate-200 dark:ring-slate-600/70 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <FileText className="w-3 h-3 mr-1 text-slate-400" /> {question.exam}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {onFeedback && (
              <button
                type="button"
                onClick={onFeedback}
                title="Report an issue or give feedback on this question"
                className={cardIconButton}
              >
                <MessageSquareText
                  className="h-3.5 w-3.5"
                  strokeWidth={2}
                  stroke="url(#pyqIconIdle)"
                  fill="none"
                />
              </button>
            )}
            <button
              type="button"
              onClick={toggleBookmark}
              aria-pressed={isBookmarked}
              title={isBookmarked ? "Remove bookmark" : "Bookmark this question"}
              className={cardIconButton}
            >
              <Bookmark
                className={cn("h-3.5 w-3.5", isBookmarked && cardIcon3d)}
                strokeWidth={2}
                stroke={isBookmarked ? "url(#pyqIconActive)" : "url(#pyqIconIdle)"}
                fill={isBookmarked ? "url(#pyqIconActive)" : "none"}
              />
            </button>
            <button
              ref={notesButtonRef}
              type="button"
              onClick={() => {
                const usesTouchInteraction = window.matchMedia('(hover: none), (pointer: coarse)').matches;
                if (usesTouchInteraction && questionNote.trim()) {
                  showNotePreview(true);
                } else {
                  openNoteEditor();
                }
              }}
              onMouseEnter={() => showNotePreview(false)}
              onMouseLeave={hideNotePreview}
              onFocus={() => showNotePreview(false)}
              onBlur={hideNotePreview}
              aria-expanded={isNotesOpen}
              title={questionNote ? "View or edit your note" : "Add a note"}
              className={cardIconButton}
            >
              {questionNote
                ? <FilePlus
                    className={cn("h-3.5 w-3.5", cardIcon3d)}
                    strokeWidth={2}
                    stroke="url(#pyqIconActive)"
                    fill="url(#pyqIconActive)"
                    fillOpacity={0.25}
                  />
                : <FilePlus
                    className="h-3.5 w-3.5"
                    strokeWidth={2}
                    stroke="url(#pyqIconIdle)"
                    fill="none"
                  />}
            </button>
            <span 
              onClick={() => onYearClick?.(question.year)}
              className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap bg-slate-100 dark:bg-slate-700/50 px-2.5 py-1 rounded-full ring-1 ring-inset ring-slate-200 dark:ring-slate-600/70 flex items-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Calendar className="w-3 h-3 mr-1" />{question.year}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span 
              onClick={() => onSubjectClick?.(question.subject)}
              className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide ring-1 ring-inset cursor-pointer hover:opacity-90 transition-opacity", colorClasses)}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
              {question.subject}
            </span>
            {question.topic && (
              <span 
                onClick={() => onTopicClick?.(question.topic!)}
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-slate-200 dark:ring-slate-600/70 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {question.topic}
              </span>
            )}
          </div>
          <div className="shrink-0 pr-1">
            <AttemptIndicator question={question} questionType={storageScope} userEmail={userEmail} />
          </div>
        </div>
      </div>

      {isNotePreviewVisible && notesButtonRect && createPortal(
        <>
          {isTouchNotePreview && (
            <button
              type="button"
              className="fixed inset-0 z-[99] cursor-default bg-slate-950/25 backdrop-blur-[2px]"
              onClick={closeNotePreview}
              aria-label="Close note preview"
            />
          )}
          <div
            className="fixed z-[100] flex w-72 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-violet-200/80 bg-white/95 shadow-2xl shadow-violet-950/15 backdrop-blur-xl dark:border-violet-500/25 dark:bg-slate-900/95 dark:shadow-black/30"
            onMouseEnter={() => showNotePreview(isTouchNotePreview)}
            onMouseLeave={hideNotePreview}
            style={isTouchNotePreview ? {
              left: '50%',
              top: '50%',
              width: 'calc(100vw - 1rem)',
              maxWidth: '42rem',
              height: '77vh',
              maxHeight: '77vh',
              transform: 'translate(-50%, -50%)',
            } : {
              right: Math.max(8, window.innerWidth - notesButtonRect.right),
              ...(notePreviewOpensUp
                ? { bottom: Math.max(8, window.innerHeight - notesButtonRect.top + 7) }
                : { top: Math.max(8, notesButtonRect.bottom + 7) }),
              maxHeight: 'min(70vh, 32rem)',
            }}
          >
            <div className="flex items-center gap-1.5 border-b border-violet-200/70 bg-gradient-to-r from-violet-100/80 to-indigo-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:border-violet-500/20 dark:from-violet-500/15 dark:to-indigo-500/10 dark:text-violet-300">
              <FilePlus className="h-3 w-3" />
              <span className="min-w-0 flex-1 truncate">{questionNoteTitle}</span>
              {isTouchNotePreview && (
                <button
                  type="button"
                  onClick={closeNotePreview}
                  className="rounded-md p-1 text-violet-500 hover:bg-violet-200/70 dark:text-violet-300 dark:hover:bg-violet-500/20"
                  aria-label="Close note preview"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="note-paper-lines min-h-0 flex-1 overflow-y-auto border-l-2 border-violet-400/60 px-3.5 py-3 text-[11px] leading-[22px] text-slate-700 dark:border-violet-400/40 dark:text-slate-200">
              {questionNote.trim()
                ? <NoteContent note={questionNote.trim()} />
                : "No note added yet. Click to add one."}
            </div>
            {isTouchNotePreview && (
              <div className="sticky bottom-0 z-10 mt-auto border-t border-violet-100 bg-white/95 p-2.5 shadow-[0_-8px_24px_-18px_rgba(76,29,149,0.45)] backdrop-blur-md dark:border-violet-500/15 dark:bg-slate-900/95">
                <button
                  type="button"
                  onClick={openNoteEditor}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-600/20"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit note
                </button>
              </div>
            )}
          </div>
        </>,
        document.body
      )}

      {isNotesOpen && createPortal(
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-md"
          onMouseDown={() => closeNotes()}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`question-note-title-${storageScope}-${question.id}`}
            onMouseDown={(event) => event.stopPropagation()}
            className="flex h-[81vh] max-h-[calc(100vh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] border border-violet-200/70 bg-white shadow-2xl shadow-violet-950/20 dark:border-violet-500/20 dark:bg-slate-900"
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-violet-200/70 bg-gradient-to-r from-violet-50 via-white to-indigo-50 px-5 py-4 sm:px-6 dark:border-violet-500/20 dark:from-violet-500/10 dark:via-slate-900 dark:to-indigo-500/10">
              <div
                id={`question-note-title-${storageScope}-${question.id}`}
                className="flex min-w-0 items-center gap-3 text-sm font-bold text-slate-900 dark:text-white"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/20 ring-1 ring-inset ring-white/20">
                  <StickyNote className="h-5 w-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1 leading-tight">
                  <span className="group/title flex min-w-0 items-center gap-2">
                    <input
                      value={questionNoteTitle}
                      onChange={(event) => setQuestionNoteTitle(event.target.value)}
                      onBlur={() => {
                        const title = getNoteTitle(questionNoteTitle, question.topic, question.subject);
                        setQuestionNoteTitle(title);
                        questionNoteTitleRef.current = title;
                      }}
                      maxLength={120}
                      aria-label="Editable note title"
                      title="Click to edit note title"
                      className="min-w-0 w-full border-0 border-b border-dashed border-violet-300 bg-transparent p-0 pb-0.5 text-base font-extrabold text-slate-900 shadow-none outline-none transition focus:border-violet-500 focus:shadow-none dark:border-violet-500/40 dark:text-white dark:focus:border-violet-400"
                      placeholder={question.topic || question.subject || 'Study note'}
                    />
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-violet-100 px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                      <Pencil className="h-2.5 w-2.5" />
                      <span className="hidden sm:inline">Edit title</span>
                    </span>
                  </span>
                  <span className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Question {question.id} · {question.subject}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => closeNotes()}
                aria-label="Close notes"
                className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-violet-100 bg-violet-50/35 px-5 py-2 sm:px-6 dark:border-violet-500/15 dark:bg-violet-500/5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyNoteFormat('bold');
                  }}
                  aria-pressed={activeNoteFormats.bold}
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-md transition",
                    activeNoteFormats.bold
                      ? "bg-violet-600 text-white shadow-sm shadow-violet-500/25 ring-1 ring-inset ring-violet-500 dark:bg-violet-500 dark:ring-violet-400"
                      : "text-slate-500 hover:bg-violet-100 hover:text-violet-700 dark:text-slate-400 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
                  )}
                  title="Bold selected text"
                  aria-label="Bold selected text"
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyNoteFormat('list');
                  }}
                  aria-pressed={activeNoteFormats.list}
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-md transition",
                    activeNoteFormats.list
                      ? "bg-violet-600 text-white shadow-sm shadow-violet-500/25 ring-1 ring-inset ring-violet-500 dark:bg-violet-500 dark:ring-violet-400"
                      : "text-slate-500 hover:bg-violet-100 hover:text-violet-700 dark:text-slate-400 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
                  )}
                  title="Bulleted list"
                  aria-label="Bulleted list"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-2.5 pt-3 sm:px-3">
              <div
                ref={noteEditorRef}
                id={`question-note-${storageScope}-${question.id}`}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                data-placeholder="Write a note for this question..."
                onInput={(event) => {
                  const nextValue = noteEditorToMarkdown(event.currentTarget);
                  updateQuestionNote(nextValue);
                  questionNoteRef.current = nextValue;
                  syncActiveNoteFormats();
                }}
                onKeyUp={syncActiveNoteFormats}
                onMouseUp={syncActiveNoteFormats}
                className="note-editor min-h-[12rem] w-full flex-1 overflow-y-auto rounded-2xl border border-violet-200/80 px-5 py-3 text-[15px] leading-[30px] text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-violet-500/25 dark:text-slate-100 dark:focus:border-violet-400 [&_strong]:font-bold [&_strong]:text-violet-950 dark:[&_strong]:text-violet-100 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ul]:marker:text-violet-500 [&_li]:pl-1"
              />
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-3 py-3">
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                {questionNote.trim().length} characters · saves when closed
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={clearNote}
                  disabled={questionNote.trim() === ""}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-red-500/50 dark:hover:bg-red-500/10 dark:hover:text-red-400 dark:disabled:hover:border-slate-600 dark:disabled:hover:bg-slate-800 dark:disabled:hover:text-slate-300"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => closeNotes()}
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/20 transition hover:from-violet-500 hover:to-indigo-500"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {showNoteInline && questionNote.trim() !== "" && (
        <div className="mb-4 overflow-hidden rounded-2xl border border-emerald-200/80 bg-white shadow-sm shadow-emerald-950/5 dark:border-emerald-500/25 dark:bg-emerald-500/10">
          <div className="flex items-center gap-1.5 border-b border-emerald-200/70 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-500/20 dark:from-emerald-500/10 dark:to-teal-500/10 dark:text-emerald-300">
            <FilePlus className="h-3 w-3" /> {questionNoteTitle}
          </div>
          <div className="border-l-2 border-emerald-400/60 bg-emerald-50/55 px-4 py-3 dark:border-emerald-400/40 dark:bg-emerald-500/5">
            <NoteContent
              note={questionNote.trim()}
              className="text-[12px] leading-[22px] text-emerald-950/85 dark:text-emerald-50/90"
              bulletClassName="bg-emerald-500 shadow-emerald-500/30"
            />
          </div>
        </div>
      )}

      {(() => {
        const md = parseMatchTable(question.question);
        const badge = <span className="inline-flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-bold px-2 py-0.5 mr-2 ring-1 ring-blue-500/20 align-middle">Q{question.id}</span>;
        return md ? (
          <MatchQuestion data={md} query={searchQuery} badge={badge} />
        ) : (
          <h3 className="text-[13.5px] font-medium text-slate-900 dark:text-slate-100 mb-3.5 leading-[23px] whitespace-pre-wrap px-1">
            {badge}
            <HighlightText text={question.question} query={searchQuery} spaceLists />
          </h3>
        );
      })()}
      
      <div className="space-y-2 mb-5 px-1">
        {(question.options || []).map(opt => {
          const isCorrectAnswer = opt === question.answer;
          const isSelected = opt === attemptedOption;
          const hasAttempted = !!attemptedOption;
          // Results only colour the options while the answer is on screen, so
          // hiding the answer genuinely resets the question for a re-attempt.
          const showResult = hasAttempted && isRevealed;

          return (
            <button
              key={opt}
              disabled={showResult || isSelected}
              onClick={() => onOptionClick(opt)}
              className={cn(
                "w-full text-left py-2.5 px-4 border rounded-xl text-[13px] font-medium transition-all flex justify-between items-center group/btn leading-[19px]",
                !showResult && "bg-slate-50/80 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600/70 text-slate-700 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-slate-600/70 hover:border-blue-300 dark:hover:border-blue-500/60 hover:shadow-sm cursor-pointer active:scale-[0.98]",
                !showResult && isSelected && "ring-1 ring-blue-400/60 cursor-default",
                showResult && isCorrectAnswer && "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-500/10",
                showResult && isSelected && !isCorrectAnswer && "bg-red-50 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-400 shadow-sm shadow-red-500/10",
                showResult && !isCorrectAnswer && !isSelected && "bg-slate-50/50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 opacity-60"
              )}
            >
              <span className="text-left pr-3 leading-[19px]">
                <HighlightText text={opt} query={searchQuery} />
              </span>
              {showResult && isCorrectAnswer && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-500 shrink-0" />}
              {showResult && isSelected && !isCorrectAnswer && <XCircle className="w-4 h-4 text-red-600 dark:text-red-500 shrink-0" />}
            </button>
          );
        })}
      </div>
      
      <div className={cn("flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-700/50 mt-auto", isRevealed && "mb-3")}>
        <button 
          onClick={onToggleRevealed} 
          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-white bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-600 dark:hover:bg-blue-600 px-3 py-1.5 rounded-full flex items-center focus:outline-none transition-colors ring-1 ring-blue-500/20"
        >
          <div
            className={cn("mr-1.5 transition-transform duration-200", isRevealed ? "rotate-180" : "rotate-0")}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
          <span>{isRevealed ? "Hide Answer" : "Show Answer"}</span>
        </button>
        
        <div className="flex items-center gap-2">
        <a 
          href={`https://www.google.com/search?q=${encodeURIComponent((question.question || '').replace(/<[^>]*>?/gm, ' '))}`} 
          target="_blank" 
          rel="noopener noreferrer" 
          title="Search Google for this question" 
          className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-white flex items-center transition-colors px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:bg-blue-600 dark:hover:bg-blue-600 hover:border-blue-500 focus:outline-none"
        >
          <ExternalLink className="w-3 h-3 mr-1.5" /> Search
        </a>
        </div>
      </div>
      
      {isRevealed && (
        <div className="pt-3 px-1 animate-fadeInUp">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-full ring-1 ring-emerald-500/20 mb-2.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Answer: {question.answer}
          </div>
          {question.explanation && (
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-slate-800/40 border border-indigo-100 dark:border-indigo-500/20 p-3.5 rounded-xl shadow-sm">
              <p className="text-[12px] text-indigo-900 dark:text-indigo-200 leading-[18px]">
                <span className="inline-flex items-center gap-1 font-bold text-indigo-700 dark:text-indigo-300 uppercase text-[10px] tracking-wider mb-1.5"><Sparkles className="w-3 h-3" /> Explanation</span>
                <span className="block whitespace-pre-wrap">
                  <HighlightText text={question.explanation} query={searchQuery} />
                </span>
              </p>
            </div>
          )}

          {/* Admin/editor edit button */}
          {(isAdmin || isEditor) && onUpdateQuestion && !isEditing && (
            <button
              onClick={() => {
                setEditAnswer(question.answer || "");
                setEditExplanation(question.explanation || "");
                setIsEditing(true);
              }}
              className="mt-2 text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" /> Edit Answer
            </button>
          )}

          {/* Admin/editor edit form */}
          {(isAdmin || isEditor) && isEditing && (
            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-amber-700 dark:text-amber-300 w-16">Answer</label>
                <FancySelect
                  value={editAnswer}
                  onChange={(v) => setEditAnswer(v)}
                  ariaLabel="Answer"
                  className="flex-1"
                  options={[{ value: "", label: "-- Select --" }, ...(question.options || []).map(opt => ({ value: opt, label: opt }))]}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-amber-700 dark:text-amber-300 block mb-1">Explanation <span className="font-normal text-amber-600/70">— # Heading, ## Sub-heading, **bold**, Enter = new line</span></label>
                <textarea
                  value={editExplanation}
                  onChange={(e) => setEditExplanation(e.target.value)}
                  rows={3}
                  className="w-full text-xs border border-amber-300 dark:border-amber-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-y"
                  placeholder="Enter explanation... (# Heading, **bold**, new lines supported)"
                />
              </div>
              <div className="flex gap-2">
                <button
                  disabled={isSaving}
                  onClick={async () => {
                    setIsSaving(true);
                    try {
                      await onUpdateQuestion(question.id, question.year, editAnswer, editExplanation);
                      setIsEditing(false);
                    } catch {}
                    setIsSaving(false);
                  }}
                  className="text-[10px] font-bold px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-[10px] font-bold px-3 py-1 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

// Marks + word limit as one segmented pill: rounded at both ends, split by a
// hairline. Shared by the Mains and Topper's Copy cards so they read the same.
// Renders nothing unless the paper actually stated a value.
const MarksWordsPill: React.FC<{ marks?: number | null; words?: number | null }> = ({ marks, words }) => {
  if (marks == null && words == null) return null;
  const seg = "px-2.5 py-[3px] leading-none whitespace-nowrap";
  return (
    <span
      className="inline-flex items-stretch overflow-hidden rounded-full text-[10px] font-bold ring-1 ring-inset ring-blue-400/25 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
      title={[marks != null && `${marks} marks`, words != null && `${words} words`].filter(Boolean).join(" · ")}
    >
      {marks != null && (
        <span className={cn(seg, "bg-gradient-to-r from-blue-500/15 to-indigo-500/15 text-blue-600 dark:from-blue-400/15 dark:to-indigo-400/15 dark:text-blue-300")}>
          {marks}<span className="ml-0.5 font-semibold opacity-70">marks</span>
        </span>
      )}
      {marks != null && words != null && <span className="w-px bg-blue-400/25" />}
      {words != null && (
        <span className={cn(seg, "bg-gradient-to-r from-indigo-500/10 to-violet-500/15 text-indigo-600 dark:from-indigo-400/10 dark:to-violet-400/15 dark:text-indigo-300")}>
          {words}<span className="ml-0.5 font-semibold opacity-70">words</span>
        </span>
      )}
    </span>
  );
};

interface MainsQuestionCardProps {
  question: MainsQuestion;
  isAnswerVisible: boolean;
  onToggleAnswer: () => void;
  searchQuery?: string;
  onSubjectClick?: (subject: string) => void;
  onExamClick?: (exam: string) => void;
  onYearClick?: (year: string) => void;
  onFeedback?: () => void;
}

const MainsQuestionCard: React.FC<MainsQuestionCardProps> = ({
  question,
  isAnswerVisible,
  onToggleAnswer,
  searchQuery = "",
  onSubjectClick,
  onExamClick,
  onYearClick,
  onFeedback,
}) => {
  const colorClasses = subjectColors[question.subject] || subjectColors["Default"];
  const answer = question.modelAnswer || question.model_answer || "";
  const hasModelAnswer = !!answer.trim();

  return (
    <div className="relative bg-white dark:bg-slate-800/70 backdrop-blur-sm p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_30px_-8px_rgba(59,130,246,0.25)] dark:shadow-black/10 ring-1 ring-slate-200/70 dark:ring-slate-700/70 hover:ring-blue-400/60 dark:hover:ring-blue-500/50 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full group overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="flex justify-between items-start mb-3 gap-2">
        <div className="flex gap-1.5 items-center flex-wrap">
          <span
            onClick={() => onExamClick?.(question.exam)}
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-slate-200 dark:ring-slate-600/70 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <FileText className="w-3 h-3 mr-1 text-slate-400" /> {question.exam}
          </span>
          <span
            onClick={() => onSubjectClick?.(question.subject)}
            className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide ring-1 ring-inset cursor-pointer hover:opacity-90 transition-opacity", colorClasses)}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
            {question.subject}
          </span>
          {question.paper && (
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-slate-200 dark:ring-slate-600/70">
              {question.paper}
            </span>
          )}
          {question.topic && (
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-slate-200 dark:ring-slate-600/70">
              {question.topic}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Marks / word limit — only rendered when the paper actually stated them */}
          <MarksWordsPill marks={question.marks} words={question.words} />
          {onFeedback && (
            <button
              type="button"
              onClick={onFeedback}
              title="Report an issue or give feedback on this question"
              className={cardIconButton}
            >
              <MessageSquareText
                className="h-3.5 w-3.5"
                strokeWidth={2}
                stroke="url(#pyqIconIdle)"
                fill="none"
              />
            </button>
          )}
          <span
            onClick={() => onYearClick?.(question.year)}
            className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap bg-slate-100 dark:bg-slate-700/50 px-2.5 py-1 rounded-full ring-1 ring-inset ring-slate-200 dark:ring-slate-600/70 flex items-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Calendar className="w-3 h-3 mr-1" />{question.year}
          </span>
        </div>
      </div>

      <h3 className="text-[13.5px] font-medium text-slate-900 dark:text-slate-100 mb-4 leading-[23px] whitespace-pre-wrap flex-grow">
        <HighlightText text={question.question} query={searchQuery} spaceLists />
      </h3>

      {question.keywords && question.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {question.keywords.map((kw, i) => (
            <span key={i} className="text-[9.5px] px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full ring-1 ring-inset ring-blue-500/20 font-semibold">
              {kw}
            </span>
          ))}
        </div>
      )}

      <div className={cn("pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between", isAnswerVisible && "mb-3")}>
        <div
          onClick={onToggleAnswer}
          className="flex-grow cursor-pointer flex items-center py-1 -my-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
        >
          <div className={cn("mr-1.5 transition-transform duration-200", isAnswerVisible ? "rotate-180" : "rotate-0")}>
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
          <span>{isAnswerVisible ? "Hide Model Answer" : "Show Model Answer"}</span>
        </div>
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(question.question)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 p-1.5 rounded-md text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          title="Search on Google"
        >
          <Search className="w-3.5 h-3.5" />
        </a>
      </div>

      {isAnswerVisible && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-indigo-500 p-3 rounded-r-lg shadow-sm">
          <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider mb-2">Model Answer</p>
          {hasModelAnswer ? (
            <p className="text-[12px] text-indigo-900 dark:text-indigo-200 leading-relaxed whitespace-pre-wrap">
              <HighlightText text={answer} query={searchQuery} />
            </p>
          ) : (
            <p className="text-[12px] text-slate-600 dark:text-slate-300 italic">Model answer not available yet</p>
          )}
        </div>
      )}
    </div>
  );
};

// Topper scroll tabs - items in view show full name, items at edges collapse to circles
function TopperScrollTabs({ answers, activeIdx, onSelect }: { answers: any[]; activeIdx: number; onSelect: (idx: number) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());

  const updateVisibility = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const newVisible = new Set<number>();
    const children = container.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement;
      const childRect = child.getBoundingClientRect();
      const childCenter = childRect.left + childRect.width / 2;
      // Consider visible if center is within container bounds with some padding
      if (childCenter >= rect.left + 10 && childCenter <= rect.right - 10) {
        newVisible.add(i);
      }
    }
    setVisibleItems(newVisible);
  }, []);

  useEffect(() => {
    updateVisibility();
    const container = scrollRef.current;
    if (container) {
      container.addEventListener('scroll', updateVisibility);
      const observer = new ResizeObserver(updateVisibility);
      observer.observe(container);
      return () => { container.removeEventListener('scroll', updateVisibility); observer.disconnect(); };
    }
  }, [updateVisibility, answers.length]);

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-1.5 mb-3 overflow-x-auto scrollbar-hide py-1 px-0.5"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {answers.map((answer, idx) => {
        const isExpanded = visibleItems.has(idx);
        const isActive = activeIdx === idx;
        return (
          <button
            key={idx}
            title={answer.topperName + (answer.rank ? ` (AIR ${answer.rank})` : '')}
            onClick={() => onSelect(idx)}
            className={cn(
              "flex items-center rounded-full font-semibold whitespace-nowrap transition-all duration-300 ease-in-out shrink-0",
              isActive
                ? "gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shadow-sm ring-2 ring-blue-300 dark:ring-blue-600"
                : isExpanded
                  ? "gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  : "w-8 h-8 justify-center bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
            )}
          >
            <div className={cn(
              "rounded-full flex items-center justify-center text-white font-bold shrink-0 transition-all duration-300",
              isActive ? "w-5 h-5 text-[9px] bg-gradient-to-br from-blue-400 to-indigo-500"
                : isExpanded ? "w-5 h-5 text-[9px] bg-slate-400 dark:bg-slate-500"
                : "w-8 h-8 text-[11px] bg-slate-400 dark:bg-slate-500"
            )}>
              {answer.topperName.charAt(0)}
            </div>
            {(isExpanded || isActive) && (
              <span className={cn("text-[11px] transition-opacity duration-300", isActive ? "font-bold" : "")}>
                {answer.topperName}
              </span>
            )}
            {(isExpanded || isActive) && answer.rank && (
              <span className="text-[9px] text-blue-500 dark:text-blue-400 font-bold">AIR {answer.rank}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'prelims' | 'mains' | 'essay' | 'toppers' | 'csat' | 'english'>('prelims');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [mainsQuestions, setMainsQuestions] = useState<MainsQuestion[]>([]);
  const [csatQuestions, setCSATQuestions] = useState<Question[]>([]);
  const [englishQuestions, setEnglishQuestions] = useState<Question[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [hasLoadedAllQuestions, setHasLoadedAllQuestions] = useState(false);
  const [isLoadingMains, setIsLoadingMains] = useState(false);
  const [isLoadingCSAT, setIsLoadingCSAT] = useState(false);
  const [isLoadingEnglish, setIsLoadingEnglish] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("All");
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [notedOnly, setNotedOnly] = useState(false);
  const [sortMode, setSortMode] = useState<
    'latest' | 'oldest' | 'score-asc' | 'score-desc' | 'attempts-desc' | 'attempts-asc'
  >('latest');
  const [examFilter, setExamFilter] = useState("All");
  const [paperFilter, setPaperFilter] = useState("All");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [topicFilter, setTopicFilter] = useState("All");
  const [isSavingDefaultFilters, setIsSavingDefaultFilters] = useState(false);
  const [defaultFilterMessage, setDefaultFilterMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [savedPrelimsFilterDefaults, setSavedPrelimsFilterDefaults] = useState<PrelimsFilterPreferences | null>(null);
  const [savedCSATFilterDefaults, setSavedCSATFilterDefaults] = useState<CSATFilterPreferences | null>(null);
  const [savedEnglishFilterDefaults, setSavedEnglishFilterDefaults] = useState<PrelimsFilterPreferences | null>(null);
  const [savingDefaultSection, setSavingDefaultSection] = useState<null | 'prelims' | 'csat' | 'english'>(null);
  const [isApplyingDefaultFilters, setIsApplyingDefaultFilters] = useState(false);
  const [mainsYearFilter, setMainsYearFilter] = useState("All");
  const [mainsExamFilter, setMainsExamFilter] = useState("All");
  const [mainsSubjectFilter, setMainsSubjectFilter] = useState("All");
  const [mainsTopicFilter, setMainsTopicFilter] = useState("All");
  const [mainsSearchQuery, setMainsSearchQuery] = useState("");
  const [userAttempts, setUserAttempts] = useState<Record<number, string>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [revealedMainsAnswers, setRevealedMainsAnswers] = useState<Record<string, boolean>>({});
  const [mainsRandomMode, setMainsRandomMode] = useState(false);
  const [mainsRandomizedQuestions, setMainsRandomizedQuestions] = useState<MainsQuestion[]>([]);
  const [mainsRandomSelectLimit, setMainsRandomSelectLimit] = useState(10);
  const [toppersQuestions, setToppersQuestions] = useState<ToppersCopyQuestion[]>([]);
  const [isLoadingToppers, setIsLoadingToppers] = useState(false);
  const [toppersYearFilter, setToppersYearFilter] = useState("All");
  const [toppersTopperFilter, setToppersTopperFilter] = useState("All");
  const [toppersSubjectFilter, setToppersSubjectFilter] = useState("All");
  const [toppersPaperFilter, setToppersPaperFilter] = useState("All");
  const [toppersSearchQuery, setToppersSearchQuery] = useState("");
  const [activeTopperIndex, setActiveTopperIndex] = useState<Record<string, number>>({});
  
  // CSAT and English filters
  const [csatYearFilter, setCSATYearFilter] = useState("All");
  const [csatSubjectFilter, setCSATSubjectFilter] = useState("All");
  const [csatSearchQuery, setCSATSearchQuery] = useState("");
  const [csatVisibleCount, setCSATVisibleCount] = useState(30);
  const [csatRandomMode, setCSATRandomMode] = useState(false);
  const [csatRandomizedQuestions, setCSATRandomizedQuestions] = useState<Question[]>([]);
  const [csatRandomSelectLimit, setCSATRandomSelectLimit] = useState(10);
  const [csatBookmarkedOnly, setCSATBookmarkedOnly] = useState(false);
  const [csatNotedOnly, setCSATNotedOnly] = useState(false);
  const [csatSortMode, setCSATSortMode] = useState<QuestionSortMode>('latest');
  
  const [englishYearFilter, setEnglishYearFilter] = useState("All");
  const [englishSubjectFilter, setEnglishSubjectFilter] = useState("All");
  const [englishTopicFilter, setEnglishTopicFilter] = useState("All");
  const [englishExamFilter, setEnglishExamFilter] = useState("All");
  const [englishPaperFilter, setEnglishPaperFilter] = useState("All");
  const [englishSearchQuery, setEnglishSearchQuery] = useState("");
  const [englishVisibleCount, setEnglishVisibleCount] = useState(30);
  const [englishRandomMode, setEnglishRandomMode] = useState(false);
  const [englishRandomizedQuestions, setEnglishRandomizedQuestions] = useState<Question[]>([]);
  const [englishRandomSelectLimit, setEnglishRandomSelectLimit] = useState(10);
  const [englishBookmarkedOnly, setEnglishBookmarkedOnly] = useState(false);
  const [englishNotedOnly, setEnglishNotedOnly] = useState(false);
  const [englishSortMode, setEnglishSortMode] = useState<QuestionSortMode>('latest');

  // Bookmarks, notes and attempt counts live in the shared remote-state map, so
  // every list that reads them must re-render when it changes (a save, or a new
  // account). Declared here because the Prelims, CSAT and English memos all
  // depend on it.
  const [workspaceVersion, bumpWorkspaceVersion] = useReducer((n: number) => n + 1, 0);

  // Infinite scroll using callback refs
  const csatObserverRef = useRef<IntersectionObserver | null>(null);
  const englishObserverRef = useRef<IntersectionObserver | null>(null);

  const csatScrollRef = useCallback((node: HTMLDivElement | null) => {
    if (csatObserverRef.current) csatObserverRef.current.disconnect();
    if (!node) return;
    csatObserverRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !csatRandomMode) {
        setCSATVisibleCount(prev => prev + 30);
      }
    }, { threshold: 0.1 });
    csatObserverRef.current.observe(node);
  }, [csatRandomMode]);

  const englishScrollRef = useCallback((node: HTMLDivElement | null) => {
    if (englishObserverRef.current) englishObserverRef.current.disconnect();
    if (!node) return;
    englishObserverRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !englishRandomMode) {
        setEnglishVisibleCount(prev => prev + 30);
      }
    }, { threshold: 0.1 });
    englishObserverRef.current.observe(node);
  }, [englishRandomMode]);
  
  const [score, setScore] = useState({ correct: 0, total: 0 });
  // Per-section score for the current practice session (prelims/csat/english).
  const [sectionScores, setSectionScores] = useState<Record<string, { correct: number; total: number }>>({});
  // An attempt = questions answered in one run, until the user presses Reset or reloads.
  const newAttemptId = () => `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [attemptId, setAttemptId] = useState<string>(newAttemptId);
  const [visibleCount, setVisibleCount] = useState(() => {
    const saved = localStorage.getItem('visibleCount');
    return saved ? parseInt(saved) : 30;
  });
  const [mainsVisibleCount, setMainsVisibleCount] = useState(30);
  const [randomMode, setRandomMode] = useState<{ active: boolean; limit: number }>({ active: false, limit: 0 });
  const [randomizedQuestions, setRandomizedQuestions] = useState<Question[]>([]);
  const [randomSelectLimit, setRandomSelectLimit] = useState(10);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    // Default to dark mode (true) if nothing is saved
    return saved === null ? true : saved === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Persist scroll position (visibleCount)
  useEffect(() => {
    localStorage.setItem('visibleCount', String(visibleCount));
  }, [visibleCount]);

  // Slim the header once the page is scrolled
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [userEmail, setUserEmail] = useState<string | null>(() => {
    const saved = localStorage.getItem('user_session');
    if (!saved) return null;
    try {
      const session = JSON.parse(saved);
      const currentTime = Date.now();
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
      if (currentTime - session.loginTime < sevenDaysInMs) {
        return session.email;
      }
      localStorage.removeItem('user_session');
      return null;
    } catch {
      return null;
    }
  });
  const loadedDefaultFiltersForEmailRef = useRef<string | null>(null);

  // Pull the user's saved bookmarks and notes once per login so they appear on
  // every device. Clears the cache on logout.
  useEffect(() => {
    loadRemoteQuestionState(userEmail);
  }, [userEmail]);

  const fetchQuestions = async (showLoading = true) => {
    if (showLoading) setIsLoadingQuestions(true);
    try {
      console.log("Fetching questions from API...");
      const response = await fetch('/api/questions');
      if (!response.ok) throw new Error("API response not ok");
      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        console.log(`Loaded ${data.length} questions from API`);
       // Keep the 100 shown locally, then append remaining questions from API.
       // The feed itself contains repeated ids, so track ids as we go rather
       // than only diffing against `prev` — otherwise two copies of the same id
       // inside one batch both survive and collide on React's `key`.
       setQuestions(prev => {
         const seenIds = new Set(prev.map(q => String(q.id)));
         const newQuestions: Question[] = [];
         for (const q of data as Question[]) {
           const id = String(q.id);
           if (seenIds.has(id)) continue;
           seenIds.add(id);
           newQuestions.push(q);
         }
         return [...prev, ...newQuestions];
       });
      } else {
       throw new Error("Empty data from API");
      }
    } catch (error) {
      console.warn("Server API failed, falling back to local data:", error);
      console.log(`Loaded ${fallbackQuestions.length} questions from local fallback`);
      setQuestions(fallbackQuestions as Question[]);
    } finally {
      setIsLoadingQuestions(false);
      setHasLoadedAllQuestions(true);
    }
  };

  const fetchMainsQuestions = async () => {
    setIsLoadingMains(true);
    try {
      console.log("Fetching mains questions from API...");
      const response = await fetch('/api/mains-questions');
      if (!response.ok) throw new Error("API response not ok");
      const data = await response.json();
      setMainsQuestions(Array.isArray(data) ? dedupeQuestionsById(data) : []);
    } catch (error) {
      console.warn("Failed to fetch mains questions:", error);
      setMainsQuestions([]);
    } finally {
      setIsLoadingMains(false);
    }
  };

  const fetchToppersQuestions = async () => {
    setIsLoadingToppers(true);
    try {
      const response = await fetch('/api/toppers-copy');
      if (!response.ok) throw new Error("API response not ok");
      const data = await response.json();
      setToppersQuestions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn("Failed to fetch toppers copy questions:", error);
      setToppersQuestions([]);
    } finally {
      setIsLoadingToppers(false);
    }
  };

  const fetchCSATQuestions = async () => {
    setIsLoadingCSAT(true);
    try {
      const response = await fetch('/api/csat-questions');
      if (!response.ok) throw new Error("API response not ok");
      const data = await response.json();
      setCSATQuestions(Array.isArray(data) ? dedupeQuestionsById(data) : []);
    } catch (error) {
      console.warn("Failed to fetch CSAT questions:", error);
      setCSATQuestions([]);
    } finally {
      setIsLoadingCSAT(false);
    }
  };

  const fetchEnglishQuestions = async () => {
    setIsLoadingEnglish(true);
    try {
      const response = await fetch('/api/english-questions');
      if (!response.ok) throw new Error("API response not ok");
      const data = await response.json();
      setEnglishQuestions(Array.isArray(data) ? dedupeQuestionsById(data) : []);
    } catch (error) {
      console.warn("Failed to fetch English questions:", error);
      setEnglishQuestions([]);
    } finally {
      setIsLoadingEnglish(false);
    }
  };

  // Fast initial paint: fetch the top 100 prelims (display order) from the backend.
  const fetchInitialQuestions = async () => {
    try {
      const response = await fetch('/api/questions?limit=100');
      if (!response.ok) throw new Error("API response not ok");
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setQuestions(dedupeQuestionsById(data as Question[]));
        console.log(`Showing ${data.length} prelims from backend (top 100)`);
        return;
      }
      throw new Error("Empty data from API");
    } catch (error) {
      console.warn("Initial questions fetch failed, using local fallback:", error);
      setQuestions(fallbackQuestions.slice(0, 100) as Question[]);
    }
  };

  const loadRazorpay = () =>
    new Promise<boolean>((resolve) => {
      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const initiatePayment = async (plan: '1yr' | '2yr' | 'ebooks') => {
    if (!userEmail) {
      setPendingPlan(plan);
      setShowPremiumModal(false);
      setShowLoginModal(true);
      return;
    }
    try {
      const ok = await loadRazorpay();
      if (!ok) {
        alert("Couldn't load the payment gateway. Check your connection and try again.");
        return;
      }
      const couponForPlan = appliedCoupon && appliedCoupon.plans.includes(plan) ? appliedCoupon.code : null;
      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, plan, couponCode: couponForPlan }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok || !order.orderId) {
        alert(order.error || "Could not start payment. Please try again.");
        return;
      }
      const rzp = new (window as any).Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "UPSC PYQ Powerhouse",
        description: plan === 'ebooks' ? "PowerHouse Ebooks - All-in-One" : plan === '2yr' ? "Premium Access - 2 Years" : "Premium Access - 1 Year",
        prefill: { email: userEmail },
        theme: { color: "#4f46e5" },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...response, email: userEmail, plan }),
            });
            const result = await verifyRes.json();
            if (verifyRes.ok && result.success) {
              setShowPremiumModal(false);
              if (plan === 'ebooks') {
                alert("✅ Payment successful! Redirecting you to the PowerHouse Ebooks Telegram channel...");
                window.open("https://t.me/+7DfVmsKSI4FmNzg1", "_blank", "noopener,noreferrer");
              } else {
                await checkUserStatus(userEmail);
                alert("✅ Payment successful! Your premium access is now active.");
              }
            } else {
              alert("Payment received but verification failed. Please contact support with Payment ID: " + response.razorpay_payment_id);
            }
          } catch (e) {
            alert("Could not verify the payment. If money was deducted, please contact support.");
          }
        },
      });
      rzp.on("payment.failed", (resp: any) => {
        alert("Payment failed: " + (resp?.error?.description || "please try again."));
      });
      rzp.open();
    } catch (e) {
      alert("Payment error. Please try again.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    let fetchTimer: ReturnType<typeof setTimeout> | undefined;

    // Keep the loader running until the first batch of prelims has loaded
    setIsLoadingQuestions(true);
    // Load the first batch before starting the full fetch so the smaller
    // response can never overwrite the complete dataset.
    fetchInitialQuestions().finally(() => {
      if (cancelled) return;
      setIsLoadingQuestions(false);
      fetchTimer = setTimeout(() => {
        fetchQuestions(false);
        fetchMainsQuestions();
        fetchToppersQuestions();
        fetchCSATQuestions();
        fetchEnglishQuestions();
      }, 250);
    });

    // Restore a sane initial batch. We cap it because a previously inflated
    // value would force a huge synchronous render and freeze the page on load;
    // infinite scroll re-grows visibleCount naturally as the user scrolls.
    const savedVisibleCount = localStorage.getItem('visibleCount');
    const initialCount = Math.min(savedVisibleCount ? parseInt(savedVisibleCount) : 100, 150);
    setVisibleCount(initialCount);

    // Scroll to saved position after a brief delay to let DOM render
    const scrollTimer = setTimeout(() => {
      if (savedVisibleCount) {
        window.scrollTo(0, 0); // Start from top for fresh load
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(scrollTimer);
      if (fetchTimer) clearTimeout(fetchTimer);
    };
  }, []);

  useEffect(() => {
    if (!userEmail) {
      loadedDefaultFiltersForEmailRef.current = null;
      return;
    }
    if (
      !hasLoadedAllQuestions ||
      questions.length === 0 ||
      loadedDefaultFiltersForEmailRef.current === userEmail
    ) return;

    let cancelled = false;
    const loadDefaultFilters = async () => {
      try {
        const response = await fetch(`/api/filter-preferences?email=${encodeURIComponent(userEmail)}`);
        if (!response.ok) throw new Error("Could not load default filters");
        const data = await response.json();
        if (cancelled) return;

        loadedDefaultFiltersForEmailRef.current = userEmail;
        const csatDefaults = data.csat as CSATFilterPreferences | null;
        if (csatDefaults) {
          setSavedCSATFilterDefaults(csatDefaults);
          setCSATYearFilter(csatDefaults.year);
          setCSATSubjectFilter(csatDefaults.subject);
          if (csatDefaults.sort) setCSATSortMode(csatDefaults.sort as QuestionSortMode);
          setCSATVisibleCount(30);
          setCSATRandomMode(false);
        }

        const englishDefaults = data.english as PrelimsFilterPreferences | null;
        if (englishDefaults) {
          setSavedEnglishFilterDefaults(englishDefaults);
          setEnglishExamFilter(englishDefaults.exam);
          setEnglishYearFilter(englishDefaults.year);
          setEnglishPaperFilter(englishDefaults.paper);
          setEnglishSubjectFilter(englishDefaults.subject);
          setEnglishTopicFilter(englishDefaults.topic);
          if (englishDefaults.sort) setEnglishSortMode(englishDefaults.sort as QuestionSortMode);
          setEnglishVisibleCount(30);
          setEnglishRandomMode(false);
        }

        const defaults = data.prelims as PrelimsFilterPreferences | null;
        setSavedPrelimsFilterDefaults(defaults);
        if (!defaults) return;

        setIsApplyingDefaultFilters(true);
        setExamFilter(defaults.exam);
        setYearFilter(defaults.year);
        setPaperFilter(defaults.paper);
        setSubjectFilter(defaults.subject);
        setTopicFilter(defaults.topic);
        if (defaults.sort) setSortMode(defaults.sort as QuestionSortMode);
        setVisibleCount(30);
        setRandomMode({ active: false, limit: 0 });
        setDefaultFilterMessage({ text: "Default filters applied.", type: "success" });
      } catch (error) {
        console.warn("Failed to load default filters:", error);
      }
    };

    loadDefaultFilters();
    return () => {
      cancelled = true;
    };
  }, [hasLoadedAllQuestions, questions.length, userEmail]);

  useEffect(() => {
    if (!isApplyingDefaultFilters || !savedPrelimsFilterDefaults) return;

    const defaultsApplied =
      examFilter === savedPrelimsFilterDefaults.exam &&
      yearFilter === savedPrelimsFilterDefaults.year &&
      paperFilter === savedPrelimsFilterDefaults.paper &&
      subjectFilter === savedPrelimsFilterDefaults.subject &&
      topicFilter === savedPrelimsFilterDefaults.topic;

    if (defaultsApplied) {
      setIsApplyingDefaultFilters(false);
    }
  }, [
    examFilter,
    isApplyingDefaultFilters,
    paperFilter,
    savedPrelimsFilterDefaults,
    subjectFilter,
    topicFilter,
    yearFilter,
  ]);

  // Handle closing user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isUserMenuOpen]);

  const latestTwoYears = useMemo(() => {
    const years = [...new Set(questions.map(q => q.year))].sort((a, b) => (b as string).localeCompare(a as string));
    return years.slice(0, 2);
  }, [questions]);

  const csatLatestTwoYears = useMemo(() => {
    const years = [...new Set(csatQuestions.map(q => q.year))].sort((a, b) => (b as string).localeCompare(a as string));
    return years.slice(0, 2);
  }, [csatQuestions]);

  const englishLatestTwoYears = useMemo(() => {
    const years = [...new Set(englishQuestions.map(q => q.year))].sort((a, b) => (b as string).localeCompare(a as string));
    return years.slice(0, 2);
  }, [englishQuestions]);

  const mainsYearsList = useMemo(() => {
    const availableData = mainsQuestions.filter(q =>
      (mainsExamFilter === "All" || q.exam === mainsExamFilter) &&
      (mainsSubjectFilter === "All" || q.subject === mainsSubjectFilter) &&
      (mainsTopicFilter === "All" || q.topic === mainsTopicFilter)
    );
    const uniqueYears = Array.from(new Set(availableData.map(q => q.year))).sort((a, b) => (b as string).localeCompare(a as string));

    const yearCounts: Record<string, number> = {};
    availableData.forEach(q => {
      yearCounts[q.year] = (yearCounts[q.year] || 0) + 1;
    });

    return {
      options: ["All", ...uniqueYears],
      counts: yearCounts,
    };
  }, [mainsQuestions, mainsExamFilter, mainsSubjectFilter, mainsTopicFilter]);

  const mainsExamsList = useMemo(() => {
    const availableData = mainsQuestions.filter(q =>
      (mainsYearFilter === "All" || q.year === mainsYearFilter) &&
      (mainsSubjectFilter === "All" || q.subject === mainsSubjectFilter) &&
      (mainsTopicFilter === "All" || q.topic === mainsTopicFilter)
    );
    const uniqueExams = [...new Set(availableData.map(q => q.exam))].sort();

    const examCounts: Record<string, number> = {};
    availableData.forEach(q => {
      examCounts[q.exam] = (examCounts[q.exam] || 0) + 1;
    });

    return {
      options: ["All", ...uniqueExams],
      counts: examCounts,
    };
  }, [mainsQuestions, mainsYearFilter, mainsSubjectFilter, mainsTopicFilter]);

  const mainsSubjectsList = useMemo(() => {
    const availableData = mainsQuestions.filter(q =>
      (mainsYearFilter === "All" || q.year === mainsYearFilter) &&
      (mainsExamFilter === "All" || q.exam === mainsExamFilter) &&
      (mainsTopicFilter === "All" || q.topic === mainsTopicFilter)
    );
    const uniqueSubjects = [...new Set(availableData.map(q => q.subject))].sort();

    const subjectCounts: Record<string, number> = {};
    availableData.forEach(q => {
      subjectCounts[q.subject] = (subjectCounts[q.subject] || 0) + 1;
    });

    return {
      options: ["All", ...uniqueSubjects],
      counts: subjectCounts,
    };
  }, [mainsQuestions, mainsYearFilter, mainsExamFilter, mainsTopicFilter]);

  const mainsTopicsList = useMemo(() => {
    const availableData = mainsQuestions.filter(q =>
      (mainsYearFilter === "All" || q.year === mainsYearFilter) &&
      (mainsExamFilter === "All" || q.exam === mainsExamFilter) &&
      (mainsSubjectFilter === "All" || q.subject === mainsSubjectFilter)
    );

    const topicCounts: Record<string, number> = {};
    availableData.forEach(q => {
      if (q.topic) topicCounts[q.topic] = (topicCounts[q.topic] || 0) + 1;
    });

    const uniqueTopics = ([...new Set(availableData.map(q => q.topic).filter(Boolean))] as string[]).sort((a, b) => (topicCounts[b] || 0) - (topicCounts[a] || 0));

    return {
      options: ["All", ...uniqueTopics],
      counts: topicCounts,
    };
  }, [mainsQuestions, mainsYearFilter, mainsExamFilter, mainsSubjectFilter]);

  const filteredMainsQuestions = useMemo(() => {
    if (mainsRandomMode) {
      return mainsRandomizedQuestions;
    }
    return mainsQuestions
      .filter(q => {
        // Skip questions without valid question text
        if (!q.question || q.question.trim() === '' || q.question.startsWith('Q_')) return false;
        
        const matchesYear = mainsYearFilter === "All" || q.year === mainsYearFilter;
        const matchesExam = mainsExamFilter === "All" || q.exam === mainsExamFilter;
        const matchesSubject = mainsSubjectFilter === "All" || q.subject === mainsSubjectFilter;
        const matchesTopic = mainsTopicFilter === "All" || q.topic === mainsTopicFilter;
        const matchesSearch = mainsSearchQuery === "" ||
          matchesQuestionId(q.id, mainsSearchQuery) ||
          (q.question || "").toLowerCase().includes(mainsSearchQuery.toLowerCase()) ||
          (q.model_answer || "").toLowerCase().includes(mainsSearchQuery.toLowerCase()) ||
          (q.modelAnswer || "").toLowerCase().includes(mainsSearchQuery.toLowerCase()) ||
          (q.subject || "").toLowerCase().includes(mainsSearchQuery.toLowerCase()) ||
          (q.exam || "").toLowerCase().includes(mainsSearchQuery.toLowerCase()) ||
          (q.year || "").toLowerCase().includes(mainsSearchQuery.toLowerCase());

        return matchesYear && matchesExam && matchesSubject && matchesTopic && matchesSearch;
      })
      .sort((a, b) => String(b.year).localeCompare(String(a.year)) || String(a.id).localeCompare(String(b.id)))
      .slice(0, mainsVisibleCount);
  }, [mainsQuestions, mainsYearFilter, mainsExamFilter, mainsSubjectFilter, mainsTopicFilter, mainsSearchQuery, mainsRandomMode, mainsRandomizedQuestions, mainsVisibleCount]);

  const isMoreMainsToLoad = useMemo(() => {
    if (mainsRandomMode) return false;
    const totalFiltered = mainsQuestions.filter(q => {
      const matchesYear = mainsYearFilter === "All" || q.year === mainsYearFilter;
      const matchesExam = mainsExamFilter === "All" || q.exam === mainsExamFilter;
      const matchesSubject = mainsSubjectFilter === "All" || q.subject === mainsSubjectFilter;
      const matchesTopic = mainsTopicFilter === "All" || q.topic === mainsTopicFilter;
      const matchesSearch = mainsSearchQuery === "" ||
        matchesQuestionId(q.id, mainsSearchQuery) ||
        (q.question || "").toLowerCase().includes(mainsSearchQuery.toLowerCase());
      return matchesYear && matchesExam && matchesSubject && matchesTopic && matchesSearch;
    }).length;
    return totalFiltered > mainsVisibleCount;
  }, [mainsQuestions, mainsYearFilter, mainsExamFilter, mainsSubjectFilter, mainsTopicFilter, mainsSearchQuery, mainsVisibleCount, mainsRandomMode]);

  // Toppers copy filter lists
  const toppersYearsList = useMemo(() => {
    return [...new Set(toppersQuestions.map(q => q.year))].sort((a: string, b: string) => b.localeCompare(a));
  }, [toppersQuestions]);

  const toppersToppersList = useMemo(() => {
    const toppers = new Set<string>();
    toppersQuestions.forEach(q => q.answers?.forEach(a => toppers.add(a.topperName)));
    return [...toppers].sort();
  }, [toppersQuestions]);

  const toppersSubjectsList = useMemo(() => {
    return [...new Set(toppersQuestions.map(q => q.subject))].sort();
  }, [toppersQuestions]);

  const toppersPapersList = useMemo(() => {
    return [...new Set(toppersQuestions.map(q => q.paper).filter(Boolean))].sort();
  }, [toppersQuestions]);

  const filteredToppersQuestions = useMemo(() => {
    return toppersQuestions.filter(q => {
      const matchesYear = toppersYearFilter === "All" || q.year === toppersYearFilter;
      const matchesSubject = toppersSubjectFilter === "All" || q.subject === toppersSubjectFilter;
      const matchesTopper = toppersTopperFilter === "All" || 
        q.answers?.some(a => a.topperName === toppersTopperFilter);
      const matchesPaper = toppersPaperFilter === "All" || q.paper === toppersPaperFilter;
      const matchesSearch = toppersSearchQuery === "" ||
        matchesQuestionId(q.id, toppersSearchQuery) ||
        (q.question || "").toLowerCase().includes(toppersSearchQuery.toLowerCase()) ||
        (q.subject || "").toLowerCase().includes(toppersSearchQuery.toLowerCase()) ||
        (q.year || "").toLowerCase().includes(toppersSearchQuery.toLowerCase());
      return matchesYear && matchesSubject && matchesTopper && matchesPaper && matchesSearch;
    }).sort((a, b) => {
      // Unlocked questions first (free = 2023 + GS1 or no paper)
      const aFree = a.year === "2023" && (a.paper === "GS1" || !a.paper) ? 0 : 1;
      const bFree = b.year === "2023" && (b.paper === "GS1" || !b.paper) ? 0 : 1;
      if (!isSubscribed && aFree !== bFree) return aFree - bFree;
      // Then by Year (desc) → Question Number (asc)
      if (a.year !== b.year) return b.year.localeCompare(a.year);
      return (a.questionNumber || 0) - (b.questionNumber || 0);
    });
  }, [toppersQuestions, toppersYearFilter, toppersSubjectFilter, toppersTopperFilter, toppersPaperFilter, toppersSearchQuery, isSubscribed]);

  // CSAT filter lists
  const csatYearsList = useMemo(() => {
    const years = [...new Set(csatQuestions.map(q => q.year))].sort((a, b) => (b as string).localeCompare(a as string));
    const counts: Record<string, number> = {};
    csatQuestions.forEach(q => {
      counts[q.year] = (counts[q.year] || 0) + 1;
    });
    return { options: ["All", ...years], counts };
  }, [csatQuestions]);

  const csatSubjectsList = useMemo(() => {
    const filtered = csatQuestions.filter(q => csatYearFilter === "All" || q.year === csatYearFilter);
    const subjects = [...new Set(filtered.map(q => q.subject))].sort();
    const counts: Record<string, number> = {};
    filtered.forEach(q => {
      counts[q.subject] = (counts[q.subject] || 0) + 1;
    });
    return { options: ["All", ...subjects], counts };
  }, [csatQuestions, csatYearFilter]);

  const matchesCSATBaseFilters = useCallback((q: Question) => {
    const matchesYear = csatYearFilter === "All" || q.year === csatYearFilter;
    const matchesSubject = csatSubjectFilter === "All" || q.subject === csatSubjectFilter;
    const matchesSearch = csatSearchQuery === "" ||
      matchesQuestionId(q.id, csatSearchQuery) ||
      (q.question || "").toLowerCase().includes(csatSearchQuery.toLowerCase()) ||
      (q.options || []).some(opt => (opt || "").toLowerCase().includes(csatSearchQuery.toLowerCase()));
    return matchesYear && matchesSubject && matchesSearch;
  }, [csatYearFilter, csatSubjectFilter, csatSearchQuery]);

  const [bookmarkedCSATCount, notedCSATCount] = useMemo(
    () => countSavedQuestions("csat", csatQuestions.filter(matchesCSATBaseFilters)),
    [csatQuestions, matchesCSATBaseFilters, workspaceVersion]
  );

  const filteredCSATQuestions = useMemo(() => {
    if (csatRandomMode) return csatRandomizedQuestions;
    const list = sortQuestionsBy(
      csatQuestions.filter(
        q => matchesCSATBaseFilters(q) && matchesSavedFilters("csat", q, csatBookmarkedOnly, csatNotedOnly)
      ),
      "csat",
      csatSortMode
    );
    if (csatBookmarkedOnly || csatNotedOnly) return list;
    return list.slice(0, csatVisibleCount);
  }, [csatQuestions, matchesCSATBaseFilters, csatRandomMode, csatRandomizedQuestions, csatVisibleCount, csatBookmarkedOnly, csatNotedOnly, csatSortMode, workspaceVersion]);

  // English filter lists
  const englishYearsList = useMemo(() => {
    const filtered = englishQuestions.filter(q =>
      (englishExamFilter === "All" || getExamCategory(q.exam) === englishExamFilter) &&
      (englishPaperFilter === "All" || q.exam === englishPaperFilter) &&
      (englishSubjectFilter === "All" || q.subject === englishSubjectFilter) &&
      (englishTopicFilter === "All" || q.topic === englishTopicFilter)
    );
    const years = [...new Set(filtered.map(q => q.year))].sort((a, b) => (b as string).localeCompare(a as string));
    const counts: Record<string, number> = {};
    filtered.forEach(q => {
      counts[q.year] = (counts[q.year] || 0) + 1;
    });
    return { options: ["All", ...years], counts };
  }, [englishQuestions, englishExamFilter, englishPaperFilter, englishSubjectFilter, englishTopicFilter]);

  const englishSubjectsList = useMemo(() => {
    const filtered = englishQuestions.filter(q =>
      (englishYearFilter === "All" || q.year === englishYearFilter) &&
      (englishExamFilter === "All" || getExamCategory(q.exam) === englishExamFilter) &&
      (englishPaperFilter === "All" || q.exam === englishPaperFilter) &&
      (englishTopicFilter === "All" || q.topic === englishTopicFilter)
    );
    const subjects = [...new Set(filtered.map(q => q.subject))].sort();
    const counts: Record<string, number> = {};
    filtered.forEach(q => {
      counts[q.subject] = (counts[q.subject] || 0) + 1;
    });
    return { options: ["All", ...subjects], counts };
  }, [englishQuestions, englishYearFilter, englishExamFilter, englishPaperFilter, englishTopicFilter]);

  const englishTopicsList = useMemo(() => {
    const filtered = englishQuestions.filter(q =>
      (englishYearFilter === "All" || q.year === englishYearFilter) &&
      (englishExamFilter === "All" || getExamCategory(q.exam) === englishExamFilter) &&
      (englishPaperFilter === "All" || q.exam === englishPaperFilter) &&
      (englishSubjectFilter === "All" || q.subject === englishSubjectFilter)
    );
    const topics = [...new Set(filtered.map(q => q.topic).filter(Boolean))].sort();
    const counts: Record<string, number> = {};
    filtered.forEach(q => {
      if (q.topic) counts[q.topic] = (counts[q.topic] || 0) + 1;
    });
    return { options: ["All", ...topics], counts };
  }, [englishQuestions, englishYearFilter, englishExamFilter, englishPaperFilter, englishSubjectFilter]);

  const englishExamsList = useMemo(() => {
    const exams = [...new Set(englishQuestions.map(q => getExamCategory(q.exam)).filter(Boolean))].sort();
    const counts: Record<string, number> = {};
    englishQuestions.forEach(q => {
      if (q.exam) {
        const category = getExamCategory(q.exam);
        counts[category] = (counts[category] || 0) + 1;
      }
    });
    return { options: ["All", ...exams], counts };
  }, [englishQuestions]);

  const englishPapersList = useMemo(() => {
    const filtered = englishQuestions.filter(q =>
      (englishExamFilter === "All" || getExamCategory(q.exam) === englishExamFilter) &&
      (englishYearFilter === "All" || q.year === englishYearFilter) &&
      (englishSubjectFilter === "All" || q.subject === englishSubjectFilter) &&
      (englishTopicFilter === "All" || q.topic === englishTopicFilter)
    );
    const papers = [...new Set(filtered.map(q => q.exam).filter(Boolean))].sort();
    const counts: Record<string, number> = {};
    filtered.forEach(q => {
      counts[q.exam] = (counts[q.exam] || 0) + 1;
    });
    return { options: ["All", ...papers], counts };
  }, [englishQuestions, englishExamFilter, englishYearFilter, englishSubjectFilter, englishTopicFilter]);

  useEffect(() => {
    if (englishPaperFilter !== "All" && !englishPapersList.options.includes(englishPaperFilter)) {
      setEnglishPaperFilter("All");
    }
  }, [englishPapersList.options, englishPaperFilter]);

  const matchesEnglishBaseFilters = useCallback((q: Question) => {
    const matchesYear = englishYearFilter === "All" || q.year === englishYearFilter;
    const matchesSubject = englishSubjectFilter === "All" || q.subject === englishSubjectFilter;
    const matchesTopic = englishTopicFilter === "All" || q.topic === englishTopicFilter;
    const matchesExam = englishExamFilter === "All" || getExamCategory(q.exam) === englishExamFilter;
    const matchesPaper = englishPaperFilter === "All" || q.exam === englishPaperFilter;
    const matchesSearch = englishSearchQuery === "" ||
      matchesQuestionId(q.id, englishSearchQuery) ||
      (q.question || "").toLowerCase().includes(englishSearchQuery.toLowerCase()) ||
      (q.options || []).some(opt => (opt || "").toLowerCase().includes(englishSearchQuery.toLowerCase()));
    return matchesYear && matchesSubject && matchesTopic && matchesExam && matchesPaper && matchesSearch;
  }, [englishYearFilter, englishSubjectFilter, englishTopicFilter, englishExamFilter, englishPaperFilter, englishSearchQuery]);

  const [bookmarkedEnglishCount, notedEnglishCount] = useMemo(
    () => countSavedQuestions("english", englishQuestions.filter(matchesEnglishBaseFilters)),
    [englishQuestions, matchesEnglishBaseFilters, workspaceVersion]
  );

  const filteredEnglishQuestions = useMemo(() => {
    if (englishRandomMode) return englishRandomizedQuestions;
    const list = sortQuestionsBy(
      englishQuestions.filter(
        q => matchesEnglishBaseFilters(q) && matchesSavedFilters("english", q, englishBookmarkedOnly, englishNotedOnly)
      ),
      "english",
      englishSortMode
    );
    if (englishBookmarkedOnly || englishNotedOnly) return list;
    return list.slice(0, englishVisibleCount);
  }, [englishQuestions, matchesEnglishBaseFilters, englishRandomMode, englishRandomizedQuestions, englishVisibleCount, englishBookmarkedOnly, englishNotedOnly, englishSortMode, workspaceVersion]);

  // Check subscription and admin status
  // Admin API key (secret) — stored only in this browser, sent with admin requests.
  const [adminKey, setAdminKey] = useState<string>(() => localStorage.getItem('admin_api_key') || "");
  const saveAdminKey = (key: string) => {
    const k = key.trim();
    setAdminKey(k);
    if (k) localStorage.setItem('admin_api_key', k);
    else localStorage.removeItem('admin_api_key');
  };
  // Builds request headers with the admin key (read fresh from storage to avoid stale values).
  const adminHeaders = (base: Record<string, string> = {}): Record<string, string> => {
    const k = localStorage.getItem('admin_api_key') || "";
    return k ? { ...base, Authorization: `Bearer ${k}` } : base;
  };

  // Portal opens only for an admin email login + a server-verified key, and
  // stays unlocked for 7 days before the key must be re-verified.
  const ADMIN_UNLOCK_MS = 7 * 24 * 60 * 60 * 1000;
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const verifyAdminKey = async (rawKey?: string): Promise<boolean> => {
    const k = (rawKey ?? localStorage.getItem('admin_api_key') ?? "").trim();
    if (!k) {
      setAdminUnlocked(false);
      setAdminMessage({ text: "Enter the current admin key to unlock the portal.", type: "error" });
      return false;
    }
    try {
      const res = await fetch('/api/admin/verify', { headers: { Authorization: `Bearer ${k}` } });
      if (res.ok) {
        localStorage.setItem('admin_api_key', k);
        localStorage.setItem('admin_unlock_expiry', String(Date.now() + ADMIN_UNLOCK_MS));
        setAdminKey(k);
        setAdminUnlocked(true);
        setAdminMessage({ text: "Admin portal unlocked.", type: "success" });
        return true;
      }
      if (res.status === 401) {
        localStorage.removeItem('admin_api_key');
        localStorage.removeItem('admin_unlock_expiry');
        setAdminKey("");
        setAdminMessage({ text: "The saved admin key is no longer valid. Enter the current key.", type: "error" });
      } else {
        setAdminMessage({ text: `Could not verify the admin key (${res.status}).`, type: "error" });
      }
    } catch {
      setAdminMessage({ text: "Could not reach the admin verification service.", type: "error" });
    }
    setAdminUnlocked(false);
    return false;
  };
  // Re-open the portal automatically (up to 7 days) once the admin email is
  // logged in and a previously verified key is still stored and unexpired.
  useEffect(() => {
    if (!isAdmin) { setAdminUnlocked(false); return; }
    const key = localStorage.getItem('admin_api_key');
    const expiry = Number(localStorage.getItem('admin_unlock_expiry') || 0);
    if (key && expiry > Date.now()) verifyAdminKey(key);
    else setAdminUnlocked(false);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [isAdmin]);

  // Blocks admin write actions (prices / user operations) until the key is verified.
  const requireAdminKey = (): boolean => {
    if (!adminUnlocked) {
      setAdminMessage({ text: "Add and verify your admin key first to perform admin actions.", type: "error" });
      return false;
    }
    return true;
  };

  // ── Admin: coupon management ──
  type AdminCoupon = {
    code: string;
    discountPercent: number;
    expiryDate: string;
    plans: string[];
    maxRedemptions: number;
    description?: string | null;
    redemptionCount?: number;
    lastRedeemedAt?: string | null;
    isActive?: boolean;
    deletedAt?: string | null;
  };
  const blankCouponForm = { code: '', discountPercent: '10', expiryDate: '', plans: ['1yr', '2yr', 'ebooks'] as string[], maxRedemptions: '0', description: '' };
  const [adminCoupons, setAdminCoupons] = useState<AdminCoupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [showWithdrawnCoupons, setShowWithdrawnCoupons] = useState(false);
  const [couponForm, setCouponForm] = useState(blankCouponForm);
  const [couponEditing, setCouponEditing] = useState<string | null>(null);
  const [savingCoupon, setSavingCoupon] = useState(false);

  const fetchAdminCoupons = useCallback(async (includeDeleted = false) => {
    setLoadingCoupons(true);
    try {
      const res = await fetch(`/api/admin/coupons${includeDeleted ? '?includeDeleted=1' : ''}`, { headers: adminHeaders() });
      if (res.ok) setAdminCoupons(await res.json());
    } catch {
      /* non-fatal: the table just stays empty */
    } finally {
      setLoadingCoupons(false);
    }
    // adminHeaders reads the current key from state; refetching is cheap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  const saveCoupon = async () => {
    if (!requireAdminKey()) return;
    setSavingCoupon(true);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          code: couponForm.code,
          discountPercent: Number(couponForm.discountPercent),
          expiryDate: couponForm.expiryDate,
          plans: couponForm.plans,
          maxRedemptions: Number(couponForm.maxRedemptions || 0),
          description: couponForm.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save coupon');
      setAdminMessage({ text: `✓ Coupon ${data.coupon.code} saved.`, type: 'success' });
      setCouponForm(blankCouponForm);
      setCouponEditing(null);
      await fetchAdminCoupons(showWithdrawnCoupons);
    } catch (e: any) {
      setAdminMessage({ text: e.message, type: 'error' });
    } finally {
      setSavingCoupon(false);
      setTimeout(() => setAdminMessage({ text: '', type: '' }), 5000);
    }
  };

  // Pause/resume flips isActive without touching counters; withdraw soft-deletes.
  const setCouponActive = async (c: AdminCoupon, active: boolean) => {
    if (!requireAdminKey()) return;
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          code: c.code,
          discountPercent: c.discountPercent,
          expiryDate: c.expiryDate,
          plans: c.plans,
          maxRedemptions: c.maxRedemptions || 0,
          description: c.description || '',
          isActive: active,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setAdminMessage({ text: `✓ ${c.code} ${active ? 'activated' : 'paused'}.`, type: 'success' });
      await fetchAdminCoupons(showWithdrawnCoupons);
    } catch (e: any) {
      setAdminMessage({ text: e.message, type: 'error' });
    } finally {
      setTimeout(() => setAdminMessage({ text: '', type: '' }), 5000);
    }
  };

  const withdrawCoupon = async (code: string) => {
    if (!requireAdminKey()) return;
    if (!window.confirm(`Withdraw ${code}? It stops working immediately but past redemptions are kept.`)) return;
    try {
      const res = await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, { method: 'DELETE', headers: adminHeaders() });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setAdminMessage({ text: `✓ ${code} withdrawn.`, type: 'success' });
      await fetchAdminCoupons(showWithdrawnCoupons);
    } catch (e: any) {
      setAdminMessage({ text: e.message, type: 'error' });
    } finally {
      setTimeout(() => setAdminMessage({ text: '', type: '' }), 5000);
    }
  };

  const [planPrices, setPlanPrices] = useState<Record<string, number>>({});
  const [priceForm, setPriceForm] = useState<{ '1yr': string; '2yr': string; 'ebooks': string }>({ '1yr': '', '2yr': '', 'ebooks': '' });
  const [savingPrices, setSavingPrices] = useState(false);
  useEffect(() => {
    if (Object.keys(planPrices).length) {
      setPriceForm({
        '1yr': String(Math.round((planPrices['1yr'] || 89900) / 100)),
        '2yr': String(Math.round((planPrices['2yr'] || 129900) / 100)),
        'ebooks': String(Math.round((planPrices['ebooks'] || 94900) / 100)),
      });
    }
  }, [planPrices]);
  const savePrices = async () => {
    if (!requireAdminKey()) return;
    setSavingPrices(true);
    try {
      const res = await fetch('/api/admin/prices', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ prices: {
          '1yr': Number(priceForm['1yr']),
          '2yr': Number(priceForm['2yr']),
          'ebooks': Number(priceForm['ebooks']),
        } }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdminMessage({ text: "✓ Subscription prices updated.", type: "success" });
        const pr = await fetch('/api/plans');
        if (pr.ok) setPlanPrices(await pr.json());
      } else {
        throw new Error(data.error || "Failed to update prices");
      }
    } catch (e: any) {
      setAdminMessage({ text: `Failed to update prices: ${e.message}`, type: "error" });
    } finally {
      setSavingPrices(false);
      setTimeout(() => setAdminMessage({ text: "", type: "" }), 5000);
    }
  };

  const checkUserStatus = async (email: string) => {
    try {
      const response = await fetch(`/api/user-status?email=${encodeURIComponent(email)}`);
      
      if (!response.ok) {
        const text = await response.text();
        console.warn(`User status check failed (${response.status}):`, text);
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType || 'text'}: ${text.substring(0, 50)}`);
      }

      const data = await response.json();
      setIsSubscribed(data.status === 'subscribed' || data.status === 'admin' || data.status === 'editor');
      // Admin status is decided solely by the backend role; never trust the client.
      setIsAdmin(data.status === 'admin');
      setIsEditor(data.status === 'editor');
    } catch (error) {
      console.error("Failed to check status:", error);
      setIsSubscribed(false);
      setIsAdmin(false);
      setIsEditor(false);
    }
  };

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  // Shareable deep-link that opens the premium plans modal directly.
  const premiumLink = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}#premium` : '#premium';
  const copyPremiumLink = async () => {
    try {
      await navigator.clipboard.writeText(premiumLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };
  // Open the premium modal when the URL hash is #premium (on load, paste, or navigation).
  useEffect(() => {
    const applyHash = () => { if (window.location.hash === '#premium') setShowPremiumModal(true); };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);
  // Keep the URL hash in sync with the modal so the link is always shareable.
  useEffect(() => {
    if (showPremiumModal) {
      if (window.location.hash !== '#premium') window.history.replaceState(null, '', '#premium');
    } else if (window.location.hash === '#premium') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [showPremiumModal]);

  // ── My Workspace (bookmarks · notes · performance report) ──
  type ReportBucket = { correct: number; total: number };
  type ReportAttempt = { questionId?: number; questionType: string; subject: string | null; topic: string | null; isCorrect: boolean; attemptId?: string | null; ts?: string; attemptCount?: number; correctCount?: number; wrongCount?: number };
  type ReportData = {
    attempts: ReportAttempt[];
    score: ReportBucket;
    sections: Record<string, ReportBucket>;
    subjects: Record<string, ReportBucket>;
    topics: Record<string, ReportBucket & { subject: string | null }>;
    attemptCount: number;
  };
  type WorkspaceTab = 'bookmarks' | 'notes' | 'report';
  const [showReport, setShowReport] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('report');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    remoteStateListeners.add(bumpWorkspaceVersion);
    return () => {
      remoteStateListeners.delete(bumpWorkspaceVersion);
    };
  }, []);

  const loadReport = async () => {
    if (!userEmail) return;
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await fetch(`/api/attempts?email=${encodeURIComponent(userEmail)}`);
      if (!res.ok) throw new Error('Failed to load report');
      const data = await res.json();
      setReportData(data);
    } catch {
      setReportError('Could not load your report. Please try again.');
    } finally {
      setReportLoading(false);
    }
  };
  const openWorkspace = async (tab: WorkspaceTab = 'report') => {
    setWorkspaceTab(tab);
    setShowReport(true);
    // The report is the only tab that needs its own request; bookmarks and
    // notes are already in memory from the sign-in fetch.
    if (tab === 'report') await loadReport();
  };
  // Fetch the report lazily the first time that tab is opened.
  useEffect(() => {
    if (!showReport || workspaceTab !== 'report') return;
    if (reportData || reportLoading || reportError) return;
    loadReport();
  }, [showReport, workspaceTab]);

  // Bookmarks and notes can point at any section, but the CSAT and English
  // lists only load when their tab is visited. Pull them in when the workspace
  // opens so every saved entry can show its actual question text.
  useEffect(() => {
    if (!showReport || !userEmail) return;
    if (csatQuestions.length === 0 && !isLoadingCSAT) fetchCSATQuestions();
    if (englishQuestions.length === 0 && !isLoadingEnglish) fetchEnglishQuestions();
  }, [showReport, userEmail]);

  type WorkspaceEntry = WorkspaceEntryShape;

  // Everything saved by the signed-in user, joined back to the loaded question
  // so the workspace can show the actual question text. Entries whose question
  // is not loaded still render from the metadata stored on the document.
  const workspaceEntries = useMemo<WorkspaceEntry[]>(() => {
    // Index by string id: some questions use non-numeric ids (e.g. "mcq_3210"),
    // which a numeric lookup would silently miss.
    const index: Record<string, Map<string, Question>> = {
      prelims: new Map(questions.map(q => [String(q.id), q])),
      csat: new Map(csatQuestions.map(q => [String(q.id), q])),
      english: new Map(englishQuestions.map(q => [String(q.id), q])),
    };
    const rows: WorkspaceEntry[] = [];
    remoteQuestionState.forEach((state, key) => {
      const separator = key.indexOf(':');
      const questionType = key.slice(0, separator);
      const rawId = key.slice(separator + 1);
      const questionId = Number.isFinite(Number(rawId)) && rawId.trim() !== '' ? Number(rawId) : rawId;
      rows.push({ key, questionId, questionType, question: index[questionType]?.get(rawId), state });
    });
    return rows.sort((a, b) => String(b.state.updatedAt || '').localeCompare(String(a.state.updatedAt || '')));
  }, [workspaceVersion, questions, csatQuestions, englishQuestions]);

  const bookmarkedEntries = useMemo(
    () => workspaceEntries.filter(entry => entry.state.isBookmarked),
    [workspaceEntries]
  );
  const notedEntries = useMemo(
    () => workspaceEntries.filter(entry => entry.state.notes.trim().length > 0),
    [workspaceEntries]
  );

  const removeWorkspaceEntry = (entry: WorkspaceEntry, patch: { isBookmarked?: boolean; notes?: string }) => {
    saveRemoteQuestionState(
      userEmail,
      entry.questionType,
      entry.question || {
        id: entry.questionId,
        subject: entry.state.subject,
        topic: entry.state.topic,
        exam: entry.state.exam,
        year: entry.state.year,
      },
      patch
    );
  };
  const [legalPage, setLegalPage] = useState<null | 'about' | 'contact' | 'privacy' | 'terms' | 'refund'>(null);
  const [showFounderModal, setShowFounderModal] = useState(false);
  const [showReleasesModal, setShowReleasesModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<null | '1yr' | '2yr' | 'ebooks'>(null);

  useEffect(() => {
    if (localStorage.getItem(RELEASE_NOTES_STORAGE_KEY) === RELEASE_NOTES_VERSION) return;

    localStorage.setItem(RELEASE_NOTES_STORAGE_KEY, RELEASE_NOTES_VERSION);
    setShowReleasesModal(true);
  }, []);

  // ── Checkout coupons ──
  // The applied coupon is a preview only: `create-order` re-validates the code
  // server-side and recomputes the amount, so nothing here can change a price.
  type AppliedCoupon = {
    code: string;
    discountPercent: number;
    plans: string[];
    amounts: Record<string, { listAmount: number; discountAmount: number; finalAmount: number }>;
    description?: string | null;
  };
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponChecking(true);
    setCouponError(null);
    try {
      const res = await fetch('/api/coupon/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: userEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setAppliedCoupon(null);
        setCouponError(data.error || 'This coupon code is not valid.');
        return;
      }
      setAppliedCoupon({
        code: data.code,
        discountPercent: data.discountPercent,
        plans: data.plans || [],
        amounts: data.amounts || {},
        description: data.description,
      });
      setCouponInput(data.code);
    } catch {
      setCouponError('Could not check that coupon. Please try again.');
    } finally {
      setCouponChecking(false);
    }
  };

  const clearCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  };

  // A coupon is tied to the signed-in user (one redemption each), so drop it
  // when the account changes.
  useEffect(() => {
    clearCoupon();
  }, [userEmail]);

  // ── Feedback (global + per-question) ──
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<{ questionId: number | null; questionType: string }>({ questionId: null, questionType: 'global' });
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackAlias, setFeedbackAlias] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  const openFeedback = (questionId: number | null, questionType: string) => {
    setFeedbackTarget({ questionId, questionType });
    setFeedbackComment("");
    setFeedbackError("");
    setFeedbackDone(false);
    setFeedbackAlias(userEmail || "");
    setShowFeedbackModal(true);
  };

  const renderFeedbackModal = () => (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md animate-overlayFade sm:p-5"
          onMouseDown={() => setShowFeedbackModal(false)}
          role="presentation"
        >
          <div
            className="relative flex max-h-[calc(100%-1.5rem)] w-full max-w-[30rem] flex-col overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-2xl shadow-blue-950/30 dark:border-slate-600/70 dark:bg-[#101a2f] animate-modalPop"
            onMouseDown={(event) => event.stopPropagation()}
          >
            {/* Gradient header */}
            <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 px-6 py-6 text-center sm:py-7">
              <div className="pointer-events-none absolute -left-16 -top-20 h-44 w-44 rounded-full bg-cyan-300/15 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -right-12 h-44 w-44 rounded-full bg-fuchsia-400/20 blur-3xl" />
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="absolute right-3 top-3 z-20 rounded-xl p-2 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="relative flex flex-col items-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 shadow-lg shadow-indigo-950/15 ring-1 ring-inset ring-white/25 backdrop-blur-sm">
                  <MessageSquareText className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 max-w-full">
                  <h2 className="truncate text-xl font-extrabold leading-tight text-white">
                    {feedbackTarget.questionId != null ? 'Feedback on this question' : 'Send Feedback'}
                  </h2>
                  <p className="mt-1.5 truncate text-xs font-semibold uppercase tracking-wide text-white/75">
                    {feedbackTarget.questionId != null
                      ? `${feedbackTarget.questionType.toUpperCase()} · Q#${feedbackTarget.questionId}`
                      : 'Tell us what we can improve'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 sm:p-7">
              {feedbackDone ? (
                <div className="py-6 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                    <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                  </div>
                  <h3 className="mb-1 text-lg font-bold text-slate-900 dark:text-white">Thank you!</h3>
                  <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">Your feedback has been received.</p>
                  <button
                    onClick={() => setShowFeedbackModal(false)}
                    className="w-full rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-95"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <label className="mb-2 block shrink-0 text-[13px] font-bold text-slate-600 dark:text-slate-400">Your name / alias <span className="font-medium text-slate-400">(optional)</span></label>
                  <input
                    type="text"
                    value={feedbackAlias}
                    onChange={(e) => setFeedbackAlias(e.target.value)}
                    placeholder="Anonymous"
                    className="mb-5 w-full shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-medium text-slate-900 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-800/90 dark:text-white"
                  />
                  <label className="mb-2 block shrink-0 text-[13px] font-bold text-slate-600 dark:text-slate-400">Feedback</label>
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder={feedbackTarget.questionId != null ? "Is something wrong with this question? Let us know…" : "Share your suggestions, issues, or ideas…"}
                    className="min-h-[8rem] w-full flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm leading-6 text-slate-900 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-800/90 dark:text-white"
                  />
                  {feedbackError && <p className="shrink-0 text-xs text-rose-500 mt-2">{feedbackError}</p>}
                  <div className="mt-5 flex shrink-0 gap-3">
                    <button
                      onClick={() => setShowFeedbackModal(false)}
                      className="flex-1 rounded-2xl bg-slate-100 py-3.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitFeedback}
                      disabled={feedbackSubmitting || !feedbackComment.trim()}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {feedbackSubmitting ? 'Sending…' : (<><Send className="h-4 w-4" /> Send</>)}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
  );

  const submitFeedback = async () => {
    if (!feedbackComment.trim()) {
      setFeedbackError("Please enter your feedback.");
      return;
    }
    setFeedbackSubmitting(true);
    setFeedbackError("");
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: feedbackTarget.questionId,
          questionType: feedbackTarget.questionType,
          comment: feedbackComment,
          userAlias: feedbackAlias.trim() || userEmail || 'Anonymous',
        }),
      });
      if (res.ok) {
        setFeedbackDone(true);
        setFeedbackComment("");
      } else {
        const data = await res.json().catch(() => ({}));
        setFeedbackError(data.error || "Could not send feedback. Please try again.");
      }
    } catch (e) {
      setFeedbackError("Network error. Please try again.");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // ── Admin: all feedback list ──
  const [adminFeedback, setAdminFeedback] = useState<any[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const fetchAdminFeedback = useCallback(async () => {
    setLoadingFeedback(true);
    try {
      const res = await fetch('/api/admin/feedback', { headers: adminHeaders() });
      if (res.ok) setAdminFeedback(await res.json());
    } catch (e) {
      // ignore
    } finally {
      setLoadingFeedback(false);
    }
  }, []);

  const [adminPayments, setAdminPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const fetchAdminPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const res = await fetch('/api/admin/payments', { headers: adminHeaders() });
      if (res.ok) setAdminPayments(await res.json());
    } catch (e) {
      // ignore
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  useEffect(() => {
    if (adminUnlocked && isAdminView) { fetchAdminFeedback(); fetchAdminPayments(); fetchAdminCoupons(showWithdrawnCoupons); }
    // showWithdrawnCoupons has its own toggle handler, so it stays out of the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isAdminView, adminUnlocked, fetchAdminFeedback, fetchAdminPayments, fetchAdminCoupons]);

  useEffect(() => {
    fetch('/api/plans')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d === 'object') setPlanPrices(d); })
      .catch(() => {});
  }, []);

  // After a not-logged-in user logs in, resume the payment they intended.
  useEffect(() => {
    if (userEmail && pendingPlan) {
      const plan = pendingPlan;
      setPendingPlan(null);
      setShowLoginModal(false);
      initiatePayment(plan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, pendingPlan]);
  const [loginEmailInput, setLoginEmailInput] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [allUsers, setAllUsers] = useState<{email: string, status: string, expiryDate?: string}[]>([]);
  const [isAdminUserEmail, setIsAdminUserEmail] = useState("");
  const [isAdminUserStatus, setIsAdminUserStatus] = useState<"subscribed" | "not_subscribed" | "admin" | "editor">("subscribed");
  const [adminUserDuration, setAdminUserDuration] = useState("12");
  const [adminMessage, setAdminMessage] = useState({ text: "", type: "" });
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [expandedUserHistory, setExpandedUserHistory] = useState<string | null>(null);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeSessionsMap, setActiveSessionsMap] = useState<Record<string, number>>({});
  type AdminUserUsage = {
    bookmarks: number;
    notes: number;
    attempts: number;
    correct: number;
    wrong: number;
    topExam: string | null;
    topExamAttempts: number;
    examBreakdown: { exam: string; attempts: number }[];
  };
  type AdminExamUsage = { exam: string; attempts: number; users: number };
  const [adminUserUsage, setAdminUserUsage] = useState<Record<string, AdminUserUsage>>({});
  const [adminExamUsage, setAdminExamUsage] = useState<AdminExamUsage[]>([]);
  const [isLoadingUserUsage, setIsLoadingUserUsage] = useState(false);
  const [adminCouponsPortalTarget, setAdminCouponsPortalTarget] = useState<HTMLDivElement | null>(null);
  const [adminUsagePortalTarget, setAdminUsagePortalTarget] = useState<HTMLDivElement | null>(null);
  const [adminFeedbackPortalTarget, setAdminFeedbackPortalTarget] = useState<HTMLDivElement | null>(null);
  const adminUsageRows = useMemo(
    () => allUsers.map(user => ({
      email: user.email,
      usage: adminUserUsage[user.email] || { bookmarks: 0, notes: 0, attempts: 0, correct: 0, wrong: 0, topExam: null, topExamAttempts: 0, examBreakdown: [] },
    })),
    [allUsers, adminUserUsage]
  );
  const adminUsageTotals = useMemo(
    () => adminUsageRows.reduce(
      (totals, row) => ({
        bookmarks: totals.bookmarks + row.usage.bookmarks,
        notes: totals.notes + row.usage.notes,
        attempts: totals.attempts + row.usage.attempts,
        correct: totals.correct + row.usage.correct,
        wrong: totals.wrong + row.usage.wrong,
      }),
      { bookmarks: 0, notes: 0, attempts: 0, correct: 0, wrong: 0 }
    ),
    [adminUsageRows]
  );
  const rankedAdminUsageRows = useMemo(
    () => [...adminUsageRows].sort((a, b) => b.usage.attempts - a.usage.attempts),
    [adminUsageRows]
  );
  const mostActiveAdminUser = rankedAdminUsageRows[0]?.usage.attempts > 0 ? rankedAdminUsageRows[0] : null;
  const maxAdminAttempts = Math.max(1, ...rankedAdminUsageRows.map(row => row.usage.attempts));
  const topAdminExams = adminExamUsage.slice(0, 5);
  const maxAdminExamAttempts = Math.max(1, ...topAdminExams.map(exam => exam.attempts));

  const fetchAllUserUsage = async () => {
    setIsLoadingUserUsage(true);
    try {
      const response = await fetch('/api/admin/user-usage', { headers: adminHeaders() });
      const body = await response.text();
      const data = body ? JSON.parse(body) : null;
      if (!response.ok) throw new Error(data?.error || `Failed to load usage (${response.status})`);
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Usage API returned an invalid response");
      }
      setAdminUserUsage(data.users || {});
      setAdminExamUsage(Array.isArray(data.exams) ? data.exams : []);
    } catch (error: any) {
      setAdminUserUsage({});
      setAdminExamUsage([]);
      setAdminMessage({ text: error.message || "Failed to load user usage", type: "error" });
    } finally {
      setIsLoadingUserUsage(false);
    }
  };

  const fetchLoginHistory = async (email: string) => {
    if (expandedUserHistory === email) {
      setExpandedUserHistory(null);
      return;
    }
    setExpandedUserHistory(email);
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/admin/login-history/${encodeURIComponent(email)}`, { headers: adminHeaders() });
      if (response.ok) {
        const data = await response.json();
        setLoginHistory(data);
      }
    } catch (e) {
      setLoginHistory([]);
    }
    setIsLoadingHistory(false);
  };

  const fetchActiveSessions = async () => {
    try {
      const response = await fetch('/api/admin/active-sessions', { headers: adminHeaders() });
      if (response.ok) {
        const data = await response.json();
        const map: Record<string, number> = {};
        data.forEach((item: { email: string, count: number }) => { map[item.email] = item.count; });
        setActiveSessionsMap(map);
      }
    } catch {}
  };

  const fetchAllUsers = async () => {
    if (!isAdmin) return;
    setIsLoadingUsers(true);
    try {
      console.log("Fetching users from API...");
      const response = await fetch('/api/admin/users', { headers: adminHeaders() });
      
      if (!response.ok) {
        throw new Error(`API fetch failed with status ${response.status}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("API did not return JSON");
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setAllUsers(data);
      }
    } catch (error: any) {
      console.error("Failed to fetch users:", error.message || error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (userEmail) {
      checkUserStatus(userEmail);
    }
  }, [userEmail]);

  useEffect(() => {
    if (isAdmin && userEmail && isAdminView && adminUnlocked) {
      fetchAllUsers();
      fetchActiveSessions();
      fetchAllUserUsage();
    }
  }, [isAdmin, userEmail, isAdminView, adminUnlocked]);

  const handleUpdateUser = async (
    email: string,
    status: string,
    accessDuration?: { durationMonths: number }
  ): Promise<boolean> => {
    if (!requireAdminKey()) return false;
    const userEmailToUpdate = email.toLowerCase().trim();
    try {
      console.log(`Updating user ${userEmailToUpdate} to ${status}...`);
      const response = await fetch('/api/admin/update-status', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ email: userEmailToUpdate, status, ...accessDuration })
      });

      if (response.ok) {
        setAdminMessage({ text: `User ${userEmailToUpdate} updated to ${status}`, type: "success" });
        setTimeout(() => setAdminMessage({ text: "", type: "" }), 3000);
        fetchAllUsers();
        if (userEmailToUpdate === userEmail) checkUserStatus(userEmailToUpdate);
        return true;
      } else {
        const err = await response.json().catch(() => ({ error: "Unknown server error" }));
        throw new Error(err.details || err.error || "Server failed");
      }
    } catch (error: any) {
      console.error("Failed to update user:", error.message || error);
      setAdminMessage({ text: `Failed: ${error.message || "Server error"}`, type: "error" });
      return false;
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (!requireAdminKey()) return;
    if (email === userEmail) return; // Don't delete self
    if (!window.confirm(`Are you sure you want to deactivate "${email}"? This user will no longer have access.`)) return;
    const userEmailToDelete = email.toLowerCase().trim();
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userEmailToDelete)}`, { method: 'DELETE', headers: adminHeaders() });
      if (response.ok) {
        setAdminMessage({ text: `User ${userEmailToDelete} deactivated`, type: "success" });
        setTimeout(() => setAdminMessage({ text: "", type: "" }), 3000);
        fetchAllUsers();
        return;
      } else {
        throw new Error("Server delete failed");
      }
    } catch (error: any) {
      console.error("Failed to deactivate user:", error.message || error);
      setAdminMessage({ text: "Failed to deactivate user", type: "error" });
    }
  };

  const handleAddUserFromAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminUserEmail.trim()) return;
    const durationMonths = Number(adminUserDuration);
    if (!Number.isInteger(durationMonths) || durationMonths < 1) {
      setAdminMessage({
        text: "Months must be a positive whole number.",
        type: "error"
      });
      return;
    }
    const updated = await handleUpdateUser(isAdminUserEmail.trim(), isAdminUserStatus, {
      durationMonths,
    });
    if (updated) setIsAdminUserEmail("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmailInput.trim() || !loginEmailInput.includes('@')) return;

    setIsLoggingIn(true);
    const email = loginEmailInput.trim().toLowerCase();
    
    // Store session
    const session = {
      email,
      loginTime: Date.now()
    };
    localStorage.setItem('user_session', JSON.stringify(session));
    setUserEmail(email);
    
    // Track login device info
    try {
      const ua = navigator.userAgent;
      const screenWidth = window.innerWidth;
      const device = screenWidth < 768 ? "Mobile" : screenWidth < 1024 ? "Tablet" : "Desktop";
      const browser = ua.includes("Edg") ? "Edge" : ua.includes("Chrome") ? "Chrome" : ua.includes("Safari") ? "Safari" : ua.includes("Firefox") ? "Firefox" : "Other";
      const os = ua.includes("Android") ? "Android" : ua.includes("iPhone") || ua.includes("iPad") ? "iOS" : ua.includes("Win") ? "Windows" : ua.includes("Mac") ? "macOS" : ua.includes("Linux") ? "Linux" : "Other";
      fetch("/api/auth/track-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, device, browser, os, screenWidth })
      }).then(r => r.json()).then(data => {
        if (data.sessionId) localStorage.setItem('login_session_id', data.sessionId);
      }).catch(() => {});
    } catch {}

    // Check status
    await checkUserStatus(email);
    
    setIsLoggingIn(false);
    setShowLoginModal(false);
  };

  const handleLogout = () => {
    // Mark login session as inactive
    const sessionId = localStorage.getItem('login_session_id');
    const session = localStorage.getItem('user_session');
    const email = session ? JSON.parse(session).email : null;
    if (sessionId && email) {
      fetch("/api/auth/track-logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, sessionId })
      }).catch(() => {});
    }
    localStorage.removeItem('user_session');
    localStorage.removeItem('login_session_id');
    localStorage.removeItem('admin_api_key');
    localStorage.removeItem('admin_unlock_expiry');
    setAdminUnlocked(false);
    setIsAdminView(false);
    setUserEmail(null);
    setIsSubscribed(false);
    setShowLoginModal(true);
  };

  const yearsList = useMemo(() => {
    const availableData = questions.filter(q => 
      (examFilter === "All" || getExamCategory(q.exam) === examFilter) &&
      (paperFilter === "All" || q.exam === paperFilter) &&
      (subjectFilter === "All" || q.subject === subjectFilter) &&
      (topicFilter === "All" || q.topic === topicFilter)
    );
    const uniqueYears = Array.from(new Set(availableData.map(q => q.year))).sort((a, b) => (b as string).localeCompare(a as string));
    
    // Count questions for each year GIVEN current exam/subject/topic filters
    const yearCounts: Record<string, number> = {};
    availableData.forEach(q => {
      yearCounts[q.year] = (yearCounts[q.year] || 0) + 1;
    });

    return { 
      options: ["All", ...uniqueYears],
      counts: yearCounts,
      total: availableData.length
    };
  }, [questions, examFilter, paperFilter, subjectFilter, topicFilter]);

  const examsList = useMemo(() => {
    const uniqueExams = [...new Set(questions.map(q => getExamCategory(q.exam)))].sort();
    
    const examCounts: Record<string, number> = {};
    questions.forEach(q => {
      const category = getExamCategory(q.exam);
      examCounts[category] = (examCounts[category] || 0) + 1;
    });

    return { 
      options: ["All", ...uniqueExams],
      counts: examCounts
    };
  }, [questions]);

  const papersList = useMemo(() => {
    const availableData = questions.filter(q =>
      (examFilter === "All" || getExamCategory(q.exam) === examFilter) &&
      (yearFilter === "All" || q.year === yearFilter) &&
      (subjectFilter === "All" || q.subject === subjectFilter) &&
      (topicFilter === "All" || q.topic === topicFilter)
    );
    const uniquePapers = [...new Set(availableData.map(q => q.exam))].sort();

    const paperCounts: Record<string, number> = {};
    availableData.forEach(q => {
      paperCounts[q.exam] = (paperCounts[q.exam] || 0) + 1;
    });

    return {
      options: ["All", ...uniquePapers],
      counts: paperCounts
    };
  }, [questions, examFilter, yearFilter, subjectFilter, topicFilter]);

  const subjectsList = useMemo(() => {
    const availableData = questions.filter(q => 
      (yearFilter === "All" || q.year === yearFilter) &&
      (examFilter === "All" || getExamCategory(q.exam) === examFilter) &&
      (paperFilter === "All" || q.exam === paperFilter) &&
      (topicFilter === "All" || q.topic === topicFilter)
    );
    const uniqueSubjects = [...new Set(availableData.map(q => q.subject))].sort();
    
    const subjectCounts: Record<string, number> = {};
    availableData.forEach(q => {
      subjectCounts[q.subject] = (subjectCounts[q.subject] || 0) + 1;
    });

    return { 
      options: ["All", ...uniqueSubjects],
      counts: subjectCounts
    };
  }, [questions, yearFilter, examFilter, paperFilter, topicFilter]);

  const topicsList = useMemo(() => {
    const availableData = questions.filter(q => 
      (yearFilter === "All" || q.year === yearFilter) &&
      (examFilter === "All" || getExamCategory(q.exam) === examFilter) &&
      (paperFilter === "All" || q.exam === paperFilter) &&
      (subjectFilter === "All" || q.subject === subjectFilter)
    );
    
    const stats: Record<string, number> = {};
    availableData.forEach(q => {
      if (q.topic) {
        stats[q.topic] = (stats[q.topic] || 0) + 1;
      }
    });

    const sortedTopics = Object.entries(stats)
      .sort((a, b) => b[1] - a[1] || (a[0] as string).localeCompare(b[0] as string))
      .map(entry => entry[0]);

    return { 
      options: ["All", ...sortedTopics],
      counts: stats
    };
  }, [questions, yearFilter, examFilter, paperFilter, subjectFilter]);

  // Auto-reset filters if selected option is no longer available
  useEffect(() => {
    if (isApplyingDefaultFilters) return;
    if (yearFilter !== "All" && !yearsList.options.includes(yearFilter)) {
      setYearFilter("All");
    }
  }, [isApplyingDefaultFilters, yearsList.options, yearFilter]);

  useEffect(() => {
    if (isApplyingDefaultFilters) return;
    if (examFilter !== "All" && !examsList.options.includes(examFilter)) {
      setExamFilter("All");
    }
  }, [examFilter, examsList.options, isApplyingDefaultFilters]);

  useEffect(() => {
    if (isApplyingDefaultFilters) return;
    if (paperFilter !== "All" && !papersList.options.includes(paperFilter)) {
      setPaperFilter("All");
    }
  }, [isApplyingDefaultFilters, paperFilter, papersList.options]);

  useEffect(() => {
    if (isApplyingDefaultFilters) return;
    if (subjectFilter !== "All" && !subjectsList.options.includes(subjectFilter)) {
      setSubjectFilter("All");
    }
  }, [isApplyingDefaultFilters, subjectFilter, subjectsList.options]);

  useEffect(() => {
    if (isApplyingDefaultFilters) return;
    if (topicFilter !== "All" && !topicsList.options.includes(topicFilter)) {
      setTopicFilter("All");
    }
  }, [isApplyingDefaultFilters, topicFilter, topicsList.options]);

  useEffect(() => {
    if (mainsYearFilter !== "All" && !mainsYearsList.options.includes(mainsYearFilter)) {
      setMainsYearFilter("All");
    }
  }, [mainsYearsList.options, mainsYearFilter]);

  useEffect(() => {
    if (mainsExamFilter !== "All" && !mainsExamsList.options.includes(mainsExamFilter)) {
      setMainsExamFilter("All");
    }
  }, [mainsExamsList.options, mainsExamFilter]);

  useEffect(() => {
    if (mainsSubjectFilter !== "All" && !mainsSubjectsList.options.includes(mainsSubjectFilter)) {
      setMainsSubjectFilter("All");
    }
  }, [mainsSubjectsList.options, mainsSubjectFilter]);

  useEffect(() => {
    if (mainsTopicFilter !== "All" && !mainsTopicsList.options.includes(mainsTopicFilter)) {
      setMainsTopicFilter("All");
    }
  }, [mainsTopicsList.options, mainsTopicFilter]);

  // Every prelims filter except the bookmark/notes toggles themselves. Shared by
  // the list, the "load more" check and the sidebar badges, so a badge count can
  // never disagree with what is actually rendered.
  const matchesPrelimsBaseFilters = useCallback((q: Question) => {
    // Skip questions without valid question text
    if (!q.question || q.question.trim() === '' || q.question.startsWith('Q_')) return false;

    const matchesYear = yearFilter === "All" || q.year === yearFilter;
    const matchesExam = examFilter === "All" || getExamCategory(q.exam) === examFilter;
    const matchesPaper = paperFilter === "All" || q.exam === paperFilter;
    const matchesSubject = subjectFilter === "All" || q.subject === subjectFilter;
    const matchesTopic = topicFilter === "All" || q.topic === topicFilter;
    const matchesSearch = searchQuery === "" ||
      matchesQuestionId(q.id, searchQuery) ||
      (q.question || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.explanation || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.options || []).some(opt => (opt || "").toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesYear && matchesExam && matchesPaper && matchesSubject && matchesTopic && matchesSearch;
  }, [yearFilter, examFilter, paperFilter, subjectFilter, topicFilter, searchQuery]);

  const [bookmarkedPrelimsCount, notedPrelimsCount] = useMemo(
    () => countSavedQuestions("prelims", questions.filter(matchesPrelimsBaseFilters)),
    [questions, matchesPrelimsBaseFilters, workspaceVersion]
  );

  const filteredQuestions = useMemo(() => {
    if (randomMode.active) {
      return randomizedQuestions;
    }

    const list = sortQuestionsBy(
      questions.filter(
        q => matchesPrelimsBaseFilters(q) && matchesSavedFilters("prelims", q, bookmarkedOnly, notedOnly)
      ),
      "prelims",
      sortMode
    );

    // Bookmarked/noted sets are small and the user expects the badge count to
    // match what's on screen, so skip pagination while either filter is on.
    if (bookmarkedOnly || notedOnly) return list;
    return list.slice(0, visibleCount);
  }, [questions, matchesPrelimsBaseFilters, visibleCount, randomMode, randomizedQuestions, bookmarkedOnly, notedOnly, sortMode, workspaceVersion]);

  const isMoreToLoad = useMemo(() => {
    if (randomMode.active) return false;
    if (bookmarkedOnly || notedOnly) return false;
    const totalFiltered = questions.filter(q => {
      if (!matchesPrelimsBaseFilters(q)) return false;

      const state = remoteQuestionState.get(remoteStateKey("prelims", q.id));
      const matchesBookmark = !bookmarkedOnly || state?.isBookmarked === true;
      const matchesNote = !notedOnly || (state?.notes || "").trim() !== "";

      return matchesBookmark && matchesNote;
    }).length;
    return totalFiltered > visibleCount;
  }, [questions, matchesPrelimsBaseFilters, visibleCount, randomMode, bookmarkedOnly, notedOnly, workspaceVersion]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + 150);
  }, []);

  const handleMainsLoadMore = useCallback(() => {
    setMainsVisibleCount(prev => prev + 50);
  }, []);

  // Infinite scroll: load more on scroll near bottom.
  // Guarded so it never runs while the admin dashboard is open (its tall page
  // would otherwise silently inflate visibleCount and freeze the list on Back),
  // and never grows visibleCount past what's actually available.
  useEffect(() => {
    if (isAdminView) return;
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 2500
      ) {
        if (activeTab === 'prelims') { if (isMoreToLoad) handleLoadMore(); }
        else if (activeTab === 'mains') handleMainsLoadMore();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleLoadMore, handleMainsLoadMore, activeTab, isAdminView, isMoreToLoad]);

  // Reset mains pagination on filter change
  useEffect(() => {
    setMainsVisibleCount(30);
  }, [mainsYearFilter, mainsExamFilter, mainsSubjectFilter, mainsTopicFilter, mainsSearchQuery]);

  const handleOptionClick = (qid: number, option: string, isCorrect: boolean, questionType: string = 'prelims', subject?: string, topic?: string) => {
    // Re-attempting is allowed, but picking the same option again would only
    // inflate the counters without saying anything new about recall.
    if (userAttempts[qid] === option) return;
    setUserAttempts(prev => ({ ...prev, [qid]: option }));
    setRevealedAnswers(prev => ({ ...prev, [qid]: true }));
    setScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));
    setSectionScores(prev => {
      const cur = prev[questionType] || { correct: 0, total: 0 };
      return { ...prev, [questionType]: { correct: cur.correct + (isCorrect ? 1 : 0), total: cur.total + 1 } };
    });
    // Keep the tally in memory for everyone so the attempt badge and history
    // work signed out; only a logged-in attempt is persisted server-side.
    recordRemoteAttempt(userEmail, questionType, qid, option, isCorrect, attemptId);
    if (userEmail) {
      fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, questionId: qid, questionType, option, isCorrect, attemptId, subject, topic }),
      }).catch(() => {});
    }
  };

  const toggleAnswer = (qid: number) => {
    setRevealedAnswers(prev => ({ ...prev, [qid]: !prev[qid] }));
  };

  const toggleMainsAnswer = (qid: string) => {
    setRevealedMainsAnswers(prev => ({ ...prev, [qid]: !prev[qid] }));
  };

  const updateQuestionAnswer = async (
    section: "prelims" | "english",
    id: number,
    answer: string,
    explanation: string
  ) => {
    const res = await fetch("/api/update-question", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, id, answer, explanation, email: userEmail }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert("Update failed: " + (err.error || "Unknown error"));
      throw new Error(err.error);
    }
    const data = await res.json();
    const applyUpdate = (items: Question[]) => items.map(q =>
      q.id === id ? { ...q, answer: data.answer, explanation: data.explanation } : q
    );
    if (section === "english") {
      setEnglishQuestions(applyUpdate);
    } else {
      setQuestions(applyUpdate);
    }
  };

  const handleUpdateQuestion = (id: number, _year: string, answer: string, explanation: string) =>
    updateQuestionAnswer("prelims", id, answer, explanation);

  const handleUpdateEnglishQuestion = (id: number, _year: string, answer: string, explanation: string) =>
    updateQuestionAnswer("english", id, answer, explanation);

  const resetFilters = () => {
    setYearFilter("All");
    setExamFilter("All");
    setPaperFilter("All");
    setSubjectFilter("All");
    setTopicFilter("All");
    setSearchQuery("");
    setBookmarkedOnly(false);
    setNotedOnly(false);
    setSortMode('latest');
    setVisibleCount(30);
    setRandomMode({ active: false, limit: 0 });
    resetQuiz(false);
  };

  const hasSavedPrelimsDefault = savedPrelimsFilterDefaults !== null;
  const hasSavedCSATDefault = savedCSATFilterDefaults !== null;
  const hasSavedEnglishDefault = savedEnglishFilterDefaults !== null;

  // One saver for all three sections. The body carries the section name and its
  // filters (plus the sort mode); the API stores each section independently.
  const saveFilterDefaults = async (
    section: 'prelims' | 'csat' | 'english',
    filters: Record<string, string>
  ) => {
    if (!userEmail) {
      setDefaultFilterMessage({ text: "Sign in to save default filters.", type: "error" });
      setShowLoginModal(true);
      return;
    }

    setSavingDefaultSection(section);
    setIsSavingDefaultFilters(section === 'prelims');
    setDefaultFilterMessage(null);

    try {
      const response = await fetch("/api/filter-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, section, filters }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save default filters");

      if (section === 'prelims') {
        loadedDefaultFiltersForEmailRef.current = userEmail;
        setSavedPrelimsFilterDefaults(filters as PrelimsFilterPreferences);
      } else if (section === 'csat') {
        setSavedCSATFilterDefaults(filters as CSATFilterPreferences);
      } else {
        setSavedEnglishFilterDefaults(filters as PrelimsFilterPreferences);
      }
      setDefaultFilterMessage({ text: "Current filters saved as your default.", type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save default filters";
      setDefaultFilterMessage({ text: message, type: "error" });
    } finally {
      setSavingDefaultSection(null);
      setIsSavingDefaultFilters(false);
    }
  };

  const removeFilterDefaults = async (section: 'prelims' | 'csat' | 'english') => {
    if (!userEmail) return;

    setSavingDefaultSection(section);
    setIsSavingDefaultFilters(section === 'prelims');
    setDefaultFilterMessage(null);
    try {
      const response = await fetch(
        `/api/filter-preferences?email=${encodeURIComponent(userEmail)}&section=${section}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not remove default filters");

      if (section === 'prelims') setSavedPrelimsFilterDefaults(null);
      else if (section === 'csat') setSavedCSATFilterDefaults(null);
      else setSavedEnglishFilterDefaults(null);
      setDefaultFilterMessage({ text: "Default choice removed. Current filters are unchanged.", type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not remove default filters";
      setDefaultFilterMessage({ text: message, type: "error" });
    } finally {
      setSavingDefaultSection(null);
      setIsSavingDefaultFilters(false);
    }
  };

  const togglePrelimsFilterDefault = () => {
    if (hasSavedPrelimsDefault) {
      removeFilterDefaults('prelims');
    } else {
      saveFilterDefaults('prelims', {
        exam: examFilter,
        year: yearFilter,
        paper: paperFilter,
        subject: subjectFilter,
        topic: topicFilter,
        sort: sortMode,
      });
    }
  };

  const toggleCSATFilterDefault = () => {
    if (hasSavedCSATDefault) {
      removeFilterDefaults('csat');
    } else {
      saveFilterDefaults('csat', {
        year: csatYearFilter,
        subject: csatSubjectFilter,
        sort: csatSortMode,
      });
    }
  };

  const toggleEnglishFilterDefault = () => {
    if (hasSavedEnglishDefault) {
      removeFilterDefaults('english');
    } else {
      saveFilterDefaults('english', {
        exam: englishExamFilter,
        year: englishYearFilter,
        paper: englishPaperFilter,
        subject: englishSubjectFilter,
        topic: englishTopicFilter,
        sort: englishSortMode,
      });
    }
  };

  const resetMainsFilters = () => {
    setMainsYearFilter("All");
    setMainsExamFilter("All");
    setMainsSubjectFilter("All");
    setMainsTopicFilter("All");
    setMainsSearchQuery("");
    setMainsRandomMode(false);
  };

  const startMainsRandomPractice = (limit: number) => {
    const baseList = mainsQuestions.filter(q => {
      const matchesYear = mainsYearFilter === "All" || q.year === mainsYearFilter;
      const matchesExam = mainsExamFilter === "All" || q.exam === mainsExamFilter;
      const matchesSubject = mainsSubjectFilter === "All" || q.subject === mainsSubjectFilter;
      const matchesSearch = mainsSearchQuery === "" ||
        matchesQuestionId(q.id, mainsSearchQuery) ||
        (q.question || "").toLowerCase().includes(mainsSearchQuery.toLowerCase());
      return matchesYear && matchesExam && matchesSubject && matchesSearch;
    });
    const shuffled = [...baseList].sort(() => Math.random() - 0.5);
    setMainsRandomizedQuestions(shuffled.slice(0, limit));
    setMainsRandomMode(true);
    setRevealedMainsAnswers({});
  };

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(30);
  }, [yearFilter, examFilter, paperFilter, subjectFilter, topicFilter, searchQuery, bookmarkedOnly, notedOnly]);

  const resetQuiz = (scrollToTop = true) => {
    setUserAttempts({});
    setRevealedAnswers({});
    setScore({ correct: 0, total: 0 });
    setSectionScores({});
    setAttemptId(newAttemptId());
    if (scrollToTop) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // An attempt = one practice run until the user presses Reset or reloads the page.
  // We do NOT restore prior runs onto the screen; each load starts a fresh attempt.
  // Every answered question is still saved to the DB (grouped by attemptId) for the record.

  // Reusable score chip (used by Prelims, CSAT and English section headers).
  const renderScoreChip = (sc: { correct: number; total: number }) => {
    const wrong = sc.total - sc.correct;
    const markedScore = sc.correct - wrong / 3;
    const pct = sc.total > 0 ? markedScore / sc.total : 0;
    const ringProgress = Math.max(0, Math.min(1, pct));
    const low = sc.total > 0 && pct < 0.5;
    const C = 2 * Math.PI * 13;
    return (
      <button
        type="button"
        onClick={() => resetQuiz(false)}
        disabled={sc.total === 0}
        aria-label={sc.total > 0 ? `${sc.correct} correct out of ${sc.total} attempted. Percentage includes one-third negative marking. Click to reset.` : "No score yet"}
        title={sc.total > 0 ? `${sc.correct}/${sc.total} correct. Percentage includes a 1/3 mark deduction for each wrong answer. Click to reset.` : "Answer questions to start scoring"}
        className={cn(
        "group h-[38px] pl-1.5 pr-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 shadow-sm backdrop-blur-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        low
          ? "bg-red-50/80 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/25"
          : "bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25",
        sc.total > 0
          ? "cursor-pointer hover:-translate-y-0.5 hover:bg-gradient-to-br hover:from-blue-600 hover:to-indigo-600 hover:text-white hover:border-blue-500 hover:shadow-lg hover:shadow-blue-600/25 active:translate-y-0 active:scale-95"
          : "cursor-default"
      )}>
        <div className="relative w-7 h-7 flex-shrink-0">
          <svg className="w-7 h-7 -rotate-90" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="13" fill="none" strokeWidth="3" className="stroke-slate-200/70 transition-colors group-hover:stroke-white/30 dark:stroke-slate-700" />
            <circle cx="16" cy="16" r="13" fill="none" strokeWidth="3" strokeLinecap="round"
              className={cn(low ? "stroke-red-500" : "stroke-emerald-500", "transition-colors group-hover:stroke-white")}
              style={{ strokeDasharray: C, strokeDashoffset: C * (1 - ringProgress), transition: 'stroke-dashoffset 0.5s ease' }} />
          </svg>
          <span className={cn("absolute inset-0 flex items-center justify-center text-[8px] font-extrabold transition-colors group-hover:text-white", low ? "text-red-500" : "text-emerald-500")}>
            {sc.total > 0 ? `${Math.round(pct * 100)}%` : <Trophy className="w-2.5 h-2.5" />}
          </span>
        </div>
        <div className="flex items-baseline gap-0.5 leading-none">
          <span className="text-[13px] tabular-nums">{sc.correct}</span>
          <span className="text-[10px] font-medium opacity-60">/</span>
          <span className="text-[13px] tabular-nums opacity-70">{sc.total}</span>
        </div>
        {sc.total > 0 && (
          <RotateCcw className="ml-0.5 h-3 w-3 opacity-50 transition-all duration-300 group-hover:rotate-180 group-hover:opacity-100" />
        )}
      </button>
    );
  };

  const isAppLoading = 
    (activeTab === 'prelims' && isLoadingQuestions) ||
    (activeTab === 'mains' && isLoadingMains) ||
    (activeTab === 'csat' && isLoadingCSAT) ||
    (activeTab === 'english' && isLoadingEnglish) ||
    (activeTab === 'toppers' && isLoadingToppers);

  const startRandomPractice = (limit: number) => {
    const baseList = questions.filter(q => {
      // If not subscribed, only random from latest 2 years
      if (!isSubscribed && !latestTwoYears.includes(q.year)) return false;

      const marchesYear = yearFilter === "All" || q.year === yearFilter;
      const matchesExam = examFilter === "All" || getExamCategory(q.exam) === examFilter;
      const matchesPaper = paperFilter === "All" || q.exam === paperFilter;
      const matchesSubject = subjectFilter === "All" || q.subject === subjectFilter;
      const matchesTopic = topicFilter === "All" || q.topic === topicFilter;
      const matchesSearch = searchQuery === "" || 
        matchesQuestionId(q.id, searchQuery) ||
        (q.question || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.explanation || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.options || []).some(opt => (opt || "").toLowerCase().includes(searchQuery.toLowerCase()));

      return marchesYear && matchesExam && matchesPaper && matchesSubject && matchesTopic && matchesSearch;
    });

    const shuffled = [...baseList].sort(() => Math.random() - 0.5);
    setRandomizedQuestions(shuffled.slice(0, limit));
    setRandomMode({ active: true, limit });
    resetQuiz();
  };

  const startCSATRandomPractice = (limit: number) => {
    const baseList = csatQuestions.filter(q => {
      const matchesYear = csatYearFilter === "All" || q.year === csatYearFilter;
      const matchesSubject = csatSubjectFilter === "All" || q.subject === csatSubjectFilter;
      const matchesSearch = csatSearchQuery === "" ||
        matchesQuestionId(q.id, csatSearchQuery) ||
        (q.question || "").toLowerCase().includes(csatSearchQuery.toLowerCase());
      return matchesYear && matchesSubject && matchesSearch;
    });

    const shuffled = [...baseList].sort(() => Math.random() - 0.5);
    setCSATRandomizedQuestions(shuffled.slice(0, limit));
    setCSATRandomMode(true);
  };

  const startEnglishRandomPractice = (limit: number) => {
    const baseList = englishQuestions.filter(q => {
      const matchesYear = englishYearFilter === "All" || q.year === englishYearFilter;
      const matchesSubject = englishSubjectFilter === "All" || q.subject === englishSubjectFilter;
      const matchesExam = englishExamFilter === "All" || getExamCategory(q.exam) === englishExamFilter;
      const matchesPaper = englishPaperFilter === "All" || q.exam === englishPaperFilter;
      const matchesSearch = englishSearchQuery === "" ||
        matchesQuestionId(q.id, englishSearchQuery) ||
        (q.question || "").toLowerCase().includes(englishSearchQuery.toLowerCase());
      return matchesYear && matchesSubject && matchesExam && matchesPaper && matchesSearch;
    });

    const shuffled = [...baseList].sort(() => Math.random() - 0.5);
    setEnglishRandomizedQuestions(shuffled.slice(0, limit));
    setEnglishRandomMode(true);
  };

  return (
    <div className={cn("min-h-screen", isDarkMode ? "dark" : "")}>
      <CardIconGradients />
      <div className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-200 font-sans antialiased min-h-screen flex flex-col transition-colors duration-300">
        <header className={cn(
          "header-3d bg-gradient-to-b from-slate-50/90 via-white/85 to-indigo-50/60 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 backdrop-blur-xl border-b border-slate-200/70 dark:border-indigo-900/50 sticky top-0 z-50 transition-all duration-300",
          isScrolled ? "is-scrolled" : ""
        )}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top row: logo, tabs, score/random, theme, login - wraps on small screens */}
          <div className={cn(
            "flex flex-wrap items-center gap-y-2 transition-all duration-300",
            isScrolled ? "py-1.5" : "py-2.5"
          )}>
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white p-1.5 rounded-xl shadow-lg shadow-blue-600/25 flex items-center justify-center w-8 h-8 flex-shrink-0 ring-1 ring-white/20">
                <Landmark className="w-4 h-4" />
              </div>
              <h1 className="text-base font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400 bg-clip-text text-transparent leading-tight hidden lg:block">UPSC PYQ Powerhouse</h1>
              <h1 className="text-sm font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400 bg-clip-text text-transparent leading-tight lg:hidden hidden sm:block">PYQHouse</h1>

              {/* Compact tab pills inline */}
              <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700 ml-1 sm:ml-2 min-w-0 overflow-x-auto scrollbar-hide">
               {([
                  { id: 'prelims', label: 'Prelims', count: questions.length },
                  { id: 'mains', label: 'Mains', count: mainsQuestions.length },
                  { id: 'csat', label: 'CSAT', count: csatQuestions.length },
                  { id: 'english', label: 'English', count: englishQuestions.length },
                  { id: 'essay', label: 'Essay', count: 0 },
                  { id: 'toppers', label: "Topper's Copy", count: toppersQuestions.length },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); window.scrollTo(0, 0); }}
                    className={cn(
                      "px-2 sm:px-2.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold transition-all whitespace-nowrap flex items-center gap-1",
                      activeTab === tab.id
                        ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={cn(
                        "text-[8px] px-1 py-px rounded font-bold hidden sm:inline",
                        activeTab === tab.id
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                      )}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto order-none">
            {/* Score + Random controls - inline on wide, wraps on narrow */}
            {activeTab === 'prelims' && (
              <div className="flex items-center gap-2 order-3 lg:order-none">
                {renderScoreChip(sectionScores.prelims || { correct: 0, total: 0 })}

                <div className="flex items-center gap-1 h-[38px] bg-slate-100 dark:bg-slate-700 p-1 rounded-xl border border-slate-200 dark:border-slate-600">
                  <QuestionCountToggle value={randomSelectLimit} onChange={setRandomSelectLimit} />
                  <button
                    onClick={() => startRandomPractice(randomSelectLimit)}
                    title={isSubscribed ? "Start Random Practice" : "Random Practice (Limited to Latest 2 Years)"}
                    className="px-2.5 py-1 rounded-md transition-all text-[11px] font-bold flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white active:scale-95 shadow-md shadow-blue-600/25"
                  >
                    <span className="hidden sm:inline">Random PYQ</span>
                    <span className="sm:hidden">Random</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'mains' && (
              <div className="flex items-center gap-2 order-3 lg:order-none">
                <div className="flex items-center gap-1 h-[38px] bg-slate-100 dark:bg-slate-700 p-1 rounded-xl border border-slate-200 dark:border-slate-600">
                  <QuestionCountToggle value={mainsRandomSelectLimit} onChange={setMainsRandomSelectLimit} />
                  <button
                    onClick={() => startMainsRandomPractice(mainsRandomSelectLimit)}
                    className="px-2.5 py-1 rounded-md transition-all text-[11px] font-bold flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white active:scale-95 shadow-md shadow-blue-600/25"
                  >
                    <span className="hidden sm:inline">Random PYQ</span>
                    <span className="sm:hidden">Random</span>
                  </button>
                  {mainsRandomMode && (
                    <button
                      onClick={() => setMainsRandomMode(false)}
                      title="Exit Random Mode"
                      className="px-2 py-0.5 rounded-md text-[11px] font-bold text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'csat' && (
              <div className="flex items-center gap-2 order-3 lg:order-none">
                {renderScoreChip(sectionScores.csat || { correct: 0, total: 0 })}
                <div className="flex items-center gap-1 h-[38px] bg-slate-100 dark:bg-slate-700 p-1 rounded-xl border border-slate-200 dark:border-slate-600">
                  <QuestionCountToggle value={csatRandomSelectLimit} onChange={setCSATRandomSelectLimit} />
                  <button
                    onClick={() => startCSATRandomPractice(csatRandomSelectLimit)}
                    className="px-2.5 py-1 rounded-md transition-all text-[11px] font-bold flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white active:scale-95 shadow-md shadow-blue-600/25"
                  >
                    <span className="hidden sm:inline">Random PYQ</span>
                    <span className="sm:hidden">Random</span>
                  </button>
                  {csatRandomMode && (
                    <button
                      onClick={() => setCSATRandomMode(false)}
                      title="Exit Random Mode"
                      className="px-2 py-0.5 rounded-md text-[11px] font-bold text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'english' && (
              <div className="flex items-center gap-2 order-3 lg:order-none">
                {renderScoreChip(sectionScores.english || { correct: 0, total: 0 })}
                <div className="flex items-center gap-1 h-[38px] bg-slate-100 dark:bg-slate-700 p-1 rounded-xl border border-slate-200 dark:border-slate-600">
                  <QuestionCountToggle value={englishRandomSelectLimit} onChange={setEnglishRandomSelectLimit} />
                  <button
                    onClick={() => startEnglishRandomPractice(englishRandomSelectLimit)}
                    className="px-2.5 py-1 rounded-md transition-all text-[11px] font-bold flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white active:scale-95 shadow-md shadow-blue-600/25"
                  >
                    <span className="hidden sm:inline">Random PYQ</span>
                    <span className="sm:hidden">Random</span>
                  </button>
                  {englishRandomMode && (
                    <button
                      onClick={() => setEnglishRandomMode(false)}
                      title="Exit Random Mode"
                      className="px-2 py-0.5 rounded-md text-[11px] font-bold text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 order-last">
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className={cn(
                    "p-2.5 rounded-xl border transition-all active:scale-95 flex items-center justify-center",
                    isUserMenuOpen
                      ? "bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 border-transparent text-white shadow-lg shadow-indigo-500/30"
                      : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                  title="Menu"
                  aria-label="Open menu"
                  aria-expanded={isUserMenuOpen}
                >
                  {isUserMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>

                {/* Mobile backdrop */}
                {isUserMenuOpen && (
                  <div
                    className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-[2px] sm:hidden"
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                )}

                {/* Unified Menu Dropdown */}
                <div
                  className={cn(
                    "absolute right-0 top-full mt-2 w-60 max-w-[calc(100vw-1.5rem)] origin-top-right z-[100]",
                    "rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-slate-900/10 dark:shadow-black/40 ring-1 ring-black/5 p-2 transition-all duration-200",
                    isUserMenuOpen
                      ? "opacity-100 visible pointer-events-auto scale-100 translate-y-0"
                      : "opacity-0 invisible pointer-events-none scale-95 -translate-y-1"
                  )}
                >
                  {userEmail && (
                    <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-sm shrink-0">
                        {userEmail.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Signed in</p>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{userEmail}</p>
                      </div>
                    </div>
                  )}

                  {/* Go Premium */}
                  {!isSubscribed && (
                    <button
                      onClick={() => { setShowPremiumModal(true); setIsUserMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-2 py-2.5 mb-1 rounded-xl text-sm font-bold text-amber-900 dark:text-amber-100 bg-gradient-to-r from-amber-300 to-yellow-400 dark:from-amber-500/30 dark:to-yellow-500/20 hover:from-amber-400 hover:to-yellow-500 transition-colors shadow-sm"
                    >
                      <span className="w-8 h-8 rounded-lg bg-white/40 dark:bg-white/10 flex items-center justify-center shrink-0">
                        <Crown className="w-4 h-4 text-amber-600 dark:text-amber-300" />
                      </span>
                      <span>Go Premium</span>
                    </button>
                  )}

                  {/* My workspace — open to guests too; their bookmarks and
                      notes live in memory until the page is refreshed. Guests
                      land on Bookmarks since the report needs an account. */}
                  <button
                    onClick={() => { openWorkspace(userEmail ? 'report' : 'bookmarks'); setIsUserMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/30 ring-1 ring-inset ring-white/20">
                      <LayoutDashboard className="w-4 h-4 text-white" />
                    </span>
                    <span>My workspace</span>
                  </button>

                  {/* Appearance */}
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                      {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                    </span>
                    <span>{isDarkMode ? "Light mode" : "Dark mode"}</span>
                  </button>

                  {/* Admin / Login section */}

                  {/* Admin Panel — shown to a logged-in admin email */}
                  {isAdmin && (
                    <button
                      onClick={() => { setIsAdminView(!isAdminView); setIsUserMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                        <KeyRound className="w-4 h-4 text-blue-500" />
                      </span>
                      <span>{isAdminView ? "Exit admin" : "Admin panel"}</span>
                    </button>
                  )}

                  {/* Telegram */}
                  <a
                    href="https://t.me/upsc_pyq_powerhouse"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center shrink-0">
                      <Send className="w-4 h-4 text-sky-500" />
                    </span>
                    <span>Join Telegram</span>
                  </a>

                  {/* Send Feedback */}
                  <button
                    onClick={() => { openFeedback(null, 'global'); setIsUserMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <MessageSquareText className="w-4 h-4 text-emerald-500" />
                    </span>
                    <span>Send Feedback</span>
                  </button>

                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-1.5" />

                  {/* Login / Logout */}
                  {!userEmail ? (
                    <button
                      onClick={() => { setShowLoginModal(true); setIsUserMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                    >
                      <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-blue-500" />
                      </span>
                      <span>Login</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => { handleLogout(); setIsUserMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                    >
                      <span className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center shrink-0">
                        <LogOut className="w-4 h-4 text-rose-500" />
                      </span>
                      <span>Logout</span>
                    </button>
                  )}

                  {/* New Releases */}
                  <button
                    onClick={() => { setShowReleasesModal(true); setIsUserMenuOpen(false); }}
                    className="group flex w-full items-center gap-3 rounded-xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50 via-blue-50 to-violet-50 px-2 py-2.5 text-sm font-bold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-indigo-500/25 dark:from-indigo-500/15 dark:via-blue-500/10 dark:to-violet-500/15 dark:text-indigo-200"
                  >
                    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-600 text-white shadow-md shadow-indigo-600/20 transition group-hover:scale-105">
                      <Sparkles className="h-4 w-4" />
                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-300 ring-2 ring-white dark:ring-slate-900" />
                    </span>
                    <span className="flex items-center gap-2">What’s New
                      <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-violet-600 shadow-sm dark:bg-slate-800 dark:text-violet-300">Explore</span>
                    </span>
                  </button>

                  {/* About the Founder */}
                  <button
                    onClick={() => { setShowFounderModal(true); setIsUserMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-extrabold text-xs shrink-0">R</span>
                    <span>About the Founder</span>
                  </button>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex flex-col md:flex-row items-start gap-6 transition-colors duration-300">
        {isAppLoading ? (
          <div className="w-full flex flex-col md:flex-row items-start gap-6 animate-fadeIn">
            {/* Filter sidebar skeleton */}
            <aside className="w-full md:w-64 lg:w-72 shrink-0 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="skeleton h-4 w-24"></div>
                <div className="skeleton h-6 w-16 rounded-lg"></div>
              </div>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="skeleton h-3 w-20"></div>
                  <div className="skeleton h-9 w-full rounded-lg"></div>
                </div>
              ))}
            </aside>
            {/* Question card grid skeleton */}
            <div className="flex-grow w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col gap-3 animate-fadeInUp"
                  style={{ animationDelay: `${i * 70}ms`, animationFillMode: 'both' }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex gap-1.5">
                      <div className="skeleton h-4 w-14 rounded-md"></div>
                      <div className="skeleton h-4 w-20 rounded-md"></div>
                    </div>
                    <div className="skeleton h-4 w-12 rounded-md"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="skeleton h-3.5 w-full"></div>
                    <div className="skeleton h-3.5 w-5/6"></div>
                  </div>
                  <div className="space-y-2 mt-1">
                    {[...Array(4)].map((_, j) => (
                      <div key={j} className="skeleton h-9 w-full rounded-lg"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : isAdmin && isAdminView ? (
          <div className="w-full space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h2>
                <p className="text-slate-500 dark:text-slate-400">Manage user subscriptions and access.</p>
              </div>
              <button 
                onClick={() => setIsAdminView(false)}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
              >
                Back
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Left column: Add User + admin tools */}
              <div className="md:col-span-1 space-y-8">
              {/* Admin Key — required to perform admin actions */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
                <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-blue-500" /> Admin Key
                  {adminUnlocked ? (
                    <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">UNLOCKED</span>
                  ) : (
                    <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 flex items-center gap-1"><Lock className="w-3 h-3" /> LOCKED</span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  {adminUnlocked
                    ? "Admin actions are unlocked on this browser for 7 days."
                    : "Enter your admin key and verify to enable price and user actions. Stored only in this browser."}
                </p>
                {!adminUnlocked && adminMessage.text && (
                  <div className={cn(
                    "mb-3 p-3 rounded-lg text-xs font-bold",
                    adminMessage.type === "success" ? "bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100/50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                  )}>
                    {adminMessage.text}
                  </div>
                )}
                <input
                  type="password"
                  placeholder="Paste admin key"
                  value={adminKey}
                  onChange={(e) => saveAdminKey(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                {!adminUnlocked && (
                  <button
                    onClick={async () => {
                      await verifyAdminKey(adminKey);
                    }}
                    className="mt-3 w-full py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
                  >
                    Verify & Unlock
                  </button>
                )}
                {adminKey && (
                  <button
                    onClick={() => { saveAdminKey(""); localStorage.removeItem('admin_unlock_expiry'); setAdminUnlocked(false); }}
                    className="mt-2 w-full py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
                  >
                    Clear Key
                  </button>
                )}
              </div>
              {/* Admin tools below require a verified key */}
              {adminUnlocked && (<>
              {/* Add New User */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-500" /> Add New User
                </h3>
                {adminMessage.text && (
                  <div className={cn(
                    "mb-4 p-3 rounded-lg text-xs font-bold transition-all",
                    adminMessage.type === "success" ? "bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100/50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                  )}>
                    {adminMessage.text}
                  </div>
                )}
                <form onSubmit={handleAddUserFromAdmin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase">Email</label>
                    <input 
                      type="email"
                      required
                      placeholder="user@example.com"
                      value={isAdminUserEmail}
                      onChange={(e) => setIsAdminUserEmail(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase">Status</label>
                    <FancySelect
                      value={isAdminUserStatus}
                      onChange={(v) => setIsAdminUserStatus(v as "subscribed" | "not_subscribed" | "admin" | "editor")}
                      ariaLabel="Status"
                      buttonClassName="px-4 py-2"
                      options={[
                        { value: "subscribed", label: "Subscribed" },
                        { value: "not_subscribed", label: "Not Subscribed" },
                        { value: "editor", label: "Editor" },
                        { value: "admin", label: "Admin" },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase">Access Duration (Months)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      step={1}
                      value={adminUserDuration}
                      onChange={(e) => setAdminUserDuration(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1.5 text-[10px] text-slate-400">
                      Enter any positive whole number of months.
                    </p>
                  </div>
                  <button type="submit" className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-lg text-sm transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]">
                    Add/Update User
                  </button>
                </form>
              </div>

              {/* Questions Cache */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
                <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-blue-500" /> Questions Cache
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Added new questions in Cosmos DB? Refresh to show them instantly.</p>
                <button
                  onClick={async () => {
                    if (!requireAdminKey()) return;
                    try {
                      setAdminMessage({ text: "Refreshing questions cache...", type: "success" });
                      const res = await fetch('/api/admin/refresh-questions', { method: 'POST', headers: adminHeaders() });
                      const data = await res.json();
                      if (res.ok) {
                        setAdminMessage({ text: `✓ Cache refreshed! ${data.count} prelims and ${data.mainsCount ?? 0} mains questions loaded.`, type: "success" });
                        fetchQuestions();
                        fetchMainsQuestions();
                      } else {
                        throw new Error(data.error);
                      }
                    } catch (err: any) {
                      setAdminMessage({ text: `Failed to refresh: ${err.message}`, type: "error" });
                    }
                    setTimeout(() => setAdminMessage({ text: "", type: "" }), 5000);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-lg text-sm transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
                >
                  Refresh Questions
                </button>
              </div>

              {/* Subscription Prices — edit live, saved to the database */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
                <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                  <IndianRupee className="w-5 h-5 text-blue-500" /> Subscription Prices
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Set the price (in ₹) per plan. Saved instantly — no redeploy. Razorpay charges this exact amount.</p>
                <div className="space-y-3">
                  {([
                    { key: '1yr', label: '1 Year Plan' },
                    { key: '2yr', label: '2 Years Plan' },
                    { key: 'ebooks', label: 'Ebooks Plan' },
                  ] as const).map(pl => (
                    <div key={pl.key}>
                      <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase">{pl.label}</label>
                      <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                        <span className="pl-3 text-slate-400 text-sm font-bold">₹</span>
                        <input
                          type="number"
                          min={1}
                          value={priceForm[pl.key]}
                          onChange={(e) => setPriceForm(prev => ({ ...prev, [pl.key]: e.target.value }))}
                          className="w-full px-2 py-2 text-sm bg-transparent outline-none"
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={savePrices}
                    disabled={savingPrices}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-60 text-white font-bold rounded-lg text-sm transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
                  >
                    {savingPrices ? "Saving..." : "Save Prices"}
                  </button>
                </div>
              </div>
              <div ref={setAdminCouponsPortalTarget} />
              </>)}
              </div>

              {/* Right column: users list + payments stacked to fill the row height */}
              <div className="md:col-span-2 flex flex-col gap-8 min-w-0">
              {/* Study activity dashboard */}
              {adminUsagePortalTarget && createPortal(
              <div className="overflow-hidden rounded-3xl border border-indigo-200/70 bg-white shadow-xl shadow-indigo-950/5 dark:border-indigo-500/20 dark:bg-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-blue-50 to-violet-50 px-6 py-4 dark:border-slate-700 dark:from-indigo-500/10 dark:via-blue-500/5 dark:to-violet-500/10">
                  <div>
                    <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                      <BarChart3 className="h-5 w-5 text-indigo-500" />
                      User Study Activity
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Usage across all registered users.</p>
                  </div>
                  <button
                    onClick={fetchAllUserUsage}
                    disabled={isLoadingUserUsage}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-60"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isLoadingUserUsage && "animate-spin")} />
                    Refresh
                  </button>
                </div>

                <div className="p-5">
                  <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {([
                      { label: "Bookmarks", value: adminUsageTotals.bookmarks, icon: Bookmark, tone: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" },
                      { label: "Notes", value: adminUsageTotals.notes, icon: StickyNote, tone: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" },
                      { label: "Attempts", value: adminUsageTotals.attempts, icon: BarChart3, tone: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" },
                      { label: "Correct", value: adminUsageTotals.correct, icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" },
                      { label: "Wrong", value: adminUsageTotals.wrong, icon: XCircle, tone: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300" },
                    ] as const).map(metric => {
                      const MetricIcon = metric.icon;
                      return (
                        <div key={metric.label} className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", metric.tone)}>
                            <MetricIcon className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-base font-black tabular-nums text-slate-900 dark:text-white">{metric.value}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{metric.label}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {mostActiveAdminUser && (
                    <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 p-4 text-white shadow-lg shadow-indigo-600/20">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/20">
                            <Trophy className="h-5 w-5 text-amber-300" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-blue-100">Most active user</p>
                            <p className="truncate text-sm font-black" title={mostActiveAdminUser.email}>{mostActiveAdminUser.email}</p>
                            <p className="mt-0.5 text-[10px] text-blue-100">{mostActiveAdminUser.usage.attempts.toLocaleString()} total question attempts</p>
                          </div>
                        </div>
                        <div className="rounded-xl bg-white/10 px-4 py-2.5 ring-1 ring-inset ring-white/15">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-blue-100">Most attempted exam</p>
                          <p className="mt-0.5 max-w-[240px] truncate text-xs font-extrabold" title={mostActiveAdminUser.usage.topExam || "No exam data"}>
                            {mostActiveAdminUser.usage.topExam || "No exam data"}
                          </p>
                          <p className="text-[10px] font-bold text-amber-300">{mostActiveAdminUser.usage.topExamAttempts.toLocaleString()} attempts</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {topAdminExams.length > 0 && (
                    <div className="mb-5 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4 dark:border-indigo-500/20 dark:from-indigo-500/10 dark:via-slate-900 dark:to-violet-500/10">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h4 className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-white">
                            <Landmark className="h-4 w-4 text-indigo-500" />
                            Most attempted exams
                          </h4>
                          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Ranked by total questions attempted.</p>
                        </div>
                        <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                          Top {topAdminExams.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {topAdminExams.map((exam, index) => (
                          <div key={exam.exam} className="grid grid-cols-[24px_minmax(100px,0.9fr)_minmax(140px,2fr)_auto] items-center gap-2">
                            <span className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-lg text-[9px] font-black",
                              index === 0
                                ? "bg-gradient-to-br from-amber-300 to-orange-400 text-amber-950 shadow-sm"
                                : "bg-white text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300"
                            )}>
                              {index + 1}
                            </span>
                            <span className="truncate text-[10px] font-bold text-slate-700 dark:text-slate-200" title={exam.exam}>{exam.exam}</span>
                            <div className="h-2.5 overflow-hidden rounded-full bg-white shadow-inner dark:bg-slate-700">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-violet-500"
                                style={{ width: `${Math.max((exam.attempts / maxAdminExamAttempts) * 100, 4)}%` }}
                              />
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-black tabular-nums text-indigo-600 dark:text-indigo-300">{exam.attempts}</p>
                              <p className="text-[8px] text-slate-400">{exam.users} users</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isLoadingUserUsage ? (
                    <div className="space-y-3 py-2">
                      {[...Array(4)].map((_, index) => (
                        <div key={index} className="grid grid-cols-[minmax(120px,0.8fr)_minmax(180px,2fr)_auto] items-center gap-3">
                          <div className="skeleton h-3.5 rounded" />
                          <div className="skeleton h-3 rounded-full" />
                          <div className="skeleton h-5 w-16 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : adminUsageRows.length === 0 ? (
                    <p className="py-8 text-center text-xs text-slate-400">No registered users found.</p>
                  ) : (
                    <div className="max-h-[640px] space-y-3 overflow-y-auto pr-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        <span>User exam focus</span>
                        <span className="flex gap-3">
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Correct</span>
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />Wrong</span>
                        </span>
                      </div>
                      {rankedAdminUsageRows.map(({ email, usage }, index) => (
                        <div key={email} className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/35 sm:grid-cols-[24px_minmax(130px,0.8fr)_minmax(150px,1fr)_minmax(180px,1.5fr)_auto] sm:items-center">
                          <span className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-lg text-[9px] font-black",
                            index === 0
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                              : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                          )}>
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200" title={email}>{email}</p>
                            <p className="text-[9px] text-slate-400">{usage.attempts} attempts</p>
                          </div>
                          <div className="min-w-0 rounded-lg bg-white px-2.5 py-2 shadow-sm dark:bg-slate-800">
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                              <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">Exam split</p>
                              <p className="text-[8px] font-bold tabular-nums text-slate-400">{usage.attempts} total</p>
                            </div>
                            {usage.examBreakdown.length > 0 ? (
                              <>
                                <div className="mb-1.5 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                  {usage.examBreakdown.map((exam, examIndex) => (
                                    <span
                                      key={exam.exam}
                                      title={`${exam.exam}: ${exam.attempts} attempts`}
                                      className={([
                                        "bg-indigo-500",
                                        "bg-blue-500",
                                        "bg-violet-500",
                                        "bg-cyan-500",
                                        "bg-amber-500",
                                        "bg-fuchsia-500",
                                      ] as const)[examIndex % 6]}
                                      style={{ width: `${(exam.attempts / usage.attempts) * 100}%` }}
                                    />
                                  ))}
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-0.5">
                                  {usage.examBreakdown.map((exam, examIndex) => (
                                    <span key={exam.exam} className="inline-flex shrink-0 items-center gap-1 text-[8px] font-semibold text-slate-500 dark:text-slate-300" title={`${exam.exam}: ${exam.attempts} attempts`}>
                                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", ([
                                        "bg-indigo-500",
                                        "bg-blue-500",
                                        "bg-violet-500",
                                        "bg-cyan-500",
                                        "bg-amber-500",
                                        "bg-fuchsia-500",
                                      ] as const)[examIndex % 6])} />
                                      <span>{exam.exam}</span>
                                      <strong className="tabular-nums text-slate-700 dark:text-slate-100">{exam.attempts}</strong>
                                    </span>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <p className="text-[9px] text-slate-400">No attempts</p>
                            )}
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" title={`${usage.correct} correct, ${usage.wrong} wrong`}>
                            <div className="flex h-full" style={{ width: `${Math.max((usage.attempts / maxAdminAttempts) * 100, usage.attempts > 0 ? 3 : 0)}%` }}>
                              <span className="h-full bg-emerald-500" style={{ width: `${usage.attempts ? (usage.correct / usage.attempts) * 100 : 0}%` }} />
                              <span className="h-full bg-rose-500" style={{ width: `${usage.attempts ? (usage.wrong / usage.attempts) * 100 : 0}%` }} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-bold tabular-nums">
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300" title="Bookmarks">
                              <Bookmark className="h-3 w-3" />{usage.bookmarks}
                            </span>
                            <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-300" title="Notes">
                              <StickyNote className="h-3 w-3" />{usage.notes}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>,
              adminUsagePortalTarget
              )}

              {/* User List */}
              <div className="order-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden flex flex-col flex-shrink-0">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center flex-shrink-0">
                  <h3 className="font-bold text-slate-900 dark:text-white">All Registered Users ({allUsers.length})</h3>
                  <button onClick={() => { fetchAllUsers(); fetchActiveSessions(); fetchAllUserUsage(); }} className="text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 px-3 py-1.5 rounded-lg transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]">Refresh</button>
                </div>
                <div className="overflow-auto max-h-[70vh]">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/30 text-slate-500 uppercase tracking-wider text-[10px] font-bold sticky top-0 z-10">
                        <th className="px-4 py-3 text-center w-12">#</th>
                        <th className="px-6 py-3">Email</th>
                        <th className="px-6 py-3 text-center">Status</th>
                       <th className="px-6 py-3 text-center">Expiry Date</th>
                       <th className="px-6 py-3 text-center">Active</th>
                       <th className="px-6 py-3 text-right">Actions</th>
                     </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                     {isLoadingUsers ? (
                       <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500 animate-pulse">
                           Loading user database...
                         </td>
                       </tr>
                     ) : allUsers.length === 0 ? (
                       <tr>
                         <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                           No users found in database.
                         </td>
                       </tr>
                     ) : allUsers.map((user, idx) => (
                       <React.Fragment key={user.email}>
                       <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors">
                         <td className="px-4 py-4 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 tabular-nums">{idx + 1}</td>
                         <td className="px-6 py-4">
                           <button onClick={() => fetchLoginHistory(user.email)} className="font-medium text-slate-700 dark:text-slate-300 max-w-[200px] truncate hover:text-blue-500 transition-colors text-left" title="Click to view login history">
                             {user.email}
                           </button>
                         </td>
                         <td className="px-6 py-4 text-center">
                           <div className="flex flex-col gap-1 items-center">
                             <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                               user.status === 'admin'
                                 ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50'
                                 : user.status === 'editor'
                                 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50'
                                 : user.status === 'subscribed' 
                                 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' 
                                 : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600'
                             }`}>
                               {user.status}
                             </span>
                             <div className="flex gap-1 mt-1">
                               <button onClick={() => handleUpdateUser(user.email, 'subscribed')} className="text-[8px] text-slate-400 hover:text-emerald-500 font-bold uppercase transition-colors">Sub</button>
                               <button onClick={() => handleUpdateUser(user.email, 'not_subscribed')} className="text-[8px] text-slate-400 hover:text-slate-200 font-bold uppercase transition-colors">None</button>
                               <button onClick={() => handleUpdateUser(user.email, 'editor')} className="text-[8px] text-slate-400 hover:text-amber-500 font-bold uppercase transition-colors">Editor</button>
                               <button onClick={() => handleUpdateUser(user.email, 'admin')} className="text-[8px] text-slate-400 hover:text-blue-500 font-bold uppercase transition-colors">Admin</button>
                             </div>
                           </div>
                         </td>
                         <td className="px-6 py-4 text-center">
                           {user.expiryDate ? (
                             <span className={`text-[11px] font-medium ${
                               new Date(user.expiryDate) < new Date()
                                 ? 'text-rose-500'
                                 : 'text-emerald-600 dark:text-emerald-400'
                             }`}>
                               {new Date(user.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                             </span>
                           ) : (
                             <span className="text-[10px] text-slate-400">—</span>
                           )}
                         </td>
                         <td className="px-6 py-4 text-center">
                           {activeSessionsMap[user.email] ? (
                             <span className="inline-flex items-center gap-1.5">
                               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                               <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{activeSessionsMap[user.email]}</span>
                             </span>
                           ) : (
                             <span className="text-[10px] text-slate-400">—</span>
                           )}
                         </td>
                         <td className="px-6 py-4 text-right">
                           <div className="flex items-center justify-end gap-1">
                           {user.email !== userEmail ? (
                             <button 
                               onClick={() => handleDeleteUser(user.email)}
                               className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                               title="Deactivate user"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                           ) : (
                             <span className="text-[10px] font-bold text-blue-500/50 uppercase tracking-tighter">You</span>
                           )}
                           </div>
                         </td>
                       </tr>
                       {expandedUserHistory === user.email && (
                         <tr>
                           <td colSpan={6} className="px-6 py-3 bg-slate-50/50 dark:bg-slate-900/40">
                             {isLoadingHistory ? (
                               <p className="text-[11px] text-slate-400 animate-pulse">Loading login history...</p>
                             ) : loginHistory.length === 0 ? (
                               <p className="text-[11px] text-slate-400">No login history recorded yet.</p>
                             ) : (
                               <div className="space-y-1.5">
                                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Login History (Last {loginHistory.length})</p>
                                 <div className="grid gap-1.5 max-h-[200px] overflow-y-auto">
                                   {loginHistory.map((log: any, i: number) => (
                                     <div key={i} className="flex items-center gap-3 text-[11px] px-3 py-1.5 rounded bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                                       <span className={`w-2 h-2 rounded-full flex-shrink-0 ${log.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} title={log.isActive ? 'Active' : 'Logged out'}></span>
                                       <span className="font-medium text-slate-600 dark:text-slate-300 min-w-[70px]">{log.device}</span>
                                       <span className="text-slate-500">{log.browser}</span>
                                       <span className="text-slate-400">{log.os}</span>
                                       <span className="text-slate-400 font-mono text-[10px]">{log.ip}</span>
                                       <span className="ml-auto text-slate-400 text-[10px]">
                                         {new Date(log.loginAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date(log.loginAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                       </span>
                                     </div>
                                   ))}
                                 </div>
                               </div>
                             )}
                           </td>
                         </tr>
                       )}
                       </React.Fragment>
                     ))}
                    </tbody>
                  </table>
                </div>
              </div>

            {/* Coupons — rendered into the left admin tools column */}
            {adminCouponsPortalTarget && createPortal(
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Coupons</h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{adminCoupons.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showWithdrawnCoupons}
                      onChange={(e) => { setShowWithdrawnCoupons(e.target.checked); fetchAdminCoupons(e.target.checked); }}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Show withdrawn
                  </label>
                  <button
                    onClick={() => fetchAdminCoupons(showWithdrawnCoupons)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", loadingCoupons && "animate-spin")} /> Refresh
                  </button>
                </div>
              </div>

              {/* Create / edit form */}
              <div className={cn(
                "rounded-xl border p-4 mb-4",
                couponEditing
                  ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-700/60 dark:bg-emerald-900/15"
                  : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40"
              )}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {couponEditing ? `Editing ${couponEditing}` : 'New coupon'}
                  </p>
                  {couponEditing && (
                    <button
                      onClick={() => { setCouponEditing(null); setCouponForm(blankCouponForm); }}
                      className="text-[11px] font-bold text-slate-500 hover:text-rose-600"
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Code</label>
                    <input
                      value={couponForm.code}
                      disabled={!!couponEditing}
                      onChange={(e) => setCouponForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s+/g, '') }))}
                      placeholder="POWER25"
                      maxLength={32}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold uppercase tracking-wide outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Discount %</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={couponForm.discountPercent}
                      onChange={(e) => setCouponForm(f => ({ ...f, discountPercent: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Expires on</label>
                    <input
                      type="date"
                      value={couponForm.expiryDate}
                      onChange={(e) => setCouponForm(f => ({ ...f, expiryDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Max uses (0 = unlimited)</label>
                    <input
                      type="number"
                      min={0}
                      value={couponForm.maxRedemptions}
                      onChange={(e) => setCouponForm(f => ({ ...f, maxRedemptions: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Applies to</label>
                    <div className="flex flex-wrap gap-2">
                      {([['1yr', '1 Year'], ['2yr', '2 Years'], ['ebooks', 'Ebooks']] as const).map(([key, label]) => {
                        const on = couponForm.plans.includes(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setCouponForm(f => ({
                              ...f,
                              plans: on ? f.plans.filter(p => p !== key) : [...f.plans, key],
                            }))}
                            className={cn(
                              "px-3 py-2 rounded-lg text-xs font-bold border transition",
                              on
                                ? "bg-emerald-500 border-emerald-500 text-white shadow-sm"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500"
                            )}
                          >
                            {on ? '✓ ' : ''}{label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Note (shown to users)</label>
                    <input
                      value={couponForm.description}
                      onChange={(e) => setCouponForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Launch offer"
                      maxLength={200}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <button
                  onClick={saveCoupon}
                  disabled={savingCoupon || !couponForm.code || !couponForm.expiryDate || couponForm.plans.length === 0}
                  className="mt-3 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingCoupon ? 'Saving…' : couponEditing ? 'Update coupon' : 'Create coupon'}
                </button>
              </div>

              {/* Coupon list */}
              {adminCoupons.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No coupons yet.</p>
              ) : (
                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {adminCoupons.map(c => {
                    const expired = c.expiryDate ? new Date(`${c.expiryDate}T23:59:59.999+05:30`).getTime() < Date.now() : false;
                    const withdrawn = c.isActive === false;
                    const capped = (c.maxRedemptions || 0) > 0 && (c.redemptionCount || 0) >= c.maxRedemptions;
                    const status = withdrawn ? 'Withdrawn' : expired ? 'Expired' : capped ? 'Fully claimed' : 'Live';
                    return (
                      <div key={c.code} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-extrabold tracking-wide text-slate-800 dark:text-slate-100">{c.code}</p>
                            <p className="mt-0.5 text-[10px] text-slate-400">{c.discountPercent}% off · {(c.plans || []).map(p => p === '1yr' ? '1 Yr' : p === '2yr' ? '2 Yr' : 'Ebooks').join(', ') || 'No plans'}</p>
                          </div>
                          <span className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold",
                            status === 'Live' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : status === 'Withdrawn' ? "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                              : "bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                          )}>
                            {status}
                          </span>
                        </div>
                        {c.description && <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">{c.description}</p>}
                        <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-slate-400">
                          <span>Expires {c.expiryDate || '—'}</span>
                          <span>{c.redemptionCount || 0}{(c.maxRedemptions || 0) > 0 ? ` / ${c.maxRedemptions}` : ' / ∞'} used</span>
                        </div>
                        <div className="mt-2 flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setCouponEditing(c.code);
                              setCouponForm({
                                code: c.code,
                                discountPercent: String(c.discountPercent),
                                expiryDate: c.expiryDate || '',
                                plans: c.plans || [],
                                maxRedemptions: String(c.maxRedemptions || 0),
                                description: c.description || '',
                              });
                            }}
                            className="rounded-md px-2 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                          >
                            Edit
                          </button>
                          {withdrawn ? (
                            <button
                              onClick={() => setCouponActive(c, true)}
                              className="rounded-md px-2 py-1 text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => withdrawCoupon(c.code)}
                              className="rounded-md px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>,
            adminCouponsPortalTarget
            )}

            {/* Payments — fills the gap under the users list in the right column */}
            <div className="order-3 flex flex-col gap-8">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-5 h-5 text-blue-500" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Payments</h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">{adminPayments.length}</span>
                  {adminPayments.some(p => p.status === 'success') && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      ₹{(adminPayments.filter(p => p.status === 'success').reduce((s, p) => s + (p.amount || 0), 0) / 100).toLocaleString('en-IN')} collected
                    </span>
                  )}
                </div>
                <button
                  onClick={fetchAdminPayments}
                  className="text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", loadingPayments && "animate-spin")} /> Refresh
                </button>
              </div>
              {loadingPayments ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center flex-1">Loading payments…</p>
              ) : adminPayments.length === 0 ? (
                <div className="py-8 text-center flex-1 flex flex-col items-center justify-center">
                  <IndianRupee className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">No payments recorded yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1 min-h-0 overflow-y-auto max-h-[420px] rounded-xl border border-slate-100 dark:border-slate-700/60">
                  <table className="w-full text-left text-sm min-w-[640px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/30 text-slate-500 uppercase tracking-wider text-[10px] font-bold sticky top-0 z-10">
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Plan</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Expiry</th>
                        <th className="px-4 py-3 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {adminPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300 max-w-[180px] truncate" title={p.email}>{p.email}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400" title={p.planLabel || p.plan}>{p.plan || '—'}</td>
                          <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-800 dark:text-slate-200">
                            {typeof p.amount === 'number' ? `₹${(p.amount / 100).toLocaleString('en-IN')}` : '—'}
                            {p.couponCode && (
                              <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                {p.couponCode} −{p.couponDiscountPercent}%
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              p.status === 'success'
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                                : p.status === 'created'
                                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                                : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
                            }`}>
                              {p.status === 'signature_failed' ? 'failed' : p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-[11px] text-slate-500 dark:text-slate-400">
                            {p.expiryDate ? new Date(p.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-[11px] text-slate-400 whitespace-nowrap">
                            {p.verifiedAt || p.createdAt ? new Date(p.verifiedAt || p.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div ref={setAdminFeedbackPortalTarget} />
            </div>
            </div>
            </div>

            {/* All User Feedback */}
            {adminFeedbackPortalTarget && createPortal(
            <div className="flex h-[460px] min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="w-5 h-5 text-blue-500" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">User Feedback</h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">{adminFeedback.length}</span>
                </div>
                <button
                  onClick={fetchAdminFeedback}
                  className="text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", loadingFeedback && "animate-spin")} /> Refresh
                </button>
              </div>
              {loadingFeedback ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">Loading feedback…</p>
              ) : adminFeedback.length === 0 ? (
                <div className="py-8 text-center">
                  <MessageSquareText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">No feedback submitted yet.</p>
                </div>
              ) : (
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {adminFeedback.map((f) => (
                    <div key={f.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 bg-slate-50/60 dark:bg-slate-900/40">
                      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">{f.questionType || 'global'}</span>
                          {f.questionId != null && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Q#{f.questionId}</span>
                          )}
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 break-all">{f.userAlias || 'Anonymous'}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {f.createdAt ? new Date(f.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="break-words whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{f.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>,
            adminFeedbackPortalTarget
            )}
            <div ref={setAdminUsagePortalTarget} />
          </div>
        ) : activeTab === 'prelims' ? (
          <>
            {/* Mobile Filters Toggle Button */}
            <div className="md:hidden w-full mb-4">
              <button 
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                className="w-full flex items-center justify-between gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
              >
                <span className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  {isMobileFiltersOpen ? 'Hide Filters' : 'Show Filters'}
                </span>
                <ChevronDown className={cn("w-4 h-4 transition-transform duration-300", isMobileFiltersOpen && "rotate-180")} />
              </button>
            </div>

            <aside className={cn(
              "w-full md:w-60 lg:w-64 flex-shrink-0 md:sticky md:top-24 md:block relative z-30 md:z-auto",
              isMobileFiltersOpen ? "block" : "hidden"
            )}>
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl p-5 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-black/20 border border-slate-200/70 dark:border-slate-700/70">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                <SortMenu
                  value={sortMode}
                  onChange={(v) => setSortMode(v as typeof sortMode)}
                  defaultValue="latest"
                  options={questionSortOptions}
                />
              </h2>
              <div className="flex items-center gap-1.5">
                <SavedFilterToggles
                  bookmarkedOnly={bookmarkedOnly}
                  onToggleBookmarked={() => setBookmarkedOnly(v => !v)}
                  bookmarkedCount={bookmarkedPrelimsCount}
                  notedOnly={notedOnly}
                  onToggleNoted={() => setNotedOnly(v => !v)}
                  notedCount={notedPrelimsCount}
                />
                <button
                  type="button"
                  onClick={togglePrelimsFilterDefault}
                  disabled={isSavingDefaultFilters}
                  title={hasSavedPrelimsDefault ? "Unpin default filters" : "Pin current filters as default"}
                  aria-label={hasSavedPrelimsDefault ? "Unpin default filters" : "Pin current filters as default"}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg border transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
                    hasSavedPrelimsDefault
                      ? "border-transparent bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25 hover:from-blue-500 hover:to-indigo-500"
                      : "border-slate-200 bg-white/70 text-slate-400 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-500 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-400 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                  )}
                >
                  {isSavingDefaultFilters
                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    : hasSavedPrelimsDefault
                    ? <Pin className="h-3.5 w-3.5 fill-current" />
                    : <PinOff className="h-3.5 w-3.5" />}
                </button>
                <button 
                  onClick={resetFilters}
                  className="text-[11px] font-bold text-white bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-1 px-2.5 rounded-lg transition-all active:scale-95 shadow-md shadow-blue-600/25 flex items-center gap-1"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="search-input" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Search Keywords</label>
              <div className="relative">
                <input 
                  type="text" 
                  id="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Keyword or question ID..."
                  className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 pr-8 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                />
                <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Exam</label>
              <FancySelect
                value={examFilter}
                onChange={(v) => {
                  setExamFilter(v);
                  setPaperFilter("All");
                }}
                ariaLabel="Exam"
                options={examsList.options.map(e => ({ value: e, label: e === "All" ? "All Exams" : `${e} (${examsList.counts[e] || 0})` }))}
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Exam Year</label>
              <FancySelect
                value={yearFilter}
                onChange={(v) => setYearFilter(v)}
                ariaLabel="Exam Year"
                options={yearsList.options.map(y => ({ value: y, label: y === "All" ? "All Years" : `${y} (${yearsList.counts[y] || 0})` }))}
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Paper</label>
              <FancySelect
                value={paperFilter}
                onChange={(v) => setPaperFilter(v)}
                ariaLabel="Paper"
                options={papersList.options.map(p => ({ value: p, label: p === "All" ? "All Papers" : `${p} (${papersList.counts[p] || 0})` }))}
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Subject</label>
              <FancySelect
                value={subjectFilter}
                onChange={(v) => { setSubjectFilter(v); setTopicFilter("All"); }}
                ariaLabel="Subject"
                options={subjectsList.options.map(s => ({ value: s, label: s === "All" ? "All Subjects" : `${s} (${subjectsList.counts[s] || 0})` }))}
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Topic (by frequency)</label>
              <FancySelect
                value={topicFilter}
                onChange={(v) => setTopicFilter(v)}
                ariaLabel="Topic"
                options={topicsList.options.map(t => ({ value: t, label: t === "All" ? "All Topics" : `${t} (${topicsList.counts[t] || 0})` }))}
              />
            </div>

            {defaultFilterMessage && (
              <p className={cn(
                "mb-3 text-center text-[10px] font-semibold",
                defaultFilterMessage.type === "success"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              )}>
                {defaultFilterMessage.text}
              </p>
            )}

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">Showing <span className="font-bold text-blue-500 dark:text-blue-400">{filteredQuestions.length}</span> questions</p>
            </div>

          </div>
        </aside>

        <section className="flex-grow">
          {filteredQuestions.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-10 text-center">
              <FolderOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3 mx-auto" />
              <h3 className="text-base font-medium text-slate-900 dark:text-white mb-1">No questions found</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs">Try adjusting your filters to see more results.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredQuestions.map((q, idx) => {
                    const isLocked = !isSubscribed && !latestTwoYears.includes(q.year);
                    
                    return (
                      <QuestionCard 
                        key={q.id}
                        question={q}
                        storageScope="prelims"
                        index={idx}
                        attemptedOption={userAttempts[q.id]}
                        isRevealed={revealedAnswers[q.id]}
                        onOptionClick={(opt) => handleOptionClick(q.id, opt, opt === q.answer, 'prelims', q.subject, q.topic)}
                        onToggleRevealed={() => toggleAnswer(q.id)}
                        isLocked={isLocked}
                        userEmail={userEmail}
                        onOpenPremium={() => setShowPremiumModal(true)}
                        onFeedback={() => openFeedback(q.id, 'prelims')}
                        showNoteInline={notedOnly}
                        searchQuery={searchQuery}
                        isAdmin={isAdmin}
                        isEditor={isEditor}
                        onUpdateQuestion={handleUpdateQuestion}
                        onSubjectClick={(subject) => {
                          setSubjectFilter(subject);
                          setTopicFilter("All");
                          setRandomMode({ active: false, limit: 0 });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        onTopicClick={(topic) => {
                          setTopicFilter(topic);
                          setRandomMode({ active: false, limit: 0 });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        onExamClick={(exam) => {
                          setExamFilter(getExamCategory(exam));
                          setPaperFilter(exam);
                          setRandomMode({ active: false, limit: 0 });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        onYearClick={(year) => {
                          setYearFilter(year);
                          setRandomMode({ active: false, limit: 0 });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      />
                    );
                  })}

                {isMoreToLoad && (
                  <div className="col-span-full py-8 flex justify-center">
                    <span className="text-sm text-slate-400 dark:text-slate-500 animate-pulse">Scroll down for more questions...</span>
                  </div>
                )}

                {!isSubscribed && (
                  <div 
                    className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/40 dark:to-slate-800 p-6 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-500/50 flex flex-col items-center justify-center text-center group"
                  >
                    <div className="bg-indigo-600 p-3 rounded-full mb-4 shadow-lg group-hover:scale-110 transition-transform">
                      <Lock className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Unlock 9500+ Questions</h3>
                    <p className="text-slate-600 dark:text-slate-300 text-xs mb-6 max-w-[250px]">
                      You're viewing the free preview. Get full access to all subjects, 2026 predictions, and future updates by subscribing.
                    </p>
                    
                    <div className="w-full space-y-4">
                      {/* Subscription Plans / Pricing */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wider">Subscription Plans</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">1 Year</p>
                            <p className="text-lg font-extrabold text-slate-900 dark:text-white">₹899</p>
                          </div>
                          <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border-2 border-indigo-400 dark:border-indigo-500 text-center relative">
                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[8px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">BEST VALUE</span>
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">2 Years</p>
                            <p className="text-lg font-extrabold text-slate-900 dark:text-white">₹1299</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowPremiumModal(true)}
                          className="mt-3 w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold py-2.5 rounded-lg text-xs transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                          <Crown className="w-4 h-4 text-amber-300" /> View Premium Plans
                        </button>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 text-left">
                        <div className="flex items-center gap-2 mb-3">
                          <QrCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wider">How to Subscribe</span>
                        </div>
                        <ol className="text-[11px] text-slate-500 dark:text-slate-400 space-y-2 list-decimal list-inside">
                          <li>Contact us on Telegram <a href="https://telegram.me/UPSC_powerhouse_helpbot" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">@UPSC_powerhouse_helpbot</a></li>
                          <li>Provide your registered email: <span className="font-bold text-slate-700 dark:text-white truncate block mt-1">{userEmail}</span></li>
                          <li>Once your subscription is activated, refresh this page.</li>
                        </ol>
                        
                        <div className="mt-4 flex justify-center">
                          <a href="https://telegram.me/UPSC_powerhouse_helpbot" target="_blank" rel="noopener noreferrer">
                            <img src="/telegram-qr.png" alt="Telegram QR Code @UPSC_powerhouse_helpbot" className="w-40 h-40 rounded-lg shadow-md" />
                          </a>
                        </div>

                        <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-700">
                           <p className="text-[10px] text-blue-800 dark:text-blue-300 font-medium text-center">Your subscription is managed via the backend list based on your email.</p>
                        </div>
                      </div>

                      <button 
                        onClick={() => userEmail && checkUserStatus(userEmail)}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-xs transition-colors shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]"
                      >
                        <RotateCcw className="w-4 h-4" /> Check Subscription Status
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {isSubscribed && (
                <div className="mt-8 p-4 bg-emerald-100 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg text-center">
                   <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                     <Trophy className="w-4 h-4 mr-2 text-emerald-500" /> Premium Access Active - Enjoy the full database!
                   </p>
                </div>
              )}
            </>
          )}
        </section>
        </>
        ) : activeTab === 'mains' ? (
          <>
            {/* Mobile Filters Toggle Button */}
            <div className="md:hidden w-full mb-4">
              <button 
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                className="w-full flex items-center justify-between gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
              >
                <span className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  {isMobileFiltersOpen ? 'Hide Filters' : 'Show Filters'}
                </span>
                <ChevronDown className={cn("w-4 h-4 transition-transform duration-300", isMobileFiltersOpen && "rotate-180")} />
              </button>
            </div>

            <aside className={cn(
              "w-full md:w-60 lg:w-64 flex-shrink-0 md:sticky md:top-24 md:block relative z-30 md:z-auto",
              isMobileFiltersOpen ? "block" : "hidden"
            )}>
              <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl p-5 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-black/20 border border-slate-200/70 dark:border-slate-700/70">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                    <Filter className="w-4 h-4 text-blue-500" />
                  </h2>
                  <button
                    onClick={resetMainsFilters}
                    className="text-[11px] font-bold text-white bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-1 px-2.5 rounded-lg transition-all active:scale-95 shadow-md shadow-blue-600/25 flex items-center gap-1"
                  >
                    Reset
                  </button>
                </div>

                <div className="mb-4">
                  <label htmlFor="mains-search-input" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Search Keywords</label>
                  <div className="relative">
                    <input
                      type="text"
                      id="mains-search-input"
                      value={mainsSearchQuery}
                      onChange={(e) => setMainsSearchQuery(e.target.value)}
                      placeholder="Keyword or question ID..."
                      className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 pr-8 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                    />
                    <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Exam Year</label>
                  <FancySelect
                    value={mainsYearFilter}
                    onChange={(v) => setMainsYearFilter(v)}
                    ariaLabel="Exam Year"
                    options={mainsYearsList.options.map(y => ({ value: y, label: y === "All" ? "All Years" : `${y} (${mainsYearsList.counts[y] || 0})` }))}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Examination</label>
                  <FancySelect
                    value={mainsExamFilter}
                    onChange={(v) => setMainsExamFilter(v)}
                    ariaLabel="Examination"
                    options={mainsExamsList.options.map(exam => ({ value: exam, label: exam === "All" ? "All Exams" : `${exam} (${mainsExamsList.counts[exam] || 0})` }))}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Subject</label>
                  <FancySelect
                    value={mainsSubjectFilter}
                    onChange={(v) => setMainsSubjectFilter(v)}
                    ariaLabel="Subject"
                    options={mainsSubjectsList.options.map(subject => ({ value: subject, label: subject === "All" ? "All Subjects" : `${subject} (${mainsSubjectsList.counts[subject] || 0})` }))}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Topic (by frequency)</label>
                  <FancySelect
                    value={mainsTopicFilter}
                    onChange={(v) => setMainsTopicFilter(v)}
                    ariaLabel="Topic"
                    options={mainsTopicsList.options.map(topic => ({ value: topic, label: topic === "All" ? "All Topics" : `${topic} (${mainsTopicsList.counts[topic] || 0})` }))}
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">Showing <span className="font-bold text-blue-500 dark:text-blue-400">{filteredMainsQuestions.length}</span> questions</p>
                </div>

              </div>
            </aside>

            <section className="flex-grow">
              {mainsQuestions.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-10 text-center">
                  <Database className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3 mx-auto" />
                  <h3 className="text-base font-medium text-slate-900 dark:text-white mb-1">Mains questions coming soon!</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">Check back later.</p>
                </div>
              ) : filteredMainsQuestions.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-10 text-center">
                  <FolderOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3 mx-auto" />
                  <h3 className="text-base font-medium text-slate-900 dark:text-white mb-1">No mains questions found</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">Try adjusting your filters to see more results.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredMainsQuestions.map((q) => (
                    <MainsQuestionCard
                      key={q.id}
                      question={q}
                      isAnswerVisible={revealedMainsAnswers[q.id]}
                      onToggleAnswer={() => toggleMainsAnswer(q.id)}
                      searchQuery={mainsSearchQuery}
                      onFeedback={() => openFeedback(q.id, 'mains')}
                      onSubjectClick={(subject) => {
                        setMainsSubjectFilter(subject);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      onExamClick={(exam) => {
                        setMainsExamFilter(exam);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      onYearClick={(year) => {
                        setMainsYearFilter(year);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    />
                  ))}
                </div>
              )}
              {isMoreMainsToLoad && (
                <div className="text-center py-6">
                  <div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    Loading more questions...
                  </div>
                </div>
              )}
            </section>
          </>
        ) : activeTab === 'csat' ? (
          <>
            {/* Mobile Filters Toggle Button */}
            <div className="md:hidden w-full mb-4">
              <button 
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                className="w-full flex items-center justify-between gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
              >
                <span className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  {isMobileFiltersOpen ? 'Hide Filters' : 'Show Filters'}
                </span>
                <ChevronDown className={cn("w-4 h-4 transition-transform duration-300", isMobileFiltersOpen && "rotate-180")} />
              </button>
            </div>

            <aside className={cn(
              "w-full md:w-60 lg:w-64 flex-shrink-0 md:sticky md:top-24 md:block relative z-30 md:z-auto",
              isMobileFiltersOpen ? "block" : "hidden"
            )}>
              <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl p-5 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-black/20 border border-slate-200/70 dark:border-slate-700/70">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                    <SortMenu
                      value={csatSortMode}
                      onChange={(v) => setCSATSortMode(v as QuestionSortMode)}
                      defaultValue="latest"
                      options={questionSortOptions}
                    />
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <SavedFilterToggles
                      bookmarkedOnly={csatBookmarkedOnly}
                      onToggleBookmarked={() => { setCSATBookmarkedOnly(v => !v); setCSATVisibleCount(30); }}
                      bookmarkedCount={bookmarkedCSATCount}
                      notedOnly={csatNotedOnly}
                      onToggleNoted={() => { setCSATNotedOnly(v => !v); setCSATVisibleCount(30); }}
                      notedCount={notedCSATCount}
                    />
                    <button
                      type="button"
                      onClick={toggleCSATFilterDefault}
                      disabled={savingDefaultSection === 'csat'}
                      title={hasSavedCSATDefault ? "Unpin default filters" : "Pin current filters as default"}
                      aria-label={hasSavedCSATDefault ? "Unpin default filters" : "Pin current filters as default"}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg border transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
                        hasSavedCSATDefault
                          ? "border-transparent bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25 hover:from-blue-500 hover:to-indigo-500"
                          : "border-slate-200 bg-white/70 text-slate-400 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-500 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-400 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                      )}
                    >
                      {savingDefaultSection === 'csat'
                        ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        : hasSavedCSATDefault
                        ? <Pin className="h-3.5 w-3.5 fill-current" />
                        : <PinOff className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => {
                        setCSATYearFilter("All");
                        setCSATSubjectFilter("All");
                        setCSATSearchQuery("");
                        setCSATVisibleCount(30);
                        setCSATRandomMode(false);
                        setCSATBookmarkedOnly(false);
                        setCSATNotedOnly(false);
                        setCSATSortMode('latest');
                        resetQuiz(false);
                      }}
                      className="text-[11px] font-bold text-white bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-1 px-2.5 rounded-lg transition-all active:scale-95 shadow-md shadow-blue-600/25 flex items-center gap-1"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="csat-search" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Search Keywords</label>
                  <div className="relative">
                    <input
                      type="text"
                      id="csat-search"
                      value={csatSearchQuery}
                      onChange={(e) => setCSATSearchQuery(e.target.value)}
                      placeholder="Keyword or question ID..."
                      className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 pr-8 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                    />
                    <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Year</label>
                  <FancySelect
                    value={csatYearFilter}
                    onChange={(v) => setCSATYearFilter(v)}
                    ariaLabel="Year"
                    options={csatYearsList.options.map(y => ({ value: y, label: y === "All" ? "All Years" : `${y} (${csatYearsList.counts[y] || 0})` }))}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Topic</label>
                  <FancySelect
                    value={csatSubjectFilter}
                    onChange={(v) => setCSATSubjectFilter(v)}
                    ariaLabel="Topic"
                    options={csatSubjectsList.options.map(s => ({ value: s, label: s === "All" ? "All Topics" : `${s} (${csatSubjectsList.counts[s] || 0})` }))}
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">Showing <span className="font-bold text-blue-500 dark:text-blue-400">{filteredCSATQuestions.length}</span> questions</p>
                </div>
              </div>
            </aside>

            <section className="flex-grow">
              {filteredCSATQuestions.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-10 text-center">
                  <FolderOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3 mx-auto" />
                  <h3 className="text-base font-medium text-slate-900 dark:text-white mb-1">No CSAT questions found</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">Try adjusting your filters to see more results.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredCSATQuestions.map((q, idx) => {
                      const isLocked = !isSubscribed && !csatLatestTwoYears.includes(q.year);
                      return (
                        <QuestionCard 
                          key={q.id}
                          question={q}
                          storageScope="csat"
                          index={idx}
                          attemptedOption={userAttempts[q.id]}
                          isRevealed={revealedAnswers[q.id]}
                          onOptionClick={(opt) => handleOptionClick(q.id, opt, opt === q.answer, 'csat', q.subject, q.topic)}
                          onToggleRevealed={() => toggleAnswer(q.id)}
                          isLocked={isLocked}
                          userEmail={userEmail}
                          searchQuery={csatSearchQuery}
                          onOpenPremium={() => setShowPremiumModal(true)}
                          onFeedback={() => openFeedback(q.id, 'csat')}
                          showNoteInline={csatNotedOnly}
                          onSubjectClick={(subject) => {
                            setCSATSubjectFilter(subject);
                            setCSATRandomMode(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          onYearClick={(year) => {
                            setCSATYearFilter(year);
                            setCSATRandomMode(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        />
                      );
                    })}
                  </div>

                  <div ref={csatScrollRef} className="h-10" />
                </>
              )}
            </section>
          </>
        ) : activeTab === 'english' ? (
          <>
            {/* Mobile Filters Toggle Button */}
            <div className="md:hidden w-full mb-4">
              <button 
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                className="w-full flex items-center justify-between gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
              >
                <span className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  {isMobileFiltersOpen ? 'Hide Filters' : 'Show Filters'}
                </span>
                <ChevronDown className={cn("w-4 h-4 transition-transform duration-300", isMobileFiltersOpen && "rotate-180")} />
              </button>
            </div>

            <aside className={cn(
              "w-full md:w-60 lg:w-64 flex-shrink-0 md:sticky md:top-24 md:block relative z-30 md:z-auto",
              isMobileFiltersOpen ? "block" : "hidden"
            )}>
              <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl p-5 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-black/20 border border-slate-200/70 dark:border-slate-700/70">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                    <SortMenu
                      value={englishSortMode}
                      onChange={(v) => setEnglishSortMode(v as QuestionSortMode)}
                      defaultValue="latest"
                      options={questionSortOptions}
                    />
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <SavedFilterToggles
                      bookmarkedOnly={englishBookmarkedOnly}
                      onToggleBookmarked={() => { setEnglishBookmarkedOnly(v => !v); setEnglishVisibleCount(30); }}
                      bookmarkedCount={bookmarkedEnglishCount}
                      notedOnly={englishNotedOnly}
                      onToggleNoted={() => { setEnglishNotedOnly(v => !v); setEnglishVisibleCount(30); }}
                      notedCount={notedEnglishCount}
                    />
                    <button
                      type="button"
                      onClick={toggleEnglishFilterDefault}
                      disabled={savingDefaultSection === 'english'}
                      title={hasSavedEnglishDefault ? "Unpin default filters" : "Pin current filters as default"}
                      aria-label={hasSavedEnglishDefault ? "Unpin default filters" : "Pin current filters as default"}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg border transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
                        hasSavedEnglishDefault
                          ? "border-transparent bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25 hover:from-blue-500 hover:to-indigo-500"
                          : "border-slate-200 bg-white/70 text-slate-400 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-500 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-400 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                      )}
                    >
                      {savingDefaultSection === 'english'
                        ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        : hasSavedEnglishDefault
                        ? <Pin className="h-3.5 w-3.5 fill-current" />
                        : <PinOff className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => {
                        setEnglishYearFilter("All");
                        setEnglishSubjectFilter("All");
                        setEnglishTopicFilter("All");
                        setEnglishExamFilter("All");
                        setEnglishPaperFilter("All");
                        setEnglishSearchQuery("");
                        setEnglishVisibleCount(30);
                        setEnglishRandomMode(false);
                        setEnglishBookmarkedOnly(false);
                        setEnglishNotedOnly(false);
                        setEnglishSortMode('latest');
                        resetQuiz(false);
                      }}
                      className="text-[11px] font-bold text-white bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-1 px-2.5 rounded-lg transition-all active:scale-95 shadow-md shadow-blue-600/25 flex items-center gap-1"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="english-search" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Search Keywords</label>
                  <div className="relative">
                    <input
                      type="text"
                      id="english-search"
                      value={englishSearchQuery}
                      onChange={(e) => setEnglishSearchQuery(e.target.value)}
                      placeholder="Keyword or question ID..."
                      className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 pr-8 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                    />
                    <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Exam</label>
                  <FancySelect
                    value={englishExamFilter}
                    onChange={(v) => {
                      setEnglishExamFilter(v);
                      setEnglishPaperFilter("All");
                    }}
                    ariaLabel="Exam"
                    options={englishExamsList.options.map(ex => ({ value: ex, label: ex === "All" ? "All Exams" : `${ex} (${englishExamsList.counts[ex] || 0})` }))}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Year</label>
                  <FancySelect
                    value={englishYearFilter}
                    onChange={(v) => setEnglishYearFilter(v)}
                    ariaLabel="Year"
                    options={englishYearsList.options.map(y => ({ value: y, label: y === "All" ? "All Years" : `${y} (${englishYearsList.counts[y] || 0})` }))}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Paper</label>
                  <FancySelect
                    value={englishPaperFilter}
                    onChange={(v) => setEnglishPaperFilter(v)}
                    ariaLabel="Paper"
                    options={englishPapersList.options.map(p => ({ value: p, label: p === "All" ? "All Papers" : `${p} (${englishPapersList.counts[p] || 0})` }))}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Topic</label>
                  <FancySelect
                    value={englishTopicFilter}
                    onChange={(v) => setEnglishTopicFilter(v)}
                    ariaLabel="Topic"
                    options={englishTopicsList.options.map(t => ({ value: t, label: t === "All" ? "All Topics" : `${t} (${englishTopicsList.counts[t] || 0})` }))}
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">Showing <span className="font-bold text-blue-500 dark:text-blue-400">{filteredEnglishQuestions.length}</span> questions</p>
                </div>
              </div>
            </aside>

            <section className="flex-grow">
              {filteredEnglishQuestions.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-10 text-center">
                  <FolderOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3 mx-auto" />
                  <h3 className="text-base font-medium text-slate-900 dark:text-white mb-1">No English questions found</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">Try adjusting your filters to see more results.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredEnglishQuestions.map((q, idx) => {
                      const isLocked = !isSubscribed && !englishLatestTwoYears.includes(q.year);
                      return (
                        <QuestionCard 
                          key={q.id}
                          question={q}
                          storageScope="english"
                          index={idx}
                          attemptedOption={userAttempts[q.id]}
                          isRevealed={revealedAnswers[q.id]}
                          onOptionClick={(opt) => handleOptionClick(q.id, opt, opt === q.answer, 'english', q.subject, q.topic)}
                          onToggleRevealed={() => toggleAnswer(q.id)}
                          isLocked={isLocked}
                          userEmail={userEmail}
                          searchQuery={englishSearchQuery}
                          isAdmin={isAdmin}
                          isEditor={isEditor}
                          onUpdateQuestion={handleUpdateEnglishQuestion}
                          onOpenPremium={() => setShowPremiumModal(true)}
                          onFeedback={() => openFeedback(q.id, 'english')}
                          showNoteInline={englishNotedOnly}
                          onSubjectClick={(subject) => {
                            setEnglishSubjectFilter(subject);
                            setEnglishRandomMode(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          onExamClick={(exam) => {
                            setEnglishExamFilter(getExamCategory(exam));
                            setEnglishPaperFilter(exam);
                            setEnglishRandomMode(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          onYearClick={(year) => {
                            setEnglishYearFilter(year);
                           setEnglishRandomMode(false);
                           window.scrollTo({ top: 0, behavior: 'smooth' });
                         }}
                       />
                     );
                   })}
                  </div>
                  <div ref={englishScrollRef} className="h-10" />
                </>
              )}
            </section>
          </>
        ) : activeTab === 'essay' ? (
          <div className="w-full">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Essay Section</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                  UPSC Essay papers with model essays, topic analysis, and writing frameworks — coming soon!
                </p>
                <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-4 py-2 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-800/50">
                  <Lock className="w-3.5 h-3.5" />
                  Under Development
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'toppers' ? (
          <div className="w-full">
            {isLoadingToppers ? (
              <div className="text-center py-10">
                <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-slate-500 text-sm">Loading Topper's Copy...</p>
              </div>
            ) : toppersQuestions.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
                <Trophy className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
                <p className="text-slate-500">No topper's copy questions available yet.</p>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Filters sidebar */}
                <div className="lg:w-64 flex-shrink-0">
                  <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl rounded-xl border border-slate-200/70 dark:border-slate-700/70 p-4 shadow-sm sticky top-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Filters</h3>
                      <button
                        onClick={() => { setToppersYearFilter("All"); setToppersTopperFilter("All"); setToppersSubjectFilter("All"); setToppersPaperFilter("All"); setToppersSearchQuery(""); }}
                        className="text-[11px] font-bold text-white bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-1 px-2.5 rounded-lg transition-all active:scale-95 shadow-md shadow-blue-600/25 flex items-center gap-1"
                      >Reset</button>
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Search</label>
                      <input
                        type="text"
                        value={toppersSearchQuery}
                        onChange={(e) => setToppersSearchQuery(e.target.value)}
                        placeholder="Keyword or question ID..."
                        className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Year</label>
                      <FancySelect value={toppersYearFilter} onChange={(v) => setToppersYearFilter(v)} ariaLabel="Year"
                        options={[{ value: 'All', label: 'All Years' }, ...toppersYearsList.map(y => ({ value: y, label: y }))]} />
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Paper</label>
                      <FancySelect value={toppersPaperFilter} onChange={(v) => setToppersPaperFilter(v)} ariaLabel="Paper"
                        options={[{ value: 'All', label: 'All Papers' }, ...toppersPapersList.map(p => ({ value: p, label: p }))]} />
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Subject</label>
                      <FancySelect value={toppersSubjectFilter} onChange={(v) => setToppersSubjectFilter(v)} ariaLabel="Subject"
                        options={[{ value: 'All', label: 'All Subjects' }, ...toppersSubjectsList.map(s => ({ value: s, label: s }))]} />
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Topper</label>
                      <FancySelect value={toppersTopperFilter} onChange={(v) => setToppersTopperFilter(v)} ariaLabel="Topper"
                        options={[{ value: 'All', label: 'All Toppers' }, ...toppersToppersList.map(t => ({ value: t, label: t }))]} />
                    </div>

                    <div className="text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-700">
                      Showing {filteredToppersQuestions.length} of {toppersQuestions.length} questions
                    </div>
                  </div>
                </div>

                {/* Questions grid - two columns */}
                <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {filteredToppersQuestions.map((q) => {
                    const visibleAnswers = toppersTopperFilter === "All" ? q.answers : q.answers?.filter(a => a.topperName === toppersTopperFilter);
                    const currentIdx = activeTopperIndex[q.id] ?? -1;
                    const currentAnswer = currentIdx >= 0 ? visibleAnswers?.[currentIdx] : null;
                    const isToppersLocked = !isSubscribed && !(q.year === "2023" && (q.paper === "GS1" || q.paper === "GS 1" || !q.paper));
                    return (
                    <div key={q.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
                      {/* Question header */}
                      <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex flex-wrap gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-300/90 rounded-full ring-1 ring-inset ring-blue-400/15 font-semibold"><Calendar className="w-3 h-3" />{q.year}</span>
                            <span className="text-[10px] px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-300/90 rounded-full ring-1 ring-inset ring-blue-400/15 font-semibold">{q.exam}</span>
                            {q.paper && <span className="text-[10px] px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-300/90 rounded-full ring-1 ring-inset ring-blue-400/15 font-semibold">{q.paper}</span>}
                            <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-300/90 rounded-full ring-1 ring-inset ring-indigo-400/15 font-semibold tracking-wide"><span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />{q.subject}</span>
                            {q.topic && <span className="text-[10px] px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-300/90 rounded-full ring-1 ring-inset ring-blue-400/15 font-semibold">{q.topic}</span>}
                          </div>
                          <div className="flex gap-1.5 items-center">
                            <MarksWordsPill marks={q.marks} words={q.words} />
                            <button
                              type="button"
                              onClick={() => openFeedback(q.id, 'toppers')}
                              title="Report an issue or give feedback on this question"
                              className={cardIconButton}
                            >
                              <MessageSquareText
                                className="h-3.5 w-3.5"
                                strokeWidth={2}
                                stroke="url(#pyqIconIdle)"
                                fill="none"
                              />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-slate-900 dark:text-slate-100 leading-relaxed">
                          {q.questionNumber && <span className="font-bold text-indigo-600 dark:text-indigo-400">Q{q.questionNumber}. </span>}
                          <HighlightText text={q.question} query={toppersSearchQuery} />
                        </p>
                      </div>

                      {/* Answers section - tabs always visible, answer locked on expand for non-subscribed */}
                      {visibleAnswers && visibleAnswers.length > 0 ? (
                        <div className="flex-1 p-4">
                          {/* Topper tabs - scroll to expand/collapse */}
                          <TopperScrollTabs
                            answers={visibleAnswers}
                            activeIdx={currentIdx}
                            onSelect={(idx) => setActiveTopperIndex(prev => {
                              const isClosing = prev[q.id] === idx;
                              if (isClosing) {
                                const next = { ...prev };
                                delete next[q.id];
                                return next;
                              }
                              const openCount = Object.values(prev).filter(v => (v as number) >= 0).length - ((prev[q.id] as number) >= 0 ? 1 : 0);
                              if (openCount >= 2) return { [q.id]: idx };
                              return { ...prev, [q.id]: idx };
                            })}
                          />

                          {/* Active topper's answer */}
                          {currentAnswer && (
                            isToppersLocked ? (
                              <div className="relative rounded-lg p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center select-none">
                                <div className="bg-indigo-600 p-2 rounded-full mb-3 shadow-lg">
                                  <Lock className="w-4 h-4 text-white" />
                                </div>
                                <h4 className="text-[13px] font-bold text-slate-900 dark:text-white mb-2">Premium Content</h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-4">
                                  Topper answers from {q.year} {q.paper || ''} are available for subscribed members only.
                                </p>
                                <div className="w-full max-w-xs space-y-2">
                                  <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-left">
                                    <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-1.5 font-bold uppercase tracking-wider flex items-center gap-1">
                                      <Sparkles className="w-3 h-3" /> What you unlock
                                    </p>
                                    <ul className="space-y-1">
                                      <li className="flex items-center gap-1.5 text-[9px] text-slate-500 dark:text-slate-400 leading-tight">
                                        <Check className="w-2.5 h-2.5 shrink-0 text-emerald-500" /> All topper copies with model answers
                                      </li>
                                      <li className="flex items-center gap-1.5 text-[9px] text-slate-500 dark:text-slate-400 leading-tight">
                                        <Check className="w-2.5 h-2.5 shrink-0 text-emerald-500" /> Every PYQ with detailed solutions
                                      </li>
                                      <li className="flex items-center gap-1.5 text-[9px] text-slate-500 dark:text-slate-400 leading-tight">
                                        <Check className="w-2.5 h-2.5 shrink-0 text-emerald-500" /> All-in-one ebooks &amp; advanced search
                                      </li>
                                    </ul>
                                    <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold text-center mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                      1 Year ₹899 · 2 Years ₹1299
                                    </p>
                                  </div>
                                  <button 
                                    onClick={() => setShowPremiumModal(true)}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg text-[10px] transition-colors shadow-md flex items-center justify-center gap-1.5"
                                  >
                                    <Crown className="w-3 h-3" /> View Premium Plans
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap rounded-lg p-4 bg-emerald-50/50 dark:bg-emerald-900/10 shadow-[0_0_12px_rgba(16,185,129,0.15)] border border-emerald-100 dark:border-emerald-800/30">
                                {currentAnswer.topperAnswerText.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                                  part.startsWith('**') && part.endsWith('**')
                                    ? <strong key={i} className="font-bold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>
                                    : <span key={i}>{part}</span>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      ) : null}
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>

      <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 py-6 mt-auto transition-colors duration-300">
        <div className="max-w-[1400px] mx-auto px-4 flex flex-col gap-3 items-center">
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {([
              ['about', 'About Us'],
              ['contact', 'Contact Us'],
              ['privacy', 'Privacy Policy'],
              ['terms', 'Terms & Conditions'],
              ['refund', 'Refund Policy'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setLegalPage(key)}
                className="text-xs font-semibold text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="w-full flex flex-col sm:flex-row justify-between items-center gap-2 text-center">
            <p className="text-xs text-slate-500 font-medium">&copy; 2026 UPSC PYQ Powerhouse. Education & Practice Platform.</p>
            <p className="text-xs text-slate-500 font-medium">Built for Civil Service Aspirants.</p>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      {showFeedbackModal && createPortal(renderFeedbackModal(), document.body)}

      {showLoginModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-overlayFade"
        >
          <div
            className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-modalPop"
          >
            {/* Gradient header */}
            <div className="relative bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-600 px-6 pt-7 pb-8 text-center overflow-hidden">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
              <button
                onClick={() => { setShowLoginModal(false); setPendingPlan(null); }}
                className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="relative flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shadow-lg ring-2 ring-white/25 mb-3">
                  <User className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-extrabold text-white">Welcome Back</h2>
                <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-xs mx-auto">
                  Enter your email address to access the powerhouse.
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 sm:px-8 pt-6 pb-7">
              {pendingPlan && (
                <div className="mb-5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/70 dark:border-indigo-500/30 px-4 py-2.5 text-center">
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    Please log in to continue to your {pendingPlan === '2yr' ? '2 Years' : '1 Year'} plan payment.
                  </p>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      required
                      value={loginEmailInput}
                      onChange={(e) => setLoginEmailInput(e.target.value)}
                      placeholder="e.g. user@example.com"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 hover:from-indigo-500 hover:via-blue-500 hover:to-violet-500 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-600/25 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isLoggingIn ? "Logging in..." : "Continue to UPSC Powerhouse"}
                  {!isLoggingIn && <Check className="w-5 h-5" />}
                </button>
              </form>

              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-6">
                Your session will be remembered for 7 days.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Premium Modal */}
      {showReport && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-overlayFade">
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-6xl h-[92vh] flex flex-col rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-modalPop">
            {/* Header (slim) */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-indigo-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50 via-blue-50 to-violet-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-500 shadow-sm shadow-indigo-500/30">
                  <LayoutDashboard className="w-3.5 h-3.5 text-white" />
                </span>
                <h2 className="text-sm font-bold text-indigo-900 dark:text-slate-100 leading-tight">My Workspace</h2>
                <span className="text-[11px] text-indigo-400/80 dark:text-slate-500 truncate hidden sm:inline">· {userEmail || 'Not signed in'}</span>
              </div>
              <button
                onClick={() => setShowReport(false)}
                className="p-1.5 rounded-full text-indigo-400 hover:bg-white/60 dark:hover:bg-slate-800 hover:text-indigo-600 transition-colors flex-shrink-0"
                aria-label="Close workspace"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-3 sm:px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
              {([
                { id: 'report' as const, label: 'Report', icon: BarChart3, count: null },
                { id: 'bookmarks' as const, label: 'Bookmarks', icon: Bookmark, count: bookmarkedEntries.length },
                { id: 'notes' as const, label: 'Notes', icon: StickyNote, count: notedEntries.length },
              ]).map(tab => {
                const TabIcon = tab.icon;
                const isActive = workspaceTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setWorkspaceTab(tab.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold border-b-2 -mb-px transition-colors focus:outline-none",
                      isActive
                        ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                        : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    )}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    {tab.count !== null && tab.count > 0 && (
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none",
                        isActive
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      )}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bookmarks */}
            {workspaceTab === 'bookmarks' && (
              <div className="overflow-y-auto px-5 sm:px-7 py-5 flex-1">
                {!userEmail && <GuestSessionNotice onSignIn={() => { setShowReport(false); setShowLoginModal(true); }} />}
                {bookmarkedEntries.length === 0 ? (
                  <div className="text-center py-12">
                    <Bookmark className="w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No bookmarks yet.</p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Tap the bookmark icon on any question to save it here.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {bookmarkedEntries.map(entry => (
                      <WorkspaceEntryCard
                        key={entry.key}
                        entry={entry}
                        onRemove={() => removeWorkspaceEntry(entry, { isBookmarked: false })}
                        removeLabel="Remove bookmark"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {workspaceTab === 'notes' && (
              <div className="flex-1 overflow-y-auto bg-gradient-to-b from-violet-50/50 via-white to-white px-4 py-6 sm:px-8 dark:from-violet-500/5 dark:via-slate-900 dark:to-slate-900">
                {!userEmail && <GuestSessionNotice onSignIn={() => { setShowReport(false); setShowLoginModal(true); }} />}
                {notedEntries.length === 0 ? (
                  <div className="text-center py-12">
                    <StickyNote className="w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No notes yet.</p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Use the notes icon on any question to jot something down.</p>
                  </div>
                ) : (
                  <div className="mx-auto max-w-4xl space-y-4">
                    {notedEntries.map(entry => (
                      <WorkspaceEntryCard
                        key={entry.key}
                        entry={entry}
                        onRemove={() => removeWorkspaceEntry(entry, { notes: '' })}
                        removeLabel="Delete note"
                      >
                        <div className="note-paper-lines mt-4 rounded-2xl border border-violet-200/80 px-5 py-5 shadow-inner shadow-violet-100/30 ring-1 ring-violet-100/70 dark:border-violet-500/20 dark:shadow-none dark:ring-violet-500/10">
                          <h3 className="mb-3 text-base font-extrabold text-slate-900 dark:text-white">
                            {getNoteTitle(
                              entry.state.noteTitle,
                              entry.question?.topic || entry.state.topic,
                              entry.question?.subject || entry.state.subject
                            )}
                          </h3>
                          <NoteContent note={entry.state.notes} className="text-[13px] leading-6 text-slate-700 dark:text-slate-200" />
                        </div>
                      </WorkspaceEntryCard>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Report */}
            {workspaceTab === 'report' && (
            <div className="overflow-y-auto px-5 sm:px-7 py-5 space-y-6 flex-1">
              {!userEmail ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-10">Please sign in to see your performance report.</p>
              ) : reportLoading ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-10">Loading your report…</p>
              ) : reportError ? (
                <p className="text-center text-rose-500 py-10">{reportError}</p>
              ) : !reportData || reportData.score.total === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-10">No attempts yet. Answer some questions and your report will appear here.</p>
              ) : (() => {
                const pct = (b: { correct: number; total: number }) => b.total > 0 ? Math.round((b.correct / b.total) * 100) : 0;
                // One modern traffic-light scale reused by every chart, so a
                // colour always means the same thing wherever it appears.
                // Bars are gradients rather than flat fills.
                const barColor = (p: number) => p >= 70
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                  : p >= 40 ? 'bg-gradient-to-r from-amber-300 to-orange-400' : 'bg-gradient-to-r from-rose-400 to-pink-500';
                const barColorUp = (p: number) => p >= 70
                  ? 'bg-gradient-to-t from-teal-500 to-emerald-400'
                  : p >= 40 ? 'bg-gradient-to-t from-orange-400 to-amber-300' : 'bg-gradient-to-t from-pink-500 to-rose-400';
                const toneText = (p: number) => p >= 70
                  ? 'text-teal-600 dark:text-emerald-400'
                  : p >= 40 ? 'text-orange-500 dark:text-amber-400' : 'text-rose-500 dark:text-rose-400';
                const ringStops = (p: number) => p >= 70
                  ? ['#34d399', '#0d9488']
                  : p >= 40 ? ['#fcd34d', '#fb923c'] : ['#fb7185', '#ec4899'];
                const attempts = reportData.attempts || [];
                // Backfill subject/topic for older attempts (saved before we stored them) using loaded question metadata.
                const qMeta: Record<string, Map<number, { subject?: string; topic?: string }>> = {
                  prelims: new Map(questions.map(q => [q.id, { subject: q.subject, topic: q.topic }])),
                  csat: new Map(csatQuestions.map(q => [q.id, { subject: q.subject, topic: q.topic }])),
                  english: new Map(englishQuestions.map(q => [q.id, { subject: q.subject, topic: q.topic }])),
                };
                const resolveKey = (a: ReportAttempt, key: 'subject' | 'topic') => {
                  const direct = (a[key] || '').toString().trim();
                  if (direct) return direct;
                  const meta = a.questionId != null ? qMeta[a.questionType]?.get(a.questionId) : undefined;
                  return (meta?.[key] || '').toString().trim();
                };
                // Group a section's attempts by subject or topic. `total` counts
                // each question once (scored on its latest attempt, like the
                // cards); `attempts` is the lifetime attempt volume, used both to
                // order the bars and to decide whether an area has been practised
                // enough to be called a strength or a weakness.
                const groupBy = (type: string, key: 'subject' | 'topic') => {
                  const map: Record<string, { correct: number; total: number; attempts: number }> = {};
                  for (const a of attempts) {
                    if (a.questionType !== type) continue;
                    const name = resolveKey(a, key);
                    if (!name) continue;
                    if (!map[name]) map[name] = { correct: 0, total: 0, attempts: 0 };
                    map[name].total += 1;
                    map[name].attempts += Math.max(a.attemptCount ?? 1, 1);
                    if (a.isCorrect) map[name].correct += 1;
                  }
                  // Most-practised first: the areas you have the most data on.
                  return Object.entries(map).sort((x, y) => y[1].attempts - x[1].attempts || y[1].total - x[1].total);
                };

                // A titled section card: its own score plus a horizontal bar per
                // subject/topic. Horizontal bars fit long names, which the old
                // vertical columns truncated to two cramped lines.
                const SectionReport: React.FC<{
                  title: string;
                  dot: string;
                  score: { correct: number; total: number };
                  groupLabel: string;
                  entries: [string, { correct: number; total: number; attempts: number }][];
                }> = ({ title, dot, score, groupLabel, entries }) => {
                  if (score.total === 0) return null;
                  const sp = pct(score);
                  return (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
                      <div className="mb-3.5 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dot)} />
                          <h3 className="truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">{title}</h3>
                          <span className="hidden shrink-0 text-[11px] font-medium text-slate-400 sm:inline">· {groupLabel}, most practised first</span>
                        </div>
                        <div className="flex shrink-0 items-baseline gap-1.5">
                          <span className={cn('text-sm font-extrabold', toneText(sp))}>{sp}%</span>
                          <span className="text-[11px] font-semibold text-slate-400">{score.correct}/{score.total}</span>
                        </div>
                      </div>
                      {entries.length === 0 ? (
                        <p className="py-3 text-center text-[11px] text-slate-400 dark:text-slate-500">No {groupLabel.toLowerCase()} data yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {entries.map(([k, b]) => {
                            const p = pct(b);
                            return (
                              <div key={k} className="flex items-center gap-2.5" title={`${k}: ${b.correct}/${b.total} questions correct (${p}%) · ${b.attempts} attempts`}>
                                <span className="w-24 shrink-0 truncate text-[11px] font-semibold text-slate-600 dark:text-slate-300 sm:w-40">{k}</span>
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
                                  <div
                                    className={cn('h-full rounded-full transition-all duration-500', barColor(p))}
                                    style={{ width: `${Math.max(p, 2)}%` }}
                                  />
                                </div>
                                <span className={cn('w-8 shrink-0 text-right text-[11px] font-bold', toneText(p))}>{p}%</span>
                                <span className="w-16 shrink-0 text-right text-[10px] font-medium tabular-nums text-slate-400 dark:text-slate-500">
                                  {b.correct}/{b.total} · {b.attempts}x
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                };

                const empty = { correct: 0, total: 0 };
                const prelimsScore = reportData.sections.prelims || empty;
                const csatScore = reportData.sections.csat || empty;
                const englishScore = reportData.sections.english || empty;
                const overallPct = pct(reportData.score);
                // Group by session (attemptId = one run until reset/reload), ordered oldest → newest.
                const sessionMap: Record<string, { correct: number; total: number; ts: string }> = {};
                for (const a of attempts) {
                  const id = a.attemptId || 'legacy';
                  if (!sessionMap[id]) sessionMap[id] = { correct: 0, total: 0, ts: a.ts || '' };
                  sessionMap[id].total += 1;
                  if (a.isCorrect) sessionMap[id].correct += 1;
                  if (a.ts && (!sessionMap[id].ts || a.ts < sessionMap[id].ts)) sessionMap[id].ts = a.ts;
                }
                const sessions = Object.values(sessionMap).sort((x, y) => (x.ts || '').localeCompare(y.ts || ''));
                const totalQ = reportData.score.total;
                const rightQ = reportData.score.correct;
                const wrongQ = totalQ - rightQ;
                // Plain-language read of the headline number, so the report says
                // what to do next instead of only what happened.
                const verdict = overallPct >= 80
                  ? "Excellent — you're exam ready on what you've practised."
                  : overallPct >= 60
                    ? 'Solid work. Tighten the weaker areas below and you’re there.'
                    : overallPct >= 40
                      ? 'Getting there — revise the red areas below before moving on.'
                      : 'Early days. Focus on fundamentals in the red areas below.';
                // Strongest and weakest areas across all three sections. An area
                // has to be properly practised before it is judged: at least 8
                // distinct questions and 12 attempts. Ranking then uses the
                // Wilson lower bound rather than raw accuracy, so a small 5/5
                // cannot outrank a well-evidenced 17/20.
                const MIN_QUESTIONS = 8;
                const MIN_ATTEMPTS = 12;
                const wilson = (correct: number, total: number) => {
                  if (total === 0) return 0;
                  const z = 1.96;
                  const p = correct / total;
                  return (p + (z * z) / (2 * total) - z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total)) / (1 + (z * z) / total);
                };
                const ranked = [
                  ...groupBy('prelims', 'subject'),
                  ...groupBy('csat', 'topic'),
                  ...groupBy('english', 'topic'),
                ]
                  .filter(([, b]) => b.total >= MIN_QUESTIONS && b.attempts >= MIN_ATTEMPTS)
                  .sort((x, y) => wilson(y[1].correct, y[1].total) - wilson(x[1].correct, x[1].total));
                // Split the ranked list in half so a weak area is never labelled
                // "strong" just because it happens to be the only one measured.
                const bandSize = Math.min(3, Math.floor(ranked.length / 2));
                const strengths = ranked.slice(0, bandSize);
                const focusAreas = ranked.slice(ranked.length - bandSize).reverse();
                return (
                  <>
                    {/* Headline: one number, in plain words */}
                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4 dark:border-slate-700 dark:from-slate-800/70 dark:via-slate-800/40 dark:to-slate-800/70">
                      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                        <div className="relative h-24 w-24 shrink-0">
                          <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                            <defs>
                              <linearGradient id="reportRingGradient" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor={ringStops(overallPct)[0]} />
                                <stop offset="100%" stopColor={ringStops(overallPct)[1]} />
                              </linearGradient>
                            </defs>
                            <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" className="stroke-slate-200/80 dark:stroke-slate-700/80" />
                            <circle
                              cx="18"
                              cy="18"
                              r="15.5"
                              fill="none"
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              stroke="url(#reportRingGradient)"
                              className="transition-all duration-700"
                              strokeDasharray={`${(overallPct / 100) * 97.4} 97.4`}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={cn('text-xl font-extrabold leading-none', toneText(overallPct))}>{overallPct}%</span>
                            <span className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">accuracy</span>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold leading-snug text-slate-800 dark:text-slate-100">{verdict}</p>
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {([
                              { label: 'Attempted', value: totalQ, tone: 'text-slate-800 dark:text-slate-100' },
                              { label: 'Correct', value: rightQ, tone: 'text-teal-600 dark:text-emerald-400' },
                              { label: 'Wrong', value: wrongQ, tone: 'text-rose-500 dark:text-rose-400' },
                              { label: 'Sessions', value: reportData.attemptCount, tone: 'text-violet-500 dark:text-violet-400' },
                            ]).map(stat => (
                              <div key={stat.label} className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-slate-200/80 dark:bg-slate-900/40 dark:ring-slate-700/70">
                                <div className={cn('text-base font-extrabold leading-none', stat.tone)}>{stat.value}</div>
                                <div className="mt-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500">{stat.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section-wise scores, with a bar so they compare at a glance */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      {([
                        { label: 'Prelims', s: prelimsScore },
                        { label: 'CSAT / Maths', s: csatScore },
                        { label: 'English', s: englishScore },
                      ]).map(({ label, s }) => {
                        const p = pct(s);
                        return (
                          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/40">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>
                              <span className={cn('text-sm font-extrabold', s.total > 0 ? toneText(p) : 'text-slate-300 dark:text-slate-600')}>
                                {s.total > 0 ? `${p}%` : '—'}
                              </span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
                              <div className={cn('h-full rounded-full transition-all duration-500', barColor(p))} style={{ width: `${s.total > 0 ? Math.max(p, 2) : 0}%` }} />
                            </div>
                            <div className="mt-1.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                              {s.total > 0 ? `${s.correct} of ${s.total} correct` : 'Not attempted yet'}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* What's working vs what needs work */}
                    {ranked.length >= 4 ? (
                      <div>
                        <div className="grid gap-3 sm:grid-cols-2">
                        {([
                          { title: 'Strong areas', rows: strengths, tint: 'border-teal-200 bg-teal-50/60 dark:border-teal-500/25 dark:bg-teal-500/10', head: 'text-teal-700 dark:text-teal-300' },
                          { title: 'Needs work', rows: focusAreas, tint: 'border-rose-200 bg-rose-50/60 dark:border-rose-500/25 dark:bg-rose-500/10', head: 'text-rose-600 dark:text-rose-300' },
                        ]).filter(card => card.rows.length > 0).map(card => (
                          <div key={card.title} className={cn('rounded-2xl border p-3.5', card.tint)}>
                            <h3 className={cn('mb-2 text-[11px] font-bold uppercase tracking-wide', card.head)}>{card.title}</h3>
                            <div className="space-y-1.5">
                              {card.rows.map(([k, b]) => (
                                <div key={k} className="flex items-center justify-between gap-3" title={`${b.correct}/${b.total} questions correct · ${b.attempts} attempts`}>
                                  <span className="truncate text-[12px] font-semibold text-slate-700 dark:text-slate-200">{k}</span>
                                  <span className="shrink-0 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                    <span className={toneText(pct(b))}>{pct(b)}%</span>
                                    <span className="ml-1.5 font-medium tabular-nums text-slate-400 dark:text-slate-500">{b.correct}/{b.total}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        </div>
                        <p className="mt-2 text-center text-[10px] font-medium text-slate-400 dark:text-slate-500">
                          Ranked by confidence, not raw score — only areas with {MIN_QUESTIONS}+ questions and {MIN_ATTEMPTS}+ attempts are judged.
                        </p>
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-center text-[11px] font-medium text-slate-400 dark:border-slate-700 dark:text-slate-500">
                        Strong and weak areas appear once you've attempted {MIN_QUESTIONS}+ questions ({MIN_ATTEMPTS}+ attempts) in at least four subjects or topics.
                      </p>
                    )}

                    {/* Per-section breakdowns */}
                    <SectionReport
                      title="Prelims"
                      dot="bg-gradient-to-br from-sky-400 to-blue-500"
                      score={prelimsScore}
                      groupLabel="Subject-wise"
                      entries={groupBy('prelims', 'subject')}
                    />
                    <SectionReport
                      title="CSAT / Maths"
                      dot="bg-gradient-to-br from-violet-400 to-fuchsia-500"
                      score={csatScore}
                      groupLabel="Topic-wise"
                      entries={groupBy('csat', 'topic')}
                    />
                    <SectionReport
                      title="English"
                      dot="bg-gradient-to-br from-emerald-400 to-teal-500"
                      score={englishScore}
                      groupLabel="Topic-wise"
                      entries={groupBy('english', 'topic')}
                    />

                    {/* Session trend (each run until reset/reload) — shown last */}
                    {sessions.length > 1 && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
                        <div className="mb-3.5 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br from-amber-300 to-orange-400" />
                            <h3 className="truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">Progress</h3>
                            <span className="hidden shrink-0 text-[11px] font-medium text-slate-400 sm:inline">· accuracy per session</span>
                          </div>
                          <span className="shrink-0 text-[11px] font-semibold text-slate-400">last {Math.min(sessions.length, 12)} of {sessions.length}</span>
                        </div>
                        <div className="flex h-32 items-end gap-1.5 sm:gap-2.5">
                          {sessions.slice(-12).map((s, i) => {
                            const p = pct(s);
                            return (
                              <div
                                key={i}
                                className="flex h-full flex-1 flex-col items-center justify-end"
                                title={`${s.correct}/${s.total} correct (${p}%)`}
                              >
                                <span className={cn('mb-1 text-[10px] font-bold', toneText(p))}>{p}</span>
                                <div
                                  className={cn('w-full max-w-[28px] rounded-t-lg shadow-sm transition-all duration-500', barColorUp(p))}
                                  style={{ height: `${Math.max(p, 3)}%` }}
                                />
                                <span className="mt-1.5 text-[9px] font-semibold text-slate-400 dark:text-slate-500">
                                  {sessions.length - Math.min(sessions.length, 12) + i + 1}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            )}
          </div>
        </div>
      )}

      {showPremiumModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-overlayFade">
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[96vh] flex flex-col rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-modalPop">
            <button
              onClick={() => setShowPremiumModal(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header banner */}
            <div className="relative shrink-0 bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-600 px-6 sm:px-10 pt-3 pb-3 text-center overflow-hidden">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
              <div className="relative">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white/15 backdrop-blur mb-1 shadow-lg">
                  <Crown className="w-4 h-4 text-amber-300" />
                </div>
                <h2 className="text-base sm:text-xl font-extrabold text-white flex items-center justify-center gap-2">
                  Powerhouse Premium
                </h2>
                <p className="text-blue-100 text-[11px] sm:text-xs mt-0.5 max-w-md mx-auto">
                  Unlock every PYQ, topper copies and all-in-one ebooks. Pick the plan that fits your prep.
                </p>
                <button
                  onClick={copyPremiumLink}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold backdrop-blur transition-colors"
                  title="Copy a link that opens these plans"
                >
                  {linkCopied ? <><Check className="w-3.5 h-3.5" /> Link copied!</> : <><Link2 className="w-3.5 h-3.5" /> Copy plans link</>}
                </button>
              </div>
            </div>

            <div className="px-4 sm:px-6 pb-4 pt-3 overflow-y-auto flex-1 min-h-0">
              {/* Coupon */}
              <div className={cn(
                "mb-3 rounded-2xl border px-3 py-2.5 transition-colors",
                appliedCoupon
                  ? "animate-couponGlow border-emerald-300 bg-emerald-50 dark:border-emerald-700/60 dark:bg-emerald-900/20"
                  : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
              )}>
                {appliedCoupon ? (
                  <div key={appliedCoupon.code} className="animate-couponSlide flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="animate-couponPop flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        <Tag className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-slate-800 dark:text-slate-100">
                          {appliedCoupon.code} applied · <span className="text-emerald-600 dark:text-emerald-400">{appliedCoupon.discountPercent}% off</span>
                        </p>
                        <p className="truncate text-[10.5px] text-slate-500 dark:text-slate-400">
                          {appliedCoupon.description
                            || `Applies to ${appliedCoupon.plans.map(p => p === '1yr' ? '1 Year' : p === '2yr' ? '2 Years' : 'Ebooks').join(', ')}`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearCoupon}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">Have a coupon?</span>
                    <input
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') applyCoupon(); }}
                      placeholder="ENTER CODE"
                      maxLength={32}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-slate-700 outline-none transition placeholder:font-medium placeholder:tracking-normal placeholder:text-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={couponChecking || couponInput.trim() === ''}
                      className="shrink-0 rounded-lg bg-indigo-600 px-4 py-1.5 text-[11px] font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {couponChecking ? 'Checking…' : 'Apply'}
                    </button>
                    {couponError && (
                      <p className="w-full text-[11px] font-semibold text-rose-500">{couponError}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-3 gap-3 sm:gap-4">
                {([
                  {
                    id: 'pyq1',
                    label: 'PYQ SUBSCRIPTION',
                    icon: 'calendar',
                    title: '1 Year',
                    subtitle: 'Premium PYQ Access',
                    price: '₹899',
                    per: '≈ ₹75 / month',
                    ribbon: '',
                    labelClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
                    cardClass: 'border-emerald-500/40',
                    iconClass: 'bg-emerald-500/10 text-emerald-400',
                    titleClass: 'text-emerald-400',
                    checkClass: 'text-emerald-400',
                    btnClass: 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/25',
                    features: ['Unlimited access to all sections', 'All PYQs with solutions', 'Advanced filters & search', 'Download & bookmark', 'Regular updates', 'Cancel anytime'],
                    cta: 'Get 1 Year Plan',
                    link: 'https://telegram.me/UPSC_powerhouse_helpbot',
                    plan: '1yr',
                  },
                  {
                    id: 'pyq2',
                    label: 'PYQ SUBSCRIPTION',
                    icon: 'calendar',
                    title: '2 Years',
                    subtitle: 'Premium PYQ Access',
                    price: '₹1299',
                    per: '≈ ₹54 / month',
                    ribbon: 'Most Popular',
                    labelClass: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
                    cardClass: 'border-blue-500 ring-2 ring-blue-500/20',
                    iconClass: 'bg-blue-500/10 text-blue-400',
                    titleClass: 'text-blue-400',
                    checkClass: 'text-blue-400',
                    btnClass: 'bg-blue-500 hover:bg-blue-400 shadow-blue-500/25',
                    features: ['Unlimited access to all sections', 'All PYQs with solutions', 'Advanced filters & search', 'Download & bookmark', 'Regular updates', 'Priority support', 'Cancel anytime'],
                    cta: 'Get 2 Years Plan',
                    link: 'https://telegram.me/UPSC_powerhouse_helpbot',
                    plan: '2yr',
                  },
                  {
                    id: 'ebooks',
                    label: 'EBOOKS SUBSCRIPTION',
                    icon: 'book',
                    title: 'PowerHouse Ebooks',
                    subtitle: 'All-in-One Study Material',
                    price: '₹949',
                    per: 'All Powerhouse ebooks for exams like UPSC CSE, State PCS, CAPF, CDS, NDA, etc...',
                    ribbon: '',
                    labelClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
                    cardClass: 'border-amber-500/40',
                    iconClass: 'bg-amber-500/10 text-amber-400',
                    titleClass: 'text-amber-400',
                    checkClass: 'text-amber-400',
                    btnClass: 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/25',
                    features: ['Polity - Laxmikant summary', 'Geography - 11th and 12th NCERT summary', 'Ancient and Medieval - From Upendra and old NCERT', 'Modern History - Spectrum summary', 'Theme 1 and Theme 2 - 12th NCERT', 'Economics - 12th Micro and Macro summary + Mrunal Sir'],
                    cta: 'Get Ebooks Plan',
                    link: 'https://t.me/+7DfVmsKSI4FmNzg1',
                    plan: 'ebooks',
                  },
                ] as const).map(card => {
                  const cardDeal = appliedCoupon?.plans.includes(card.plan) ? appliedCoupon.amounts[card.plan] : undefined;
                  return (
                  <div
                    key={card.id}
                    className={cn(
                      "relative flex flex-col rounded-2xl border-2 bg-white dark:bg-slate-800/60 p-3 shadow-sm transition-all duration-300",
                      card.cardClass,
                      cardDeal && "border-emerald-400/70 shadow-lg shadow-emerald-500/10 dark:border-emerald-500/50"
                    )}
                  >
                    {cardDeal && (
                      <span
                        key={appliedCoupon!.code}
                        className="coupon-shine animate-couponPop absolute -top-2.5 -left-2.5 z-10 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-2.5 py-1 text-[10px] font-extrabold text-white shadow-lg shadow-emerald-500/30"
                      >
                        {appliedCoupon!.discountPercent}% OFF
                      </span>
                    )}
                    {card.ribbon && (
                      <span className="absolute -top-px right-4 bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-b-lg shadow-md">
                        {card.ribbon}
                      </span>
                    )}
                    <span className={cn("self-start text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md", card.labelClass)}>
                      {card.label}
                    </span>

                    <div className="flex flex-col items-center text-center mt-2">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mb-1.5", card.iconClass)}>
                        {card.icon === 'book' ? <BookOpen className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
                      </div>
                      <h3 className={cn("text-lg font-extrabold", card.titleClass)}>{card.title}</h3>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{card.subtitle}</p>
                      {(() => {
                        const listPaise = planPrices[card.plan];
                        const deal = appliedCoupon?.plans.includes(card.plan) ? appliedCoupon.amounts[card.plan] : undefined;
                        const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
                        if (deal) {
                          return (
                            <>
                              <div key={appliedCoupon!.code} className="mt-1 flex items-baseline justify-center gap-2">
                                <span className="coupon-strike text-sm font-bold text-slate-400">{rupees(deal.listAmount)}</span>
                                <span className="animate-couponPop text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{rupees(deal.finalAmount)}</span>
                              </div>
                              <span className="animate-couponSlide mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 ring-1 ring-emerald-500/25 dark:text-emerald-400">
                                <Tag className="h-3 w-3" /> {appliedCoupon!.code} · saves {rupees(deal.discountAmount)}
                              </span>
                            </>
                          );
                        }
                        return (
                          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{listPaise ? rupees(listPaise) : card.price}</p>
                        );
                      })()}
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 px-2">{card.per}</p>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-700 my-2" />

                    <ul className="space-y-1.5 flex-1">
                      {card.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className={cn("w-4 h-4 shrink-0 mt-0.5", card.checkClass)} />
                          <span className="text-[12px] text-slate-700 dark:text-slate-300">{f}</span>
                        </li>
                      ))}
                    </ul>

                    {(
                      <button
                        onClick={() => initiatePayment(card.plan)}
                        className={cn(
                          "mt-3 w-full text-white font-bold py-2 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2",
                          card.btnClass
                        )}
                      >
                        <Lock className="w-4 h-4" /> {card.cta}
                      </button>
                    )}
                  </div>
                  );
                })}
              </div>

              {/* Queries footer */}
              <div className="mt-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-2 flex flex-col sm:flex-row items-center gap-2 justify-between">
                <p className="text-[12px] text-slate-500 dark:text-slate-400 text-center sm:text-left">
                  For any queries or activation help, reach us on Telegram.
                </p>
                <a
                  href="https://telegram.me/UPSC_powerhouse_helpbot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Queries on Telegram
                </a>
              </div>

              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-2">
                PYQ plans include the same features — only the duration & per-month cost differ. Secure activation via Telegram.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* New Releases Modal */}
      {showReleasesModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-2 backdrop-blur-md animate-overlayFade sm:p-4" onClick={() => setShowReleasesModal(false)}>
          <div className="relative flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-indigo-200/80 bg-white shadow-2xl shadow-indigo-950/25 dark:border-indigo-500/20 dark:bg-slate-900 animate-modalPop" onClick={(e) => e.stopPropagation()}>
            <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-600 px-5 py-5 sm:px-7">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
              <div className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-28 right-20 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-3xl" />
              <button
                onClick={() => setShowReleasesModal(false)}
                className="absolute right-4 top-4 z-20 rounded-xl bg-white/15 p-2 text-white transition-colors hover:bg-white/25"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="relative flex items-center gap-4 pr-12">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white shadow-lg ring-1 ring-inset ring-white/30 backdrop-blur">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amber-300 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-indigo-950 shadow-sm">New experience</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-100">September 2026</span>
                  </div>
                  <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">Study smarter. Revise faster.</h2>
                  <p className="mt-1 text-xs font-medium text-blue-50/90 sm:text-sm">Meet the new tools built to improve every practice session.</p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-br from-indigo-50/60 via-slate-50 to-violet-50/50 px-4 py-5 sm:px-7 sm:py-7 dark:from-indigo-500/5 dark:via-slate-950 dark:to-violet-500/5">
              <div className="grid gap-6 lg:grid-cols-3">
                <section className="hidden">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm shadow-emerald-500/25">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Latest release</h3>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">18 September 2026</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {([
                      {
                        title: 'Modern note-taking',
                        description: 'Create study notes with bold text, bullet lists, editable titles and full previews on desktop or mobile.',
                        icon: StickyNote,
                        tone: 'violet',
                      },
                      {
                        title: 'Check every attempt',
                        description: 'See correct and wrong totals on each question, preview recent attempts and open the complete attempt history.',
                        icon: BarChart3,
                        tone: 'emerald',
                      },
                      {
                        title: 'Sort your practice',
                        description: 'Order questions by latest, oldest, score or attempt count to quickly focus on the practice you need.',
                        icon: ArrowDownWideNarrow,
                        tone: 'blue',
                      },
                    ] as const).map(item => {
                      const ItemIcon = item.icon;
                      const tone = item.tone === 'violet'
                        ? 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300'
                        : item.tone === 'emerald'
                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300';
                      const cardTone = item.tone === 'violet'
                        ? 'border-violet-200/80 hover:border-violet-300 dark:border-violet-500/20'
                        : item.tone === 'emerald'
                        ? 'border-emerald-200/80 hover:border-emerald-300 dark:border-emerald-500/20'
                        : 'border-blue-200/80 hover:border-blue-300 dark:border-blue-500/20';
                      return (
                        <article key={item.title} className={cn("rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-800/70 sm:p-5", cardTone)}>
                          <div className={cn("mb-4 flex h-10 w-10 items-center justify-center rounded-xl", tone)}>
                            <ItemIcon className="h-5 w-5" />
                          </div>
                          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{item.title}</h4>
                          <p className="mt-2 text-[12.5px] font-medium leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="order-4 lg:col-span-3">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-sm shadow-indigo-500/25">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">What’s coming next</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {([
                      { title: 'More State PCS exams', description: 'More State PCS question papers.', icon: Landmark },
                      { title: 'Essay practice', description: 'Essay topics and model approaches.', icon: BookOpen },
                      { title: 'Repeat patterns', description: 'Find repeated, high-yield PYQ concepts.', icon: BarChart3 },
                    ] as const).map(item => {
                      const ItemIcon = item.icon;
                      return (
                        <article key={item.title} className="flex gap-3 rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-white to-indigo-50 p-4 shadow-sm dark:border-indigo-500/15 dark:from-slate-800 dark:to-indigo-500/10">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-500 shadow-sm dark:bg-slate-800 dark:text-indigo-300">
                            <ItemIcon className="h-4.5 w-4.5" />
                          </span>
                          <div>
                            <h4 className="text-[13px] font-extrabold text-slate-900 dark:text-white">{item.title}</h4>
                            <p className="mt-1 text-[11.5px] leading-5 text-slate-500 dark:text-slate-400">{item.description}</p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="hidden">
                  <div className="rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-4 sm:p-6 dark:border-blue-500/20 dark:from-blue-500/10 dark:via-slate-900 dark:to-violet-500/10">
                    <div className="mb-5 flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20">
                        <BookOpen className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Quick start</h3>
                        <p className="mt-1 text-[12px] font-medium leading-5 text-slate-600 dark:text-slate-300">Four short paths to start using the tools shown above.</p>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {([
                        {
                          step: '1',
                          title: 'Write a note',
                          path: 'Question card → Note icon',
                          detail: 'Add a title, bold key facts or create a bullet list. Tap the icon again to preview or edit.',
                          icon: StickyNote,
                          tone: 'bg-violet-600 shadow-violet-600/20',
                        },
                        {
                          step: '2',
                          title: 'Sort questions',
                          path: 'Filters → Latest dropdown',
                          detail: 'Choose latest, oldest, score or attempts. The selected order applies to the current section.',
                          icon: ArrowDownWideNarrow,
                          tone: 'bg-blue-600 shadow-blue-600/20',
                        },
                        {
                          step: '3',
                          title: 'Check attempts',
                          path: 'Question card → Attempt counter',
                          detail: 'Hover or tap for recent results. Select the counter to open your complete attempt timeline.',
                          icon: BarChart3,
                          tone: 'bg-emerald-600 shadow-emerald-600/20',
                        },
                        {
                          step: '4',
                          title: 'Review progress',
                          path: 'Profile menu → My Workspace',
                          detail: 'Open Report for performance, or switch to Bookmarks and Notes to revisit saved questions.',
                          icon: LayoutDashboard,
                          tone: 'bg-amber-500 shadow-amber-500/20',
                        },
                      ] as const).map(item => {
                        const StepIcon = item.icon;
                        return (
                          <article key={item.step} className="relative rounded-2xl border border-white bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
                            <span className={cn("absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold text-white shadow-md", item.tone)}>
                              {item.step}
                            </span>
                            <span className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-md", item.tone)}>
                              <StepIcon className="h-4.5 w-4.5" />
                            </span>
                            <h4 className="text-[13px] font-extrabold text-slate-900 dark:text-white">{item.title}</h4>
                            <p className="mt-1.5 text-[10px] font-extrabold uppercase tracking-wide text-blue-600 dark:text-blue-300">{item.path}</p>
                            <p className="mt-2 text-[11.5px] font-medium leading-5 text-slate-600 dark:text-slate-300">{item.detail}</p>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <section className="order-1 lg:col-span-3">
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/20">
                        <Sparkles className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">See what’s new</h3>
                        <p className="mt-0.5 text-[11.5px] font-medium text-slate-500 dark:text-slate-400">Notes, sorting and attempt history.</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-gradient-to-r from-blue-100 to-violet-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:from-blue-500/15 dark:to-violet-500/15 dark:text-indigo-300">18 September 2026</span>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    {([
                      {
                        title: 'Write notes',
                        description: 'Bold facts, add bullets and edit titles.',
                        image: '/release-screenshots/note-editor.png',
                        alt: 'Modern note editor with bold text, bullet list and editable title',
                        badge: 'Notes',
                        icon: StickyNote,
                        frame: 'from-violet-500/20 via-indigo-500/10 to-fuchsia-500/20',
                        iconTone: 'bg-violet-600 shadow-violet-600/25',
                        imageClass: 'object-cover object-top',
                      },
                      {
                        title: 'Sort questions',
                        description: 'Sort by date, score or attempts.',
                        image: '/release-screenshots/question-sorting.png',
                        alt: 'Question filter panel with sorting options open',
                        badge: 'Sorting',
                        icon: ArrowDownWideNarrow,
                        frame: 'from-blue-500/20 via-cyan-500/10 to-indigo-500/20',
                        iconTone: 'bg-blue-600 shadow-blue-600/25',
                        imageClass: 'object-contain',
                      },
                      {
                        title: 'Check attempts',
                        description: 'See correct, wrong and full attempt history.',
                        image: '/release-screenshots/attempt-history.png',
                        alt: 'Attempt history showing total, correct and wrong answer counts',
                        badge: 'Progress',
                        icon: BarChart3,
                        frame: 'from-emerald-500/20 via-teal-500/10 to-cyan-500/20',
                        iconTone: 'bg-emerald-600 shadow-emerald-600/25',
                        imageClass: 'object-contain',
                      },
                    ] as const).map(item => {
                      const TourIcon = item.icon;
                      return (
                        <article key={item.title} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-700 dark:bg-slate-800/70">
                          <a
                            href={item.image}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn("relative flex h-56 items-center justify-center overflow-hidden bg-gradient-to-br p-3", item.frame)}
                            title={`Open ${item.badge.toLowerCase()} screenshot`}
                          >
                            <div className="absolute inset-0 opacity-35" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
                            <img
                              src={item.image}
                              alt={item.alt}
                              loading="lazy"
                              className={cn("relative h-full w-full rounded-2xl border border-white/50 shadow-2xl shadow-slate-950/20 transition duration-500 group-hover:scale-[1.025]", item.imageClass)}
                            />
                            <span className="absolute bottom-5 right-5 rounded-full bg-slate-950/70 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-md">
                              View full size
                            </span>
                          </a>
                          <div className="p-4 sm:p-5">
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-md", item.iconTone)}>
                                <TourIcon className="h-4.5 w-4.5" />
                              </span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300">{item.badge}</span>
                            </div>
                            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{item.title}</h4>
                            <p className="mt-2 text-[12px] font-medium leading-5 text-slate-600 dark:text-slate-300">{item.description}</p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="order-2 lg:col-span-3">
                  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-600/20">
                        <BookOpen className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">How to use these features</h3>
                        <p className="mt-1 text-[12px] font-medium text-slate-600 dark:text-slate-300">Pin filters. Revise notes. Improve weak areas.</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-gradient-to-r from-blue-100 to-violet-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:from-blue-500/15 dark:to-violet-500/15 dark:text-indigo-300">Start here</span>
                  </div>

                  <div className="space-y-5">
                    {([
                      {
                        title: 'Pin default filters',
                        eyebrow: 'Default filters',
                        description: 'Save your usual filters for every visit.',
                        image: '/release-screenshots/pinned-default-filters.png',
                        alt: 'Filter panel with selected exam and year and the pin button highlighted',
                        icon: Pin,
                        tone: 'blue',
                        path: 'Filters → Pin',
                        steps: [
                          'Choose your filters.',
                          'Tap the Pin button.',
                          'They load next time. Tap Pin again to remove.',
                        ],
                      },
                      {
                        title: 'Review saved questions',
                        eyebrow: 'Saved questions',
                        description: 'Show only bookmarks or questions with notes.',
                        image: '/release-screenshots/notes-filter.png',
                        alt: 'Notes filter selected with saved notes displayed above matching questions',
                        icon: StickyNote,
                        tone: 'emerald',
                        path: 'Filters → Bookmark / Notes',
                        steps: [
                          'Tap Bookmark for saved questions.',
                          'Tap Notes for questions with notes.',
                          'Tap a note icon to view or edit.',
                        ],
                      },
                      {
                        title: 'Improve weak areas',
                        eyebrow: 'Progress report',
                        description: 'Use your report to plan revision.',
                        image: '/release-screenshots/workspace-report.png',
                        alt: 'My Workspace report with accuracy, strong areas, weak areas and subject performance bars',
                        icon: BarChart3,
                        tone: 'violet',
                        path: 'Profile menu → My Workspace → Report',
                        steps: [
                          'Open My Workspace and select Report.',
                          'Check accuracy, correct and wrong answers.',
                          'Revise topics listed under Needs Work.',
                        ],
                      },
                    ] as const).map(item => {
                      const WalkthroughIcon = item.icon;
                      const theme = item.tone === 'blue'
                        ? {
                            border: 'border-blue-200/80 dark:border-blue-500/20',
                            surface: 'from-blue-50/90 to-indigo-50/70 dark:from-blue-500/10 dark:to-indigo-500/5',
                            icon: 'from-blue-600 to-indigo-600 shadow-blue-600/20',
                            label: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
                            step: 'bg-blue-600',
                          }
                        : item.tone === 'emerald'
                        ? {
                            border: 'border-emerald-200/80 dark:border-emerald-500/20',
                            surface: 'from-emerald-50/90 to-teal-50/70 dark:from-emerald-500/10 dark:to-teal-500/5',
                            icon: 'from-emerald-600 to-teal-600 shadow-emerald-600/20',
                            label: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
                            step: 'bg-emerald-600',
                          }
                        : {
                            border: 'border-violet-200/80 dark:border-violet-500/20',
                            surface: 'from-violet-50/90 to-indigo-50/70 dark:from-violet-500/10 dark:to-indigo-500/5',
                            icon: 'from-violet-600 to-indigo-600 shadow-violet-600/20',
                            label: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
                            step: 'bg-violet-600',
                          };
                      return (
                        <article key={item.title} className={cn("overflow-hidden rounded-3xl border bg-white shadow-sm dark:bg-slate-800/70", theme.border)}>
                          <div className="grid xl:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.85fr)]">
                            <a
                              href={item.image}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn("group relative flex min-h-64 items-center justify-center overflow-hidden bg-gradient-to-br p-3 sm:p-4", theme.surface)}
                              title={`Open ${item.eyebrow.toLowerCase()} screenshot`}
                            >
                              <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle, rgba(99,102,241,0.35) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                              <img
                                src={item.image}
                                alt={item.alt}
                                loading="lazy"
                                className="relative max-h-[36rem] w-full rounded-2xl border border-white/60 object-contain shadow-2xl shadow-slate-950/20 transition duration-500 group-hover:scale-[1.01]"
                              />
                              <span className="absolute bottom-6 right-6 rounded-full bg-slate-950/75 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-md">
                                View full size
                              </span>
                            </a>

                            <div className="flex flex-col p-5 sm:p-6">
                              <div className="mb-4 flex items-start justify-between gap-3">
                                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg", theme.icon)}>
                                  <WalkthroughIcon className="h-5 w-5" />
                                </span>
                                <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide", theme.label)}>{item.eyebrow}</span>
                              </div>
                              <h4 className="text-lg font-extrabold text-slate-900 dark:text-white">{item.title}</h4>
                              <p className="mt-2 text-[12.5px] font-medium leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
                              <p className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-600 dark:bg-slate-700/70 dark:text-slate-300">{item.path}</p>
                              <ol className="mt-4 space-y-3">
                                {item.steps.map((step, stepIndex) => (
                                  <li key={step} className="flex gap-3">
                                    <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white shadow-sm", theme.step)}>
                                      {stepIndex + 1}
                                    </span>
                                    <p className="pt-0.5 text-[11.5px] font-medium leading-5 text-slate-600 dark:text-slate-300">{step}</p>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="hidden">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-6 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-700 text-white dark:bg-slate-600">
                        <RefreshCw className="h-4 w-4" />
                      </span>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Earlier this week</h3>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">14 September 2026</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {([
                      { title: 'Better paper filters', description: 'Separate Exam, Year and Paper filters.', icon: Filter },
                      { title: 'Saved defaults', description: 'Pin your preferred filter combination.', icon: Pin },
                      { title: 'Simpler exam names', description: 'Cleaner grouping for BPSC, CISF and EPFO.', icon: Tag },
                      { title: '638 new questions', description: 'More CDS, NDA, UKPSC and APFC PYQs.', icon: Database },
                      { title: 'Reliable loading', description: 'Safer loading of the complete question list.', icon: RefreshCw },
                    ] as const).map(item => {
                      const ItemIcon = item.icon;
                      return (
                        <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
                          <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                            <ItemIcon className="h-4.5 w-4.5" />
                          </span>
                          <h4 className="text-[13px] font-extrabold text-slate-900 dark:text-white">{item.title}</h4>
                          <p className="mt-1.5 text-[11.5px] leading-5 text-slate-500 dark:text-slate-400">{item.description}</p>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Founder Modal */}
      {showFounderModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-overlayFade" onClick={() => setShowFounderModal(false)}>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-md max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-modalPop" onClick={(e) => e.stopPropagation()}>
            <div className="relative shrink-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-6 pt-7 pb-7 text-center overflow-hidden">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
              <button
                onClick={() => setShowFounderModal(false)}
                className="absolute top-3 right-3 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="relative flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white font-extrabold text-2xl shadow-lg ring-2 ring-white/30">R</div>
                <h2 className="text-xl font-extrabold text-white mt-3">Rajendra</h2>
                <p className="text-indigo-100 text-xs font-medium mt-1">Founder · UPSC PYQ Powerhouse</p>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5">
              <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                <span className="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold">UPSC Interview Candidate</span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[10px] font-bold">105+ CSE Prelims 2025</span>
                <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300 text-[10px] font-bold">CAPF · CDS · NDA Qualified</span>
              </div>

              <p className="text-lg font-extrabold text-slate-900 dark:text-white text-center">A Note from the Founder</p>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mt-3">Every PYQ tells a story.</p>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mt-3">During my preparation, I realized that UPSC rarely asks questions in isolation—it often revisits ideas in new ways. The more PYQs I solved, the more the exam started to make sense.</p>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mt-3">That's why PowerHouse PYQ exists: to make quality PYQs simple, organized, and affordable, so every aspirant can spend less time searching and more time learning.</p>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mt-3">— Rajendra</p>

              <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3">
                <p className="text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">Built with <span className="text-rose-500">❤️</span></p>
                <p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400 mt-1">Powered by my brother, a software engineer at Microsoft and an IIT Delhi alumnus, who brings the technology behind the platform while I bring the UPSC journey behind it.</p>
                <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 mt-2">Built by aspirants, for aspirants.</p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                <a href="mailto:raj48354835@gmail.com" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  <Mail className="w-3.5 h-3.5" /> raj48354835@gmail.com
                </a>
                <a href="tel:+917665872210" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  <Phone className="w-3.5 h-3.5" /> +91 76658 72210
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legal / Policy Pages Modal */}
      {legalPage && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-5 sm:px-7 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{LEGAL_TITLES[legalPage]}</h2>
              <button
                onClick={() => setLegalPage(null)}
                className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0 px-5 sm:px-7 py-5">
              <LegalPageContent page={legalPage} />
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}
