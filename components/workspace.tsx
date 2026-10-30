"use client";
import { Component, useEffect, useEffectEvent, useState, type ReactNode } from "react";
import type { AnchorHTMLAttributes } from "react";
function Link(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} />;
}
import dynamic from "next/dynamic";
import {
  BookOpen,
  ArrowUpRight,
  ArrowRight,
  LayoutDashboard,
  CalendarDays,
  Layers3,
  RefreshCw,
  Sparkles,
  ChartNoAxesCombined,
  Play,
  CloudOff,
  GraduationCap,
  Leaf,
  Menu,
  Check,
  Printer,
  Download,
  Wifi,
  ChevronRight,
  Users,
  Clock3,
  Plus,
  Pause,
  LogOut,
} from "lucide-react";
import { motion } from "motion/react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  defaultInput,
  generate,
  replan,
  explain,
  command,
} from "@/lib/engine.mjs";
import { records, save, put, type RecordEntry } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { syncDecision } from "@/lib/sync.mjs";
const Scene = dynamic(() => import("./classroom"), {
  ssr: false,
  loading: () => <p>Preparing classroom…</p>,
});
type Input = typeof defaultInput;
type Plan = ReturnType<typeof generate>;
const navigation = [
  ["dashboard", "Overview", LayoutDashboard],
  ["timetable", "Timetable studio", CalendarDays],
  ["activities", "Learning continuity", Layers3],
  ["replanning", "Replanning lab", RefreshCw],
  ["assistant", "Teacher assistant", Sparkles],
  ["analytics", "Learning insights", ChartNoAxesCombined],
  ["simulation", "Classroom simulation", Play],
  ["offline", "Offline workspace", CloudOff],
  ["portal", "Teacher portal", GraduationCap],
] as const;
function Schedule({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected?: number;
  onSelect?: (i: number) => void;
}) {
  return (
    <div className="schedule">
      <div
        className="schedule-head"
        style={{
          gridTemplateColumns: `60px repeat(${plan.input.grades.length}, minmax(100px, 1fr))`,
        }}
      >
        <span>TIME</span>
        {plan.input.grades.map((g) => (
          <strong key={g.id}>
            Class {g.id}
            <small>{g.students} learners</small>
          </strong>
        ))}
      </div>
      {plan.blocks.map((b, i) => (
        <div
          style={{
            gridTemplateColumns: `60px repeat(${plan.input.grades.length}, minmax(100px, 1fr))`,
          }}
          className={`schedule-row ${selected === i ? "selected" : ""}`}
          key={i}
        >
          <span>
            {time(b.start)}
            <small>{b.end - b.start} min</small>
          </span>
          {plan.input.grades.map((g) => (
            <button
              key={g.id}
              onClick={() => onSelect?.(i)}
              className={
                b.break
                  ? "break"
                  : b.teacher === g.id
                    ? "teacher"
                    : "independent"
              }
            >
              <b>
                {b.break
                  ? "Rest & recharge"
                  : b.teacher === g.id
                    ? g.subject
                    : "Independent practice"}
              </b>
              <small>
                {b.break
                  ? "All grades"
                  : b.teacher === g.id
                    ? "With teacher"
                    : "Peer learning · activity card"}
              </small>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
const time = (m: number) =>
  `${String(9 + Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
function FlatRoom({
  active,
  onSelect,
}: {
  active: number;
  onSelect: (g: number) => void;
}) {
  return (
    <div className="flat-room">
      <div className="blackboard">
        <span>Today, every learner moves forward.</span>
        <small>READ · DISCOVER · GROW</small>
      </div>
      <div className="room-groups">
        {[2, 3, 4].map((g, i) => (
          <button
            key={g}
            onClick={() => onSelect(g)}
            className={`room-group group-${g} ${active === g ? "active" : ""}`}
          >
            <div className="people">
              {[0, 1, 2, 3].map((n) => (
                <i key={n} style={{ animationDelay: `${n * 0.2}s` }} />
              ))}
            </div>
            <div className="desk" />
            <strong>Class {g}</strong>
            <small>
              {active === g
                ? "✦ With teacher"
                : ["Story circle", "Number explorers", "Science discovery"][i]}
            </small>
          </button>
        ))}
      </div>
      <div className="room-caption">
        <span className="dot" /> Teacher attention → Class {active}
        <span>Everyone else keeps learning.</span>
      </div>
    </div>
  );
}
export default function Workspace({ page }: { page: string }) {
  const [input, setInput] = useState<Input>(structuredClone(defaultInput)),
    [plan, setPlan] = useState<Plan>(() => generate(defaultInput)),
    [proposal, setProposal] = useState<Plan | null>(null),
    [online, setOnline] = useState(true),
    [notice, setNotice] = useState(""),
    [items, setItems] = useState<RecordEntry[]>([]),
    [active, setActive] = useState(3),
    [three, setThree] = useState(false),
    [webgl, setWebgl] = useState(false),
    [mobile, setMobile] = useState(false),
    [selected, setSelected] = useState(0),
    [playing, setPlaying] = useState(false),
    [lost, setLost] = useState(30),
    [priority, setPriority] = useState(3),
    [filter, setFilter] = useState("All"),
    [step, setStep] = useState(0),
    [message, setMessage] = useState(""),
    [answer, setAnswer] = useState(""),
    [busy, setBusy] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [owner, setOwner] = useState("demo"),
    [note, setNote] = useState(""),
    [score, setScore] = useState(50),
    [assessmentGrade, setAssessmentGrade] = useState(3),
    [attendance, setAttendance] = useState(30),
    [profile, setProfile] = useState("Demo teacher"),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const frame = requestAnimationFrame(() => {
      const c = document.createElement("canvas");
      setWebgl(
        !!c.getContext("webgl2") &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
    });
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() => setNotice("Offline resources could not be cached."));
    supabase?.auth
      .getSession()
      .then(({ data }) => setOwner(data.session?.user.id ?? "demo"));
    const sub = supabase?.auth.onAuthStateChange((_e, s) => {
      setLoaded(false);
      setOwner(s?.user.id ?? "demo");
      setItems([]);
      setPlan(generate(defaultInput));
      setInput(structuredClone(defaultInput));
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      sub?.data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    records(owner)
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
        const latest = rows
          .filter((r) => r.kind === "plan")
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        if (latest) {
          const stored = latest.value as Plan;
          const validated = generate(stored.input);
          setPlan(validated);
          setInput(validated.input);
        }
        setLoaded(true);
      })
      .catch(() =>
        setNotice(
          "Local storage unavailable; export your work before leaving.",
        ),
      );
    return () => {
      cancelled = true;
    };
  }, [owner]);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () => setSelected((i) => (i + 1) % plan.blocks.length),
      1800,
    );
    return () => clearInterval(id);
  }, [playing, plan.blocks.length]);
  async function persist(kind: string, value: unknown, id?: string) {
    try {
      await save(kind, value, owner, id);
      setItems(await records(owner));
      setNotice("Saved on this device.");
    } catch {
      setNotice("Save failed. Export your records before closing.");
    }
  }
  function calculate() {
    try {
      const p = generate(input);
      setPlan(p);
      setSelected(0);
      setNotice("Timetable calculated. Review and approve to save.");
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  function challenge() {
    try {
      setProposal(replan(plan.input, lost, priority));
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  async function approve(p: Plan) {
    await persist("plan", p);
    setPlan(p);
    setInput(p.input);
    setProposal(null);
  }
  async function assistant() {
    setBusy(true);
    setProposal(null);
    try {
      if (online) {
        const r = await fetch("/api/assistant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...((await supabase?.auth.getSession())?.data.session?.access_token
              ? {
                  Authorization: `Bearer ${(await supabase?.auth.getSession())?.data.session?.access_token}`,
                }
              : {}),
          },
          body: JSON.stringify({
            message,
            input: plan.input,
            progress: items
              .filter((r) => r.kind === "assessment")
              .slice(-100)
              .map((r) => r.value),
          }),
        });
        if (r.ok) {
          const result = await r.json();
          setAnswer(result.message);
          if (result.plan) setProposal(result.plan);
          return;
        }
        if (r.status !== 503)
          throw Error("Assistant request failed. Try a local command.");
      }
      const result = command(message, plan.input);
      setAnswer(result.message);
      if (result.plan) setProposal(result.plan);
    } catch (e) {
      setAnswer((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function auth(register = false) {
    if (!supabase) {
      setNotice(
        "Supabase is not configured. The fictional demo needs no login.",
      );
      return;
    }
    setBusy(true);
    const result = register
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setNotice(
      result.error?.message ??
        (register
          ? "Check your email to confirm registration."
          : "Signed in. Private records are scoped to your account."),
    );
    setBusy(false);
  }
  async function sync() {
    if (!supabase || owner === "demo") {
      setNotice(
        "Sign into a configured Supabase project to sync private records. Demo records stay local.",
      );
      return;
    }
    setBusy(true);
    try {
      for (const row of items.filter((r) => !r.synced)) {
        const { data: remote, error: readError } = await supabase
          .from("records")
          .select("*")
          .eq("id", row.id)
          .maybeSingle();
        if (readError) throw readError;
        const decision = syncDecision(row, remote);
        if (decision.action === "conflict") {
          setNotice(
            "Conflict found. Local data preserved; export it before resolving with the server.",
          );
          return;
        }
        const { error } = await supabase.rpc("save_record", {
          record_id: row.id,
          record_kind: row.kind,
          record_value: row.value,
          expected_revision: decision.expected,
        });
        if (error) throw error;
        const current = (await records(owner)).find((r) => r.id === row.id);
        if (current?.revision === row.revision)
          await put({
            ...current,
            synced: true,
            remoteRevision: (decision.expected ?? 0) + 1,
          });
      }
      const { data, error } = await supabase.from("records").select("*");
      if (error) throw error;
      for (const r of data ?? []) {
        const local = (await records(owner)).find((x) => x.id === r.id);
        if (!local || local.synced)
          await put({
            id: r.id,
            kind: r.kind,
            value: r.value,
            owner: r.owner,
            revision: r.revision,
            remoteRevision: r.revision,
            updatedAt: r.updated_at,
            synced: true,
          });
      }
      setItems(await records(owner));
      setNotice("Synchronization complete.");
    } catch (e) {
      setNotice(
        `Sync failed; local records preserved. ${(e as Error).message}`,
      );
    } finally {
      setBusy(false);
    }
  }
  const syncOnReconnect = useEffectEvent(() => {
    if (owner !== "demo") void sync();
  });
  useEffect(() => {
    const reconnect = () => syncOnReconnect();
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, []);
  function exportData() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { exportedAt: new Date().toISOString(), records: items, plan },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "ruralclass-records.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const total = input.grades.reduce((n, g) => n + g.students, 0),
    pending = items.filter((r) => !r.synced).length;
  const chart = plan.attention.map((a) => {
    const assessments = items.filter(
      (r) =>
        r.kind === "assessment" &&
        (r.value as { grade: number }).grade === a.grade,
    );
    return {
      name: `Class ${a.grade}`,
      attention: a.minutes,
      progress: assessments.length
        ? Math.round(
            assessments.reduce(
              (n, r) => n + (r.value as { score: number }).score,
              0,
            ) / assessments.length,
          )
        : ([62, 46, 78][a.grade - 2] ?? 50),
    };
  });
  const room = (
    <>
      <div className="room-toolbar">
        <span>
          <i className="dot" /> LIVE CLASSROOM
        </span>
        <button onClick={() => setThree(!three)} disabled={!webgl}>
          {three ? "Use 2D view" : "Explore in 3D"}
        </button>
      </div>
      {three && webgl ? (
        <div className="canvas">
          <SceneBoundary
            fallback={<FlatRoom active={active} onSelect={setActive} />}
          >
            <Scene active={active} />
          </SceneBoundary>
        </div>
      ) : (
        <FlatRoom active={active} onSelect={setActive} />
      )}
      <div className="room-tabs">
        {[2, 3, 4].map((g) => (
          <button
            key={g}
            onClick={() => setActive(g)}
            aria-pressed={active === g}
          >
            Class {g}
            <span>{active === g ? "Teacher-led" : "Independent"}</span>
          </button>
        ))}
      </div>
    </>
  );
  if (page === "home")
    return (
      <>
        <header className="site-header">
          <Link className="brand" href="/">
            <span className="brand-icon">
              <BookOpen size={23} />
            </span>
            ruralclass<span className="ai">AI</span>
          </Link>
          <nav>
            <a href="#how">How it works</a>
            <a href="#features">Our approach</a>
            <Link href="/impact">The impact</Link>
          </nav>
          <Link className="login" href="/portal">
            Teacher login <ArrowUpRight size={15} />
          </Link>
          <Link className="button small" href="/dashboard">
            Enter classroom <ArrowRight size={15} />
          </Link>
        </header>
        <main>
          <section className="hero">
            <div className="hero-copy">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="eyebrow">
                  <span className="dot" /> BUILT FOR THE CLASSROOMS THAT NEED IT
                  MOST
                </div>
                <h1>
                  One teacher.
                  <br />
                  Multiple grades.
                  <br />
                  <em>Every child matters.</em>
                </h1>
                <p>
                  Turn limited teaching time into limitless possibilities. A
                  thoughtful classroom companion that keeps every grade
                  learning, even when you’re teaching another.
                </p>
                <div className="hero-actions">
                  <Link className="button" href="/dashboard">
                    Step into your classroom <ArrowUpRight size={18} />
                  </Link>
                  <Link className="text-button" href="/presentation">
                    <span className="play-circle">
                      <Play size={13} />
                    </span>{" "}
                    Watch the 3-minute demo
                  </Link>
                </div>
                <div className="hero-trust">
                  <span className="avatar-stack">👩🏽‍🏫 👨🏽‍🏫 👩🏻‍🏫</span>
                  <span>
                    Designed around teachers.
                    <br />
                    <b>Built for real-world constraints.</b>
                  </span>
                  <span className="trust-divider" />
                  <span>
                    <Wifi size={16} /> Works beyond Wi-Fi
                    <small>Offline-first by design</small>
                  </span>
                </div>
              </motion.div>
            </div>
            <motion.div
              className="hero-visual"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7 }}
            >
              <div className="visual-label">
                <Leaf size={15} /> A SMALL CLASSROOM. A BIG POSSIBILITY.
              </div>
              <div className="room-card">{room}</div>
              <div className="floating-note">
                <span className="check-icon">
                  <Check size={16} />
                </span>
                <span>
                  One teacher. Three grades.<b>Learning never stops.</b>
                </span>
                <span className="note-line" />
              </div>
              <span className="visual-footnote">
                A living classroom, not just another lesson planner.
              </span>
            </motion.div>
          </section>
          <div className="principles">
            <span>
              Less waiting.<b>More wondering.</b>
            </span>
            <span>
              <Users size={18} /> Attention, thoughtfully shared
            </span>
            <span>
              <CloudOff size={18} /> Learning, without interruption
            </span>
            <span>
              <Leaf size={18} /> Small schools. Extraordinary potential.
            </span>
          </div>
          <section className="section" id="features">
            <div className="section-top">
              <div>
                <span className="eyebrow">
                  A LITTLE SUPPORT. A LASTING DIFFERENCE.
                </span>
                <h2>
                  More than a timetable.
                  <br />
                  <em>A rhythm for your classroom.</em>
                </h2>
              </div>
              <p>
                While you focus on one group, RuralClass gives every other
                learner a meaningful next step.
              </p>
            </div>
            <div className="feature-grid">
              {(
                [
                  [
                    Clock3,
                    "01",
                    "Make every minute matter",
                    "Balance teacher attention across grades, learning gaps, and the time you actually have.",
                    "timetable",
                  ],
                  [
                    Layers3,
                    "02",
                    "Keep curiosity moving",
                    "Thoughtful independent activities, follow-ups, and easier alternatives for every group.",
                    "activities",
                  ],
                  [
                    RefreshCw,
                    "03",
                    "Life happens. Plans adapt.",
                    "An interruption shouldn’t interrupt learning. Replan your day in a few simple steps.",
                    "replanning",
                  ],
                ] as const
              ).map(([Icon, n, title, text, route]) => (
                <Link
                  className="feature-card"
                  key={String(n)}
                  href={`/${route}`}
                >
                  <div>
                    <span className="feature-icon">
                      <Icon size={23} />
                    </span>
                    <span className="feature-number">{String(n)}</span>
                  </div>
                  <h3>{String(title)}</h3>
                  <p>{String(text)}</p>
                  <span className="feature-link">
                    Explore the possibility <ArrowUpRight size={17} />
                  </span>
                </Link>
              ))}
            </div>
          </section>
          <section className="dark-section" id="how">
            <span className="eyebrow">THE RURALCLASS DIFFERENCE</span>
            <h2>
              When attention shifts,
              <br />
              <em>learning continues.</em>
            </h2>
            <p>
              Traditional planning tells you what to teach. RuralClass helps you
              coordinate what happens while you teach.
            </p>
            <Link href="/replanning" className="button light">
              Challenge RuralClass <ArrowUpRight size={18} />
            </Link>
            <div className="comparison">
              <span>CONVENTIONAL DAY</span>
              <div className="waiting">
                Teacher instruction <i>Unplanned waiting</i>
                <i>Unplanned waiting</i>
              </div>
              <span>THE RURALCLASS DAY</span>
              <div className="flow">
                Teacher instruction <i>Peer discovery</i>
                <i>Independent practice</i>
              </div>
            </div>
          </section>
          <section className="bottom-cta">
            <Leaf size={32} />
            <h2>
              A better day of learning
              <br />
              starts with a little support.
            </h2>
            <Link href="/dashboard" className="button">
              Try the fictional classroom demo <ArrowRight size={18} />
            </Link>
            <p>No login. No API keys. Just possibilities.</p>
          </section>
        </main>
        <footer>
          <Link className="brand" href="/">
            <BookOpen /> ruralclass AI
          </Link>
          <span>One Teacher. Multiple Grades. Continuous Learning.</span>
          <Link href="/impact">
            Research & impact <ArrowUpRight size={14} />
          </Link>
        </footer>
      </>
    );
  return (
    <div className="app-shell">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <button
          className="sidebar-close"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          ×
        </button>
        <Link className="brand" href="/">
          <span className="brand-icon">
            <BookOpen size={22} />
          </span>
          ruralclass <span className="ai">AI</span>
        </Link>
        <div className="school">
          <span>🌿</span>
          <div>
            {owner === "demo" ? "Little Grove School" : "My classroom"}
            <small>
              {owner === "demo"
                ? "Fictional demo workspace"
                : "Private teacher workspace"}
            </small>
          </div>
        </div>
        <span className="nav-label">YOUR CLASSROOM</span>
        <nav>
          {navigation.map(([route, label, Icon]) => (
            <Link
              key={route}
              className={page === route ? "active" : ""}
              href={`/${route}`}
            >
              <Icon size={18} />
              {label}
              {route === "replanning" && <span className="new">TRY IT</span>}
            </Link>
          ))}
        </nav>
        <Link className="presentation-link" href="/presentation">
          <Play size={17} /> Presentation mode <ArrowUpRight size={16} />
        </Link>
        <div className="sidebar-bottom">
          <Leaf />
          <p>
            A little attention.
            <br />
            <b>A world of possibility.</b>
          </p>
          <Link href="/impact">
            Our purpose <ArrowUpRight size={14} />
          </Link>
        </div>
      </aside>
      <div className="app-body">
        <header className="app-header">
          <button
            className="mobile-menu"
            onClick={() => setMobile(!mobile)}
            aria-label="Toggle navigation"
          >
            <Menu />
          </button>
          <span>
            Workspace <ChevronRight size={14} />{" "}
            {navigation.find((n) => n[0] === page)?.[1] ?? "Presentation"}
          </span>
          <div>
            <span className="status">
              <i className={online ? "dot" : "dot offline"} />
              {online ? "Online" : "Offline"} ·{" "}
              {owner === "demo" ? "Demo mode" : "Private account"}
            </span>
            <Link href="/portal" className="profile">
              DT
            </Link>
          </div>
        </header>
        <main className="workspace">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                ONE TEACHER. ENDLESS POSSIBILITIES.
              </span>
              <h1>
                {(
                  {
                    dashboard: "A good day to make a difference.",
                    timetable: "A little structure. A lot of possibility.",
                    activities: "Keep every learner moving.",
                    replanning: "Plans change. Learning continues.",
                    assistant: "Your thoughtful teaching companion.",
                    analytics: "See every small step forward.",
                    simulation: "Your classroom, in motion.",
                    portal: "A space for your teaching journey.",
                    offline: "Good learning travels with you.",
                    impact: "Built for possibility. Grounded in reality.",
                    presentation: "One classroom. Three minutes.",
                  } as Record<string, string>
                )[page] ?? "Your classroom"}
              </h1>
              <p>
                {page === "dashboard"
                  ? "Welcome back. Here’s how your classroom is coming together today."
                  : "Fictional demo data · Local scheduling heuristic · Teacher approval always comes first"}
              </p>
            </div>
            <button className="button small" onClick={() => window.print()}>
              <Printer size={15} /> Print
            </button>
          </div>
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}
          {page === "dashboard" && (
            <>
              <div className="stats">
                {(
                  [
                    [Users, total, "Curious learners", "Across your classroom"],
                    [
                      GraduationCap,
                      input.grades.length,
                      "Grades, one community",
                      "Every group has a next step",
                    ],
                    [
                      Clock3,
                      `${plan.input.minutes} min`,
                      "Time to make an impact",
                      "Including classroom breaks",
                    ],
                    [
                      Layers3,
                      `${plan.unmet.reduce((n, g) => n + g.minutes, 0)} min`,
                      "Unmet teaching requests",
                      "Visible, never hidden",
                    ],
                  ] as const
                ).map(([Icon, value, label, sub]) => (
                  <div className="stat" key={String(label)}>
                    <span>
                      <Icon size={19} />
                      {String(label)}
                    </span>
                    <strong>{String(value)}</strong>
                    <small>{String(sub)}</small>
                  </div>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <span className="eyebrow">THE BIG PICTURE</span>
                      <h2>A classroom in harmony.</h2>
                    </div>
                    <Link href="/simulation">
                      Explore <ArrowUpRight size={16} />
                    </Link>
                  </div>
                  {room}
                </section>
                <section className="panel attention-panel">
                  <span className="eyebrow">THOUGHTFULLY SHARED</span>
                  <h2>Teacher attention</h2>
                  <p>Calculated from your current timetable.</p>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chart}>
                        <CartesianGrid vertical={false} stroke="#e9ede5" />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis width={30} />
                        <Tooltip />
                        <Bar
                          dataKey="attention"
                          fill="#4e8b67"
                          radius={[8, 8, 0, 0]}
                          name="Teacher minutes"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <Link href="/timetable" className="text-button">
                    Shape your teaching day <ArrowRight size={15} />
                  </Link>
                </section>
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-title">
                    <h2>Today’s learning journey</h2>
                    <Link href="/timetable">
                      View timetable <ArrowUpRight size={16} />
                    </Link>
                  </div>
                  {plan.input.grades.map((g) => (
                    <div className="journey" key={g.id}>
                      <span className={`grade-badge g${g.id}`}>{g.id}</span>
                      <div>
                        <b>{g.subject}</b>
                        <small>
                          Class {g.id} · {g.students} learners · {g.level}
                        </small>
                      </div>
                      <span className="pill">
                        {plan.attention.find((a) => a.grade === g.id)?.minutes}{" "}
                        min with you
                      </span>
                    </div>
                  ))}
                </section>
                <section className="panel challenge-card">
                  <span className="eyebrow">BECAUSE NO TWO DAYS ARE ALIKE</span>
                  <RefreshCw size={28} />
                  <h2>A surprise in your school day?</h2>
                  <p>
                    Try losing 30 minutes. See how your classroom adapts,
                    without leaving anyone behind.
                  </p>
                  <Link href="/replanning" className="button">
                    Meet the replanning lab <ArrowUpRight size={16} />
                  </Link>
                </section>
              </div>
            </>
          )}
          {page === "timetable" && (
            <>
              <section className="panel">
                <div className="panel-title">
                  <h2>Shape your day</h2>
                  <span className="pill">Deterministic · offline capable</span>
                </div>
                <div className="form-row">
                  <label>
                    Available minutes
                    <input
                      type="number"
                      min="15"
                      max="480"
                      value={input.minutes}
                      onChange={(e) =>
                        setInput({ ...input, minutes: +e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Break starts after (min)
                    <input
                      type="number"
                      value={input.breakStart}
                      onChange={(e) =>
                        setInput({ ...input, breakStart: +e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Break duration
                    <input
                      type="number"
                      value={input.breakDuration}
                      onChange={(e) =>
                        setInput({ ...input, breakDuration: +e.target.value })
                      }
                    />
                  </label>
                </div>
                {input.grades.map((g, i) => (
                  <div className="grade-fields" key={g.id}>
                    <label>
                      Grade
                      <input
                        type="number"
                        value={g.id}
                        onChange={(e) =>
                          setInput({
                            ...input,
                            grades: input.grades.map((x, j) =>
                              j === i ? { ...x, id: +e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </label>
                    {(
                      [
                        "students",
                        "subject",
                        "duration",
                        "priority",
                        "level",
                      ] as const
                    ).map((key) => (
                      <label key={key}>
                        {
                          {
                            students: "Students",
                            subject: "Subject",
                            duration: "Required min",
                            priority: "Priority (1–5)",
                            level: "Learning level",
                          }[key]
                        }
                        <input
                          type={
                            ["students", "duration", "priority"].includes(key)
                              ? "number"
                              : "text"
                          }
                          value={g[key]}
                          onChange={(e) =>
                            setInput({
                              ...input,
                              grades: input.grades.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      [key]: [
                                        "students",
                                        "duration",
                                        "priority",
                                      ].includes(key)
                                        ? +e.target.value
                                        : e.target.value,
                                    }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                    <button
                      aria-label={`Remove Class ${g.id}`}
                      onClick={() =>
                        setInput({
                          ...input,
                          grades: input.grades.filter((_, j) => j !== i),
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="actions">
                  <button
                    onClick={() =>
                      setInput({
                        ...input,
                        grades: [
                          ...input.grades,
                          {
                            id:
                              Math.max(...input.grades.map((g) => g.id), 1) + 1,
                            students: 10,
                            subject: "Reading",
                            duration: 30,
                            priority: 2,
                            level: "Developing",
                          },
                        ],
                      })
                    }
                  >
                    <Plus size={15} /> Add grade
                  </button>
                  <button className="button" onClick={calculate}>
                    Generate timetable <Sparkles size={16} />
                  </button>
                  <button onClick={() => approve(plan)}>
                    Approve & save current plan
                  </button>
                </div>
              </section>
              <section className="panel">
                <Legend />
                <Schedule plan={plan} />
                <Unmet plan={plan} />
              </section>
            </>
          )}
          {page === "activities" && (
            <>
              <div className="actions">
                <label>
                  Subject
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    {[
                      "All",
                      ...new Set(plan.activities.map((a) => a.subject)),
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <span className="pill">
                  Structured learning for every unattended group
                </span>
              </div>
              <div className="activity-grid">
                {plan.activities
                  .filter((a) => filter === "All" || a.subject === filter)
                  .map((a) => (
                    <section className="panel activity" key={a.grade}>
                      <span className="eyebrow">
                        CLASS {a.grade} · {a.subject}
                      </span>
                      <h2>Little steps, real discovery.</h2>
                      {(
                        ["primary", "followUp", "easier", "checkpoint"] as const
                      ).map((k, i) => (
                        <div className="activity-step" key={k}>
                          <span>0{i + 1}</span>
                          <div>
                            <b>
                              {
                                [
                                  "Primary activity · developing",
                                  "Follow-up · stretch",
                                  "Easier alternative · supported",
                                  "Teacher checkpoint",
                                ][i]
                              }
                            </b>
                            <p>{a[k]}</p>
                          </div>
                        </div>
                      ))}
                      <div className="actions">
                        <button
                          className="button small"
                          onClick={() =>
                            persist(
                              "completion",
                              { grade: a.grade, completed: true },
                              `completion-${a.grade}`,
                            )
                          }
                        >
                          <Check size={15} />
                          {items.some(
                            (r) => r.id === `${owner}:completion-${a.grade}`,
                          )
                            ? "Completed"
                            : "Mark complete"}
                        </button>
                        <button
                          onClick={() =>
                            persist("activity", a, `activity-${a.grade}`)
                          }
                        >
                          Approve template
                        </button>
                      </div>
                    </section>
                  ))}
              </div>
            </>
          )}
          {page === "replanning" && (
            <>
              <section className="panel challenge-controls">
                <div>
                  <span className="eyebrow">JUDGE CHALLENGE MODE</span>
                  <h2>What does today have in store?</h2>
                  <p>
                    Introduce a real constraint. Watch the timetable actually
                    change.
                  </p>
                </div>
                <label>
                  Minutes lost
                  <input
                    type="number"
                    min="0"
                    max={plan.input.minutes - 15}
                    value={lost}
                    onChange={(e) => setLost(+e.target.value)}
                  />
                </label>
                <label>
                  Grade needing support
                  <select
                    value={priority}
                    onChange={(e) => setPriority(+e.target.value)}
                  >
                    {plan.input.grades.map((g) => (
                      <option key={g.id} value={g.id}>
                        Class {g.id} · priority 5
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button" onClick={challenge}>
                  Challenge RuralClass <RefreshCw size={17} />
                </button>
                <button
                  onClick={() => {
                    setProposal(null);
                    setLost(30);
                    setPriority(3);
                  }}
                >
                  Reset
                </button>
              </section>
              <div className="compare-grid">
                <section className="panel">
                  <span className="eyebrow">
                    BEFORE · {plan.input.minutes} MINUTES
                  </span>
                  <h2>The original rhythm</h2>
                  <Schedule plan={plan} />
                </section>
                <section className="panel revised">
                  <span className="eyebrow">
                    AFTER · {proposal?.input.minutes ?? "—"} MINUTES
                  </span>
                  <h2>A new way forward</h2>
                  {proposal ? (
                    <>
                      <Schedule plan={proposal} />
                      <Unmet plan={proposal} />
                    </>
                  ) : (
                    <div className="empty-state">
                      <RefreshCw />
                      <p>Introduce a challenge to calculate a revised plan.</p>
                    </div>
                  )}
                </section>
              </div>
              {proposal && (
                <section className="panel">
                  <h2>Every change, explained.</h2>
                  {explain(plan, proposal).map((s) => (
                    <p key={s}>{s}</p>
                  ))}
                  <p>
                    Priority-weighted, fair-share heuristic. This is a feasible
                    proposal, not a proof of mathematical optimality.
                  </p>
                  <button className="button" onClick={() => approve(proposal)}>
                    Approve revised timetable <Check size={16} />
                  </button>
                </section>
              )}
            </>
          )}
          {page === "assistant" && (
            <section className="panel assistant">
              <span className="assistant-symbol">
                <Sparkles size={30} />
              </span>
              <h2>A little help for a big responsibility.</h2>
              <p>
                Cloud AI when configured. Transparent local commands otherwise.
                <br />
                Proposals are never saved without your approval.
              </p>
              <div className="suggestions">
                {[
                  "Class 3 is struggling. Reduce available time to 120 minutes.",
                  "Generate today’s timetable.",
                  "Show Class 2 activities.",
                ].map((s) => (
                  <button key={s} onClick={() => setMessage(s)}>
                    {s}
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
              <label className="sr-only" htmlFor="message">
                Teacher request
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What would make your teaching day easier?"
                maxLength={2000}
              />
              <button
                className="button"
                disabled={busy || !message.trim()}
                onClick={assistant}
              >
                {busy ? "Preparing proposal…" : "Ask your companion"}
                <ArrowRight size={16} />
              </button>
              {answer && (
                <div className="answer" role="status">
                  {answer}
                </div>
              )}
              {proposal && (
                <>
                  <Schedule plan={proposal} />
                  <Unmet plan={proposal} />
                  <button className="button" onClick={() => approve(proposal)}>
                    Approve proposed timetable
                  </button>
                </>
              )}
            </section>
          )}
          {page === "analytics" && (
            <>
              <div className="dashboard-grid">
                <section className="panel">
                  <h2>Small steps, visible growth.</h2>
                  <p>
                    Fictional baseline scores until assessments are recorded.
                  </p>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chart}>
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Bar
                          dataKey="progress"
                          fill="#5b9274"
                          name="Assessment score (%)"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
                <section className="panel">
                  <h2>Record a classroom assessment</h2>
                  <label>
                    Grade
                    <select
                      value={assessmentGrade}
                      onChange={(e) => setAssessmentGrade(+e.target.value)}
                    >
                      {plan.input.grades.map((g) => (
                        <option key={g.id} value={g.id}>
                          Class {g.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Score (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={score}
                      onChange={(e) => setScore(+e.target.value)}
                    />
                  </label>
                  <button
                    className="button"
                    onClick={() =>
                      Number.isFinite(score) && score >= 0 && score <= 100
                        ? persist("assessment", {
                            grade: assessmentGrade,
                            score,
                            subject: plan.input.grades.find(
                              (g) => g.id === assessmentGrade,
                            )?.subject,
                          })
                        : setNotice("Score must be between 0 and 100.")
                    }
                  >
                    Record assessment
                  </button>
                </section>
              </div>
              <section className="panel">
                <h2>Support, with a reason.</h2>
                {chart.map((g) => (
                  <div className="journey" key={g.name}>
                    <b>{g.name}</b>
                    <span>{g.progress}%</span>
                    <span className="pill">
                      {g.progress < 60
                        ? "Guided small-group support"
                        : "Independent practice + stretch tasks"}
                    </span>
                  </div>
                ))}
                <p>
                  Transparent rule: scores below 60% flag support. These are
                  guidance rules, not validated predictions.
                </p>
                <h3>Assessment history</h3>
                {items
                  .filter((r) => r.kind === "assessment")
                  .map((r) => (
                    <p key={r.id}>
                      {new Date(r.updatedAt).toLocaleDateString()} · Class{" "}
                      {(r.value as { grade: number }).grade} ·{" "}
                      {(r.value as { score: number }).score}%
                    </p>
                  ))}
              </section>
            </>
          )}
          {page === "simulation" && (
            <section className="panel">
              <div className="panel-title">
                <h2>
                  {time(plan.blocks[selected]?.start ?? 0)} ·{" "}
                  {plan.blocks[selected]?.break
                    ? "Classroom break"
                    : plan.blocks[selected]?.teacher
                      ? `Teacher with Class ${plan.blocks[selected].teacher}`
                      : "All groups practice independently"}
                </h2>
                <button
                  className="button small"
                  onClick={() => setPlaying(!playing)}
                >
                  {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
                  {playing ? "Pause" : "Play"}
                </button>
              </div>
              <FlatRoom
                active={plan.blocks[selected]?.teacher ?? 0}
                onSelect={(g) => {
                  const index = plan.blocks.findIndex((b) => b.teacher === g);
                  if (index >= 0) setSelected(index);
                }}
              />
              <label>
                Classroom timeline
                <input
                  type="range"
                  min="0"
                  max={plan.blocks.length - 1}
                  value={selected}
                  onChange={(e) => setSelected(+e.target.value)}
                />
              </label>
              <Schedule
                plan={plan}
                selected={selected}
                onSelect={setSelected}
              />
            </section>
          )}
          {page === "portal" && (
            <div className="dashboard-grid">
              <section className="panel">
                <h2>
                  {owner === "demo"
                    ? "A warm welcome, teacher."
                    : "Your private classroom"}
                </h2>
                <p>
                  {supabase
                    ? "Supabase authentication enabled."
                    : "Cloud authentication is not configured. Explore the full fictional demo without an account."}
                </p>
                {owner === "demo" ? (
                  <>
                    <label>
                      Email
                      <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="password"
                        minLength={8}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </label>
                    <div className="actions">
                      <button
                        className="button"
                        disabled={busy || !email || password.length < 8}
                        onClick={() => auth()}
                      >
                        Sign in
                      </button>
                      <button
                        disabled={busy || !email || password.length < 8}
                        onClick={() => auth(true)}
                      >
                        Create account
                      </button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => supabase?.auth.signOut()}>
                    <LogOut size={16} /> Sign out
                  </button>
                )}
                <p>
                  Shared device? Sign out after use. Local records remain on
                  this device; export and clear them when finished.
                </p>
              </section>
              <section className="panel">
                <h2>Teacher profile</h2>
                <label>
                  Display name
                  <input
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                  />
                </label>
                <button
                  onClick={() =>
                    persist("profile", { name: profile }, "profile")
                  }
                >
                  Save profile on device
                </button>
                <Link className="button" href="/timetable">
                  Set up your classroom <ArrowUpRight size={16} />
                </Link>
              </section>
              <section className="panel">
                <h2>Saved timetables</h2>
                {items
                  .filter((r) => r.kind === "plan")
                  .map((r) => (
                    <button
                      className="saved-row"
                      key={r.id}
                      onClick={() => {
                        const p = generate((r.value as Plan).input);
                        setPlan(p);
                        setInput(p.input);
                        setNotice("Saved timetable loaded.");
                      }}
                    >
                      {new Date(r.updatedAt).toLocaleString()}
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
              </section>
              <section className="panel">
                <h2>Activity history</h2>
                {items
                  .filter(
                    (r) => r.kind === "completion" || r.kind === "activity",
                  )
                  .map((r) => (
                    <p key={r.id}>
                      {r.kind} · Class {(r.value as { grade: number }).grade} ·{" "}
                      {new Date(r.updatedAt).toLocaleDateString()}
                    </p>
                  ))}
              </section>
            </div>
          )}
          {page === "offline" && (
            <>
              <section className="panel">
                <div className="panel-title">
                  <div>
                    <span className="eyebrow">ON THIS DEVICE</span>
                    <h2>Your classroom goes with you.</h2>
                  </div>
                  <span className="pill">
                    {online ? "Connected" : "Offline"} · {pending} local records
                    pending
                  </span>
                </div>
                <p>
                  Local records use IndexedDB. Application resources cache after
                  a successful production visit. Cloud AI and authentication
                  require a connection. Offline readiness must be tested on this
                  browser.
                </p>
                <div className="actions">
                  <button className="button" onClick={exportData}>
                    <Download size={16} /> Export local records
                  </button>
                  <button disabled={!online || busy} onClick={sync}>
                    <RefreshCw size={16} /> Synchronize
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        !confirm(
                          "Delete this account’s local records from this shared device? Export first.",
                        )
                      )
                        return;
                      const db = await new Promise<IDBDatabase>(
                        (resolve, reject) => {
                          const r = indexedDB.open("ruralclass", 1);
                          r.onsuccess = () => resolve(r.result);
                          r.onerror = () => reject(r.error);
                        },
                      );
                      const tx = db.transaction("records", "readwrite");
                      for (const r of items)
                        tx.objectStore("records").delete(r.id);
                      tx.oncomplete = () => {
                        db.close();
                        setItems([]);
                        setNotice("Local records cleared.");
                      };
                      tx.onerror = () => setNotice("Could not clear records.");
                    }}
                  >
                    Clear device records
                  </button>
                </div>
              </section>
              <div className="dashboard-grid">
                <section className="panel">
                  <h2>Classroom notebook</h2>
                  <label>
                    Today’s observation
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={4000}
                    />
                  </label>
                  <button
                    className="button"
                    disabled={!note.trim()}
                    onClick={() => persist("observation", { note })}
                  >
                    Save note locally
                  </button>
                  {items
                    .filter((r) => r.kind === "observation")
                    .map((r) => (
                      <p key={r.id}>{(r.value as { note: string }).note}</p>
                    ))}
                </section>
                <section className="panel">
                  <h2>Attendance</h2>
                  <label>
                    Learners present
                    <input
                      type="number"
                      min="0"
                      max={total}
                      value={attendance}
                      onChange={(e) => setAttendance(+e.target.value)}
                    />
                  </label>
                  <button
                    className="button"
                    onClick={() =>
                      Number.isInteger(attendance) &&
                      attendance >= 0 &&
                      attendance <= total
                        ? persist(
                            "attendance",
                            {
                              present: attendance,
                              total,
                              date: new Date().toISOString().slice(0, 10),
                            },
                            `attendance-${new Date().toISOString().slice(0, 10)}`,
                          )
                        : setNotice("Attendance must fit the classroom size.")
                    }
                  >
                    Record attendance
                  </button>
                  <p>
                    Use grade totals or fictional identifiers. Avoid storing
                    children’s personal details on shared devices.
                  </p>
                </section>
              </div>
            </>
          )}
          {page === "impact" && (
            <section className="panel prose">
              <span className="eyebrow">OUR PURPOSE</span>
              <h2>A fairer share of attention.</h2>
              <p>
                RuralClass coordinates the classroom while teacher attention
                moves between grades. It combines attention-aware scheduling,
                structured independent activities, and constraint-driven
                replanning.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Capability</th>
                    <th>Traditional timetable</th>
                    <th>Generic lesson planner</th>
                    <th>RuralClass</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      "Teacher conflict prevention",
                      "Manual",
                      "Not guaranteed",
                      "Deterministic",
                    ],
                    [
                      "Unattended groups",
                      "Teacher plans",
                      "Content suggestions",
                      "Activity + alternative + checkpoint",
                    ],
                    [
                      "Interrupted day",
                      "Manual rewrite",
                      "Prompt again",
                      "Recalculate locally",
                    ],
                    [
                      "Internet required",
                      "No",
                      "Usually",
                      "No for local planning",
                    ],
                  ].map((row) => (
                    <tr key={row[0]}>
                      {row.map((c) => (
                        <td key={c}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3>Research, without inflated claims</h3>
              <p>
                Consult the{" "}
                <a
                  href="https://udiseplus.gov.in/"
                  target="_blank"
                  rel="noreferrer"
                >
                  official UDISE+ school education reports
                </a>{" "}
                for national staffing data and{" "}
                <a
                  href="https://asercentre.org/"
                  target="_blank"
                  rel="noreferrer"
                >
                  ASER Centre
                </a>{" "}
                for learning-level research. A national count of single-teacher
                schools is not a measurement of multi-grade classroom
                prevalence. No unverified national statistics or field outcomes
                are presented here.
              </p>
              <h3>What we will measure</h3>
              <p>
                Teacher conflicts (target zero), independent activity coverage,
                unmet requested minutes, observed planning time, teacher
                acceptance, and classroom feasibility. All figures in this demo
                are fictional or calculated from the displayed inputs; no field
                trial has been conducted.
              </p>
            </section>
          )}
          {page === "presentation" && (
            <section className="panel presentation">
              <div className="step-dots">
                {[0, 1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    aria-label={`Presentation step ${n + 1}`}
                    className={step === n ? "active" : ""}
                    onClick={() => setStep(n)}
                  >
                    {n + 1}
                  </button>
                ))}
              </div>
              <span className="eyebrow">
                STEP {step + 1} OF 5 · ABOUT 3 MINUTES
              </span>
              <h2>
                {
                  [
                    "One teacher. Three grades.",
                    "A rhythm for every learner.",
                    "No group left waiting.",
                    "A school day takes a turn.",
                    "Less time. Learning continues.",
                  ][step]
                }
              </h2>
              <p>
                {
                  [
                    "The challenge is sharing attention, not just creating lesson content.",
                    "This timetable is calculated from real inputs with one teacher and no overlapping instruction.",
                    "Each group gets a primary task, a follow-up, an easier alternative, and a checkpoint.",
                    "Thirty minutes lost. Class 3 needs more support. Run the challenge to recalculate.",
                    "Review the trade-offs. Approve the new day only when it works for your classroom.",
                  ][step]
                }
              </p>
              {step === 0 ? (
                <FlatRoom active={active} onSelect={setActive} />
              ) : step === 1 ? (
                <Schedule plan={plan} />
              ) : step === 2 ? (
                <div className="activity-grid">
                  {plan.activities.map((a) => (
                    <div className="activity-step" key={a.grade}>
                      <div>
                        <b>Class {a.grade}</b>
                        <p>{a.primary}</p>
                        <small>{a.easier}</small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : step === 3 ? (
                <button
                  className="button"
                  onClick={() => {
                    challenge();
                    setStep(4);
                  }}
                >
                  Introduce the 30-minute interruption <RefreshCw size={17} />
                </button>
              ) : proposal ? (
                <>
                  <Schedule plan={proposal} />
                  {explain(plan, proposal).map((s) => (
                    <p key={s}>{s}</p>
                  ))}
                  <button className="button" onClick={() => approve(proposal)}>
                    Approve revised day
                  </button>
                </>
              ) : (
                <button onClick={challenge}>Calculate revised timetable</button>
              )}
              <div className="actions">
                <button onClick={() => setStep(0)}>Restart</button>
                <button disabled={step === 0} onClick={() => setStep(step - 1)}>
                  Back
                </button>
                <button
                  className="button"
                  disabled={step === 4}
                  onClick={() => setStep(step + 1)}
                >
                  Next <ArrowRight size={16} />
                </button>
              </div>
            </section>
          )}
          {!loaded && (
            <p className="subtle">Opening local classroom records…</p>
          )}
          <div className="workspace-footer">
            <span>
              <Leaf size={14} /> Made for small schools. Designed for big
              possibilities.
            </span>
            <span>Fictional demo · Your approval matters</span>
          </div>
        </main>
      </div>
    </div>
  );
}
function Legend() {
  return (
    <div className="legend">
      <span>
        <i className="teacher" /> Teacher-led
      </span>
      <span>
        <i className="independent" /> Independent activity
      </span>
      <span>
        <i className="break" /> Break
      </span>
    </div>
  );
}
function Unmet({ plan }: { plan: Plan }) {
  return plan.unmet.length ? (
    <div className="warning" role="status">
      Unmet requirements:{" "}
      {plan.unmet
        .map((g) => `Class ${g.grade}: ${g.minutes} minutes`)
        .join(" · ")}
      . These lessons need another session.
    </div>
  ) : (
    <p className="success">
      <Check size={15} /> All requested teaching minutes fit this plan.
    </p>
  );
}

class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
