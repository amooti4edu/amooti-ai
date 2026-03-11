import { useState, useEffect } from "react";
import { Download, Copy, Check, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import type { TeacherDoc } from "@/types/chat";

interface TeacherResponseProps {
  doc: TeacherDoc;
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-foreground">{children}: </span>;
}

function BulletList({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-1 space-y-0.5 list-disc list-inside text-sm text-muted-foreground">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-primary uppercase tracking-wide mb-2 border-b border-border pb-1">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Scheme of Work renderer ───────────────────────────────────────────────────

function SchemeOfWork({ data }: { data: any }) {
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(new Set([0]));
  const weeks: any[] = data.weeks ?? [];

  const toggle = (i: number) =>
    setOpenWeeks(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <div className="space-y-2">
      {data.note && (
        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-3 mb-4">
          <span className="font-semibold">Note: </span>{data.note}
        </p>
      )}
      {weeks.map((w, i) => (
        <div key={i} className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => toggle(i)}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted text-left transition-colors"
          >
            <span className="font-semibold text-sm">
              Week {w.week ?? i + 1}: {w.topic ?? "—"}
            </span>
            {openWeeks.has(i) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {openWeeks.has(i) && (
            <div className="px-4 py-3 space-y-2 text-sm">
              {w.subtopic && <p><Label>Subtopic</Label>{w.subtopic}</p>}
              {w.outcomes?.length > 0 && (
                <div>
                  <Label>Learning Outcomes</Label>
                  <BulletList items={Array.isArray(w.outcomes) ? w.outcomes : [w.outcomes]} />
                </div>
              )}
              {w.methods?.length > 0 && (
                <p><Label>Methods</Label>
                  {Array.isArray(w.methods) ? w.methods.join(", ") : w.methods}
                </p>
              )}
              {w.materials && <p><Label>Materials</Label>{w.materials}</p>}
              {w.assessment && <p><Label>Assessment</Label>{w.assessment}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Lesson Plan renderer ──────────────────────────────────────────────────────

function LessonPlan({ data }: { data: any }) {
  const sections: any[] = data.sections ?? [];
  return (
    <div className="space-y-4 text-sm">
      {data.note && (
        <p className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-3">
          <span className="font-semibold">Note: </span>{data.note}
        </p>
      )}

      <div className="flex gap-6 flex-wrap">
        {data.duration_mins && <p><Label>Duration</Label>{data.duration_mins} minutes</p>}
        {data.subject && <p><Label>Subject</Label>{data.subject}</p>}
        {data.class   && <p><Label>Class</Label>{data.class}</p>}
      </div>

      {data.objectives?.length > 0 && (
        <Section title="Learning Objectives">
          <BulletList items={data.objectives} />
        </Section>
      )}

      {sections.length > 0 && (
        <Section title="Lesson Procedure">
          <div className="space-y-3">
            {sections.map((s, i) => (
              <div key={i} className="border-l-2 border-primary pl-3">
                <p className="font-semibold text-foreground">
                  {s.name ?? `Phase ${i + 1}`}
                  {s.duration_mins ? <span className="font-normal text-muted-foreground"> ({s.duration_mins} min)</span> : ""}
                </p>
                {s.teacher_activity && <p className="text-muted-foreground"><Label>Teacher</Label>{s.teacher_activity}</p>}
                {s.student_activity && <p className="text-muted-foreground"><Label>Students</Label>{s.student_activity}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.materials?.length > 0 && (
        <Section title="Materials">
          <BulletList items={Array.isArray(data.materials) ? data.materials : [data.materials]} />
        </Section>
      )}

      {data.homework && (
        <Section title="Homework">
          <p className="text-muted-foreground">{data.homework}</p>
        </Section>
      )}
    </div>
  );
}

// ── Topic Summary renderer ────────────────────────────────────────────────────

function TopicSummary({ data }: { data: any }) {
  return (
    <div className="space-y-4 text-sm">
      {data.note && (
        <p className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-3">
          <span className="font-semibold">Note: </span>{data.note}
        </p>
      )}

      {data.overview && (
        <Section title="Overview">
          <p className="text-muted-foreground">{data.overview}</p>
        </Section>
      )}
      {data.why_it_matters && (
        <Section title="Why It Matters">
          <p className="text-muted-foreground">{data.why_it_matters}</p>
        </Section>
      )}
      {data.key_concepts?.length > 0 && (
        <Section title="Key Concepts">
          <dl className="space-y-2">
            {data.key_concepts.map((c: any, i: number) => (
              <div key={i}>
                <dt className="font-semibold text-foreground">{c.name}</dt>
                <dd className="text-muted-foreground ml-2">{c.definition}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}
      {data.connections?.length > 0 && (
        <Section title="Cross-Subject Connections">
          <ul className="space-y-1">
            {data.connections.map((c: any, i: number) => (
              <li key={i} className="text-muted-foreground">
                <span className="font-semibold text-foreground">{c.subject}: </span>{c.link}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

// ── Assessment renderer ───────────────────────────────────────────────────────

function Assessment({ data }: { data: any }) {
  const questions: any[] = data.questions ?? [];
  return (
    <div className="space-y-4 text-sm">
      {data.note && (
        <p className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-3">
          <span className="font-semibold">Note: </span>{data.note}
        </p>
      )}
      {data.instructions && (
        <p className="font-semibold text-foreground border-b pb-2">{data.instructions}</p>
      )}
      <ol className="space-y-4">
        {questions.map((q: any, i: number) => (
          <li key={i} className="border border-border rounded p-3">
            <p className="font-medium text-foreground">
              {q.number}. {q.text}
              {q.marks && <span className="ml-2 text-xs text-muted-foreground">[{q.marks} mark{q.marks > 1 ? "s" : ""}]</span>}
            </p>
            {q.type === "mcq" && q.options?.length > 0 && (
              <ul className="mt-2 space-y-1 ml-4">
                {q.options.map((opt: any) => (
                  <li key={opt.id} className="text-muted-foreground">
                    <span className="font-semibold">{opt.id}.</span> {opt.text}
                  </li>
                ))}
              </ul>
            )}
            {q.type === "essay" && q.marking_guide && (
              <p className="mt-2 ml-4 text-xs text-muted-foreground italic">
                Marking guide: {q.marking_guide}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Progress Report renderer ──────────────────────────────────────────────────

function ProgressReport({ data }: { data: any }) {
  const outcomes: any[] = data.outcomes ?? [];
  const statusColor = (s: string) =>
    s === "on_track" ? "text-green-600" :
    s === "needs_support" ? "text-amber-600" : "text-red-600";
  const statusLabel = (s: string) =>
    s === "on_track" ? "On Track" : s === "needs_support" ? "Needs Support" : "Critical";

  return (
    <div className="space-y-4 text-sm">
      {data.note && (
        <p className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-3">
          <span className="font-semibold">Note: </span>{data.note}
        </p>
      )}
      {data.summary && (
        <Section title="Summary">
          <p className="text-muted-foreground">{data.summary}</p>
        </Section>
      )}
      {outcomes.length > 0 && (
        <Section title="Outcome Performance">
          <div className="space-y-3">
            {outcomes.map((o: any, i: number) => (
              <div key={i} className="border border-border rounded p-3">
                <p className="font-semibold text-foreground">{o.outcome}</p>
                <div className="mt-1 flex flex-wrap gap-4 text-xs">
                  <span><Label>Mastery</Label>{o.mastery_pct ?? "—"}%</span>
                  <span className={statusColor(o.status ?? "")}>
                    {statusLabel(o.status ?? "")}
                  </span>
                </div>
                {o.intervention && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <Label>Intervention</Label>{o.intervention}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Fallback: render any unknown object as readable key-value ─────────────────

function GenericDoc({ data }: { data: any }) {
  const render = (v: unknown, depth = 0): React.ReactNode => {
    if (v === null || v === undefined) return null;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
      return <span className="text-muted-foreground">{String(v)}</span>;
    if (Array.isArray(v))
      return (
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          {v.map((item, i) => <li key={i}>{render(item, depth + 1)}</li>)}
        </ul>
      );
    return (
      <dl className={`space-y-1 ${depth > 0 ? "ml-3" : ""}`}>
        {Object.entries(v as object).filter(([k]) => k !== "type").map(([k, val]) => (
          <div key={k}>
            <dt className="font-semibold text-foreground capitalize">{k.replace(/_/g, " ")}</dt>
            <dd className="ml-2">{render(val, depth + 1)}</dd>
          </div>
        ))}
      </dl>
    );
  };
  return <div className="text-sm">{render(data)}</div>;
}

// ── Document router ───────────────────────────────────────────────────────────

function DocRenderer({ data }: { data: any }) {
  if (!data || typeof data !== "object") {
    return <p className="text-sm text-muted-foreground">{String(data ?? "No content")}</p>;
  }

  switch (data.type) {
    case "scheme_of_work":   return <SchemeOfWork  data={data} />;
    case "lesson_plan":      return <LessonPlan    data={data} />;
    case "topic_summary":    return <TopicSummary  data={data} />;
    case "assessment":       return <Assessment    data={data} />;
    case "progress_report":  return <ProgressReport data={data} />;
    default:                 return <GenericDoc    data={data} />;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function TeacherResponse({ doc }: TeacherResponseProps) {
  const [copied, setCopied]   = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const checkExpiry = () => setExpired(Date.now() >= doc.expiresAt);
    checkExpiry();
    const interval = setInterval(checkExpiry, 30_000);
    return () => clearInterval(interval);
  }, [doc.expiresAt]);

  const handleCopy = async () => {
    // Produce a clean text representation for copy
    const textContent = typeof doc.content === "string"
      ? doc.content
      : JSON.stringify(doc.content, null, 2);
    await navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Derive a display title from the document object
  const docTitle = typeof doc.content === "object" && doc.content !== null
    ? (doc.content as any).title ?? "Teacher Document"
    : "Teacher Document";

  return (
    <div className="mx-auto w-full max-w-3xl rounded-lg border bg-card shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <span className="font-semibold text-sm text-foreground flex-1 min-w-0 truncate">
          {docTitle}
        </span>

        {expired ? (
          <button
            disabled
            className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
          >
            <AlertCircle size={14} />
            Link expired — regenerate
          </button>
        ) : (
          <button
            onClick={() => window.open(doc.downloadUrl, "_blank")}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Download size={14} />
            Download Word Doc
          </button>
        )}

        <button
          onClick={handleCopy}
          className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied!" : "Copy JSON"}
        </button>

        {!expired && (
          <span className="text-xs text-muted-foreground">
            Expires in {Math.max(0, Math.ceil((doc.expiresAt - Date.now()) / 60_000))} min
          </span>
        )}
      </div>

      {/* Document body */}
      <div className="p-5">
        <DocRenderer data={doc.content} />
      </div>
    </div>
  );
}
