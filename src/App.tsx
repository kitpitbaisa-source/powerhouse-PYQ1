/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  UserPlus,
  X,
  Database
} from 'lucide-react';
import { mcqData } from './questions.ts';
import { Question, SubjectColorMap } from './types.ts';
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
}

const HighlightText: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query.trim()) {
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  }

  // Escape special regex characters
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  
  // Split by HTML tags to avoid highlighting inside tags
  const parts = text.split(/(<[^>]*>)/g);
  
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
  searchQuery = ""
}) => {
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
                Contact <a href="https://t.me/INDIAN4" target="_blank" rel="noopener noreferrer" className="text-blue-500 font-bold hover:underline">@INDIAN4</a> on Telegram to unlock all {question.year} questions.
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
            {question.question.substring(0, 50)}...
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
      
      <h3 className="text-[13px] font-normal text-slate-900 dark:text-slate-100 mb-3 leading-[18px] whitespace-pre-wrap">
        <span className="text-blue-600 dark:text-blue-400 mr-1 font-normal">Q{question.id}.</span> 
        <HighlightText text={question.question} query={searchQuery} />
      </h3>
      
      <div className="space-y-1.5 mb-5">
        {question.options.map(opt => {
          const isCorrectAnswer = opt === question.answer;
          const isSelected = opt === attemptedOption;
          const hasAttempted = !!attemptedOption;

          return (
            <button
              key={opt}
              disabled={hasAttempted}
              onClick={() => onOptionClick(opt)}
              className={cn(
                "w-full text-left py-2.5 px-3 border rounded-lg text-[13px] font-normal transition-all flex justify-between items-center group/btn",
                !hasAttempted && "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-600 hover:border-slate-300 dark:hover:border-slate-500 cursor-pointer active:scale-[0.98]",
                hasAttempted && isCorrectAnswer && "bg-emerald-100/50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400",
                hasAttempted && isSelected && !isCorrectAnswer && "bg-red-100/50 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-400",
                hasAttempted && !isCorrectAnswer && !isSelected && "bg-slate-50/50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 opacity-60"
              )}
            >
              <span className="text-left pr-3">
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
          href={`https://www.google.com/search?q=${encodeURIComponent(question.question.replace(/<[^>]*>?/gm, ' '))}`} 
          target="_blank" 
          rel="noopener noreferrer" 
          title="Search Google for this question" 
          className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center transition-colors px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-blue-600 hover:border-blue-500 focus:outline-none"
        >
          <ExternalLink className="w-3 h-3 mr-1.5" /> Search
        </a>
      </div>
      
      {isRevealed && (
        <div className="pt-2">
          <p className="text-xs font-normal text-slate-700 dark:text-slate-300 mb-1.5">
            Answer: <span className="text-emerald-600 dark:text-emerald-400 font-normal">{question.answer}</span>
          </p>
          {question.explanation && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-indigo-500 p-2.5 rounded-r-lg shadow-sm">
              <p className="text-[12px] text-indigo-900 dark:text-indigo-200 leading-relaxed italic">
                <span className="font-bold text-indigo-700 dark:text-indigo-300 uppercase text-[10px] tracking-wider block mb-1 not-italic">Explanation</span>
                <HighlightText text={question.explanation} query={searchQuery} />
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("All");
  const [examFilter, setExamFilter] = useState("All");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [topicFilter, setTopicFilter] = useState("All");
  const [excludeSciMath, setExcludeSciMath] = useState(false);
  const [userAttempts, setUserAttempts] = useState<Record<number, string>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [visibleCount, setVisibleCount] = useState(30);
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

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Admin configuration
  const ADMIN_EMAILS = ['kitpitbaisa@gmail.com', 'admin@example.com'];

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
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

  const fetchQuestions = async () => {
    setIsLoadingQuestions(true);
    try {
      console.log("Fetching questions from API...");
      const response = await fetch('/api/questions');
      if (!response.ok) throw new Error("API response not ok");
      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        console.log(`Loaded ${data.length} questions from API`);
        setQuestions(data);
      } else {
        throw new Error("Empty data from API");
      }
    } catch (error) {
      console.warn("Server API failed, falling back to local data:", error);
      console.log(`Loaded ${mcqData.length} questions from local fallback`);
      setQuestions(mcqData as Question[]);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const latestTwoYears = useMemo(() => {
    const years = [...new Set(questions.map(q => q.year))].sort((a, b) => (b as string).localeCompare(a as string));
    return years.slice(0, 2);
  }, [questions]);

  // Check subscription and admin status
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
      const adminStatus = data.status === 'admin' || ADMIN_EMAILS.includes(email.toLowerCase().trim());
      setIsAdmin(adminStatus);
    } catch (error) {
      console.error("Failed to check status:", error);
      setIsSubscribed(false);
      setIsAdmin(ADMIN_EMAILS.includes(email.toLowerCase().trim()));
    }
  };

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmailInput, setLoginEmailInput] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [allUsers, setAllUsers] = useState<{email: string, status: string}[]>([]);
  const [isAdminUserEmail, setIsAdminUserEmail] = useState("");
  const [isAdminUserStatus, setIsAdminUserStatus] = useState<"subscribed" | "not_subscribed" | "admin">("subscribed");
  const [adminMessage, setAdminMessage] = useState({ text: "", type: "" });
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const fetchAllUsers = async () => {
    if (!isAdmin) return;
    setIsLoadingUsers(true);
    try {
      console.log("Fetching users from API...");
      const response = await fetch('/api/admin/users');
      
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
    }
  }, [isAdmin, userEmail]);

  const handleUpdateUser = async (email: string, status: string) => {
    const userEmailToUpdate = email.toLowerCase().trim();
    try {
      console.log(`Updating user ${userEmailToUpdate} to ${status}...`);
      const response = await fetch('/api/admin/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    const userEmailToDelete = email.toLowerCase().trim();
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userEmailToDelete)}`, { method: 'DELETE' });
      if (response.ok) {
        setAdminMessage({ text: `User ${userEmailToDelete} deleted`, type: "success" });
        setTimeout(() => setAdminMessage({ text: "", type: "" }), 3000);
        fetchAllUsers();
        return;
      } else {
        throw new Error("Server delete failed");
      }
    } catch (error: any) {
      console.error("Failed to delete user:", error.message || error);
      setAdminMessage({ text: "Failed to delete user", type: "error" });
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
    
    // Check status
    await checkUserStatus(email);
    
    setIsLoggingIn(false);
    setShowLoginModal(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('user_session');
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

  const filteredQuestions = useMemo(() => {
    if (randomMode.active) {
      return randomizedQuestions;
    }

    const list = questions.filter(q => {
      const marchesYear = yearFilter === "All" || q.year === yearFilter;
      const matchesExam = examFilter === "All" || q.exam === examFilter;
      const matchesSubject = (subjectFilter === "All" || q.subject === subjectFilter) && 
                            (!excludeSciMath || (q.subject !== "Science & Technology" && q.subject !== "Mathematics" && q.subject !== "Science"));
      const matchesTopic = topicFilter === "All" || q.topic === topicFilter;
      const matchesSearch = searchQuery === "" || 
        (q.question || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.explanation || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.options.some(opt => (opt || "").toLowerCase().includes(searchQuery.toLowerCase()));
      
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
        q.options.some(opt => (opt || "").toLowerCase().includes(searchQuery.toLowerCase()));
      
      return marchesYear && matchesExam && matchesSubject && matchesTopic && matchesSearch;
    }).length;
    return totalFiltered > visibleCount;
  }, [questions, yearFilter, examFilter, subjectFilter, topicFilter, searchQuery, visibleCount, randomMode]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + 50);
  }, []);

  // Infinite scroll: load more on scroll near bottom
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 800
      ) {
        handleLoadMore();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleLoadMore]);

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
        q.options.some(opt => (opt || "").toLowerCase().includes(searchQuery.toLowerCase()));

      return marchesYear && matchesExam && matchesSubject && matchesTopic && matchesSearch;
    });

    const shuffled = [...baseList].sort(() => Math.random() - 0.5);
    setRandomizedQuestions(shuffled.slice(0, limit));
    setRandomMode({ active: true, limit });
    resetQuiz();
  };

  return (
    <div className={cn("min-h-screen", isDarkMode ? "dark" : "")}>
      <div className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-200 font-sans antialiased min-h-screen flex flex-col transition-colors duration-300">
        <header className="bg-white dark:bg-slate-900 shadow-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm flex items-center justify-center w-9 h-9">
                <Landmark className="w-5 h-5" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">UPSC PYQ Powerhouse</h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Meticulously curated PYQs • {questions.length} Total Loaded
                </p>
              </div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight sm:hidden">UPSC PYQ</h1>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
                {userEmail && (
                <div className="hidden lg:flex flex-col items-end mr-2 text-right">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-none mb-0.5">Logged in as</span>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-white truncate max-w-[140px] leading-tight" title={userEmail}>{userEmail}</span>
                  {isAdmin && (
                    <button 
                      onClick={() => setIsAdminView(!isAdminView)}
                      className="text-[9px] font-extrabold text-blue-500 hover:text-blue-600 uppercase tracking-tighter mt-1 hover:underline"
                    >
                      {isAdminView ? "Exit Admin" : "Admin Panel"}
                    </button>
                  )}
                </div>
              )}
              
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-all border border-slate-200 dark:border-slate-600 group"
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDarkMode ? (
                  <Sun className="w-4 h-4 group-hover:rotate-45 transition-transform" />
                ) : (
                  <Moon className="w-4 h-4 group-hover:-rotate-12 transition-transform" />
                )}
              </button>


              
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
                  <span className="hidden xl:inline">Random PYQ</span>
                  <span className="xl:hidden">Random</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <a 
                  href="https://t.me/upsc_pyq_powerhouse" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md flex items-center shadow-amber-500/20 hover:scale-[1.02] hidden sm:flex"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" /> <span>Join Telegram</span>
                </a>

                {!userEmail ? (
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors border border-blue-200 dark:border-blue-800/50 flex items-center gap-2 px-3"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span className="text-xs font-bold hidden sm:inline">Login</span>
                  </button>
                ) : (
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors border border-rose-200 dark:border-rose-800/50 flex items-center gap-2 px-3"
                    title="Logout"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span className="text-xs font-bold hidden sm:inline">Logout</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex flex-col md:flex-row items-start gap-6 transition-colors duration-300">
        {isLoadingQuestions ? (
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
                    const res = await fetch('/api/admin/refresh-questions', { method: 'POST' });
                    const data = await res.json();
                    if (res.ok) {
                      setAdminMessage({ text: `✓ Cache refreshed! ${data.count} questions loaded.`, type: "success" });
                      fetchQuestions();
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
                  <button onClick={fetchAllUsers} className="text-xs font-bold text-blue-500 hover:underline">Refresh</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/30 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                        <th className="px-6 py-3">Email</th>
                        <th className="px-6 py-3 text-center">Status</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {isLoadingUsers ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-12 text-center text-slate-500 animate-pulse">
                            Loading user database...
                          </td>
                        </tr>
                      ) : allUsers.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                            No users found in database.
                          </td>
                        </tr>
                      ) : allUsers.map((user) => (
                        <tr key={user.email} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-700 dark:text-slate-300 max-w-[200px] truncate">{user.email}</div>
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
                          <td className="px-6 py-4 text-right">
                            {user.email !== userEmail ? (
                              <button 
                                onClick={() => handleDeleteUser(user.email)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold text-blue-500/50 uppercase tracking-tighter">You</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <aside className="w-full md:w-72 lg:w-80 flex-shrink-0 md:sticky md:top-24">
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

            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-center bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600/50">
              {userEmail && (
                <div className="mb-4 pb-3 border-b border-slate-200 dark:border-slate-600/50">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Signed in as</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-white truncate" title={userEmail}>{userEmail}</p>
                </div>
              )}
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Your Score</p>
              <p className={cn(
                "text-2xl font-bold mb-3",
                score.total > 0 && (score.correct / score.total) < 0.5
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400"
              )}>
                {score.correct} <span className="text-xs text-slate-500 font-normal">/ {score.total}</span>
                {score.total > 0 && (
                  <span className={cn(
                    "ml-2 text-xs px-2 py-0.5 rounded-full",
                    (score.correct / score.total) < 0.5
                      ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                      : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                  )}>
                    {Math.round((score.correct / score.total) * 100)}%
                  </span>
                )}
              </p>
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
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Unlock {mcqData.length}+ Questions</h3>
                    <p className="text-slate-600 dark:text-slate-300 text-xs mb-6 max-w-[250px]">
                      You're viewing the free preview. Get full access to all subjects, 2026 predictions, and future updates by subscribing.
                    </p>
                    
                    <div className="w-full space-y-4">
                      {/* Subscription Info */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 text-left">
                        <div className="flex items-center gap-2 mb-3">
                          <QrCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wider">How to Subscribe</span>
                        </div>
                        <ol className="text-[11px] text-slate-500 dark:text-slate-400 space-y-2 list-decimal list-inside">
                          <li>Contact us on Telegram <a href="https://t.me/INDIAN4" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">@INDIAN4</a></li>
                          <li>Provide your registered email: <span className="font-bold text-slate-700 dark:text-white truncate block mt-1">{userEmail}</span></li>
                          <li>Once your subscription is activated, refresh this page.</li>
                        </ol>
                        
                        <div className="mt-4 flex justify-center">
                          <a href="https://t.me/INDIAN4" target="_blank" rel="noopener noreferrer">
                            <img src="/telegram-qr.png" alt="Telegram QR Code @INDIAN4" className="w-40 h-40 rounded-lg shadow-md" />
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
        )}
      </main>

      <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 py-6 mt-auto transition-colors duration-300">
        <div className="max-w-[1400px] mx-auto px-4 text-center flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-xs text-slate-500 font-medium">&copy; 2026 UPSC PYQ Powerhouse. Education & Practice Platform.</p>
          <p className="text-xs text-slate-500 font-medium">Built for Civil Service Aspirants.</p>
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
              <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-500/30">
                <KeyRound className="w-8 h-8 text-white" />
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
    </div>
  </div>
  );
}
