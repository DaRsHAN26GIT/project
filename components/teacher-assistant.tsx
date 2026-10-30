"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Clipboard,
  Clock3,
  CloudOff,
  Download,
  FileText,
  History,
  LoaderCircle,
  MessageSquare,
  Plus,
  Printer,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Schedule, Unmet } from "./schedule";
import { generate, explain, type Plan } from "@/lib/engine.mjs";
import {
  localReply,
  worksheet,
  worksheetText,
  type Worksheet,
} from "@/lib/assistant.mjs";
import { supabase } from "@/lib/supabase";
import { downloadText, printText } from "@/lib/browser-files";
import type { RecordEntry } from "@/lib/storage";
type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  source?: string;
  plan?: Plan;
  baseline?: Plan;
  worksheet?: Worksheet;
  status?: "approved" | "dismissed" | "superseded";
  error?: boolean;
  tools?: string[];
};
type Conversation = { id: string; title: string; messages: Message[] };
type Props = {
  owner: string;
  plan: Plan;
  items: RecordEntry[];
  online: boolean;
  onApprove: (p: Plan) => Promise<boolean>;
  onSave: (kind: string, value: unknown, id?: string) => Promise<boolean>;
};
type CloudStatus = {
  configured: boolean;
  provider: string;
  authConfigured: boolean;
  modelConfigured: boolean;
};
const sourceLabel = (source?: string) =>
  source === "openai"
    ? "OpenAI"
    : source === "huggingface"
      ? "Hugging Face"
      : "Local tools";
function fresh(): Conversation {
  return { id: crypto.randomUUID(), title: "New conversation", messages: [] };
}
function history(items: RecordEntry[]) {
  return items
    .filter((r) => r.kind === "conversation")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((r) => r.value as Conversation)
    .filter((c) => typeof c?.id === "string" && Array.isArray(c.messages));
}
function printWorksheet(sheet: Worksheet, answers: boolean) {
  printText(worksheetText(sheet, answers), `Class ${sheet.grade} worksheet`);
}
export default function TeacherAssistant({
  owner,
  plan,
  items,
  online,
  onApprove,
  onSave,
}: Props) {
  const [conversation, setConversation] = useState<Conversation>(
    () => history(items)[0] ?? fresh(),
  );
  const [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [action, setAction] = useState(""),
    [feedback, setFeedback] = useState(""),
    [view, setView] = useState("chat"),
    [language, setLanguage] = useState("English"),
    [localOnly, setLocalOnly] = useState(false),
    [cloud, setCloud] = useState<CloudStatus | null>(null),
    [grade, setGrade] = useState(plan.input.grades[0].id),
    [subject, setSubject] = useState("Mathematics"),
    [difficulty, setDifficulty] = useState("standard"),
    [topic, setTopic] = useState("multiplication"),
    [builderSheet, setBuilderSheet] = useState<Worksheet | null>(null);
  const request = useRef<AbortController | null>(null),
    end = useRef<HTMLDivElement>(null),
    composer = useRef<HTMLTextAreaElement>(null);
  const cloudReady =
    online && !!cloud?.configured && owner !== "demo" && !localOnly;
  const pending = [...conversation.messages]
    .reverse()
    .find((m) => m.plan && !m.status);
  const contextPlan = pending?.plan ?? plan;
  useEffect(() => {
    const controller = new AbortController();
    if (online)
      fetch("/api/assistant", { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((status) => setCloud(status))
        .catch(() => {
          if (!controller.signal.aborted)
            setFeedback(
              "Cloud connection status unavailable. Local tools still work.",
            );
        });
    return () => controller.abort();
  }, [online]);
  useEffect(() => {
    if (end.current) end.current.scrollTop = end.current.scrollHeight;
  }, [conversation.messages.length, busy]);
  useEffect(() => () => request.current?.abort(), []);
  async function commit(next: Conversation) {
    setConversation(next);
    const saved = await onSave("conversation", next, next.id);
    if (!saved)
      setFeedback(
        "Conversation is only in memory. Export it before leaving this page.",
      );
    return saved;
  }
  async function send(text = draft, retry = false) {
    if (busy || !text.trim()) return;
    setAction("");
    setBusy(true);
    setFeedback("");
    setDraft("");
    const controller = new AbortController();
    request.current = controller;
    const user: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = {
      ...conversation,
      title: conversation.messages.length
        ? conversation.title
        : text.trim().slice(0, 55),
      messages: retry
        ? conversation.messages
        : [...conversation.messages, user],
    };
    await commit(next);
    try {
      let result: {
        message: string;
        source: string;
        plan?: Plan;
        worksheet?: Worksheet;
        tools?: string[];
      };
      if (cloudReady) {
        const session = (await supabase?.auth.getSession())?.data.session;
        const response = await fetch("/api/assistant", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            message: text,
            input: contextPlan.input,
            language,
            history: conversation.messages
              .filter((m) => !m.error)
              .slice(-8)
              .map((m) => ({ role: m.role, content: m.text.slice(0, 3000) })),
            progress: items
              .filter((r) => r.kind === "assessment")
              .slice(-100)
              .map((r) => r.value),
          }),
        });
        const data = await response.json();
        if (!response.ok)
          throw Error(data.error || "The assistant could not respond.");
        result = data;
      } else {
        result = localReply(text, contextPlan.input, { grade });
      }
      if (controller.signal.aborted) return;
      const response: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: result.message,
        createdAt: new Date().toISOString(),
        source: result.source,
        tools: result.tools,
        ...(result.plan
          ? { plan: generate(result.plan.input), baseline: contextPlan }
          : {}),
        ...(result.worksheet ? { worksheet: result.worksheet } : {}),
      };
      await commit({
        ...next,
        messages: [
          ...next.messages.map((m) =>
            result.plan && m.plan && !m.status
              ? { ...m, status: "superseded" as const }
              : m,
          ),
          response,
        ],
      });
    } catch (e) {
      if (!controller.signal.aborted)
        await commit({
          ...next,
          messages: [
            ...next.messages,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              text: (e as Error).message,
              createdAt: new Date().toISOString(),
              error: true,
            },
          ],
        });
    } finally {
      if (request.current === controller) {
        setBusy(false);
        request.current = null;
        composer.current?.focus();
      }
    }
  }
  async function stop() {
    request.current?.abort();
    setFeedback("Request stopped. No timetable changes were saved.");
  }
  async function mark(message: Message, status: "approved" | "dismissed") {
    if (status === "approved" && message.plan) {
      setAction("Saving approved timetable…");
      setBusy(true);
      const saved = await onApprove(message.plan);
      setBusy(false);
      setAction("");
      if (!saved) {
        setFeedback(
          "Timetable was not saved. Please retry or export your work.",
        );
        return;
      }
    }
    await commit({
      ...conversation,
      messages: conversation.messages.map((m) =>
        m.id === message.id ? { ...m, status } : m,
      ),
    });
    setFeedback(
      status === "approved"
        ? "Timetable approved and saved. Your classroom now uses this plan."
        : "Draft dismissed. Your classroom timetable is unchanged.",
    );
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback("Copied to clipboard.");
    } catch {
      setFeedback("Clipboard unavailable. Select the message text to copy it.");
    }
  }
  function starter(text: string) {
    setView("chat");
    setDraft(text);
    setTimeout(() => composer.current?.focus(), 0);
  }
  async function buildWorksheet() {
    try {
      const sheet = worksheet({ grade, subject, difficulty, topic });
      setBuilderSheet(sheet);
      await commit({
        ...conversation,
        title: conversation.messages.length
          ? conversation.title
          : `Class ${grade} worksheet`,
        messages: [
          ...conversation.messages,
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            text: `Prepared a Class ${grade} ${subject.toLowerCase()} worksheet from a local template.`,
            createdAt: new Date().toISOString(),
            source: "local",
            worksheet: sheet,
          },
        ],
      });
    } catch (e) {
      setFeedback((e as Error).message);
    }
  }
  const starters = [
    {
      icon: Clock3,
      title: "Make room for a shorter day",
      text: `I lost 30 minutes today. Prioritize Class ${grade}.`,
    },
    {
      icon: FileText,
      title: "Create a ready-to-use worksheet",
      text: `Create an easier multiplication worksheet for Class ${grade}.`,
    },
    {
      icon: BookOpen,
      title: "Keep another group learning",
      text: `Show Class ${grade} activities.`,
    },
    {
      icon: Sparkles,
      title: "Plan from the time you have",
      text: `Generate a timetable for 120 minutes. Prioritize Class ${grade}.`,
    },
  ];
  return (
    <div className="assistant-app">
      <div className="companion-toolbar">
        <div className="flex items-center gap-3">
          <span className="companion-logo">
            <Sparkles size={20} />
          </span>
          <div>
            <strong>RuralClass companion</strong>
            <small>Thoughtful support for your teaching day</small>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            <span className="dot" />
            {cloudReady
              ? `${sourceLabel(cloud?.provider)} connected`
              : "Local tools available"}
          </Badge>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Assistant settings"
              >
                <Settings2 />
              </Button>
            </DialogTrigger>
            <DialogContent className="assistant-dialog">
              <DialogHeader>
                <DialogTitle>Your assistant, clearly connected.</DialogTitle>
                <DialogDescription>
                  Local planning and worksheets work without a key. Cloud
                  conversations require an authenticated teacher account.
                </DialogDescription>
              </DialogHeader>
              <div className="connection-list">
                <p>
                  <Check size={15} /> Local scheduler and worksheet templates{" "}
                  <Badge variant="secondary">Ready</Badge>
                </p>
                <p>
                  <ShieldCheck size={15} /> Supabase authentication{" "}
                  <Badge variant="outline">
                    {cloud
                      ? cloud.authConfigured
                        ? "Configured"
                        : "Not configured"
                      : "Not checked"}
                  </Badge>
                </p>
                <p>
                  <Sparkles size={15} />{" "}
                  {sourceLabel(cloud?.provider ?? "openai")}{" "}
                  <Badge variant="outline">
                    {cloud
                      ? cloud.modelConfigured
                        ? "Configured"
                        : "Not configured"
                      : "Not checked"}
                  </Badge>
                </p>
              </div>
              <label className="local-toggle">
                <input
                  type="checkbox"
                  checked={localOnly}
                  onChange={(e) => setLocalOnly(e.target.checked)}
                />
                Use only local tools in this conversation
              </label>
              <p className="text-sm text-muted-foreground">
                To connect live AI, create <code>.env.local</code> in the
                project folder. Add Supabase public settings and either a
                server-side OpenAI key or Hugging Face token. Follow the README,
                apply the database schema, restart the server, and sign in
                through Teacher Portal.
              </p>
              <p className="text-sm text-muted-foreground">
                Never paste API keys into chat. Conversations stay on this
                device; signed-in records use the existing private sync flow.
                Clear shared-device records when finished.
              </p>
              <Button asChild variant="outline">
                <Link href="/portal">
                  Open teacher portal <ArrowRight />
                </Link>
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="companion-layout">
        <div className="min-w-0">
          <Tabs value={view} onValueChange={setView}>
            <div className="companion-tabs">
              <TabsList>
                <TabsTrigger value="chat">
                  <MessageSquare /> Assistant
                </TabsTrigger>
                <TabsTrigger value="worksheet">
                  <FileText /> Worksheet studio
                </TabsTrigger>
              </TabsList>
              <div className="flex gap-1">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={busy}>
                      <History /> History
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="assistant-dialog">
                    <DialogHeader>
                      <DialogTitle>Your saved conversations</DialogTitle>
                      <DialogDescription>
                        Only conversations for this device’s current account are
                        shown.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="conversation-list">
                      {history(items).length ? (
                        history(items).map((c) => (
                          <DialogClose asChild key={c.id}>
                            <Button
                              variant="ghost"
                              disabled={busy}
                              className="history-item"
                              onClick={() => {
                                setConversation(c);
                                setFeedback("");
                                setView("chat");
                              }}
                            >
                              <MessageSquare />
                              <span>
                                {c.title}
                                <small>{c.messages.length} messages</small>
                              </span>
                              <ArrowRight />
                            </Button>
                          </DialogClose>
                        ))
                      ) : (
                        <p>
                          No saved conversations yet. Start with a question
                          below.
                        </p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setConversation(fresh());
                    setDraft("");
                    setBuilderSheet(null);
                    setFeedback("");
                    setView("chat");
                  }}
                >
                  <Plus />
                  New chat
                </Button>
              </div>
            </div>
            <TabsContent value="chat" className="chat-surface">
              <div
                className="chat-scroll"
                ref={end}
                role="log"
                aria-label="Conversation"
                aria-live="polite"
                aria-busy={busy}
              >
                {conversation.messages.length > 40 && (
                  <p className="text-xs text-muted-foreground">
                    Showing the latest 40 messages. Export the conversation for
                    the full history.
                  </p>
                )}
                {!conversation.messages.length ? (
                  <div className="companion-welcome">
                    <div className="welcome-symbol">
                      <Sparkles size={28} />
                      <span className="sparkle-small">✦</span>
                    </div>
                    <Badge variant="outline">
                      A LITTLE HELP. MORE ROOM TO TEACH.
                    </Badge>
                    <h2>
                      What would make
                      <br />
                      today a little easier?
                    </h2>
                    <p>
                      Plan a shorter day. Give another group a meaningful task.
                      <br />
                      Find your next step, with your classroom in mind.
                    </p>
                    <div className="starter-grid">
                      {starters.map(({ icon: Icon, title, text }) => (
                        <Button
                          variant="outline"
                          key={title}
                          onClick={() => starter(text)}
                        >
                          <span className="starter-icon">
                            <Icon />
                          </span>
                          <span>
                            {title}
                            <small>{text}</small>
                          </span>
                          <ArrowRight />
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  conversation.messages.slice(-40).map((m) => (
                    <article
                      className={`chat-message ${m.role === "user" ? "from-teacher" : "from-companion"} ${m.error ? "message-error" : ""}`}
                      key={m.id}
                    >
                      <span className="message-avatar">
                        {m.role === "user" ? "You" : <Sparkles size={17} />}
                      </span>
                      <div className="message-main">
                        <div className="message-byline">
                          <strong>
                            {m.role === "user" ? "You" : "RuralClass"}
                          </strong>
                          {m.role === "assistant" && (
                            <Badge variant="secondary">
                              {m.error
                                ? "Request failed"
                                : sourceLabel(m.source)}
                            </Badge>
                          )}
                          <time dateTime={m.createdAt}>
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        </div>
                        <div className="message-text">{m.text}</div>
                        {m.tools?.length ? (
                          <div className="tool-receipts">
                            <ShieldCheck size={12} />
                            Used{" "}
                            {m.tools
                              .map((t) => t.replaceAll("_", " "))
                              .join(" · ")}
                          </div>
                        ) : null}
                        {m.plan && (
                          <Card className="proposal-card">
                            <CardHeader>
                              <div className="flex justify-between items-center gap-2">
                                <Badge variant="outline">
                                  {m.status === "approved"
                                    ? "Approved plan"
                                    : m.status === "dismissed"
                                      ? "Dismissed draft"
                                      : m.status === "superseded"
                                        ? "Replaced by a newer draft"
                                        : "Timetable proposal"}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {m.plan.input.minutes} minutes available
                                </span>
                              </div>
                              <CardTitle>A new rhythm for your day.</CardTitle>
                              <CardDescription>
                                Calculated by the scheduling engine. No changes
                                until you approve.
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="attention-changes">
                                {m.plan.attention.map((a) => {
                                  const old =
                                    m.baseline?.attention.find(
                                      (g) => g.grade === a.grade,
                                    )?.minutes ?? 0;
                                  return (
                                    <div key={a.grade}>
                                      <span>Class {a.grade}</span>
                                      <strong>
                                        {a.minutes}
                                        <small>teacher min</small>
                                      </strong>
                                      <span>
                                        {a.minutes - old >= 0 ? "+" : ""}
                                        {a.minutes - old} min
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              <Unmet plan={m.plan} />
                              <details className="proposal-details">
                                <summary>
                                  Compare changes and preview timetable
                                  <ChevronDown size={14} />
                                </summary>
                                {m.baseline &&
                                  explain(m.baseline, m.plan).map((text) => (
                                    <p key={text}>{text}</p>
                                  ))}
                                <Schedule plan={m.plan} />
                              </details>
                              <div className="flex flex-wrap gap-2 mt-4">
                                <Button
                                  disabled={
                                    busy || !!m.status || pending?.id !== m.id
                                  }
                                  onClick={() => mark(m, "approved")}
                                >
                                  <Check />
                                  {m.status === "approved"
                                    ? "Approved & saved"
                                    : "Approve proposed timetable"}
                                </Button>
                                {!m.status && (
                                  <Button
                                    disabled={busy}
                                    variant="ghost"
                                    onClick={() => mark(m, "dismissed")}
                                  >
                                    Dismiss draft
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        {m.worksheet && (
                          <WorksheetCard
                            sheet={m.worksheet}
                            onFeedback={setFeedback}
                          />
                        )}
                        <div className="message-actions">
                          {m.error ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => {
                                  const index = conversation.messages.findIndex(
                                    (x) => x.id === m.id,
                                  );
                                  const user = [
                                    ...conversation.messages.slice(0, index),
                                  ]
                                    .reverse()
                                    .find((x) => x.role === "user");
                                  if (user) void send(user.text, true);
                                }}
                              >
                                Retry request
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setLocalOnly(true);
                                  setFeedback(
                                    "Local tools selected. Ask for a timetable, activity, or worksheet.",
                                  );
                                }}
                              >
                                Use local tools
                              </Button>
                            </>
                          ) : (
                            m.role === "assistant" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copy(m.text)}
                              >
                                <Clipboard />
                                Copy
                              </Button>
                            )
                          )}
                        </div>
                      </div>
                    </article>
                  ))
                )}
                {busy && (
                  <div className="thinking" role="status">
                    <LoaderCircle className="animate-spin" size={17} />
                    {action ||
                      (cloudReady
                        ? "Thinking with your classroom in mind…"
                        : "Preparing your classroom proposal…")}
                  </div>
                )}
              </div>
              <form
                className="composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <div className="composer-context">
                  <span>
                    <span className="dot" />
                    {pending
                      ? "Using your latest draft"
                      : "Using your current classroom"}
                  </span>
                  <span>
                    {contextPlan.input.minutes} min ·{" "}
                    {contextPlan.input.grades.length} grades
                  </span>
                </div>
                <label className="sr-only" htmlFor="teacher-message">
                  Teacher request
                </label>
                <Textarea
                  ref={composer}
                  id="teacher-message"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  disabled={busy}
                  maxLength={2000}
                  placeholder={
                    cloudReady
                      ? "Ask a teaching question, replan your day, or create a worksheet…"
                      : "Reduce time, prioritize a grade, or create a worksheet…"
                  }
                />
                <div className="composer-bottom">
                  <div className="flex gap-2 items-center">
                    <Sparkles size={13} />
                    <span>
                      {cloudReady
                        ? sourceLabel(cloud?.provider)
                        : "Local command assistant"}
                    </span>
                    <label className="sr-only" htmlFor="response-language">
                      Response language
                    </label>
                    <select
                      id="response-language"
                      aria-label="Response language"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      <option>English</option>
                      <option>Kannada</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="character-count">{draft.length}/2000</span>
                    {busy && !action ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={stop}
                      >
                        <Square />
                        Stop
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        size="sm"
                        disabled={busy || !draft.trim()}
                        aria-label="Send message"
                      >
                        <Send />
                        Send
                      </Button>
                    )}
                  </div>
                </div>
              </form>
              <div className="assistant-disclosure">
                <ShieldCheck size={12} />
                {!cloudReady
                  ? "Local tools handle planning and templates; open-ended AI needs a connected provider."
                  : "AI can make mistakes. Review suggestions before using them in class."}
                {language === "Kannada" &&
                  !cloudReady &&
                  " Kannada responses require cloud AI."}
              </div>
            </TabsContent>
            <TabsContent value="worksheet">
              <Card className="worksheet-builder">
                <CardHeader>
                  <Badge variant="secondary" className="w-fit">
                    <CloudOff size={12} />
                    Works offline
                  </Badge>
                  <CardTitle>Small tasks. Meaningful practice.</CardTitle>
                  <CardDescription>
                    Printable, reusable templates with a teacher answer key. No
                    model download or API key required.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="worksheet-fields">
                    <label>
                      Grade
                      <select
                        aria-label="Worksheet grade"
                        value={grade}
                        onChange={(e) => setGrade(+e.target.value)}
                      >
                        {plan.input.grades.map((g) => (
                          <option key={g.id} value={g.id}>
                            Class {g.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Subject
                      <select
                        aria-label="Worksheet subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      >
                        <option>Mathematics</option>
                        <option>Reading</option>
                      </select>
                    </label>
                    <label>
                      Difficulty
                      <select
                        aria-label="Worksheet difficulty"
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                      >
                        <option value="supported">
                          Supported · use objects
                        </option>
                        <option value="standard">Standard · independent</option>
                        <option value="stretch">
                          Stretch · explain thinking
                        </option>
                      </select>
                    </label>
                    {subject === "Mathematics" && (
                      <label>
                        Practice topic
                        <select
                          aria-label="Worksheet topic"
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                        >
                          <option value="multiplication">Multiplication</option>
                          <option value="addition">Addition</option>
                          <option value="subtraction">Subtraction</option>
                        </select>
                      </label>
                    )}
                  </div>
                  <Button disabled={busy} onClick={buildWorksheet}>
                    <FileText />
                    Prepare worksheet
                  </Button>
                </CardContent>
              </Card>
              {builderSheet && (
                <WorksheetCard sheet={builderSheet} onFeedback={setFeedback} />
              )}
            </TabsContent>
          </Tabs>
          {feedback && (
            <div className="assistant-feedback" role="status">
              {feedback}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Dismiss assistant notification"
                onClick={() => setFeedback("")}
              >
                <X />
              </Button>
            </div>
          )}
        </div>
        <aside className="companion-context">
          <div className="context-header">
            <span className="eyebrow">IN YOUR CLASSROOM</span>
            <Badge variant="outline">
              {owner === "demo" ? "Fictional demo" : "Private account"}
            </Badge>
          </div>
          <h3>
            Every learner,
            <br />
            in the picture.
          </h3>
          <div className="context-totals">
            <div>
              <Users size={16} />
              <strong>
                {plan.input.grades.reduce((n, g) => n + g.students, 0)}
              </strong>
              <small>learners</small>
            </div>
            <div>
              <Clock3 size={16} />
              <strong>{plan.input.minutes}</strong>
              <small>minutes today</small>
            </div>
          </div>
          <label className="context-grade-label">
            Focus grade
            <select value={grade} onChange={(e) => setGrade(+e.target.value)}>
              {plan.input.grades.map((g) => (
                <option key={g.id} value={g.id}>
                  Class {g.id}
                </option>
              ))}
            </select>
          </label>
          <div className="context-grades">
            {plan.input.grades.map((g) => (
              <button
                key={g.id}
                className={grade === g.id ? "focus-grade" : ""}
                onClick={() => setGrade(g.id)}
              >
                <span className={`grade-badge g${g.id}`}>{g.id}</span>
                <span>
                  <b>Class {g.id}</b>
                  <small>
                    {g.subject} · {g.students} learners
                  </small>
                </span>
                {g.level === "Needs support" && (
                  <span
                    className="support-dot"
                    title="Teacher-marked support need"
                  />
                )}
              </button>
            ))}
          </div>
          <div className="context-note">
            <ShieldCheck size={17} />
            <p>Your judgement comes first.</p>
            <small>
              Suggestions are drafts. Only you can approve a new timetable.
            </small>
          </div>
          <div className="context-note quiet">
            <CloudOff size={17} />
            <p>
              Connection comes and goes.
              <br />
              Learning doesn’t have to.
            </p>
            <small>
              {online ? "Online" : "Offline"} · Saved conversations remain on
              this device.
            </small>
          </div>
          {conversation.messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadText(
                  conversation.messages
                    .map(
                      (m) =>
                        `${m.role === "user" ? "TEACHER" : "RURALCLASS (" + sourceLabel(m.source) + ")"}\n${m.text}${m.worksheet ? "\n" + worksheetText(m.worksheet) : ""}`,
                    )
                    .join("\n\n"),
                  "ruralclass-conversation.txt",
                )
              }
            >
              <Download />
              Export conversation
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}
function WorksheetCard({
  sheet,
  onFeedback,
}: {
  sheet: Worksheet;
  onFeedback: (s: string) => void;
}) {
  const [answers, setAnswers] = useState(false);
  return (
    <Card className="worksheet-card">
      <CardHeader>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary">Class {sheet.grade}</Badge>
          <Badge variant="outline">{sheet.subject}</Badge>
          <Badge variant="outline">{sheet.difficulty}</Badge>
        </div>
        <CardTitle>{sheet.title}</CardTitle>
        <CardDescription>{sheet.instructions}</CardDescription>
      </CardHeader>
      <CardContent>
        {sheet.passage && <blockquote>{sheet.passage}</blockquote>}
        <ol>
          {sheet.questions.map((q, i) => (
            <li key={i}>
              <span>{i + 1}.</span>
              <div>
                {q.prompt}
                {answers && (
                  <small className="worksheet-answer">Answer: {q.answer}</small>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div className="worksheet-checkpoint">
          <Check size={15} />
          <span>{sheet.checkpoint}</span>
        </div>
        <div className="flex gap-2 flex-wrap mt-5">
          <Button
            variant="outline"
            size="sm"
            aria-pressed={answers}
            onClick={() => setAnswers(!answers)}
          >
            <BookOpen />
            {answers ? "Hide answer key" : "Show answer key"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              try {
                printWorksheet(sheet, answers);
              } catch (e) {
                onFeedback((e as Error).message);
              }
            }}
          >
            <Printer />
            {answers ? "Print with answers" : "Print worksheet"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              downloadText(
                worksheetText(sheet, answers),
                `class-${sheet.grade}-worksheet.txt`,
              )
            }
          >
            <Download />
            Download
          </Button>
        </div>
        <small className="mt-4">
          {sheet.source} · Review suitability before classroom use.
        </small>
      </CardContent>
    </Card>
  );
}
