# RAISE · FOUNDRY GAMES 2026 — Level 2 evidence map

Use `/evaluation` (Judge’s desk) for the live evidence workbench and `/presentation` for the guided five-step story. These use fictional scenarios and work without model credentials. Preserve the distinction between calculated schedule results, automated software checks, and unmeasured field impact.

| Criterion   | Implemented evidence                                                                                                                                   | How to demonstrate                                                                               | Limit                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Innovation  | Attention-aware scheduling, a four-part continuity activity for every unattended grade, and local replanning                                           | Change lost time and the support grade; inspect attention allocation and actual timetable blocks | Greedy heuristic, not a mathematical optimum or a claim of global novelty                                     |
| Impact      | Visible teaching demand, planned independent coverage, conflicts and unmet requirements                                                                | Compare the original and revised scenario, especially requests that no longer fit                | These are calculated planning measures; student learning gains and teacher acceptance are unmeasured          |
| Execution   | Client scheduler, POST `/api/schedule`, GET `/api/health`, independent constraint audits, tests, build checks, and optional authenticated integrations | Run the live system check; inspect the response and frontend/backend parity                      | A core API success does not prove live Supabase or AI availability                                            |
| UI/UX       | shadcn/ui controls, responsive layouts, keyboard focus, explicit approval, accessible labels, reduced-motion/2D fallback                               | Navigate by keyboard and mobile viewport; open the assistant and review/dismiss a proposal       | Teacher usability research remains necessary                                                                  |
| Demo        | Custom interruption, before/after schedules, audit, exportable JSON and printable brief                                                                | Let a judge choose lost minutes and priority; export the actual scenario after recalculation     | No prerecorded or fabricated replanning result                                                                |
| Feasibility | Browser-based core, IndexedDB, cached production resources, minimal Next.js backend, optional cloud integrations                                       | Disable browser network after caching and reload `/evaluation`; calculate locally                | First visits need connectivity; independent tasks need teacher review; shared-device storage is not encrypted |

## Three-minute demonstration

1. **0:00–0:30 — Problem.** One teacher, three grades, 30 fictional learners. Explain limited attention, rather than simply a shortage of lesson content.
2. **0:30–1:15 — Actual plan.** Show teacher-led and independent sessions, breaks, and the four-part activity structure.
3. **1:15–2:00 — Challenge.** Let the judge set the interruption. The 180-minute reference scenario with 45 minutes lost leaves 125 non-break teaching minutes for 140 requested minutes. The system should report 15 unmet minutes, not pretend everything fits.
4. **2:00–2:40 — Explanation.** Compare attention and check conflicts, horizon, breaks, group overlaps, and planned coverage. Explain that assigning an activity does not prove engagement or learning.
5. **2:40–3:00 — Evidence.** Send the same scenario to the scheduling API and compare it to the local calculation. Export the JSON and print the judge brief.

The reference scenario can be reset explicitly. The workbench does not overwrite an approved classroom plan. Use Replanning Lab for the full review-and-save teacher workflow.

## Real backend and API behavior

`POST /api/schedule` accepts a bounded JSON request:

```json
{
  "action": "replan",
  "input": {
    "minutes": 180,
    "breakStart": 90,
    "breakDuration": 10,
    "grades": [
      {
        "id": 2,
        "students": 10,
        "subject": "Reading",
        "duration": 45,
        "priority": 2,
        "level": "Developing"
      },
      {
        "id": 3,
        "students": 12,
        "subject": "Mathematics",
        "duration": 55,
        "priority": 3,
        "level": "Needs support"
      },
      {
        "id": 4,
        "students": 8,
        "subject": "Science",
        "duration": 40,
        "priority": 1,
        "level": "Independent"
      }
    ]
  },
  "lostMinutes": 45,
  "priorityGrade": 3
}
```

It returns the generated plan, independent audit, actual server calculation duration, and timestamp. Invalid requests receive 400; oversized requests receive 413. It does not store records or require paid AI services.

`GET /api/health` runs a reference scheduler self-check and reports safe configuration/status metadata. With a valid Supabase bearer session, it can verify that session and perform a read-only query on the caller’s private records. It returns no records, credentials, or provider tokens. That probe does **not** establish database write correctness or cross-account isolation. No paid cloud-model request is made by health checks.

## Reproducible software validation

Run the checks in the README. Browser suites exercise the main teacher journey, the assistant, actual scheduling/health APIs, judge report exports, mobile controls, and network-disabled cached reload. The 3D regression test specifically captures React console warnings during repeated mounts, grade changes, and unmounts; exercise it in development mode as documented in the README.

Live cloud authentication, database writes/RLS across real accounts, provider responses, deployment URLs, model-language quality, classroom impact, and hardware performance require separate validation with configured services and intended users. Do not describe these as verified merely because configuration metadata is present.

## Proposed pilot, not completed results

Use the same classroom scenario for manual planning and tool-assisted planning. Record actual planning time, teacher acceptance, observed task suitability, conflict count, unmet minutes, and coverage. Report the number of participating teachers, context, method, and limitations before making any field-impact claims. National single-teacher-school statistics must not be substituted for observed multi-grade-classroom prevalence. Consult the official UDISE+ and ASER references linked in the Impact page.
