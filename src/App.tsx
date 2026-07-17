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
  User,
  Mail,
  Phone,
  X,
  Database,
  Trash2,
  Pencil
} from 'lucide-react';
import { fallbackQuestions } from './questions_fallback.ts';
import { MainsQuestion, Question, SubjectColorMap, ToppersCopyQuestion } from './types.ts';
import { cn } from './lib/utils.ts';
// import { isValidCode } from './authorizedCodes';

const subjectColors: SubjectColorMap = {
  "Polity": "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 ring-purple-400/20",
  "History": "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500 ring-amber-500/20",
  "Geography": "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-blue-400/20",
  "Economy": "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-emerald-400/20",
  "Environment": "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-green-400/20",
  "Science & Technology": "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 ring-cyan-400/20",
  "Art & Culture": "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 ring-pink-400/20",
  "Current Affairs": "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 ring-orange-400/20",
  "International Relations": "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 ring-sky-400/20",
  "Default": "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ring-slate-400/20"
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
          <li className={li}><strong>Telegram (Ebooks Channel):</strong> <a className="text-blue-600 dark:text-blue-400 underline" href={BUSINESS.telegramChannel} target="_blank" rel="noopener noreferrer">Join Channel</a></li>
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
  return text.replace(/\*\*([^\*]+)\*\*/g, '<b>$1</b>');
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
              <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-1 font-bold uppercase tracking-wider flex items-center gap-1">
                <QrCode className="w-3 h-3" /> Subscribe
              </p>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight">
                Contact <a href="https://telegram.me/UPSC_powerhouse_helpbot" target="_blank" rel="noopener noreferrer" className="text-blue-500 font-bold hover:underline">@UPSC_powerhouse_helpbot</a> on Telegram to unlock all {question.year} questions.
              </p>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold text-center mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                1 Year ₹899 · 2 Years ₹1299
              </p>
            </div>
            <button 
              onClick={onCheckStatus}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg text-[10px] transition-colors shadow-md flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3 h-3" /> Refresh Status
            </button>
          </div>
        </div>

        {/* Blurred Background Content */}
        <div className="opacity-20 pointer-events-none filter blur-[1px]">
          <div className="flex justify-between items-start mb-3 gap-2">
            <div className="flex gap-1.5 items-center">
              <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
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
      className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-blue-500/50 transition-colors duration-200 flex flex-col h-full group"
    >
      <div className="flex justify-between items-start mb-3 gap-2">
        <div className="flex gap-1.5 items-center flex-wrap">
          <span 
            onClick={() => onExamClick?.(question.exam)}
            className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <FileText className="w-3 h-3 mr-1 text-slate-400" /> {question.exam}
          </span>
          <span 
            onClick={() => onSubjectClick?.(question.subject)}
            className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset cursor-pointer hover:opacity-80 transition-opacity", colorClasses)}
          >
            {question.subject}
          </span>
          {question.topic && (
            <span 
              onClick={() => onTopicClick?.(question.topic!)}
              className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 ring-1 ring-inset ring-blue-400/20 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors"
            >
              {question.topic}
            </span>
          )}
        </div>
        <span 
          onClick={() => onYearClick?.(question.year)}
          className="text-[10px] text-slate-500 font-medium whitespace-nowrap bg-slate-100/50 dark:bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/50 flex items-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
        >
          <Calendar className="w-3 h-3 mr-1" />{question.year}
        </span>
      </div>
      
      <h3 className="text-[13px] font-normal text-slate-900 dark:text-slate-100 mb-3 leading-[20px] whitespace-pre-wrap px-1">
        <span className="text-blue-600 dark:text-blue-400 mr-1.5 font-normal">Q{question.id}.</span> 
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
                "w-full text-left py-2.5 px-4 border rounded-lg text-[13px] font-normal transition-all flex justify-between items-center group/btn leading-[19px]",
                !hasAttempted && "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-600 hover:border-slate-300 dark:hover:border-slate-500 cursor-pointer active:scale-[0.98]",
                hasAttempted && isCorrectAnswer && "bg-emerald-100/50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400",
                hasAttempted && isSelected && !isCorrectAnswer && "bg-red-100/50 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-400",
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
          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center focus:outline-none"
        >
          <div
            className={cn("mr-1.5 transition-transform duration-200", isRevealed ? "rotate-180" : "rotate-0")}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
          <span>{isRevealed ? "Hide Answer" : "Show Answer"}</span>
        </button>
        
        <a 
          href={`https://www.google.com/search?q=${encodeURIComponent((question.question || '').replace(/<[^>]*>?/gm, ' '))}`} 
          target="_blank" 
          rel="noopener noreferrer" 
          title="Search Google for this question" 
          className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center transition-colors px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-blue-600 hover:border-blue-500 focus:outline-none"
        >
          <ExternalLink className="w-3 h-3 mr-1.5" /> Search
        </a>
      </div>
      
      {isRevealed && (
        <div className="pt-2 px-1">
          <p className="text-xs font-normal text-slate-700 dark:text-slate-300 mb-1.5 leading-[18px]">
            Answer: <span className="text-emerald-600 dark:text-emerald-400 font-normal">{question.answer}</span>
          </p>
          {question.explanation && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-indigo-500 p-3 rounded-r-lg shadow-sm">
              <p className="text-[12px] text-indigo-900 dark:text-indigo-200 leading-[18px] italic">
                <span className="font-bold text-indigo-700 dark:text-indigo-300 uppercase text-[10px] tracking-wider block mb-1.5 not-italic">Explanation</span>
                <HighlightText text={question.explanation} query={searchQuery} />
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
                <select
                  value={editAnswer}
                  onChange={(e) => setEditAnswer(e.target.value)}
                  className="flex-1 text-xs border border-amber-300 dark:border-amber-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="">-- Select --</option>
                  {(question.options || []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-amber-700 dark:text-amber-300 block mb-1">Explanation</label>
                <textarea
                  value={editExplanation}
                  onChange={(e) => setEditExplanation(e.target.value)}
                  rows={3}
                  className="w-full text-xs border border-amber-300 dark:border-amber-600 rounded px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-y"
                  placeholder="Enter explanation..."
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
}

const MainsQuestionCard: React.FC<MainsQuestionCardProps> = ({
  question,
  isAnswerVisible,
  onToggleAnswer,
  searchQuery = "",
  onSubjectClick,
  onExamClick,
  onYearClick,
}) => {
  const colorClasses = subjectColors[question.subject] || subjectColors["Default"];
  const answer = question.modelAnswer || question.model_answer || "";
  const hasModelAnswer = !!answer.trim();

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-blue-500/50 transition-colors duration-200 flex flex-col h-full">
      <div className="flex justify-between items-start mb-3 gap-2">
        <div className="flex gap-1.5 items-center flex-wrap">
          <span
            onClick={() => onExamClick?.(question.exam)}
            className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <FileText className="w-3 h-3 mr-1 text-slate-400" /> {question.exam}
          </span>
          <span
            onClick={() => onSubjectClick?.(question.subject)}
            className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset cursor-pointer hover:opacity-80 transition-opacity", colorClasses)}
          >
            {question.subject}
          </span>
          {question.paper && (
            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
              {question.paper}
            </span>
          )}
          {question.topic && (
            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
              {question.topic}
            </span>
          )}
        </div>
        <span
          onClick={() => onYearClick?.(question.year)}
          className="text-[10px] text-slate-500 font-medium whitespace-nowrap bg-slate-100/50 dark:bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/50 flex items-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
        >
          <Calendar className="w-3 h-3 mr-1" />{question.year}
        </span>
      </div>

      <h3 className="text-[13px] font-normal text-slate-900 dark:text-slate-100 mb-4 leading-[20px] whitespace-pre-wrap flex-grow">
        <HighlightText text={question.question} query={searchQuery} />
      </h3>

      {question.keywords && question.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {question.keywords.map((kw, i) => (
            <span key={i} className="text-[9px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/15 text-blue-600 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-700/40 font-medium">
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

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
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

  // Fast initial paint: fetch the top 150 prelims (display order) from the backend.
  const fetchInitialQuestions = async () => {
    try {
      const response = await fetch('/api/questions?limit=150');
      if (!response.ok) throw new Error("API response not ok");
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setQuestions(data as Question[]);
        console.log(`Showing ${data.length} prelims from backend (top 150)`);
        return;
      }
      throw new Error("Empty data from API");
    } catch (error) {
      console.warn("Initial questions fetch failed, using local fallback:", error);
      setQuestions(fallbackQuestions.slice(0, 150) as Question[]);
    }
  };

  useEffect(() => {
    // Load the first batch of prelims from the backend (falls back to local data)
    fetchInitialQuestions();

    // Restore previously saved scroll position
    const savedVisibleCount = localStorage.getItem('visibleCount');
    const initialCount = savedVisibleCount ? parseInt(savedVisibleCount) : 100;
    setVisibleCount(initialCount);
    setIsLoadingQuestions(false);

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
  const [legalPage, setLegalPage] = useState<null | 'about' | 'contact' | 'privacy' | 'terms' | 'refund'>(null);
  const [showFounderModal, setShowFounderModal] = useState(false);
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

  const handleOptionClick = (qid: number, option: string, isCorrect: boolean) => {
    if (userAttempts[qid]) return;
    setUserAttempts(prev => ({ ...prev, [qid]: option }));
    setRevealedAnswers(prev => ({ ...prev, [qid]: true }));
    setScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        <header className="bg-white dark:bg-slate-900 shadow-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top row: logo, tabs, score/random, theme, login - wraps on small screens */}
          <div className="flex flex-wrap items-center py-2.5 gap-y-2">
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-sm flex items-center justify-center w-8 h-8 flex-shrink-0">
                <Landmark className="w-4 h-4" />
              </div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight hidden lg:block">UPSC PYQ Powerhouse</h1>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight lg:hidden hidden sm:block">PYQHouse</h1>

              {/* Compact tab pills inline */}
              <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700 ml-1 sm:ml-2">
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
                        ? "bg-blue-600 text-white shadow-sm"
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
                <div className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-bold border flex items-center shadow-sm",
                  score.total > 0 && (score.correct / score.total) < 0.5
                    ? "bg-red-900/30 text-red-400 border-red-800/50"
                    : "bg-emerald-900/30 text-emerald-400 border-emerald-800/50"
                )}>
                  <Trophy className={cn(
                    "w-4 h-4 mr-2",
                    score.total > 0 && (score.correct / score.total) < 0.5 ? "text-red-500" : "text-emerald-500"
                  )} /> 
                  <span>{score.correct}</span>
                  <span className={cn(
                    "font-medium mx-1",
                    score.total > 0 && (score.correct / score.total) < 0.5 ? "text-red-600" : "text-emerald-600"
                  )}>/</span>
                  <span>{score.total}</span>
                  {score.total > 0 && (
                    <span className={cn(
                      "ml-2 text-[10px] px-1.5 py-0.5 rounded-md",
                      (score.correct / score.total) < 0.5 
                        ? "bg-red-500/20 text-red-400" 
                        : "bg-emerald-500/20 text-emerald-400"
                    )}>
                      {Math.round((score.correct / score.total) * 100)}%
                    </span>
                  )}
                  {score.total > 0 && (
                    <button 
                      onClick={resetQuiz}
                      title="Reset Score"
                      className="ml-2 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
                  <select
                    value={randomSelectLimit}
                    onChange={(e) => setRandomSelectLimit(Number(e.target.value))}
                    className="bg-transparent text-slate-700 dark:text-slate-200 text-[11px] font-bold px-1.5 py-0.5 focus:outline-none border-none cursor-pointer"
                  >
                    {[10, 20, 50, 100].map(n => (
                      <option key={n} value={n} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">{n}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => startRandomPractice(randomSelectLimit)}
                    title={isSubscribed ? "Start Random Practice" : "Random Practice (Limited to Latest 2 Years)"}
                    className="px-2 py-0.5 rounded-md transition-all shadow-sm text-[11px] font-bold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-blue-500/20"
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
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
                  <select
                    value={mainsRandomSelectLimit}
                    onChange={(e) => setMainsRandomSelectLimit(Number(e.target.value))}
                    className="bg-transparent text-slate-700 dark:text-slate-200 text-[11px] font-bold px-1.5 py-0.5 focus:outline-none border-none cursor-pointer"
                  >
                    {[5, 10, 20, 50].map(n => (
                      <option key={n} value={n} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">{n}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => startMainsRandomPractice(mainsRandomSelectLimit)}
                    className="px-2 py-0.5 rounded-md transition-all shadow-sm text-[11px] font-bold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-blue-500/20"
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
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
                  <select
                    value={csatRandomSelectLimit}
                    onChange={(e) => setCSATRandomSelectLimit(Number(e.target.value))}
                    className="bg-transparent text-slate-700 dark:text-slate-200 text-[11px] font-bold px-1.5 py-0.5 focus:outline-none border-none cursor-pointer"
                  >
                    {[10, 20, 50, 100].map(n => (
                      <option key={n} value={n} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">{n}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => startCSATRandomPractice(csatRandomSelectLimit)}
                    className="px-2 py-0.5 rounded-md transition-all shadow-sm text-[11px] font-bold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-blue-500/20"
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
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
                  <select
                    value={englishRandomSelectLimit}
                    onChange={(e) => setEnglishRandomSelectLimit(Number(e.target.value))}
                    className="bg-transparent text-slate-700 dark:text-slate-200 text-[11px] font-bold px-1.5 py-0.5 focus:outline-none border-none cursor-pointer"
                  >
                    {[10, 20, 50, 100].map(n => (
                      <option key={n} value={n} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">{n}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => startEnglishRandomPractice(englishRandomSelectLimit)}
                    className="px-2 py-0.5 rounded-md transition-all shadow-sm text-[11px] font-bold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-blue-500/20"
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
                      ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/25"
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

                  {/* Admin / Login section */}

                  {/* Admin Panel */}
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
                        <RotateCcw className="w-4 h-4 text-rose-500" />
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
          <div className="w-full flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-100 dark:border-blue-900/30 rounded-full animate-pulse"></div>
              <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">Loading Questions from Database...</p>
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
                Back to App
              </button>
            </div>

            {/* Admin Key — required to perform admin actions */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">🔑 Admin Key</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {adminKey
                      ? "Key saved in this browser. Admin actions are unlocked."
                      : "Enter your admin key to unlock admin actions. Stored only in this browser."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    placeholder="Paste admin key"
                    defaultValue={adminKey}
                    onChange={(e) => saveAdminKey(e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 w-56"
                  />
                  {adminKey && (
                    <button
                      onClick={() => saveAdminKey("")}
                      className="px-3 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-xs font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Refresh Questions Cache Button */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Questions Cache</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Added new questions in Cosmos DB? Refresh to show them instantly.</p>
              </div>
              <button 
                onClick={async () => {
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
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-lg text-sm transition-all shadow-lg shadow-amber-500/20 whitespace-nowrap"
              >
                🔄 Refresh Questions
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Add New User */}
              <div className="md:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
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
                    <select 
                      value={isAdminUserStatus}
                      onChange={(e) => setIsAdminUserStatus(e.target.value as "subscribed" | "not_subscribed" | "admin")}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none"
                    >
                      <option value="subscribed">Subscribed</option>
                      <option value="not_subscribed">Not Subscribed</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition-all shadow-lg shadow-blue-600/20">
                    Add/Update User
                  </button>
                </form>
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
          </div>
        ) : activeTab === 'prelims' ? (
          <>
            {/* Mobile Filters Toggle Button */}
            <div className="md:hidden w-full mb-4 flex gap-2">
              <button 
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition-all shadow-md"
              >
                <Filter className="w-4 h-4" />
                {isMobileFiltersOpen ? 'Hide' : 'Show'} Filters
              </button>
            </div>

            <aside className={cn(
              "w-72 lg:w-80 flex-shrink-0 md:sticky md:top-24 md:block",
              isMobileFiltersOpen ? "block" : "hidden"
            )}>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                <Filter className="w-4 h-4 mr-2 text-blue-500" /> Filters
              </h2>
              <button 
                onClick={resetFilters} 
                className="text-xs bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-900/20 text-white py-1 px-3 rounded-lg transition-all font-bold active:scale-95"
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
                  className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 pr-8 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                />
                <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Exam Year</label>
              <select 
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                {yearsList.options.map(y => (
                  <option key={y} value={y}>
                    {y === "All" ? "All Years" : `${y} (${yearsList.counts[y] || 0})`}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Examination</label>
              <select 
                value={examFilter}
                onChange={(e) => setExamFilter(e.target.value)}
                className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                {examsList.options.map(e => (
                  <option key={e} value={e}>
                    {e === "All" ? "All Exams" : `${e} (${examsList.counts[e] || 0})`}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Subject</label>
              <select 
                value={subjectFilter}
                onChange={(e) => {
                  setSubjectFilter(e.target.value);
                  setTopicFilter("All");
                }}
                className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                {subjectsList.options.map(s => (
                  <option key={s} value={s}>
                    {s === "All" ? "All Subjects" : `${s} (${subjectsList.counts[s] || 0})`}
                  </option>
                ))}
              </select>
              
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
              <select 
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                {topicsList.options.map(t => (
                  <option key={t} value={t}>
                    {t === "All" ? "All Topics" : `${t} (${topicsList.counts[t] || 0})`}
                  </option>
                ))}
              </select>
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
                        onOptionClick={(opt) => handleOptionClick(q.id, opt, opt === q.answer)}
                        onToggleRevealed={() => toggleAnswer(q.id)}
                        isLocked={isLocked}
                        userEmail={userEmail}
                        onCheckStatus={() => userEmail && checkUserStatus(userEmail)}
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
            <div className="md:hidden w-full mb-4 flex gap-2">
              <button 
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition-all shadow-md"
              >
                <Filter className="w-4 h-4" />
                {isMobileFiltersOpen ? 'Hide' : 'Show'} Filters
              </button>
            </div>

            <aside className={cn(
              "w-72 lg:w-80 flex-shrink-0 md:sticky md:top-24 md:block",
              isMobileFiltersOpen ? "block" : "hidden"
            )}>
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                    <Filter className="w-4 h-4 mr-2 text-blue-500" /> Filters
                  </h2>
                  <button
                    onClick={resetMainsFilters}
                    className="text-xs bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-900/20 text-white py-1 px-3 rounded-lg transition-all font-bold active:scale-95"
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
                      className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 pr-8 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                    />
                    <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Exam Year</label>
                  <select
                    value={mainsYearFilter}
                    onChange={(e) => setMainsYearFilter(e.target.value)}
                    className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    {mainsYearsList.options.map(y => (
                      <option key={y} value={y}>
                        {y === "All" ? "All Years" : `${y} (${mainsYearsList.counts[y] || 0})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Examination</label>
                  <select
                    value={mainsExamFilter}
                    onChange={(e) => setMainsExamFilter(e.target.value)}
                    className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    {mainsExamsList.options.map(exam => (
                      <option key={exam} value={exam}>
                        {exam === "All" ? "All Exams" : `${exam} (${mainsExamsList.counts[exam] || 0})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Subject</label>
                  <select
                    value={mainsSubjectFilter}
                    onChange={(e) => setMainsSubjectFilter(e.target.value)}
                    className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    {mainsSubjectsList.options.map(subject => (
                      <option key={subject} value={subject}>
                        {subject === "All" ? "All Subjects" : `${subject} (${mainsSubjectsList.counts[subject] || 0})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Topic (by frequency)</label>
                  <select
                    value={mainsTopicFilter}
                    onChange={(e) => setMainsTopicFilter(e.target.value)}
                    className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    {mainsTopicsList.options.map(topic => (
                      <option key={topic} value={topic}>
                        {topic === "All" ? "All Topics" : `${topic} (${mainsTopicsList.counts[topic] || 0})`}
                      </option>
                    ))}
                  </select>
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
            <div className="md:hidden w-full mb-4 flex gap-2">
              <button 
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition-all shadow-md"
              >
                <Filter className="w-4 h-4" />
                {isMobileFiltersOpen ? 'Hide' : 'Show'} Filters
              </button>
            </div>

            <aside className={cn(
              "w-72 lg:w-80 flex-shrink-0 md:sticky md:top-24 md:block",
              isMobileFiltersOpen ? "block" : "hidden"
            )}>
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
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
                    className="text-xs bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-900/20 text-white py-1 px-3 rounded-lg transition-all font-bold active:scale-95"
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
                      className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 pr-8 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                    />
                    <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Year</label>
                  <select
                    value={csatYearFilter}
                    onChange={(e) => setCSATYearFilter(e.target.value)}
                    className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    {csatYearsList.options.map(y => (
                      <option key={y} value={y}>
                        {y === "All" ? "All Years" : `${y} (${csatYearsList.counts[y] || 0})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Topic</label>
                  <select
                    value={csatSubjectFilter}
                    onChange={(e) => setCSATSubjectFilter(e.target.value)}
                    className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    {csatSubjectsList.options.map(s => (
                      <option key={s} value={s}>
                        {s === "All" ? "All Topics" : `${s} (${csatSubjectsList.counts[s] || 0})`}
                      </option>
                    ))}
                  </select>
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
                          onOptionClick={(opt) => handleOptionClick(q.id, opt, opt === q.answer)}
                          onToggleRevealed={() => toggleAnswer(q.id)}
                          isLocked={isLocked}
                          userEmail={userEmail}
                          searchQuery={csatSearchQuery}
                          onCheckStatus={() => userEmail && checkUserStatus(userEmail)}
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
            <div className="md:hidden w-full mb-4 flex gap-2">
              <button 
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition-all shadow-md"
              >
                <Filter className="w-4 h-4" />
                {isMobileFiltersOpen ? 'Hide' : 'Show'} Filters
              </button>
            </div>

            <aside className={cn(
              "w-72 lg:w-80 flex-shrink-0 md:sticky md:top-24 md:block",
              isMobileFiltersOpen ? "block" : "hidden"
            )}>
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
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
                    className="text-xs bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-900/20 text-white py-1 px-3 rounded-lg transition-all font-bold active:scale-95"
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
                      className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 pr-8 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                    />
                    <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Exam</label>
                  <select
                    value={englishExamFilter}
                    onChange={(e) => setEnglishExamFilter(e.target.value)}
                    className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    {englishExamsList.options.map(ex => (
                      <option key={ex} value={ex}>
                        {ex === "All" ? "All Exams" : `${ex} (${englishExamsList.counts[ex] || 0})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Year</label>
                  <select
                    value={englishYearFilter}
                    onChange={(e) => setEnglishYearFilter(e.target.value)}
                    className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    {englishYearsList.options.map(y => (
                      <option key={y} value={y}>
                        {y === "All" ? "All Years" : `${y} (${englishYearsList.counts[y] || 0})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Topic</label>
                  <select
                    value={englishTopicFilter}
                    onChange={(e) => setEnglishTopicFilter(e.target.value)}
                    className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    {englishTopicsList.options.map(t => (
                      <option key={t} value={t}>
                        {t === "All" ? "All Topics" : `${t} (${englishTopicsList.counts[t] || 0})`}
                      </option>
                    ))}
                  </select>
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
                          onOptionClick={(opt) => handleOptionClick(q.id, opt, opt === q.answer)}
                          onToggleRevealed={() => toggleAnswer(q.id)}
                          isLocked={isLocked}
                          userEmail={userEmail}
                          searchQuery={englishSearchQuery}
                          onCheckStatus={() => userEmail && checkUserStatus(userEmail)}
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
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm sticky top-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Filters</h3>
                      <button
                        onClick={() => { setToppersYearFilter("All"); setToppersTopperFilter("All"); setToppersSubjectFilter("All"); setToppersPaperFilter("All"); setToppersSearchQuery(""); }}
                        className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold"
                      >Reset</button>
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Search</label>
                      <input
                        type="text"
                        value={toppersSearchQuery}
                        onChange={(e) => setToppersSearchQuery(e.target.value)}
                        placeholder="Search questions..."
                        className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Year</label>
                      <select value={toppersYearFilter} onChange={(e) => setToppersYearFilter(e.target.value)}
                        className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white">
                        <option value="All">All Years</option>
                        {toppersYearsList.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Paper</label>
                      <select value={toppersPaperFilter} onChange={(e) => setToppersPaperFilter(e.target.value)}
                        className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white">
                        <option value="All">All Papers</option>
                        {toppersPapersList.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Subject</label>
                      <select value={toppersSubjectFilter} onChange={(e) => setToppersSubjectFilter(e.target.value)}
                        className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white">
                        <option value="All">All Subjects</option>
                        {toppersSubjectsList.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Topper</label>
                      <select value={toppersTopperFilter} onChange={(e) => setToppersTopperFilter(e.target.value)}
                        className="w-full border-slate-200 dark:border-slate-600 rounded-lg shadow-sm text-xs p-2 border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white">
                        <option value="All">All Toppers</option>
                        {toppersToppersList.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
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
                            <span className="text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded font-semibold">{q.year}</span>
                            <span className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-semibold">{q.exam}</span>
                            {q.paper && <span className="text-[10px] px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded font-semibold">{q.paper}</span>}
                            <span className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded font-semibold">{q.subject}</span>
                            {q.topic && <span className="text-[10px] px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded font-semibold">{q.topic}</span>}
                          </div>
                          <div className="flex gap-1.5">
                            {q.marks && <span className="text-[10px] px-2 py-0.5 text-blue-400 dark:text-blue-300 font-medium">{q.marks} marks</span>}
                            {q.words && <span className="text-[10px] px-2 py-0.5 text-blue-400 dark:text-blue-300 font-medium">{q.words} words</span>}
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
                                    <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-1 font-bold uppercase tracking-wider flex items-center gap-1">
                                      <QrCode className="w-3 h-3" /> Subscribe
                                    </p>
                                    <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight">
                                      Contact <a href="https://telegram.me/UPSC_powerhouse_helpbot" target="_blank" rel="noopener noreferrer" className="text-blue-500 font-bold hover:underline">@UPSC_powerhouse_helpbot</a> on Telegram to unlock all topper answers.
                                    </p>
                                    <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold text-center mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                      1 Year ₹899 · 2 Years ₹1299
                                    </p>
                                  </div>
                                  <button 
                                    onClick={() => userEmail && checkUserStatus(userEmail)}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg text-[10px] transition-colors shadow-md flex items-center justify-center gap-1.5"
                                  >
                                    <RotateCcw className="w-3 h-3" /> Refresh Status
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
      {showLoginModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
        >
          <div
            className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-8 border border-slate-200 dark:border-slate-700 relative"
          >
            <button 
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex justify-center mb-6">
              <div className="bg-blue-600 p-4 rounded-full shadow-lg shadow-blue-500/30 w-16 h-16 flex items-center justify-center relative">
                <User className="w-8 h-8 text-orange-400 absolute" />
                <Lock className="w-5 h-5 text-yellow-400 absolute bottom-1 right-1" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">Welcome Back</h2>
            <p className="text-slate-500 dark:text-slate-400 text-center text-sm mb-8">Enter your email address to access the powerhouse.</p>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">Email Address</label>
                <div className="relative">
                  <Send className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={loginEmailInput}
                    onChange={(e) => setLoginEmailInput(e.target.value)}
                    placeholder="e.g. user@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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
      )}

      {/* Premium Modal */}
      {showPremiumModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[96vh] flex flex-col rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => setShowPremiumModal(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header banner */}
            <div className="relative shrink-0 bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-600 px-6 sm:px-10 pt-5 pb-6 text-center overflow-hidden">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
              <div className="relative">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-white/15 backdrop-blur mb-2 shadow-lg">
                  <Crown className="w-6 h-6 text-amber-300" />
                </div>
                <h2 className="text-lg sm:text-2xl font-extrabold text-white flex items-center justify-center gap-2">
                  Powerhouse Premium
                </h2>
                <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-md mx-auto">
                  Unlock every PYQ, topper copies and all-in-one ebooks. Pick the plan that fits your prep.
                </p>
              </div>
            </div>

            <div className="px-4 sm:px-6 pb-6 pt-4 overflow-y-auto flex-1 min-h-0">
              <div className="grid md:grid-cols-3 gap-4 sm:gap-5">
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
                    features: ['Polity - Laxmikant summary 🇮🇳', 'Geography - 11th and 12th NCERT summary 🌍', 'Ancient and Medieval - From Upendra and old NCERT 🏛️', 'Modern History - Spectrum summary ⏳', 'Theme 1 and Theme 2 - 12th NCERT 📖', 'Economics - 12th Micro and Macro summary + Mrunal Sir 📈'],
                    cta: 'Get Ebooks Plan',
                    link: 'https://t.me/+7DfVmsKSI4FmNzg1',
                  },
                ] as const).map(card => (
                  <div
                    key={card.id}
                    className={cn(
                      "relative flex flex-col rounded-2xl border-2 bg-white dark:bg-slate-800/60 p-4 shadow-sm",
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

                    <div className="flex flex-col items-center text-center mt-3">
                      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center mb-2", card.iconClass)}>
                        {card.icon === 'book' ? <BookOpen className="w-6 h-6" /> : <Calendar className="w-6 h-6" />}
                      </div>
                      <h3 className={cn("text-lg font-extrabold", card.titleClass)}>{card.title}</h3>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{card.subtitle}</p>
                      <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">{card.price}</p>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 px-2">{card.per}</p>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-700 my-3" />

                    <ul className="space-y-2 flex-1">
                      {card.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <Check className={cn("w-4 h-4 shrink-0 mt-0.5", card.checkClass)} />
                          <span className="text-[13px] text-slate-700 dark:text-slate-300">{f}</span>
                        </li>
                      ))}
                    </ul>

                    <a
                      href={card.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "mt-4 w-full text-white font-bold py-2.5 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2",
                        card.btnClass
                      )}
                    >
                      <Lock className="w-4 h-4" /> {card.cta}
                    </a>
                  </div>
                ))}
              </div>

              {/* Activation footer */}
              <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 flex flex-col sm:flex-row items-center gap-3 justify-between">
                <p className="text-[12px] text-slate-500 dark:text-slate-400 text-center sm:text-left">
                  After paying on Telegram, share your email{userEmail ? <> (<span className="font-bold text-slate-700 dark:text-white break-all">{userEmail}</span>)</> : ""} to get activated, then tap check status.
                </p>
                <button
                  onClick={() => userEmail && checkUserStatus(userEmail)}
                  disabled={!userEmail}
                  className="shrink-0 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Check status
                </button>
              </div>

              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-3">
                PYQ plans include the same features — only the duration & per-month cost differ. Secure activation via Telegram.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Founder Modal */}
      {showFounderModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowFounderModal(false)}>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-md max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
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
