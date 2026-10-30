"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CloudOff,
  Code2,
  Download,
  HeartHandshake,
  Layers3,
  Lightbulb,
  LoaderCircle,
  MousePointer2,
  Play,
  Printer,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Schedule, Legend, Unmet } from "./schedule";
import { replan, type Plan } from "@/lib/engine.mjs";
import {
  auditSchedule,
  criteria,
  evidenceReport,
  judgeBrief,
  referenceScenario,
  type Audit,
} from "@/lib/evaluation.mjs";
import { downloadText, printText } from "@/lib/browser-files";
import { supabase } from "@/lib/supabase";
type Health = {
  status: string;
  server: string;
  checkedAt: string;
  requestId: string;
  scheduler: { status: string; passedChecks: number };
  authentication: { configured: boolean; status: string };
  database: { configured: boolean; status: string };
  ai: { provider: string; configured: boolean; status: string };
};
const criterionIcons = [
  Lightbulb,
  HeartHandshake,
  Code2,
  MousePointer2,
  Play,
  ShieldCheck,
];
export default function Evaluation({
  plan,
  online,
  owner,
}: {
  plan: Plan;
  online: boolean;
  owner: string;
}) {
  const [before, setBefore] = useState(plan),
    [after, setAfter] = useState<Plan | null>(null),
    [lost, setLost] = useState(Math.min(45, plan.input.minutes - 15)),
    [grade, setGrade] = useState(
      plan.input.grades.find((g) => g.id === 3)?.id ?? plan.input.grades[0].id,
    ),
    [applied, setApplied] = useState<{ lost: number; grade: number } | null>(
      null,
    ),
    [notes, setNotes] = useState(""),
    [error, setError] = useState(""),
    [health, setHealth] = useState<Health | null>(null),
    [busy, setBusy] = useState(false),
    [api, setApi] = useState<{
      matches: boolean;
      checkedAt: string;
      computeMs: number;
      audit: Audit;
    } | null>(null),
    [localMs, setLocalMs] = useState<number | null>(null),
    [activeCriterion, setActiveCriterion] = useState("innovation"),
    [scenario, setScenario] = useState(
      owner === "demo"
        ? "Fictional demo classroom"
        : "Current classroom snapshot",
    );
  const originalAudit = useMemo(() => auditSchedule(before), [before]);
  const currentAudit = useMemo(
    () => (after ? auditSchedule(after) : originalAudit),
    [after, originalAudit],
  );
  const learners = before.input.grades.reduce((n, g) => n + g.students, 0);
  const dirty = !!applied && (lost !== applied.lost || grade !== applied.grade);
  function challenge() {
    try {
      const started = performance.now();
      const revised = replan(before.input, lost, grade);
      auditSchedule(revised);
      setLocalMs(Math.round((performance.now() - started) * 100) / 100);
      setAfter(revised);
      setApplied({ lost, grade });
      setApi(null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function resetDemo() {
    const baseline = referenceScenario();
    setBefore(baseline);
    setAfter(null);
    setApplied(null);
    setLost(45);
    setGrade(3);
    setApi(null);
    setLocalMs(null);
    setScenario("Fictional 180-minute reference scenario");
    setError("");
  }
  async function checkBackend() {
    setBusy(true);
    setError("");
    setApi(null);
    setHealth(null);
    try {
      const session = (await supabase?.auth.getSession())?.data.session;
      const headers = {
        "Content-Type": "application/json",
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
      };
      const response = await fetch("/api/health", {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok)
        throw Error(
          "Backend self-check failed. Inspect the API response before demonstrating.",
        );
      setHealth(await response.json());
      const check = await fetch("/api/schedule", {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify(
          after && applied
            ? {
                action: "replan",
                input: before.input,
                lostMinutes: applied.lost,
                priorityGrade: applied.grade,
              }
            : { action: "generate", input: before.input },
        ),
      });
      const data = await check.json();
      if (!check.ok) throw Error(data.error || "Scheduling API failed.");
      const independentlyChecked = auditSchedule(data.plan);
      setApi({
        matches:
          JSON.stringify(data.plan) === JSON.stringify(after ?? before) &&
          independentlyChecked.valid,
        checkedAt: data.checkedAt,
        computeMs: data.computeMs,
        audit: independentlyChecked,
      });
    } catch (e) {
      setError(
        !online
          ? "Server APIs need connectivity. The local scenario and evidence export still work offline."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  function report() {
    return evidenceReport(before, after, { notes, online, scenario });
  }
  function exportEvidence() {
    downloadText(
      JSON.stringify(
        {
          ...report(),
          backendObservation: health
            ? { ...health, scheduleParity: api }
            : null,
        },
        null,
        2,
      ),
      "ruralclass-judge-evidence.json",
      "application/json;charset=utf-8",
    );
  }
  function printBrief() {
    try {
      printText(judgeBrief(report()), "RuralClass judge evidence");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const statusLabels: Record<string, string> = {
    not_configured: "Not configured",
    not_checked: "Sign in to verify",
    verified: "Session verified",
    authenticated_read_verified: "Private read verified",
    configured_not_live_verified: "Configured · not live verified",
    session_not_verified: "Session not verified",
    read_failed: "Read failed",
    service_unreachable: "Service unreachable",
    passed: "Reference audit passed",
  };
  const statusText = (status: string) => statusLabels[status] ?? status;
  return (
    <div className="judge-workbench">
      <section className="judge-hero">
        <div className="judge-hero-copy">
          <Badge variant="outline">
            <ClipboardCheck size={12} />
            RAISE · FOUNDRY GAMES 2026
          </Badge>
          <h2>
            A small classroom.
            <br />
            <em>A working system.</em>
          </h2>
          <p>
            Change the constraints, watch the classroom adapt, and inspect the
            evidence behind every decision.
          </p>
          <div className="judge-hero-actions">
            <Button onClick={challenge}>
              <Play />
              Run interruption challenge
            </Button>
            <Button asChild variant="outline">
              <Link href="/presentation">
                Guided 3-minute presentation
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <div className="judge-hero-foot">
            <ShieldCheck size={14} />
            Scenario simulation · Calculated evidence · No field results claimed
          </div>
        </div>
        <div className="judge-scenario-card">
          <span className="eyebrow">THE CLASSROOM WE’RE COORDINATING</span>
          <div className="scenario-orbit">
            <span className="scenario-teacher">
              <Users size={24} />
              <b>1</b>
              <small>teacher</small>
            </span>
            {before.input.grades.slice(0, 3).map((g) => (
              <span
                className={`orbit-grade orbit-${g.id === before.input.grades[0].id ? "first" : g.id === before.input.grades[1]?.id ? "second" : "third"}`}
                key={g.id}
              >
                <BookOpen size={15} />
                <b>Class {g.id}</b>
                <small>{g.students} learners</small>
              </span>
            ))}
          </div>
          <div className="scenario-footer">
            <span>{learners} learners</span>
            <span>{before.input.minutes} minutes</span>
            <span>{before.input.grades.length} grades</span>
          </div>
        </div>
      </section>
      <section
        className="judge-metrics"
        aria-label="Calculated scenario results"
      >
        {[
          {
            icon: ShieldCheck,
            label: "Teacher conflicts",
            value: currentAudit.teacherConflictMinutes,
            suffix: "min",
            detail: "Audited from actual schedule blocks",
          },
          {
            icon: Layers3,
            label: "Planned independent coverage",
            value: currentAudit.independentCoverage,
            suffix: "%",
            detail: `${currentAudit.independentCoveredMinutes} of ${currentAudit.independentRequiredMinutes} required grade-minutes`,
          },
          {
            icon: Clock3,
            label: "Unmet teaching requirements",
            value: currentAudit.unmetMinutes,
            suffix: "min",
            detail: "Visible trade-offs, never silently dropped",
          },
          {
            icon: Users,
            label: "Every group accounted for",
            value: before.input.grades.length,
            suffix: "grades",
            detail: after
              ? `${after.input.minutes} min revised day · ${localMs} ms local calculation`
              : "Run a challenge to inspect a revised day",
          },
        ].map(({ icon: Icon, label, value, suffix, detail }) => (
          <Card key={label}>
            <CardContent>
              <span className="metric-heading">
                <Icon size={16} />
                {label}
              </span>
              <div className="judge-metric-number">
                {value}
                <small>{suffix}</small>
              </div>
              <p>{detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      {error && (
        <div className="judge-error" role="alert">
          <XCircle size={16} />
          {error}
        </div>
      )}
      <div className="judge-main-grid">
        <Card className="judge-challenge">
          <CardHeader>
            <div className="section-label">
              <Badge variant="secondary">LIVE CHALLENGE</Badge>
              <span>Real inputs. Real recalculation.</span>
            </div>
            <CardTitle role="heading" aria-level={2}>
              No two school days are alike.
            </CardTitle>
            <CardDescription>
              Introduce an interruption and a support priority. The local
              scheduling engine recalculates; the constraint audit checks its
              output.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="judge-controls">
              <label htmlFor="judge-lost">
                Teaching time lost
                <input
                  id="judge-lost"
                  type="number"
                  min={0}
                  max={before.input.minutes - 15}
                  value={lost}
                  onChange={(e) => setLost(+e.target.value)}
                />
              </label>
              <label htmlFor="judge-priority">
                Grade needing more support
                <select
                  id="judge-priority"
                  value={grade}
                  onChange={(e) => setGrade(+e.target.value)}
                >
                  {before.input.grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      Class {g.id} · {g.subject}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="judge-presets">
              {[30, 45, 60].map((m) => (
                <Button
                  key={m}
                  variant={lost === m ? "secondary" : "outline"}
                  size="sm"
                  disabled={m > before.input.minutes - 15}
                  onClick={() => setLost(m)}
                >
                  {m} min lost
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button onClick={challenge}>
                <RefreshCw />
                Recalculate scenario
              </Button>
              <Button variant="ghost" onClick={resetDemo}>
                Load 180-minute fictional demo
              </Button>
            </div>
            {dirty && (
              <p className="judge-dirty" role="status">
                Inputs changed. Recalculate to update the displayed evidence.
              </p>
            )}
            <p className="judge-caption">
              This exercise does not overwrite your approved classroom plan.
              Review and save live changes in the{" "}
              <Link href="/replanning">Replanning Lab</Link>.
            </p>
            <div className="judge-budget">
              <div>
                <b>Teacher time, accounted for.</b>
                <span>
                  {currentAudit.allocatedTeachingMinutes}/
                  {currentAudit.availableMinutes} min
                </span>
              </div>
              <meter
                aria-label="Allocated teacher minutes"
                min={0}
                max={Math.max(1, currentAudit.availableMinutes)}
                value={currentAudit.allocatedTeachingMinutes}
              />
              <p>
                Breaks excluded ·{" "}
                {currentAudit.availableMinutes -
                  currentAudit.allocatedTeachingMinutes}{" "}
                buffer minutes · {currentAudit.unmetMinutes} unmet requested
                minutes
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="judge-audit">
          <CardHeader>
            <div className="section-label">
              <Badge variant={currentAudit.valid ? "secondary" : "outline"}>
                {currentAudit.valid ? "AUDIT PASSED" : "AUDIT NEEDS ATTENTION"}
              </Badge>
              <span>
                {currentAudit.checks.filter((c) => c.passed).length}/
                {currentAudit.checks.length} checks
              </span>
            </div>
            <CardTitle role="heading" aria-level={2}>
              Every decision has a check.
            </CardTitle>
            <CardDescription>
              Each rule is inspected independently from the rendered timetable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul>
              {currentAudit.checks.map((c) => (
                <li key={c.id}>
                  {c.passed ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <XCircle size={16} />
                  )}
                  <div>
                    <b>{c.label}</b>
                    <small>{c.detail}</small>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <section className="judge-compare">
        <div className="judge-section-header">
          <div>
            <span className="eyebrow">A DAY, RECONSIDERED</span>
            <h2>
              See what changes.<em> Understand why.</em>
            </h2>
          </div>
          <Badge variant="outline">
            {after
              ? `${before.input.minutes} → ${after.input.minutes} minutes`
              : "Original plan ready"}
          </Badge>
        </div>
        <div className="judge-plan-grid">
          <Card>
            <CardHeader>
              <span className="eyebrow">
                BEFORE · {before.input.minutes} MINUTES
              </span>
              <CardTitle role="heading" aria-level={3}>
                The original rhythm
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Legend />
              <div className="judge-schedule-scroll">
                <Schedule plan={before} />
              </div>
              <Unmet plan={before} />
            </CardContent>
          </Card>
          <Card className={after ? "judge-revised" : ""}>
            <CardHeader>
              <span className="eyebrow">
                AFTER · {after?.input.minutes ?? "—"} MINUTES
              </span>
              <CardTitle role="heading" aria-level={3}>
                A new way forward
              </CardTitle>
            </CardHeader>
            <CardContent>
              {after ? (
                <>
                  <Legend />
                  <div className="judge-schedule-scroll">
                    <Schedule plan={after} />
                  </div>
                  <Unmet plan={after} />
                </>
              ) : (
                <div className="judge-await">
                  <RefreshCw size={30} />
                  <p>
                    Introduce a challenge above.
                    <br />
                    The revised timetable will appear here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        {after && (
          <div className="judge-attention">
            {before.input.grades.map((g) => {
              const old =
                originalAudit.attention.find((a) => a.grade === g.id)
                  ?.allocated ?? 0;
              const next =
                currentAudit.attention.find((a) => a.grade === g.id)
                  ?.allocated ?? 0;
              return (
                <div key={g.id}>
                  <div>
                    <b>Class {g.id}</b>
                    <span>
                      {old} → {next} teacher-led min
                    </span>
                  </div>
                  <div className="attention-track">
                    <span style={{ width: `${(100 * old) / g.duration}%` }} />
                    <strong
                      style={{ width: `${(100 * next) / g.duration}%` }}
                    />
                  </div>
                  <small>
                    {next - old >= 0 ? "+" : ""}
                    {next - old} min · {Math.max(0, g.duration - next)}{" "}
                    requested minutes still unmet
                  </small>
                </div>
              );
            })}
          </div>
        )}
        <p className="judge-caption">
          Activity coverage measures assigned plans, not student engagement.
          Unmet requests remain visible even when every scheduling constraint
          passes.
        </p>
      </section>
      <section className="judge-criteria">
        <div className="judge-section-header">
          <div>
            <span className="eyebrow">LEVEL 2 · FINAL EVALUATION</span>
            <h2>
              Six criteria.<em> Evidence you can inspect.</em>
            </h2>
          </div>
          <span className="judge-caption">
            Your rubric, mapped to real behavior.
          </span>
        </div>
        <Tabs value={activeCriterion} onValueChange={setActiveCriterion}>
          <div className="judge-tab-scroll">
            <TabsList>
              {criteria.map((c, i) => {
                const Icon = criterionIcons[i];
                return (
                  <TabsTrigger key={c.id} value={c.id}>
                    <Icon size={14} />
                    {c.title}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
          {criteria.map((c, i) => {
            const Icon = criterionIcons[i];
            return (
              <TabsContent key={c.id} value={c.id}>
                <Card className="criterion-card">
                  <CardHeader>
                    <div className="criterion-heading">
                      <span className="criterion-icon">
                        <Icon size={23} />
                      </span>
                      <div>
                        <span className="eyebrow">CRITERION 0{i + 1}</span>
                        <CardTitle role="heading" aria-level={2}>
                          {c.title}
                        </CardTitle>
                      </div>
                    </div>
                    <CardDescription>{c.evidence}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {c.id === "innovation" && (
                      <>
                        <div className="innovation-grid">
                          {(
                            [
                              [
                                Clock3,
                                "Attention-aware scheduling",
                                "Allocate scarce teacher time using priorities, support levels, group size, and real durations.",
                              ],
                              [
                                Layers3,
                                "Learning continuity",
                                "Each unattended grade has a primary task, follow-up, easier alternative, and checkpoint.",
                              ],
                              [
                                RefreshCw,
                                "Adaptive replanning",
                                "Recalculate when the day changes and explain which teaching requests no longer fit.",
                              ],
                            ] as const
                          ).map(([Glyph, title, description]) => (
                            <div key={String(title)}>
                              <Glyph size={20} />
                              <h3>{String(title)}</h3>
                              <p>{String(description)}</p>
                            </div>
                          ))}
                        </div>
                        <p>
                          Our differentiator is coordinating what happens while
                          the teacher teaches another grade. The scheduler is a
                          transparent heuristic—not a claim of mathematical
                          optimality.
                        </p>
                        <Button asChild variant="outline">
                          <Link href="/activities">
                            Inspect the continuity board
                            <ArrowUpRight />
                          </Link>
                        </Button>
                      </>
                    )}
                    {c.id === "impact" && (
                      <>
                        <div className="impact-proof">
                          <strong>
                            {currentAudit.requestedTeachingMinutes}
                            <small>teacher minutes requested</small>
                          </strong>
                          <ArrowRight />
                          <strong>
                            {currentAudit.availableMinutes}
                            <small>teacher minutes available</small>
                          </strong>
                          <ArrowRight />
                          <strong>
                            {currentAudit.unmetMinutes}
                            <small>minutes still unmet</small>
                          </strong>
                        </div>
                        <p>
                          Intended users are teachers coordinating multiple
                          grades with limited attention. The credible near-term
                          benefit is a clearer, conflict-free plan and fewer
                          unplanned group-minutes—not a promised improvement in
                          learning outcomes.
                        </p>
                        <div className="pilot-plan">
                          <b>How we will evaluate impact with teachers</b>
                          <ol>
                            <li>
                              Measure planning time on the same scenario with
                              and without the tool.
                            </li>
                            <li>
                              Observe independent-task suitability and classroom
                              feasibility.
                            </li>
                            <li>
                              Record teacher acceptance, conflicts, coverage,
                              and unmet teaching requests.
                            </li>
                          </ol>
                          <small>
                            No field testing has been conducted. Single-teacher
                            school counts must not be presented as multi-grade
                            classroom counts.
                          </small>
                        </div>
                        <Button asChild variant="outline">
                          <Link href="/impact">
                            Research and impact boundaries
                            <ArrowUpRight />
                          </Link>
                        </Button>
                      </>
                    )}
                    {c.id === "execution" && (
                      <>
                        <div className="system-check">
                          <div>
                            <span className="eyebrow">
                              FRONTEND → API → SCHEDULER
                            </span>
                            <h3>Check the actual backend.</h3>
                            <p>
                              Send this scenario to the server and compare its
                              output to the browser calculation.
                            </p>
                          </div>
                          <Button
                            onClick={checkBackend}
                            disabled={busy || dirty}
                          >
                            {busy ? (
                              <LoaderCircle className="animate-spin" />
                            ) : (
                              <Server />
                            )}
                            {busy
                              ? "Checking actual services…"
                              : "Run live system check"}
                          </Button>
                        </div>
                        <div className="service-grid">
                          <Service
                            name="Next.js API"
                            status={
                              health?.server === "responding"
                                ? "Responding"
                                : "Not checked"
                            }
                            good={health?.server === "responding"}
                          />
                          <Service
                            name="Server scheduler"
                            status={
                              api
                                ? api.matches
                                  ? "Matches local calculation"
                                  : "Mismatch — investigate"
                                : "Not checked"
                            }
                            good={!!api?.matches}
                          />
                          <Service
                            name="Supabase session"
                            status={
                              health
                                ? statusText(health.authentication.status)
                                : "Not checked"
                            }
                            good={health?.authentication.status === "verified"}
                          />
                          <Service
                            name="Private database"
                            status={
                              health
                                ? statusText(health.database.status)
                                : "Not checked"
                            }
                            good={
                              health?.database.status ===
                              "authenticated_read_verified"
                            }
                          />
                          <Service
                            name="Cloud AI"
                            status={
                              health
                                ? statusText(health.ai.status)
                                : "Not checked"
                            }
                            good={false}
                          />
                          <Service
                            name="Local calculation"
                            status={
                              currentAudit.valid
                                ? "Audited in this browser"
                                : "Audit failed"
                            }
                            good={currentAudit.valid}
                          />
                        </div>
                        {api && (
                          <div className="api-evidence" role="status">
                            <ShieldCheck size={17} />
                            <div>
                              <b>
                                {api.matches
                                  ? "Frontend/backend parity verified for this scenario."
                                  : "The outputs differ; inspect before demonstrating."}
                              </b>
                              <small>
                                Server calculation: {api.computeMs} ms · Checked{" "}
                                {new Date(api.checkedAt).toLocaleTimeString()}
                              </small>
                            </div>
                          </div>
                        )}
                        {health && (
                          <details className="judge-json">
                            <summary>
                              Inspect the live, secret-free API response
                            </summary>
                            <pre>
                              {JSON.stringify(
                                { health, scenarioCheck: api },
                                null,
                                2,
                              )}
                            </pre>
                          </details>
                        )}
                        <p className="judge-caption">
                          The health check makes no paid AI call. A private read
                          verifies only the current session’s read operation,
                          not writes or cross-account isolation. Full test
                          evidence and reproduction commands are in the
                          repository.
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <Button asChild variant="outline">
                            <a
                              href="https://github.com/DaRsHAN26GIT/project/actions"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Inspect GitHub checks
                              <ArrowUpRight />
                            </a>
                          </Button>
                          <Button asChild variant="ghost">
                            <Link href="/assistant">
                              Test the teacher assistant
                              <ArrowRight />
                            </Link>
                          </Button>
                        </div>
                      </>
                    )}
                    {c.id === "uiux" && (
                      <>
                        <div className="ux-grid">
                          {(
                            [
                              [
                                Check,
                                "Clarity before decoration",
                                "Before/after schedules, explicit unmet requirements, source labels, and teacher approval.",
                              ],
                              [
                                MousePointer2,
                                "Keyboard and mobile access",
                                "Radix-backed tabs and dialogs, visible focus, labelled controls, and responsive navigation.",
                              ],
                              [
                                CloudOff,
                                "A resilient classroom journey",
                                "IndexedDB records, cached application shell, offline scheduling, and a limited local assistant.",
                              ],
                              [
                                Sparkles,
                                "3D with a practical fallback",
                                "Lazy-loaded geometry and native scene labels; reduced-motion and 2D alternatives.",
                              ],
                            ] as const
                          ).map(([Glyph, title, description]) => (
                            <div key={String(title)}>
                              <Glyph size={19} />
                              <b>{String(title)}</b>
                              <p>{String(description)}</p>
                            </div>
                          ))}
                        </div>
                        <p>
                          Judge the actual journey: generate → inspect →
                          interrupt → replan → review → approve. The public demo
                          uses fictional data and needs no login.
                        </p>
                        <Button asChild variant="outline">
                          <Link href="/timetable">
                            Try the teacher journey
                            <ArrowUpRight />
                          </Link>
                        </Button>
                      </>
                    )}
                    {c.id === "demo" && (
                      <>
                        <ol className="judge-demo-path">
                          {[
                            [
                              "0:00–0:30",
                              "Show the attention problem",
                              "One teacher, multiple grades, and actual requested teaching minutes.",
                            ],
                            [
                              "0:30–1:15",
                              "Inspect a calculated timetable",
                              "Point to one teacher at a time, breaks, and independent tasks for other groups.",
                            ],
                            [
                              "1:15–2:00",
                              "Introduce a judge-chosen interruption",
                              "Change lost minutes and the support grade above; recalculate live.",
                            ],
                            [
                              "2:00–2:40",
                              "Explain the trade-offs",
                              "Compare allocated attention, unmet requests, and the independent constraint audit.",
                            ],
                            [
                              "2:40–3:00",
                              "Show the engineering evidence",
                              "Run the scheduling API comparison and export the scenario report.",
                            ],
                          ].map(([duration, title, description]) => (
                            <li key={title}>
                              <span>{duration}</span>
                              <div>
                                <b>{title}</b>
                                <p>{description}</p>
                              </div>
                            </li>
                          ))}
                        </ol>
                        <Button asChild>
                          <Link href="/presentation">
                            <Play />
                            Open guided presentation
                          </Link>
                        </Button>
                        <p className="judge-caption">
                          For the offline demonstration, visit and cache the
                          production app first, disable network, reload the
                          cached page, and rerun the local challenge. Server API
                          checks are expected to be unavailable offline.
                        </p>
                      </>
                    )}
                    {c.id === "feasibility" && (
                      <>
                        <div className="feasibility-table">
                          <table>
                            <thead>
                              <tr>
                                <th>Capability</th>
                                <th>Needed to run</th>
                                <th>Practical boundary</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                [
                                  "Local planning",
                                  "A modern browser; 1–8 grades, 15–480 minutes",
                                  "Heuristic allocation; the teacher reviews task suitability.",
                                ],
                                [
                                  "Offline workspace",
                                  "Successful production caching and IndexedDB",
                                  "First visit needs connectivity; shared-device records are not encrypted.",
                                ],
                                [
                                  "Server APIs",
                                  "Next.js running locally or on Vercel",
                                  "Internet/server availability is separate from local planning.",
                                ],
                                [
                                  "Private cloud records",
                                  "Configured Supabase, schema, and signed-in account",
                                  "RLS and real account workflows need live integration validation.",
                                ],
                                [
                                  "Cloud assistant",
                                  "A configured provider, account, and API billing",
                                  "Cloud inference needs connectivity; no browser model is bundled.",
                                ],
                              ].map((row) => (
                                <tr key={row[0]}>
                                  {row.map((cell) => (
                                    <td key={cell}>{cell}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p>
                          No separate Python service, large 3D download, or
                          cloud optimizer is required. The deployment and
                          credential steps are documented in the README. AI
                          provider costs depend on actual model use; no
                          unverified cost estimate is presented.
                        </p>
                        <Button asChild variant="outline">
                          <Link href="/offline">
                            Inspect offline records and export
                            <ArrowUpRight />
                          </Link>
                        </Button>
                      </>
                    )}
                    <div className="criterion-boundary">
                      <ShieldCheck size={15} />
                      <span>{c.limit}</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </section>
      <Card className="judge-export">
        <CardHeader>
          <div>
            <Badge variant="secondary">REVIEWABLE EVIDENCE</Badge>
            <CardTitle role="heading" aria-level={2}>
              Leave the judges with more than a pitch.
            </CardTitle>
            <CardDescription>
              Export the exact scenario, both plans, audit results,
              six-criterion mapping, and the boundaries of what was
              demonstrated.
            </CardDescription>
          </div>
          <span className="export-icon">
            <ClipboardCheck size={32} />
          </span>
        </CardHeader>
        <CardContent>
          <label htmlFor="judge-notes">Optional evaluator observations</label>
          <Textarea
            id="judge-notes"
            maxLength={1500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Record what was observed in this demo. Field results remain unmeasured."
          />
          <div className="judge-export-actions">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={exportEvidence} disabled={!after || dirty}>
                <Download />
                Export judge evidence
              </Button>
              <Button
                variant="outline"
                onClick={printBrief}
                disabled={!after || dirty}
              >
                <Printer />
                Print judge brief
              </Button>
            </div>
            <span>
              {after
                ? "Ready to export your calculated scenario."
                : "Run an interruption challenge to create evidence."}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
function Service({
  name,
  status,
  good,
}: {
  name: string;
  status: string;
  good: boolean;
}) {
  return (
    <div className="service-tile">
      {good ? <CheckCircle2 size={17} /> : <Activity size={17} />}
      <strong>{name}</strong>
      <small>{status}</small>
    </div>
  );
}
