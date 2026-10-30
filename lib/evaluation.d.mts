import type { Plan } from "./engine.mjs";
export type Audit = {
  valid: boolean;
  checks: { id: string; label: string; passed: boolean; detail: string }[];
  teacherConflictMinutes: number;
  groupOverlapMinutes: number;
  breakViolationMinutes: number;
  invalidBlocks: number;
  unplannedGradeMinutes: number;
  availableMinutes: number;
  independentRequiredMinutes: number;
  independentCoveredMinutes: number;
  independentCoverage: number;
  requestedTeachingMinutes: number;
  allocatedTeachingMinutes: number;
  unmetMinutes: number;
  attention: {
    grade: number;
    requested: number;
    allocated: number;
    unmet: number;
  }[];
};
export const criteria: {
  id: string;
  title: string;
  evidence: string;
  limit: string;
}[];
export function auditSchedule(plan: Plan): Audit;
export function scheduleRequest(body: unknown): {
  plan: Plan;
  audit: Audit;
  source: string;
};
export function evidenceReport(
  before: Plan,
  after: Plan | null,
  options?: { notes?: string; online?: boolean | null; scenario?: string },
): {
  project: string;
  event: string;
  generatedAt: string;
  scenario: string;
  evidenceType: string;
  algorithm: string;
  before: { plan: Plan; audit: Audit };
  after: { plan: Plan; audit: Audit } | null;
  criteria: typeof criteria;
  notes: string;
  observations: Record<string, unknown>;
  references: { source: string; tests: string; research: string[] };
};
export function judgeBrief(report: ReturnType<typeof evidenceReport>): string;
export function referenceScenario(): Plan;
