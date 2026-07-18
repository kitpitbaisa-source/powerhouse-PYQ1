/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  Landmark, 
  Trophy, 
  Search, 
  RotateCcw, 
  LogOut,
  Dice5, 
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
  BarChart3
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

interface QuestionCardProps {
  question: Question;
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
  onSubjectClick?: (subject: string) => void;
  onTopicClick?: (topic: string) => void;
  onExamClick?: (exam: string) => void;
  onYearClick?: (year: string) => void;
  searchQuery?: string;
  isAdmin?: boolean;
  onUpdateQuestion?: (id: number, year: string, answer: string, explanation: string) => Promise<void>;
}

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

const HighlightText: React.FC<{ text: string | undefined; query: string }> = ({ text, query }) => {
  if (!text) return null;
  // First convert markdown bold to HTML
  const htmlText = parseMarkdownBold(text);
  
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

const QuestionCard: React.FC<QuestionCardProps> = ({ 
  question, 
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
  onSubjectClick,
  onTopicClick,
  onExamClick,
  onYearClick,
  searchQuery = "",
  isAdmin,
  onUpdateQuestion
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editAnswer, setEditAnswer] = useState("");
  const [editExplanation, setEditExplanation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const colorClasses = subjectColors[question.subject] || subjectColors["Default"];

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
          {question.topic && (
            <span 
              onClick={() => onTopicClick?.(question.topic!)}
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-slate-200 dark:ring-slate-600/70 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {question.topic}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onFeedback && (
            <button
              type="button"
              onClick={onFeedback}
              title="Report an issue or give feedback on this question"
              className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 p-1.5 rounded-full transition-colors focus:outline-none"
            >
              <MessageSquareText className="w-3.5 h-3.5" />
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
      
      <h3 className="text-[13.5px] font-medium text-slate-900 dark:text-slate-100 mb-3.5 leading-[21px] whitespace-pre-wrap px-1">
        <span className="inline-flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-bold px-2 py-0.5 mr-2 ring-1 ring-blue-500/20 align-middle">Q{question.id}</span>
        <HighlightText text={question.question} query={searchQuery} />
      </h3>
      
      <div className="space-y-2 mb-5 px-1">
        {(question.options || []).map(opt => {
          const isCorrectAnswer = opt === question.answer;
          const isSelected = opt === attemptedOption;
          const hasAttempted = !!attemptedOption;

          return (
            <button
              key={opt}
              disabled={hasAttempted}
              onClick={() => onOptionClick(opt)}
              className={cn(
                "w-full text-left py-2.5 px-4 border rounded-xl text-[13px] font-medium transition-all flex justify-between items-center group/btn leading-[19px]",
                !hasAttempted && "bg-slate-50/80 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600/70 text-slate-700 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-slate-600/70 hover:border-blue-300 dark:hover:border-blue-500/60 hover:shadow-sm cursor-pointer active:scale-[0.98]",
                hasAttempted && isCorrectAnswer && "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-500/10",
                hasAttempted && isSelected && !isCorrectAnswer && "bg-red-50 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-400 shadow-sm shadow-red-500/10",
                hasAttempted && !isCorrectAnswer && !isSelected && "bg-slate-50/50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 opacity-60"
              )}
            >
              <span className="text-left pr-3 leading-[19px]">
                <HighlightText text={opt} query={searchQuery} />
              </span>
              {hasAttempted && isCorrectAnswer && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-500 shrink-0" />}
              {hasAttempted && isSelected && !isCorrectAnswer && <XCircle className="w-4 h-4 text-red-600 dark:text-red-500 shrink-0" />}
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

          {/* Admin edit button */}
          {isAdmin && onUpdateQuestion && !isEditing && (
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

          {/* Admin edit form */}
          {isAdmin && isEditing && (
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
                  className="w-full text-xs border border-amber-300 dark:border-amber-600 rounded-none px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-y"
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
          {onFeedback && (
            <button
              type="button"
              onClick={onFeedback}
              title="Report an issue or give feedback on this question"
              className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 p-1.5 rounded-full transition-colors focus:outline-none"
            >
              <MessageSquareText className="w-3.5 h-3.5" />
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

      <h3 className="text-[13.5px] font-medium text-slate-900 dark:text-slate-100 mb-4 leading-[21px] whitespace-pre-wrap flex-grow">
        <HighlightText text={question.question} query={searchQuery} />
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
  const [isLoadingMains, setIsLoadingMains] = useState(false);
  const [isLoadingCSAT, setIsLoadingCSAT] = useState(false);
  const [isLoadingEnglish, setIsLoadingEnglish] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("All");
  const [examFilter, setExamFilter] = useState("All");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [topicFilter, setTopicFilter] = useState("All");
  const [mainsYearFilter, setMainsYearFilter] = useState("All");
  const [mainsExamFilter, setMainsExamFilter] = useState("All");
  const [mainsSubjectFilter, setMainsSubjectFilter] = useState("All");
  const [mainsTopicFilter, setMainsTopicFilter] = useState("All");
  const [mainsSearchQuery, setMainsSearchQuery] = useState("");
  const [excludeSciMath, setExcludeSciMath] = useState(false);
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
  
  const [englishYearFilter, setEnglishYearFilter] = useState("All");
  const [englishSubjectFilter, setEnglishSubjectFilter] = useState("All");
  const [englishTopicFilter, setEnglishTopicFilter] = useState("All");
  const [englishExamFilter, setEnglishExamFilter] = useState("All");
  const [englishSearchQuery, setEnglishSearchQuery] = useState("");
  const [englishVisibleCount, setEnglishVisibleCount] = useState(30);
  const [englishRandomMode, setEnglishRandomMode] = useState(false);
  const [englishRandomizedQuestions, setEnglishRandomizedQuestions] = useState<Question[]>([]);
  const [englishRandomSelectLimit, setEnglishRandomSelectLimit] = useState(10);

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
  const [isAdminView, setIsAdminView] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
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

  const fetchQuestions = async (showLoading = true) => {
    if (showLoading) setIsLoadingQuestions(true);
    try {
      console.log("Fetching questions from API...");
      const response = await fetch('/api/questions');
      if (!response.ok) throw new Error("API response not ok");
      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        console.log(`Loaded ${data.length} questions from API`);
       // Keep the 100 shown locally, then append remaining questions from API (avoid duplicates)
       setQuestions(prev => {
         const existingIds = new Set(prev.map(q => q.id));
         const newQuestions = data.filter(q => !existingIds.has(q.id));
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
    }
  };

  const fetchMainsQuestions = async () => {
    setIsLoadingMains(true);
    try {
      console.log("Fetching mains questions from API...");
      const response = await fetch('/api/mains-questions');
      if (!response.ok) throw new Error("API response not ok");
      const data = await response.json();
      setMainsQuestions(Array.isArray(data) ? data : []);
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
      setCSATQuestions(Array.isArray(data) ? data : []);
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
      setEnglishQuestions(Array.isArray(data) ? data : []);
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
        setQuestions(data as Question[]);
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
      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, plan }),
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
    // Keep the loader running until the first batch of prelims has loaded
    setIsLoadingQuestions(true);
    // Load the first batch of prelims from the backend (falls back to local data)
    fetchInitialQuestions().finally(() => setIsLoadingQuestions(false));

    // Restore previously saved scroll position
    const savedVisibleCount = localStorage.getItem('visibleCount');
    const initialCount = savedVisibleCount ? parseInt(savedVisibleCount) : 100;
    setVisibleCount(initialCount);

    // Scroll to saved position after a brief delay to let DOM render
    const scrollTimer = setTimeout(() => {
      if (savedVisibleCount) {
        window.scrollTo(0, 0); // Start from top for fresh load
      }
    }, 500);

    // Then fetch all prelims from API in background (already filtered on server, returns ~9.5k)
    // Delay this more so 100 questions display first
    const fetchTimer = setTimeout(() => {
      // Fetch in background without showing loading spinner
      fetchQuestions(false);
      // Fetch other sections from API only
      fetchMainsQuestions();
      fetchToppersQuestions();
      fetchCSATQuestions();
      fetchEnglishQuestions();
    }, 1000);
    
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(fetchTimer);
    };
  }, []);

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

  const filteredCSATQuestions = useMemo(() => {
    if (csatRandomMode) return csatRandomizedQuestions;
    return csatQuestions
      .filter(q => {
        const matchesYear = csatYearFilter === "All" || q.year === csatYearFilter;
        const matchesSubject = csatSubjectFilter === "All" || q.subject === csatSubjectFilter;
        const matchesSearch = csatSearchQuery === "" || 
          (q.question || "").toLowerCase().includes(csatSearchQuery.toLowerCase()) ||
          (q.options || []).some(opt => (opt || "").toLowerCase().includes(csatSearchQuery.toLowerCase()));
        return matchesYear && matchesSubject && matchesSearch;
      })
      .sort((a, b) => String(b.year).localeCompare(String(a.year)) || String(a.id).localeCompare(String(b.id)))
      .slice(0, csatVisibleCount);
  }, [csatQuestions, csatYearFilter, csatSubjectFilter, csatSearchQuery, csatRandomMode, csatRandomizedQuestions, csatVisibleCount]);

  // English filter lists
  const englishYearsList = useMemo(() => {
    const years = [...new Set(englishQuestions.map(q => q.year))].sort((a, b) => (b as string).localeCompare(a as string));
    const counts: Record<string, number> = {};
    englishQuestions.forEach(q => {
      counts[q.year] = (counts[q.year] || 0) + 1;
    });
    return { options: ["All", ...years], counts };
  }, [englishQuestions]);

  const englishSubjectsList = useMemo(() => {
    const filtered = englishQuestions.filter(q => (englishYearFilter === "All" || q.year === englishYearFilter) && (englishExamFilter === "All" || q.exam === englishExamFilter));
    const subjects = [...new Set(filtered.map(q => q.subject))].sort();
    const counts: Record<string, number> = {};
    filtered.forEach(q => {
      counts[q.subject] = (counts[q.subject] || 0) + 1;
    });
    return { options: ["All", ...subjects], counts };
  }, [englishQuestions, englishYearFilter, englishExamFilter]);

  const englishTopicsList = useMemo(() => {
    const filtered = englishQuestions.filter(q => (englishYearFilter === "All" || q.year === englishYearFilter) && (englishExamFilter === "All" || q.exam === englishExamFilter));
    const topics = [...new Set(filtered.map(q => q.topic).filter(Boolean))].sort();
    const counts: Record<string, number> = {};
    filtered.forEach(q => {
      if (q.topic) counts[q.topic] = (counts[q.topic] || 0) + 1;
    });
    return { options: ["All", ...topics], counts };
  }, [englishQuestions, englishYearFilter, englishExamFilter]);

  const englishExamsList = useMemo(() => {
    const exams = [...new Set(englishQuestions.map(q => q.exam).filter(Boolean))].sort();
    const counts: Record<string, number> = {};
    englishQuestions.forEach(q => {
      if (q.exam) counts[q.exam] = (counts[q.exam] || 0) + 1;
    });
    return { options: ["All", ...exams], counts };
  }, [englishQuestions]);

  const filteredEnglishQuestions = useMemo(() => {
    if (englishRandomMode) return englishRandomizedQuestions;
    return englishQuestions
      .filter(q => {
        const matchesYear = englishYearFilter === "All" || q.year === englishYearFilter;
        const matchesSubject = englishSubjectFilter === "All" || q.subject === englishSubjectFilter;
        const matchesTopic = englishTopicFilter === "All" || q.topic === englishTopicFilter;
        const matchesExam = englishExamFilter === "All" || q.exam === englishExamFilter;
        const matchesSearch = englishSearchQuery === "" || 
          (q.question || "").toLowerCase().includes(englishSearchQuery.toLowerCase()) ||
          (q.options || []).some(opt => (opt || "").toLowerCase().includes(englishSearchQuery.toLowerCase()));
        return matchesYear && matchesSubject && matchesTopic && matchesExam && matchesSearch;
      })
      .sort((a, b) => String(b.year).localeCompare(String(a.year)) || String(a.id).localeCompare(String(b.id)))
      .slice(0, englishVisibleCount);
  }, [englishQuestions, englishYearFilter, englishSubjectFilter, englishTopicFilter, englishExamFilter, englishSearchQuery, englishRandomMode, englishRandomizedQuestions, englishVisibleCount]);

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
    if (!k) { setAdminUnlocked(false); return false; }
    try {
      const res = await fetch('/api/admin/verify', { headers: { Authorization: `Bearer ${k}` } });
      if (res.ok) {
        localStorage.setItem('admin_api_key', k);
        localStorage.setItem('admin_unlock_expiry', String(Date.now() + ADMIN_UNLOCK_MS));
        setAdminKey(k);
        setAdminUnlocked(true);
        return true;
      }
    } catch { /* ignore */ }
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
      setIsSubscribed(data.status === 'subscribed' || data.status === 'admin');
      // Admin status is decided solely by the backend role; never trust the client.
      setIsAdmin(data.status === 'admin');
    } catch (error) {
      console.error("Failed to check status:", error);
      setIsSubscribed(false);
      setIsAdmin(false);
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

  // ── Performance report (opened from the header chart icon) ──
  type ReportBucket = { correct: number; total: number };
  type ReportAttempt = { questionId?: number; questionType: string; subject: string | null; topic: string | null; isCorrect: boolean; attemptId?: string | null; ts?: string };
  type ReportData = {
    attempts: ReportAttempt[];
    score: ReportBucket;
    sections: Record<string, ReportBucket>;
    subjects: Record<string, ReportBucket>;
    topics: Record<string, ReportBucket & { subject: string | null }>;
    attemptCount: number;
  };
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const openReport = async () => {
    setShowReport(true);
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
  const [legalPage, setLegalPage] = useState<null | 'about' | 'contact' | 'privacy' | 'terms' | 'refund'>(null);
  const [showFounderModal, setShowFounderModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<null | '1yr' | '2yr' | 'ebooks'>(null);

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

  useEffect(() => {
    if (adminUnlocked && isAdminView) fetchAdminFeedback();
  }, [isAdmin, isAdminView, fetchAdminFeedback]);

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
  const [isAdminUserStatus, setIsAdminUserStatus] = useState<"subscribed" | "not_subscribed" | "admin">("subscribed");
  const [adminMessage, setAdminMessage] = useState({ text: "", type: "" });
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [expandedUserHistory, setExpandedUserHistory] = useState<string | null>(null);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeSessionsMap, setActiveSessionsMap] = useState<Record<string, number>>({});

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
    if (isAdmin && userEmail) {
      fetchAllUsers();
      fetchActiveSessions();
    }
  }, [isAdmin, userEmail]);

  const handleUpdateUser = async (email: string, status: string) => {
    if (!requireAdminKey()) return;
    const userEmailToUpdate = email.toLowerCase().trim();
    try {
      console.log(`Updating user ${userEmailToUpdate} to ${status}...`);
      const response = await fetch('/api/admin/update-status', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ email: userEmailToUpdate, status })
      });

      if (response.ok) {
        setAdminMessage({ text: `User ${userEmailToUpdate} updated to ${status}`, type: "success" });
        setTimeout(() => setAdminMessage({ text: "", type: "" }), 3000);
        fetchAllUsers();
        if (userEmailToUpdate === userEmail) checkUserStatus(userEmailToUpdate);
        return;
      } else {
        const err = await response.json().catch(() => ({ error: "Unknown server error" }));
        throw new Error(err.details || err.error || "Server failed");
      }
    } catch (error: any) {
      console.error("Failed to update user:", error.message || error);
      setAdminMessage({ text: `Failed: ${error.message || "Server error"}`, type: "error" });
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
    await handleUpdateUser(isAdminUserEmail.trim(), isAdminUserStatus);
    setIsAdminUserEmail("");
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
      (examFilter === "All" || q.exam === examFilter) &&
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
  }, [questions, examFilter, subjectFilter, topicFilter]);

  const examsList = useMemo(() => {
    const availableData = questions.filter(q => 
      (yearFilter === "All" || q.year === yearFilter) &&
      (subjectFilter === "All" || q.subject === subjectFilter) &&
      (topicFilter === "All" || q.topic === topicFilter)
    );
    const uniqueExams = [...new Set(availableData.map(q => q.exam))].sort();
    
    const examCounts: Record<string, number> = {};
    availableData.forEach(q => {
      examCounts[q.exam] = (examCounts[q.exam] || 0) + 1;
    });

    return { 
      options: ["All", ...uniqueExams],
      counts: examCounts
    };
  }, [questions, yearFilter, subjectFilter, topicFilter]);

  const subjectsList = useMemo(() => {
    const availableData = questions.filter(q => 
      (yearFilter === "All" || q.year === yearFilter) &&
      (examFilter === "All" || q.exam === examFilter) &&
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
  }, [questions, yearFilter, examFilter, topicFilter]);

  const topicsList = useMemo(() => {
    const availableData = questions.filter(q => 
      (yearFilter === "All" || q.year === yearFilter) &&
      (examFilter === "All" || q.exam === examFilter) &&
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
  }, [questions, yearFilter, examFilter, subjectFilter]);

  // Auto-reset filters if selected option is no longer available
  useEffect(() => {
    if (yearFilter !== "All" && !yearsList.options.includes(yearFilter)) {
      setYearFilter("All");
    }
  }, [yearsList.options, yearFilter]);

  useEffect(() => {
    if (examFilter !== "All" && !examsList.options.includes(examFilter)) {
      setExamFilter("All");
    }
  }, [examsList.options, examFilter]);

  useEffect(() => {
    if (subjectFilter !== "All" && !subjectsList.options.includes(subjectFilter)) {
      setSubjectFilter("All");
    }
  }, [subjectsList.options, subjectFilter]);

  useEffect(() => {
    if (topicFilter !== "All" && !topicsList.options.includes(topicFilter)) {
      setTopicFilter("All");
    }
  }, [topicsList.options, topicFilter]);

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

  const filteredQuestions = useMemo(() => {
    if (randomMode.active) {
      return randomizedQuestions;
    }

    const list = questions.filter(q => {
      // Skip questions without valid question text
      if (!q.question || q.question.trim() === '' || q.question.startsWith('Q_')) return false;
      
      const marchesYear = yearFilter === "All" || q.year === yearFilter;
      const matchesExam = examFilter === "All" || q.exam === examFilter;
      const matchesSubject = (subjectFilter === "All" || q.subject === subjectFilter) && 
                            (!excludeSciMath || (q.subject !== "Science & Technology" && q.subject !== "Mathematics" && q.subject !== "Science"));
      const matchesTopic = topicFilter === "All" || q.topic === topicFilter;
      const matchesSearch = searchQuery === "" || 
        (q.question || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.explanation || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.options || []).some(opt => (opt || "").toLowerCase().includes(searchQuery.toLowerCase()));
      
      return marchesYear && matchesExam && matchesSubject && matchesTopic && matchesSearch;
    }).sort((a, b) => {
      // Sort by year descending
      const yearComparison = String(b.year).localeCompare(String(a.year));
      if (yearComparison !== 0) return yearComparison;
      // If same year, sort by id descending
      return b.id - a.id;
    });

    return list.slice(0, visibleCount);
  }, [questions, yearFilter, examFilter, subjectFilter, topicFilter, searchQuery, visibleCount, randomMode, randomizedQuestions]);

  const isMoreToLoad = useMemo(() => {
    if (randomMode.active) return false;
    const totalFiltered = questions.filter(q => {
      const marchesYear = yearFilter === "All" || q.year === yearFilter;
      const matchesExam = examFilter === "All" || q.exam === examFilter;
      const matchesSubject = (subjectFilter === "All" || q.subject === subjectFilter) && 
                            (!excludeSciMath || (q.subject !== "Science & Technology" && q.subject !== "Mathematics" && q.subject !== "Science"));
      const matchesTopic = topicFilter === "All" || q.topic === topicFilter;
      const matchesSearch = searchQuery === "" || 
        (q.question || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.explanation || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.options || []).some(opt => (opt || "").toLowerCase().includes(searchQuery.toLowerCase()));
      
      return marchesYear && matchesExam && matchesSubject && matchesTopic && matchesSearch;
    }).length;
    return totalFiltered > visibleCount;
  }, [questions, yearFilter, examFilter, subjectFilter, topicFilter, searchQuery, visibleCount, randomMode]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + 150);
  }, []);

  const handleMainsLoadMore = useCallback(() => {
    setMainsVisibleCount(prev => prev + 50);
  }, []);

  // Infinite scroll: load more on scroll near bottom
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 2500
      ) {
        if (activeTab === 'prelims') handleLoadMore();
        else if (activeTab === 'mains') handleMainsLoadMore();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleLoadMore, handleMainsLoadMore, activeTab]);

  // Reset mains pagination on filter change
  useEffect(() => {
    setMainsVisibleCount(30);
  }, [mainsYearFilter, mainsExamFilter, mainsSubjectFilter, mainsTopicFilter, mainsSearchQuery]);

  const handleOptionClick = (qid: number, option: string, isCorrect: boolean, questionType: string = 'prelims', subject?: string, topic?: string) => {
    if (userAttempts[qid]) return;
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
    // Persist the attempt (id + correct/wrong) for the logged-in user so the score survives reloads.
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

  const handleUpdateQuestion = async (id: number, year: string, answer: string, explanation: string) => {
    const res = await fetch("/api/admin/update-question", {
      method: "PATCH",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id, answer, explanation }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert("Update failed: " + (err.error || "Unknown error"));
      throw new Error(err.error);
    }
    const data = await res.json();
    // Update local state so the card reflects changes immediately
    setQuestions(prev => prev.map(q =>
      q.id === id ? { ...q, answer: data.answer, explanation: data.explanation } : q
    ));
  };

  const resetFilters = () => {
    setYearFilter("All");
    setExamFilter("All");
    setSubjectFilter("All");
    setTopicFilter("All");
    setExcludeSciMath(false);
    setSearchQuery("");
    setVisibleCount(30);
    setRandomMode({ active: false, limit: 0 });
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
  }, [yearFilter, examFilter, subjectFilter, topicFilter, searchQuery]);

  const resetQuiz = () => {
    setUserAttempts({});
    setRevealedAnswers({});
    setScore({ correct: 0, total: 0 });
    setSectionScores({});
    setAttemptId(newAttemptId());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // An attempt = one practice run until the user presses Reset or reloads the page.
  // We do NOT restore prior runs onto the screen; each load starts a fresh attempt.
  // Every answered question is still saved to the DB (grouped by attemptId) for the record.

  // Reusable score chip (used by Prelims, CSAT and English section headers).
  const renderScoreChip = (sc: { correct: number; total: number }) => {
    const pct = sc.total > 0 ? sc.correct / sc.total : 0;
    const low = sc.total > 0 && pct < 0.5;
    const C = 2 * Math.PI * 13;
    return (
      <div className={cn(
        "h-[38px] pl-1.5 pr-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 shadow-sm backdrop-blur-sm",
        low
          ? "bg-red-50/80 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/25"
          : "bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25"
      )}>
        <div className="relative w-7 h-7 flex-shrink-0">
          <svg className="w-7 h-7 -rotate-90" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="13" fill="none" strokeWidth="3" className="stroke-slate-200/70 dark:stroke-slate-700" />
            <circle cx="16" cy="16" r="13" fill="none" strokeWidth="3" strokeLinecap="round"
              className={low ? "stroke-red-500" : "stroke-emerald-500"}
              style={{ strokeDasharray: C, strokeDashoffset: C * (1 - pct), transition: 'stroke-dashoffset 0.5s ease' }} />
          </svg>
          <span className={cn("absolute inset-0 flex items-center justify-center text-[8px] font-extrabold", low ? "text-red-500" : "text-emerald-500")}>
            {sc.total > 0 ? `${Math.round(pct * 100)}%` : <Trophy className="w-2.5 h-2.5" />}
          </span>
        </div>
        <div className="flex items-baseline gap-0.5 leading-none">
          <span className="text-[13px] tabular-nums">{sc.correct}</span>
          <span className="text-[10px] font-medium opacity-60">/</span>
          <span className="text-[13px] tabular-nums opacity-70">{sc.total}</span>
        </div>
        {sc.total > 0 && (
          <button onClick={resetQuiz} title="Reset Score" className="ml-0.5 w-5 h-5 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors">
            <X className="w-3 h-3" strokeWidth={2.5} />
          </button>
        )}
      </div>
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
      const matchesExam = examFilter === "All" || q.exam === examFilter;
      const matchesSubject = (subjectFilter === "All" || q.subject === subjectFilter) && 
                            (!excludeSciMath || (q.subject !== "Science & Technology" && q.subject !== "Mathematics" && q.subject !== "Science"));
      const matchesTopic = topicFilter === "All" || q.topic === topicFilter;
      const matchesSearch = searchQuery === "" || 
        (q.question || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.explanation || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.options || []).some(opt => (opt || "").toLowerCase().includes(searchQuery.toLowerCase()));

      return marchesYear && matchesExam && matchesSubject && matchesTopic && matchesSearch;
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
      const matchesSearch = csatSearchQuery === "" || (q.question || "").toLowerCase().includes(csatSearchQuery.toLowerCase());
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
      const matchesSearch = englishSearchQuery === "" || (q.question || "").toLowerCase().includes(englishSearchQuery.toLowerCase());
      return matchesYear && matchesSubject && matchesSearch;
    });

    const shuffled = [...baseList].sort(() => Math.random() - 0.5);
    setEnglishRandomizedQuestions(shuffled.slice(0, limit));
    setEnglishRandomMode(true);
  };

  return (
    <div className={cn("min-h-screen", isDarkMode ? "dark" : "")}>
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
              <div className="app-tab-scroll flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700 ml-1 sm:ml-2">
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
                    onClick={() => setActiveTab(tab.id)}
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
                  <FancySelect
                    value={String(randomSelectLimit)}
                    onChange={(v) => setRandomSelectLimit(Number(v))}
                    size="sm"
                    ariaLabel="Random question count"
                    buttonClassName="!bg-transparent !border-none !shadow-none !ring-0 px-1.5"
                    options={[10, 20, 50, 100].map(n => ({ value: String(n), label: String(n) }))}
                  />
                  <button
                    onClick={() => startRandomPractice(randomSelectLimit)}
                    title={isSubscribed ? "Start Random Practice" : "Random Practice (Limited to Latest 2 Years)"}
                    className="px-2.5 py-1 rounded-md transition-all text-[11px] font-bold flex items-center gap-1.5 bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white active:scale-95 shadow-md shadow-blue-600/25"
                  >
                    <Dice5 className="w-3 h-3" />
                    <span className="hidden sm:inline">Random PYQ</span>
                    <span className="sm:hidden">Random</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'mains' && (
              <div className="flex items-center gap-2 order-3 lg:order-none">
                <div className="flex items-center gap-1 h-[38px] bg-slate-100 dark:bg-slate-700 p-1 rounded-xl border border-slate-200 dark:border-slate-600">
                  <FancySelect
                    value={String(mainsRandomSelectLimit)}
                    onChange={(v) => setMainsRandomSelectLimit(Number(v))}
                    size="sm"
                    ariaLabel="Random question count"
                    buttonClassName="!bg-transparent !border-none !shadow-none !ring-0 px-1.5"
                    options={[5, 10, 20, 50].map(n => ({ value: String(n), label: String(n) }))}
                  />
                  <button
                    onClick={() => startMainsRandomPractice(mainsRandomSelectLimit)}
                    className="px-2.5 py-1 rounded-md transition-all text-[11px] font-bold flex items-center gap-1.5 bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white active:scale-95 shadow-md shadow-blue-600/25"
                  >
                    <Dice5 className="w-3 h-3" />
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
                  <FancySelect
                    value={String(csatRandomSelectLimit)}
                    onChange={(v) => setCSATRandomSelectLimit(Number(v))}
                    size="sm"
                    ariaLabel="Random question count"
                    buttonClassName="!bg-transparent !border-none !shadow-none !ring-0 px-1.5"
                    options={[10, 20, 50, 100].map(n => ({ value: String(n), label: String(n) }))}
                  />
                  <button
                    onClick={() => startCSATRandomPractice(csatRandomSelectLimit)}
                    className="px-2.5 py-1 rounded-md transition-all text-[11px] font-bold flex items-center gap-1.5 bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white active:scale-95 shadow-md shadow-blue-600/25"
                  >
                    <Dice5 className="w-3 h-3" />
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
                  <FancySelect
                    value={String(englishRandomSelectLimit)}
                    onChange={(v) => setEnglishRandomSelectLimit(Number(v))}
                    size="sm"
                    ariaLabel="Random question count"
                    buttonClassName="!bg-transparent !border-none !shadow-none !ring-0 px-1.5"
                    options={[10, 20, 50, 100].map(n => ({ value: String(n), label: String(n) }))}
                  />
                  <button
                    onClick={() => startEnglishRandomPractice(englishRandomSelectLimit)}
                    className="px-2.5 py-1 rounded-md transition-all text-[11px] font-bold flex items-center gap-1.5 bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white active:scale-95 shadow-md shadow-blue-600/25"
                  >
                    <Dice5 className="w-3 h-3" />
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

                  {/* My report */}
                  {userEmail && (
                    <button
                      onClick={() => { openReport(); setIsUserMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <BarChart3 className="w-4 h-4 text-indigo-500" />
                      </span>
                      <span>My report</span>
                    </button>
                  )}

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
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-bold"
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
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-none text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                {!adminUnlocked && (
                  <button
                    onClick={async () => {
                      const ok = await verifyAdminKey(adminKey);
                      if (!ok) setAdminMessage({ text: "Invalid admin key.", type: "error" });
                    }}
                    className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all"
                  >
                    Verify & Unlock
                  </button>
                )}
                {adminKey && (
                  <button
                    onClick={() => { saveAdminKey(""); localStorage.removeItem('admin_unlock_expiry'); setAdminUnlocked(false); }}
                    className="mt-2 w-full py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-xs font-bold transition-all"
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
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-none text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase">Status</label>
                    <FancySelect
                      value={isAdminUserStatus}
                      onChange={(v) => setIsAdminUserStatus(v as "subscribed" | "not_subscribed" | "admin")}
                      ariaLabel="Status"
                      buttonClassName="px-4 py-2"
                      options={[
                        { value: "subscribed", label: "Subscribed" },
                        { value: "not_subscribed", label: "Not Subscribed" },
                        { value: "admin", label: "Admin" },
                      ]}
                    />
                  </div>
                  <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition-all shadow-lg shadow-blue-600/20">
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
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition-all shadow-lg shadow-blue-600/20"
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
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold rounded-lg text-sm transition-all shadow-lg shadow-blue-600/20"
                  >
                    {savingPrices ? "Saving..." : "Save Prices"}
                  </button>
                </div>
              </div>
              </>)}
              </div>

              {/* User List */}
              <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 dark:text-white">All Registered Users ({allUsers.length})</h3>
                  <button onClick={() => { fetchAllUsers(); fetchActiveSessions(); }} className="text-xs font-bold text-blue-500 hover:underline">Refresh</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/30 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
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
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 animate-pulse">
                           Loading user database...
                         </td>
                       </tr>
                     ) : allUsers.length === 0 ? (
                       <tr>
                         <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                           No users found in database.
                         </td>
                       </tr>
                     ) : allUsers.map((user) => (
                       <React.Fragment key={user.email}>
                       <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors">
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
                                 : user.status === 'subscribed' 
                                 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' 
                                 : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600'
                             }`}>
                               {user.status}
                             </span>
                             <div className="flex gap-1 mt-1">
                               <button onClick={() => handleUpdateUser(user.email, 'subscribed')} className="text-[8px] text-slate-400 hover:text-emerald-500 font-bold uppercase transition-colors">Sub</button>
                               <button onClick={() => handleUpdateUser(user.email, 'not_subscribed')} className="text-[8px] text-slate-400 hover:text-slate-200 font-bold uppercase transition-colors">None</button>
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
                         </td>
                       </tr>
                       {expandedUserHistory === user.email && (
                         <tr>
                           <td colSpan={5} className="px-6 py-3 bg-slate-50/50 dark:bg-slate-900/40">
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
            </div>

            {/* All User Feedback */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="w-5 h-5 text-blue-500" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">User Feedback</h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">{adminFeedback.length}</span>
                </div>
                <button
                  onClick={fetchAdminFeedback}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
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
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
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
                      <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{f.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
              "w-72 lg:w-80 flex-shrink-0 md:sticky md:top-24 md:block",
              isMobileFiltersOpen ? "block" : "hidden"
            )}>
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl p-5 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-black/20 border border-slate-200/70 dark:border-slate-700/70">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                <Filter className="w-4 h-4 mr-2 text-blue-500" /> Filters
              </h2>
              <button 
                onClick={resetFilters} 
                className="text-[11px] font-bold text-white bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-1 px-2.5 rounded-lg transition-all active:scale-95 shadow-md shadow-blue-600/25 flex items-center gap-1"
              >
                Reset
              </button>
            </div>

            <div className="mb-4">
              <label htmlFor="search-input" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Search Keywords</label>
              <div className="relative">
                <input 
                  type="text" 
                  id="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Constitution, GDP..." 
                  className="w-full border-slate-200 dark:border-slate-600 rounded-none shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 pr-8 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                />
                <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              </div>
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
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Examination</label>
              <FancySelect
                value={examFilter}
                onChange={(v) => setExamFilter(v)}
                ariaLabel="Examination"
                options={examsList.options.map(e => ({ value: e, label: e === "All" ? "All Exams" : `${e} (${examsList.counts[e] || 0})` }))}
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
              
              <button
                onClick={() => setExcludeSciMath(!excludeSciMath)}
                className={cn(
                  "mt-2 w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all border shadow-sm",
                  excludeSciMath 
                    ? "bg-rose-100 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400" 
                    : "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600"
                )}
              >
                {excludeSciMath ? (
                  <><XCircle className="w-3 h-3" /> Science & Math Removed</>
                ) : (
                  <><Filter className="w-3 h-3" /> Remove Science & Math</>
                )}
              </button>
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
                        index={idx}
                        attemptedOption={userAttempts[q.id]}
                        isRevealed={revealedAnswers[q.id]}
                        onOptionClick={(opt) => handleOptionClick(q.id, opt, opt === q.answer, 'prelims', q.subject, q.topic)}
                        onToggleRevealed={() => toggleAnswer(q.id)}
                        isLocked={isLocked}
                        userEmail={userEmail}
                        onOpenPremium={() => setShowPremiumModal(true)}
                        onFeedback={() => openFeedback(q.id, 'prelims')}
                        searchQuery={searchQuery}
                        isAdmin={isAdmin}
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
                          setExamFilter(exam);
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
              "w-72 lg:w-80 flex-shrink-0 md:sticky md:top-24 md:block",
              isMobileFiltersOpen ? "block" : "hidden"
            )}>
              <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl p-5 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-black/20 border border-slate-200/70 dark:border-slate-700/70">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                    <Filter className="w-4 h-4 mr-2 text-blue-500" /> Filters
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
                      placeholder="Essay, governance..."
                      className="w-full border-slate-200 dark:border-slate-600 rounded-none shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 pr-8 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
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
              "w-72 lg:w-80 flex-shrink-0 md:sticky md:top-24 md:block",
              isMobileFiltersOpen ? "block" : "hidden"
            )}>
              <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl p-5 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-black/20 border border-slate-200/70 dark:border-slate-700/70">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                    <Filter className="w-4 h-4 mr-2 text-blue-500" /> Filters
                  </h2>
                  <button
                    onClick={() => {
                      setCSATYearFilter("All");
                      setCSATSubjectFilter("All");
                      setCSATSearchQuery("");
                      setCSATVisibleCount(30);
                      setCSATRandomMode(false);
                    }}
                    className="text-[11px] font-bold text-white bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-1 px-2.5 rounded-lg transition-all active:scale-95 shadow-md shadow-blue-600/25 flex items-center gap-1"
                  >
                    Reset
                  </button>
                </div>

                <div className="mb-4">
                  <label htmlFor="csat-search" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Search Keywords</label>
                  <div className="relative">
                    <input
                      type="text"
                      id="csat-search"
                      value={csatSearchQuery}
                      onChange={(e) => setCSATSearchQuery(e.target.value)}
                      placeholder="Reasoning, logic..."
                      className="w-full border-slate-200 dark:border-slate-600 rounded-none shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 pr-8 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
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
              "w-72 lg:w-80 flex-shrink-0 md:sticky md:top-24 md:block",
              isMobileFiltersOpen ? "block" : "hidden"
            )}>
              <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl p-5 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-black/20 border border-slate-200/70 dark:border-slate-700/70">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                    <Filter className="w-4 h-4 mr-2 text-blue-500" /> Filters
                  </h2>
                  <button
                    onClick={() => {
                      setEnglishYearFilter("All");
                      setEnglishSubjectFilter("All");
                      setEnglishExamFilter("All");
                      setEnglishSearchQuery("");
                      setEnglishVisibleCount(30);
                      setEnglishRandomMode(false);
                    }}
                    className="text-[11px] font-bold text-white bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-1 px-2.5 rounded-lg transition-all active:scale-95 shadow-md shadow-blue-600/25 flex items-center gap-1"
                  >
                    Reset
                  </button>
                </div>

                <div className="mb-4">
                  <label htmlFor="english-search" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Search Keywords</label>
                  <div className="relative">
                    <input
                      type="text"
                      id="english-search"
                      value={englishSearchQuery}
                      onChange={(e) => setEnglishSearchQuery(e.target.value)}
                      placeholder="Vocabulary, grammar..."
                      className="w-full border-slate-200 dark:border-slate-600 rounded-none shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 pr-8 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                    />
                    <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Exam</label>
                  <FancySelect
                    value={englishExamFilter}
                    onChange={(v) => setEnglishExamFilter(v)}
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
                          index={idx}
                          attemptedOption={userAttempts[q.id]}
                          isRevealed={revealedAnswers[q.id]}
                          onOptionClick={(opt) => handleOptionClick(q.id, opt, opt === q.answer, 'english', q.subject, q.topic)}
                          onToggleRevealed={() => toggleAnswer(q.id)}
                          isLocked={isLocked}
                          userEmail={userEmail}
                          searchQuery={englishSearchQuery}
                          onOpenPremium={() => setShowPremiumModal(true)}
                          onFeedback={() => openFeedback(q.id, 'english')}
                          onSubjectClick={(subject) => {
                            setEnglishSubjectFilter(subject);
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
                        placeholder="Search questions..."
                        className="w-full border-slate-200 dark:border-slate-600 rounded-none shadow-sm text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
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
                            {q.marks && <span className="text-[10px] px-2 py-0.5 text-blue-400 dark:text-blue-300 font-medium">{q.marks} marks</span>}
                            {q.words && <span className="text-[10px] px-2 py-0.5 text-blue-400 dark:text-blue-300 font-medium">{q.words} words</span>}
                            <button
                              type="button"
                              onClick={() => openFeedback(q.id, 'toppers')}
                              title="Report an issue or give feedback on this question"
                              className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 p-1.5 rounded-full transition-colors focus:outline-none"
                            >
                              <MessageSquareText className="w-3.5 h-3.5" />
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
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-overlayFade">
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-modalPop">
            {/* Gradient header */}
            <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 px-6 py-5 text-center overflow-hidden">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="absolute top-3 right-3 text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-11 h-11 mx-auto mb-2 rounded-2xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center">
                <MessageSquareText className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">
                {feedbackTarget.questionId != null ? 'Feedback on this question' : 'Send Feedback'}
              </h2>
              <p className="text-[11px] text-white/80 mt-0.5">
                {feedbackTarget.questionId != null
                  ? `${feedbackTarget.questionType.toUpperCase()} · Q#${feedbackTarget.questionId}`
                  : 'Tell us what we can improve'}
              </p>
            </div>

            <div className="p-6">
              {feedbackDone ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Thank you!</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Your feedback has been received.</p>
                  <button
                    onClick={() => setShowFeedbackModal(false)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold transition-all active:scale-95 shadow-md shadow-blue-600/25"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Your name / alias <span className="font-normal text-slate-400">(optional)</span></label>
                  <input
                    type="text"
                    value={feedbackAlias}
                    onChange={(e) => setFeedbackAlias(e.target.value)}
                    placeholder="Anonymous"
                    className="w-full mb-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm p-2.5 text-slate-900 dark:text-white placeholder-slate-400"
                  />
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Feedback</label>
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    rows={4}
                    placeholder={feedbackTarget.questionId != null ? "Is something wrong with this question? Let us know…" : "Share your suggestions, issues, or ideas…"}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm p-2.5 text-slate-900 dark:text-white placeholder-slate-400 resize-none"
                  />
                  {feedbackError && <p className="text-xs text-rose-500 mt-2">{feedbackError}</p>}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setShowFeedbackModal(false)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitFeedback}
                      disabled={feedbackSubmitting || !feedbackComment.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold transition-all active:scale-95 shadow-md shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      {feedbackSubmitting ? 'Sending…' : (<><Send className="w-3.5 h-3.5" /> Send</>)}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
                <BarChart3 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <h2 className="text-sm font-bold text-indigo-900 dark:text-slate-100 leading-tight">My Performance Report</h2>
                <span className="text-[11px] text-indigo-400/80 dark:text-slate-500 truncate hidden sm:inline">· {userEmail || 'Not signed in'}</span>
              </div>
              <button
                onClick={() => setShowReport(false)}
                className="p-1.5 rounded-full text-indigo-400 hover:bg-white/60 dark:hover:bg-slate-800 hover:text-indigo-600 transition-colors flex-shrink-0"
                aria-label="Close report"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
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
                const barColor = (p: number) => p >= 70 ? 'bg-emerald-500' : p >= 40 ? 'bg-amber-500' : 'bg-rose-500';
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
                // Group a section's attempts by subject or topic → sorted [name, {correct,total}] entries.
                const groupBy = (type: string, key: 'subject' | 'topic') => {
                  const map: Record<string, { correct: number; total: number }> = {};
                  for (const a of attempts) {
                    if (a.questionType !== type) continue;
                    const name = resolveKey(a, key);
                    if (!name) continue;
                    if (!map[name]) map[name] = { correct: 0, total: 0 };
                    map[name].total += 1;
                    if (a.isCorrect) map[name].correct += 1;
                  }
                  return Object.entries(map).sort((x, y) => y[1].total - x[1].total);
                };

                // A titled section card: own score summary + a vertical bar graph.
                const SectionReport: React.FC<{
                  title: string;
                  accent: string;
                  score: { correct: number; total: number };
                  accentText: string;
                  groupLabel: string;
                  entries: [string, { correct: number; total: number }][];
                }> = ({ title, accent, accentText, score, groupLabel, entries }) => {
                  const sp = pct(score);
                  return (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 overflow-hidden">
                      <div className={cn('flex items-center justify-between px-4 py-2.5 border-b border-slate-200/70 dark:border-slate-700/70', accent)}>
                        <h3 className={cn('text-sm font-bold', accentText)}>{title}</h3>
                        <div className={cn('text-right', accentText)}>
                          <span className="text-base font-extrabold">{sp}%</span>
                          <span className="text-[11px] font-semibold opacity-70 ml-1.5">{score.correct}/{score.total}</span>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-3">{groupLabel}</p>
                        {entries.length === 0 ? (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 py-4 text-center">No data yet.</p>
                        ) : (
                          <div className="flex items-end gap-2 sm:gap-3 h-44 overflow-x-auto">
                            {entries.map(([k, b]) => {
                              const p = pct(b);
                              return (
                                <div key={k} className="flex-1 min-w-[44px] h-full flex flex-col items-center">
                                  <div className="flex-1 w-full flex items-end justify-center">
                                    <div className="w-7 sm:w-9 flex flex-col items-center justify-end h-full">
                                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">{p}%</span>
                                      <div
                                        className={cn('w-full rounded-t-md transition-all duration-500', barColor(p))}
                                        style={{ height: `${Math.max(p, 3)}%` }}
                                        title={`${k}: ${b.correct}/${b.total} (${p}%)`}
                                      />
                                    </div>
                                  </div>
                                  <span className="text-[9px] font-semibold text-slate-600 dark:text-slate-300 mt-1.5 text-center leading-tight line-clamp-2 w-full break-words">{k}</span>
                                  <span className="text-[8px] text-slate-400 dark:text-slate-500">{b.correct}/{b.total}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
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
                return (
                  <>
                    {/* Overall summary */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-center">
                        <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">{reportData.score.total}</div>
                        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Attempted</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-center">
                        <div className={cn('text-xl font-extrabold', overallPct >= 70 ? 'text-emerald-600 dark:text-emerald-400' : overallPct >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400')}>{overallPct}%</div>
                        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Correct</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-center">
                        <div className="text-xl font-extrabold text-violet-600 dark:text-violet-400">{reportData.attemptCount}</div>
                        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Sessions</div>
                      </div>
                    </div>

                    {/* Section-wise scores */}
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { label: 'Prelims', s: prelimsScore, c: 'text-blue-600 dark:text-blue-400' },
                        { label: 'CSAT / Maths', s: csatScore, c: 'text-violet-600 dark:text-violet-400' },
                        { label: 'English', s: englishScore, c: 'text-emerald-600 dark:text-emerald-400' },
                      ]).map(({ label, s, c }) => (
                        <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 p-2.5 text-center">
                          <div className={cn('text-lg font-extrabold', c)}>{pct(s)}%</div>
                          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-tight">{label}</div>
                          <div className="text-[9px] text-slate-400 dark:text-slate-500">{s.correct}/{s.total}</div>
                        </div>
                      ))}
                    </div>

                    {/* Three per-section bar graphs */}
                    <SectionReport
                      title="Prelims"
                      accent="bg-blue-50 dark:bg-blue-500/10"
                      accentText="text-blue-700 dark:text-blue-300"
                      score={prelimsScore}
                      groupLabel="Subject-wise"
                      entries={groupBy('prelims', 'subject')}
                    />
                    <SectionReport
                      title="CSAT / Maths"
                      accent="bg-violet-50 dark:bg-violet-500/10"
                      accentText="text-violet-700 dark:text-violet-300"
                      score={csatScore}
                      groupLabel="Topic-wise"
                      entries={groupBy('csat', 'topic')}
                    />
                    <SectionReport
                      title="English"
                      accent="bg-emerald-50 dark:bg-emerald-500/10"
                      accentText="text-emerald-700 dark:text-emerald-300"
                      score={englishScore}
                      groupLabel="Topic-wise"
                      entries={groupBy('english', 'topic')}
                    />

                    {/* Session-wise graph (each run until reset/reload) — shown last */}
                    {sessions.length > 0 && (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/70 dark:border-slate-700/70 bg-amber-50 dark:bg-amber-500/10">
                          <h3 className="text-sm font-bold text-amber-700 dark:text-amber-300">Session-wise</h3>
                          <span className="text-[11px] font-semibold text-amber-700/70 dark:text-amber-300/70">{sessions.length} sessions</span>
                        </div>
                        <div className="p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-3">% correct per session</p>
                          <div className="flex items-end gap-2 sm:gap-3 h-44 overflow-x-auto">
                            {sessions.map((s, i) => {
                              const p = pct(s);
                              return (
                                <div key={i} className="flex-1 min-w-[40px] h-full flex flex-col items-center">
                                  <div className="flex-1 w-full flex items-end justify-center">
                                    <div className="w-7 sm:w-9 flex flex-col items-center justify-end h-full">
                                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">{p}%</span>
                                      <div
                                        className={cn('w-full rounded-t-md transition-all duration-500', barColor(p))}
                                        style={{ height: `${Math.max(p, 3)}%` }}
                                        title={`Session ${i + 1}: ${s.correct}/${s.total} (${p}%)`}
                                      />
                                    </div>
                                  </div>
                                  <span className="text-[9px] font-semibold text-slate-600 dark:text-slate-300 mt-1.5">S{i + 1}</span>
                                  <span className="text-[8px] text-slate-400 dark:text-slate-500">{s.correct}/{s.total}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
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
                ] as const).map(card => (
                  <div
                    key={card.id}
                    className={cn(
                      "relative flex flex-col rounded-2xl border-2 bg-white dark:bg-slate-800/60 p-3 shadow-sm",
                      card.cardClass
                    )}
                  >
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
                      <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{planPrices[card.plan] ? `₹${Math.round(planPrices[card.plan] / 100).toLocaleString('en-IN')}` : card.price}</p>
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
                ))}
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
