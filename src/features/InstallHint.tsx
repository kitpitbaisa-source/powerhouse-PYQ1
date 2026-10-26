import React, { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISS_KEY = "pyq-install-hint-dismissed";

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

// iOS has no install prompt, so show the Share -> Add to Home Screen steps; Android Chrome gets a real Install button.
export const InstallHint: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const timer = isIos ? window.setTimeout(() => setVisible(true), 1200) : undefined;
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (timer) window.clearTimeout(timer);
    };
  }, [isIos]);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-sm rounded-2xl border border-white/20 bg-slate-900/95 p-3 text-white shadow-2xl backdrop-blur-xl" role="dialog" aria-label="Add PYQ Powerhouse to your home screen">
      <div className="flex items-start gap-3">
        <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 text-xs leading-relaxed">
          <p className="text-sm font-bold">Add PYQ to your home screen</p>
          {installEvent ? (
            <p className="text-white/70">Opens full screen like an app.</p>
          ) : (
            <p className="text-white/70">
              Tap <Share className="mx-0.5 inline h-3.5 w-3.5 text-sky-300" /> Share, then <b>Add to Home Screen</b>. It opens full screen.
            </p>
          )}
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="rounded-full p-1 text-white/60 hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>
      {installEvent && (
        <button
          type="button"
          onClick={async () => { await installEvent.prompt(); dismiss(); }}
          className="mt-2 w-full rounded-xl bg-white py-2 text-sm font-bold text-indigo-700 active:scale-95"
        >
          Install
        </button>
      )}
    </div>
  );
};
