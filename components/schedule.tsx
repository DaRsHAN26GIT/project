"use client";
import { Check } from "lucide-react";
import type { Plan } from "@/lib/engine.mjs";
export function Schedule({
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
export const time = (m: number) =>
  `${String(9 + Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export function Legend() {
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
export function Unmet({ plan }: { plan: Plan }) {
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
