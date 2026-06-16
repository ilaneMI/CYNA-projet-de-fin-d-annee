'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Bot, MessageCircle, Send, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChatMessage } from './types';

// TODO: real chatbot (FAQ matching + escalation to a human agent) is out of
// scope for this migration. The widget below is intentionally a UI shell
// only — no API call, no AI integration, no remote dependency. The canned
// responses live here so the page is walkable in demos without surprising
// anyone with an unmoderated LLM.
const CANNED_FAQ: { match: RegExp; answer: string }[] = [
  {
    match: /\bsoc\b/i,
    answer:
      'Le SOC (Security Operations Center) est une équipe et une plateforme qui surveillent vos systèmes 24/7 et réagissent aux incidents.',
  },
  {
    match: /\bedr\b/i,
    answer:
      "L'EDR (Endpoint Detection & Response) protège vos postes et serveurs : détection comportementale, isolation, remédiation.",
  },
  {
    match: /\bxdr\b/i,
    answer:
      "Le XDR corrèle les signaux de plusieurs surfaces (endpoint, réseau, cloud, identité) pour une détection plus contextuelle.",
  },
  {
    match: /(prix|tarif|pricing|cout)/i,
    answer:
      "Chaque service propose mensuel, annuel et par utilisateur. Le détail est sur la fiche produit du catalogue.",
  },
  {
    match: /(facture|invoice)/i,
    answer:
      "Les factures sont disponibles dans /orders. Le téléchargement PDF arrive avec le branchement Supabase.",
  },
];

const SUGGESTIONS = [
  "Qu'est-ce que le SOC ?",
  "Comment activer l'EDR ?",
  'Quelles sont les options de tarification ?',
];

const DEFAULT_ANSWER =
  "Je n'ai pas la réponse exacte. Un agent vous répondra rapidement — utilisez le formulaire de contact à gauche pour décrire votre besoin.";

const greetingMessage = (): ChatMessage => ({
  id: `bot-${Date.now()}`,
  role: 'bot',
  content:
    "Bonjour ! Je suis l'assistant Cyna. Je peux répondre à quelques questions courantes. Pour un cas précis, ouvrez un ticket via le formulaire.",
});

const findCannedAnswer = (input: string): string => {
  for (const entry of CANNED_FAQ) {
    if (entry.match.test(input)) return entry.answer;
  }
  return DEFAULT_ANSWER;
};

const generateId = (role: 'user' | 'bot') =>
  `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export default function ChatbotShell() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLLIElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const dialogTitleId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
    setMessages((prev) => (prev.length === 0 ? [greetingMessage()] : prev));
    // Defer focus until the dialog has actually rendered.
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (open) return;
    previouslyFocused.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const sendMessage = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const userMessage: ChatMessage = { id: generateId('user'), role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    window.setTimeout(() => {
      const answer: ChatMessage = {
        id: generateId('bot'),
        role: 'bot',
        content: findCannedAnswer(text),
      };
      setMessages((prev) => [...prev, answer]);
    }, 350);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendMessage(input);
  };

  return (
    <section
      aria-labelledby="chatbot-section-heading"
      className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <header className="mb-4">
        <h2 id="chatbot-section-heading" className="text-xl font-bold text-foreground sm:text-2xl">
          Assistant en ligne
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Une question rapide ? Démarrez une discussion avec l&apos;assistant. Pour un cas précis,
          le formulaire de contact reste la voie la plus sûre.
        </p>
      </header>

      <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
        <li>· Disponible côté UI uniquement pour le moment.</li>
        <li>· Réponses prédéfinies sur SOC / EDR / XDR et tarifs.</li>
        <li>· L&apos;escalade vers un agent humain passe par le formulaire.</li>
      </ul>

      <Button ref={triggerRef} type="button" onClick={() => setOpen(true)} className="w-full sm:w-auto">
        <MessageCircle aria-hidden="true" className="mr-2 h-4 w-4" />
        Contact me
      </Button>

      {open && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm p-4 sm:items-center sm:justify-end sm:p-6"
        >
          {/* Overlay click closes the dialog. Keyboard users use ESC or
              the explicit close button. */}
          <button
            type="button"
            aria-label="Fermer la fenêtre de discussion"
            onClick={close}
            className="absolute inset-0 cursor-default"
            tabIndex={-1}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-border bg-card/95 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bot aria-hidden="true" className="h-5 w-5 text-primary" />
                <h3 id={dialogTitleId} className="text-base font-semibold text-foreground">
                  Assistant Cyna
                </h3>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Fermer la discussion"
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </header>

            <ol
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              className="flex-1 space-y-3 overflow-y-auto bg-secondary/30 p-4"
            >
              {messages.map((message) => {
                const isUser = message.role === 'user';
                return (
                  <li
                    key={message.id}
                    className={`flex items-start gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <span aria-hidden="true" className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Bot className="h-4 w-4" />
                      </span>
                    )}
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        isUser
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border bg-card text-foreground'
                      }`}
                    >
                      <span className="sr-only">{isUser ? 'Vous : ' : 'Assistant : '}</span>
                      {message.content}
                    </div>
                    {isUser && (
                      <span aria-hidden="true" className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <User className="h-4 w-4" />
                      </span>
                    )}
                  </li>
                );
              })}
              <li aria-hidden="true" ref={messagesEndRef} />
            </ol>

            <div className="border-t border-border bg-card px-4 py-3">
              <p className="mb-2 text-xs text-muted-foreground">Suggestions :</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => sendMessage(suggestion)}
                    className="rounded-full border border-input bg-background px-3 py-1 text-xs text-foreground hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <label htmlFor="chatbot-input" className="sr-only">
                  Votre message
                </label>
                <input
                  ref={inputRef}
                  id="chatbot-input"
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Tapez votre question…"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button type="submit" size="sm" aria-label="Envoyer le message" disabled={input.trim().length === 0}>
                  <Send aria-hidden="true" className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
