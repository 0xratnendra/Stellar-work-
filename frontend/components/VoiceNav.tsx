"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const COMMANDS: Record<string, () => void | string> = {};

type CommandHandler = (router: ReturnType<typeof useRouter>) => void;

const NAVIGATION_COMMANDS: Record<string, CommandHandler> = {
  "go home": (r) => r.push("/"),
  "go to home": (r) => r.push("/"),
  "go to dashboard": (r) => r.push("/dashboard"),
  "open dashboard": (r) => r.push("/dashboard"),
  "go to admin": (r) => r.push("/admin"),
  "open admin": (r) => r.push("/admin"),
  "go to settings": (r) => r.push("/settings"),
  "open settings": (r) => r.push("/settings"),
  "post a job": (r) => r.push("/post-job"),
  "post job": (r) => r.push("/post-job"),
  "new job": (r) => r.push("/post-job"),
  "go to transactions": (r) => r.push("/transactions"),
  "open transactions": (r) => r.push("/transactions"),
  "go to disputes": (r) => r.push("/disputes"),
  "open disputes": (r) => r.push("/disputes"),
  "go to messages": (r) => r.push("/messages"),
  "open messages": (r) => r.push("/messages"),
  "go back": (r) => r.back(),
  "scroll down": () => window.scrollBy({ top: 400, behavior: "smooth" }),
  "scroll up": () => window.scrollBy({ top: -400, behavior: "smooth" }),
};

function matchCommand(transcript: string): CommandHandler | null {
  const normalized = transcript.toLowerCase().trim();
  for (const [phrase, handler] of Object.entries(NAVIGATION_COMMANDS)) {
    if (normalized.includes(phrase)) return handler;
  }
  return null;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

function getSpeechRecognition(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export default function VoiceNav({ autoStart = false }: { autoStart?: boolean }) {
  const router = useRouter();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const autoStartRef = useRef(false);
  const statusTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
  }, []);

  const clearStatus = useCallback(() => {
    if (statusTimeout.current) clearTimeout(statusTimeout.current);
    statusTimeout.current = setTimeout(() => {
      setLastCommand(null);
      setError(null);
    }, 3000);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionAPI = getSpeechRecognition();
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript =
        event.results[event.resultIndex][0].transcript;
      const handler = matchCommand(transcript);
      if (handler) {
        setLastCommand(transcript);
        handler(router);
      } else {
        setLastCommand(`Unknown: "${transcript}"`);
      }
      clearStatus();
      setListening(false);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "no-speech") {
        setError(event.error === "not-allowed" ? "Microphone access denied" : event.error);
        clearStatus();
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setError(null);
    setLastCommand(null);
  }, [router, clearStatus]);

  useEffect(() => {
    if (autoStart && supported && !autoStartRef.current) {
      autoStartRef.current = true;
      startListening();
    }
  }, [autoStart, startListening, supported]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (statusTimeout.current) clearTimeout(statusTimeout.current);
    };
  }, []);

  if (!supported) return null;

  return (
    <div className="relative flex items-center">
      <button
        onClick={listening ? stopListening : startListening}
        aria-label={listening ? "Stop voice navigation" : "Start voice navigation"}
        aria-pressed={listening}
        title={listening ? "Listening… click to stop" : "Voice navigation"}
        className={`rounded-md p-2 transition-colors ${
          listening
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        }`}
      >
        {listening ? (
          <svg
            className="h-5 w-5 animate-pulse"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 16.93V20H9v2h6v-2h-2v-2.07A8.001 8.001 0 0 0 20 11h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z" />
          </svg>
        ) : (
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 0 1 6 0v8.25a3 3 0 0 1-3 3z"
            />
          </svg>
        )}
      </button>

      {(lastCommand || error) && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="absolute left-1/2 top-full z-50 mt-2 w-48 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md dark:border-slate-700 dark:bg-slate-800"
        >
          {error ? (
            <span className="text-red-600 dark:text-red-400">{error}</span>
          ) : (
            <span className="text-slate-700 dark:text-slate-300">
              <span className="font-medium">Heard:</span> {lastCommand}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
