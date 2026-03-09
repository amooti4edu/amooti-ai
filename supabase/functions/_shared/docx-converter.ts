// ============================================================================
//  docx-converter.ts
//  Converts LLM output into a properly formatted .docx file.
//
//  Two conversion paths:
//    markdownToDocx() — original path, parses markdown text → docx elements
//    jsonToDocx()     — new path, builds docx directly from teacher JSON output
//                       (scheme_of_work, lesson_plan, topic_summary,
//                        assessment, progress_report)
//
//  jsonToDocx is preferred for teacher mode because it builds tables and
//  lists directly from structured data — no markdown parsing involved.
//  markdownToDocx is retained for all other uses and backwards compatibility.
//
//  Both paths upload to Supabase Storage and return a signed download URL.
// ============================================================================

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, Header, Footer, PageNumber, NumberFormat,
  TableOfContents,
} from "https://esm.sh/docx@8.5.0";

// ── Document type ─────────────────────────────────────────────────────────────

export type DocType =
  | "scheme_of_work"
  | "lesson_plan"
  | "assessment"
  | "topic_summary"
  | "progress_report"
  | "generic";

function detectDocType(markdown: string, prompt: string): DocType {
  const text = (markdown + " " + prompt).toLowerCase();
  if (text.includes("scheme of work") || text.includes("scheme"))   return "scheme_of_work";
  if (text.includes("lesson plan")    || text.includes("lesson"))   return "lesson_plan";
  if (text.includes("assessment")     || text.includes("exam")
   || text.includes("test")           || text.includes("quiz"))     return "assessment";
  if (text.includes("summary")        || text.includes("overview")) return "topic_summary";
  if (text.includes("progress")       || text.includes("report"))   return "progress_report";
  return "generic";
}

// ── Colour palette ────────────────────────────────────────────────────────────

const COLORS = {
  primary:   "1B4F8A",
  secondary: "2E75B6",
  accent:    "D6E4F0",
  white:     "FFFFFF",
  black:     "000000",
  gray:      "666666",
  lightGray: "F2F2F2",
  border:    "CCCCCC",
  success:   "1E7E34",
  warning:   "856404",
  danger:    "721C24",
};

// ── Shared border helpers ─────────────────────────────────────────────────────

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: COLORS.border };
const allBorders = {
  top: cellBorder, bottom: cellBorder,
  left: cellBorder, right: cellBorder,
};

const A4_WIDTH    = 9026;  // DXA (content width at 2cm margins)
const CELL_MARGIN = { top: 80, bottom: 80, left: 120, right: 120 };

// ── Shared element builders ───────────────────────────────────────────────────

function makeHeading(text: string, level: 1 | 2 | 3): Paragraph {
  return new Paragraph({
    heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][level - 1],
    children: [new TextRun({
      text,
      bold:  true,
      color: level === 1 ? COLORS.primary : COLORS.secondary,
      size:  level === 1 ? 32 : level === 2 ? 28 : 24,
      font:  "Arial",
    })],
    spacing: { before: level === 1 ? 360 : 240, after: 120 },
  });
}

function makePara(text: string, options: { bold?: boolean; color?: string; size?: number; spacing?: number } = {}): Paragraph {
  return new Paragraph({
    children: [new TextRun({
      text,
      bold:  options.bold  ?? false,
      color: options.color ?? COLORS.black,
      size:  options.size  ?? 22,
      font:  "Arial",
    })],
    spacing: { after: options.spacing ?? 120 },
  });
}

function makeLabelValue(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: label + ": ", bold: true, size: 22, font: "Arial", color: COLORS.secondary }),
      new TextRun({ text: value,         bold: false, size: 22, font: "Arial" }),
    ],
    spacing: { after: 80 },
  });
}

function makeBullet(text: string, ref: string): Paragraph {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    children:  [new TextRun({ text, size: 22, font: "Arial" })],
  });
}

function spacer(size = 160): Paragraph {
  return new Paragraph({ children: [], spacing: { after: size } });
}

function makeHeaderCell(text: string, width: number): TableCell {
  return new TableCell({
    borders: allBorders,
    width:   { size: width, type: WidthType.DXA },
    shading: { fill: COLORS.accent, type: ShadingType.CLEAR },
    margins: CELL_MARGIN,
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, font: "Arial", size: 20 })],
    })],
  });
}

function makeDataCell(text: string, width: number): TableCell {
  return new TableCell({
    borders: allBorders,
    width:   { size: width, type: WidthType.DXA },
    margins: CELL_MARGIN,
    children: [new Paragraph({
      children: [new TextRun({ text: text ?? "", font: "Arial", size: 20 })],
    })],
  });
}

// ── Document wrapper ──────────────────────────────────────────────────────────

function wrapDocument(
  title:    string,
  metaLine: string,
  children: Array<Paragraph | Table>,
  numbering: ReturnType<typeof buildNumbering>,
): Document {
  return new Document({
    numbering: { config: numbering },
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 32, bold: true, font: "Arial", color: COLORS.primary },
          paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, font: "Arial", color: COLORS.secondary },
          paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 24, bold: true, font: "Arial", color: COLORS.secondary },
          paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
      ],
    },
    sections: [{
      properties: {
        page: {
          size:   { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [
              new TextRun({ text: "Uganda O-Level Curriculum", color: COLORS.gray, size: 18, font: "Arial" }),
              new TextRun({ text: metaLine ? `  |  ${metaLine}` : "", color: COLORS.gray, size: 18 }),
            ],
            alignment: AlignmentType.RIGHT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.primary, space: 1 } },
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [
              new TextRun({ text: `${title}  |  `, color: COLORS.gray, size: 18 }),
              new TextRun({ text: "Page ",          color: COLORS.gray, size: 18 }),
              new TextRun({ children: [PageNumber.CURRENT], color: COLORS.gray, size: 18 }),
            ],
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 6, color: COLORS.primary, space: 1 } },
          })],
        }),
      },
      children: [
        new Paragraph({
          children: [new TextRun({ text: title, bold: true, size: 40, font: "Arial", color: COLORS.primary })],
          spacing: { before: 0, after: 120 },
        }),
        ...(metaLine ? [new Paragraph({
          children: [new TextRun({ text: metaLine, color: COLORS.gray, size: 20, font: "Arial" })],
          spacing: { before: 0, after: 40 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.primary, space: 1 } },
        })] : []),
        spacer(240),
        ...children,
      ],
    }],
  });
}

// ── Numbering config ──────────────────────────────────────────────────────────

function buildNumbering(maxGroups = 60) {
  const config = [];
  for (let i = 0; i < maxGroups; i++) {
    config.push({
      reference: `bullets-${i}`,
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    });
    config.push({
      reference: `numbers-${i}`,
      levels: [{
        level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    });
  }
  return config;
}

// ── JSON document builders ────────────────────────────────────────────────────
// Each function receives the parsed JSON and returns docx body elements.
// No markdown parsing — elements built directly from structured data.

function buildSchemeOfWork(data: any, numbering: ReturnType<typeof buildNumbering>): Array<Paragraph | Table> {
  const elements: Array<Paragraph | Table> = [];
  const weeks: any[] = data.weeks ?? [];
  let bulletIdx = 0;

  if (data.note) {
    elements.push(makePara(`Note: ${data.note}`, { color: COLORS.warning, bold: true }), spacer());
  }

  for (const w of weeks) {
    elements.push(makeHeading(`Week ${w.week ?? "—"}: ${w.topic ?? ""}`, 2));
    if (w.subtopic) elements.push(makeLabelValue("Subtopic", w.subtopic));

    if (w.outcomes?.length) {
      elements.push(makePara("Learning Outcomes:", { bold: true }));
      const ref = `bullets-${bulletIdx++}`;
      const outcomes = Array.isArray(w.outcomes) ? w.outcomes : [w.outcomes];
      for (const o of outcomes) elements.push(makeBullet(o, ref));
    }

    const methods = Array.isArray(w.methods) ? w.methods.join(", ") : (w.methods ?? "");
    if (methods) elements.push(makeLabelValue("Methods", methods));
    if (w.materials) elements.push(makeLabelValue("Materials", w.materials));
    if (w.assessment) elements.push(makeLabelValue("Assessment", w.assessment));
    elements.push(spacer());
  }

  return elements;
}

function buildLessonPlan(data: any, numbering: ReturnType<typeof buildNumbering>): Array<Paragraph | Table> {
  const elements: Array<Paragraph | Table> = [];
  let   bulletIdx = 0;

  if (data.note) {
    elements.push(makePara(`Note: ${data.note}`, { color: COLORS.warning, bold: true }), spacer());
  }

  // Meta block
  elements.push(
    makeLabelValue("Duration",    `${data.duration_mins ?? 40} minutes`),
    spacer(80),
  );

  // Objectives
  if (data.objectives?.length) {
    elements.push(makeHeading("Learning Objectives", 2));
    const ref = `bullets-${bulletIdx++}`;
    for (const obj of data.objectives) {
      elements.push(makeBullet(obj, ref));
    }
    elements.push(spacer());
  }

  // Lesson sections as text
  const sections: any[] = data.sections ?? [];
  if (sections.length) {
    elements.push(makeHeading("Lesson Procedure", 2));
    for (const s of sections) {
      elements.push(makePara(`${s.name ?? "Phase"} (${s.duration_mins ?? "—"} min)`, { bold: true }));
      if (s.teacher_activity) elements.push(makeLabelValue("Teacher Activity", s.teacher_activity));
      if (s.student_activity) elements.push(makeLabelValue("Student Activity", s.student_activity));
      elements.push(spacer(80));
    }
    elements.push(spacer());
  }

  // Materials
  if (data.materials?.length) {
    elements.push(makeHeading("Materials Required", 2));
    const ref = `bullets-${bulletIdx++}`;
    const mats = Array.isArray(data.materials) ? data.materials : [data.materials];
    for (const m of mats) elements.push(makeBullet(m, ref));
    elements.push(spacer());
  }

  // Homework
  if (data.homework) {
    elements.push(makeHeading("Homework", 2));
    elements.push(makePara(data.homework));
  }

  return elements;
}

function buildTopicSummary(data: any, numbering: ReturnType<typeof buildNumbering>): Array<Paragraph | Table> {
  const elements: Array<Paragraph | Table> = [];
  let   bulletIdx = 0;

  if (data.note) {
    elements.push(makePara(`Note: ${data.note}`, { color: COLORS.warning, bold: true }), spacer());
  }

  if (data.overview) {
    elements.push(makeHeading("Overview", 2));
    elements.push(makePara(data.overview));
    elements.push(spacer());
  }

  if (data.why_it_matters) {
    elements.push(makeHeading("Why It Matters", 2));
    elements.push(makePara(data.why_it_matters));
    elements.push(spacer());
  }

  if (data.key_concepts?.length) {
    elements.push(makeHeading("Key Concepts", 2));
    for (const c of data.key_concepts) {
      elements.push(makeLabelValue(c.name ?? "Concept", c.definition ?? ""));
    }
    elements.push(spacer());
  }

  if (data.connections?.length) {
    elements.push(makeHeading("Cross-Subject Connections", 2));
    const ref = `bullets-${bulletIdx++}`;
    for (const c of data.connections) {
      elements.push(makeBullet(`${c.subject}: ${c.link}`, ref));
    }
  }

  return elements;
}

function buildAssessment(data: any, numbering: ReturnType<typeof buildNumbering>): Array<Paragraph | Table> {
  const elements: Array<Paragraph | Table> = [];
  let   bulletIdx = 0;

  if (data.note) {
    elements.push(makePara(`Note: ${data.note}`, { color: COLORS.warning, bold: true }), spacer());
  }

  if (data.instructions) {
    elements.push(makeHeading("Instructions", 2));
    elements.push(makePara(data.instructions, { bold: true }));
    elements.push(spacer());
  }

  const questions: any[] = data.questions ?? [];
  for (const q of questions) {
    // Question stem
    elements.push(new Paragraph({
      children: [
        new TextRun({ text: `${q.number}. `, bold: true, size: 22, font: "Arial" }),
        new TextRun({ text: q.text ?? "",    bold: false, size: 22, font: "Arial" }),
        ...(q.marks ? [new TextRun({ text: `  [${q.marks} mark${q.marks > 1 ? "s" : ""}]`, size: 20, color: COLORS.gray, font: "Arial" })] : []),
      ],
      spacing: { before: 160, after: 80 },
    }));

    // MCQ options
    if (q.type === "mcq" && q.options?.length) {
      const ref = `bullets-${bulletIdx++}`;
      for (const opt of q.options) {
        elements.push(new Paragraph({
          children: [
            new TextRun({ text: `${opt.id}.  `, bold: true,  size: 22, font: "Arial" }),
            new TextRun({ text: opt.text,       bold: false, size: 22, font: "Arial" }),
          ],
          indent:  { left: 720 },
          spacing: { after: 40 },
        }));
      }
    }

    // Essay marking guide (indented, italicised)
    if (q.type === "essay" && q.marking_guide) {
      elements.push(new Paragraph({
        children: [new TextRun({ text: `Marking guide: ${q.marking_guide}`, italics: true, size: 20, color: COLORS.gray, font: "Arial" })],
        indent:  { left: 720 },
        spacing: { after: 80 },
      }));
    }

    elements.push(spacer(80));
  }

  return elements;
}

function buildProgressReport(data: any, numbering: ReturnType<typeof buildNumbering>): Array<Paragraph | Table> {
  const elements: Array<Paragraph | Table> = [];

  if (data.note) {
    elements.push(makePara(`Note: ${data.note}`, { color: COLORS.warning, bold: true }), spacer());
  }

  if (data.summary) {
    elements.push(makeHeading("Summary", 2));
    elements.push(makePara(data.summary));
    elements.push(spacer());
  }

  const outcomes: any[] = data.outcomes ?? [];
  if (outcomes.length) {
    elements.push(makeHeading("Outcome Performance", 2));
    const statusLabel = (s: string) => s === "on_track" ? "On Track" : s === "needs_support" ? "Needs Support" : "Critical";

    for (const o of outcomes) {
      elements.push(makePara(`${o.outcome ?? "Outcome"}`, { bold: true }));
      elements.push(makeLabelValue("Mastery", `${o.mastery_pct ?? "—"}%`));
      elements.push(makeLabelValue("Status", statusLabel(o.status ?? "")));
      if (o.intervention) elements.push(makeLabelValue("Intervention", o.intervention));
      elements.push(spacer(80));
    }
  }

  return elements;
}

// ── JSON → docx (new teacher path) ───────────────────────────────────────────

export async function jsonToDocx(
  json:      Record<string, unknown>,
  subject?:  string,
  classVal?: string,
  term?:     string,
): Promise<Uint8Array> {
  const data     = json as any;
  const docType  = (data.type ?? "generic") as DocType;
  const title    = data.title ?? "Curriculum Document";
  const metaLine = [
    data.subject ?? subject,
    data.class   ?? classVal,
    (data.term   ?? term) ? `Term ${data.term ?? term}` : "",
  ].filter(Boolean).join(" | ");

  const numbering = buildNumbering(60);
  let   bodyElements: Array<Paragraph | Table> = [];

  switch (docType) {
    case "scheme_of_work":
      bodyElements = buildSchemeOfWork(data, numbering);
      break;
    case "lesson_plan":
      bodyElements = buildLessonPlan(data, numbering);
      break;
    case "topic_summary":
      bodyElements = buildTopicSummary(data, numbering);
      break;
    case "assessment":
      bodyElements = buildAssessment(data, numbering);
      break;
    case "progress_report":
      bodyElements = buildProgressReport(data, numbering);
      break;
    default:
      bodyElements = [makePara("Unrecognised document type. Please check the response format.")];
  }

  const doc    = wrapDocument(title, metaLine, bodyElements, numbering);
  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

// ── Markdown → docx (original path — unchanged) ──────────────────────────────

function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const pattern = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|(.+?))/gs;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (!match[0]) break;
    if      (match[1]) runs.push(new TextRun({ text: match[2], bold: true, italics: true }));
    else if (match[3] !== undefined) runs.push(new TextRun({ text: match[3], bold: true }));
    else if (match[4] !== undefined) runs.push(new TextRun({ text: match[4], italics: true }));
    else if (match[5] !== undefined) runs.push(new TextRun({ text: match[5], font: "Courier New", size: 20 }));
    else if (match[6] !== undefined) runs.push(new TextRun({ text: match[6] }));
  }

  return runs.length > 0 ? runs : [new TextRun({ text })];
}

function makeMarkdownHeading(text: string, level: 1 | 2 | 3): Paragraph {
  const headingMap = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
  };
  return new Paragraph({
    heading:  headingMap[level],
    children: [new TextRun({
      text,
      bold:  true,
      color: level === 1 ? COLORS.primary : COLORS.secondary,
      size:  level === 1 ? 32 : level === 2 ? 28 : 24,
      font:  "Arial",
    })],
    spacing: { before: level === 1 ? 360 : 240, after: 120 },
  });
}

function makeTableFromMarkdown(lines: string[]): Table {
  const parseRow = (line: string): string[] =>
    line.split("|").map((c) => c.trim()).filter((c) => c !== "");

  const headers  = parseRow(lines[0]);
  const dataRows = lines.slice(2);
  const colCount = headers.length;
  const colWidth = Math.floor(A4_WIDTH / colCount);
  const colWidths = Array(colCount).fill(colWidth);

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) => new TableCell({
      borders: allBorders,
      width:   { size: colWidth, type: WidthType.DXA },
      shading: { fill: COLORS.accent, type: ShadingType.CLEAR },
      margins: CELL_MARGIN,
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, font: "Arial", size: 20 })] })],
    })),
  });

  const bodyRows = dataRows.map((line) => {
    const cells = parseRow(line);
    while (cells.length < colCount) cells.push("");
    return new TableRow({
      children: cells.slice(0, colCount).map((cell, i) => new TableCell({
        borders: allBorders,
        width:   { size: colWidths[i], type: WidthType.DXA },
        margins: CELL_MARGIN,
        children: [new Paragraph({ children: parseInline(cell) })],
      })),
    });
  });

  return new Table({
    width:        { size: A4_WIDTH, type: WidthType.DXA },
    columnWidths: colWidths,
    rows:         [headerRow, ...bodyRows],
  });
}

function markdownToElements(
  markdown: string,
  numbering: ReturnType<typeof buildNumbering>,
): Array<Paragraph | Table> {
  const elements: Array<Paragraph | Table> = [];
  const lines = markdown.split("\n");
  let i = 0;
  let bulletRef = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      elements.push(new Paragraph({ children: [], spacing: { after: 80 } }));
      i++; continue;
    }

    if (/^[-*_]{3,}$/.test(line.trim())) {
      elements.push(new Paragraph({
        children: [],
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.primary, space: 1 } },
        spacing: { before: 120, after: 120 },
      }));
      i++; continue;
    }

    const h1 = line.match(/^# (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h3 = line.match(/^### (.+)/);
    if (h1) { elements.push(makeMarkdownHeading(h1[1], 1)); i++; continue; }
    if (h2) { elements.push(makeMarkdownHeading(h2[1], 2)); i++; continue; }
    if (h3) { elements.push(makeMarkdownHeading(h3[1], 3)); i++; continue; }

    // Skip markdown tables — convert to plain text lines
    if (line.startsWith("|")) {
      // Skip separator rows like |---|---|
      if (/^\|[\s\-:]+\|/.test(line)) { i++; continue; }
      const cells = line.split("|").map(c => c.trim()).filter(c => c !== "");
      if (cells.length) {
        elements.push(new Paragraph({ children: parseInline(cells.join("  —  ")), spacing: { after: 80 } }));
      }
      i++;
      continue;
    }

    if (/^[\-\*\•] /.test(line)) {
      const ref = `bullets-${bulletRef++}`;
      while (i < lines.length && /^[\-\*\•] /.test(lines[i])) {
        const text = lines[i].replace(/^[\-\*\•] /, "");
        elements.push(new Paragraph({ numbering: { reference: ref, level: 0 }, children: parseInline(text) }));
        i++;
      }
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const ref = `numbers-${bulletRef++}`;
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const text = lines[i].replace(/^\d+\. /, "");
        elements.push(new Paragraph({ numbering: { reference: ref, level: 0 }, children: parseInline(text) }));
        i++;
      }
      continue;
    }

    elements.push(new Paragraph({ children: parseInline(line), spacing: { after: 120 } }));
    i++;
  }

  return elements;
}

function extractTitle(markdown: string, docType: DocType): string {
  const firstH1 = markdown.match(/^# (.+)/m);
  if (firstH1) return firstH1[1];
  const labels: Record<DocType, string> = {
    scheme_of_work: "Scheme of Work",
    lesson_plan:    "Lesson Plan",
    assessment:     "Assessment",
    topic_summary:  "Topic Summary",
    progress_report:"Progress Report",
    generic:        "Curriculum Document",
  };
  return labels[docType];
}

export async function markdownToDocx(
  markdown:  string,
  prompt:    string,
  subject?:  string,
  classVal?: string,
  term?:     string,
): Promise<Uint8Array> {
  const docType   = detectDocType(markdown, prompt);
  const title     = extractTitle(markdown, docType);
  const numbering = buildNumbering(60);
  const elements  = markdownToElements(markdown, numbering);
  const metaLine  = [subject, classVal, term ? `Term ${term}` : ""].filter(Boolean).join(" | ");

  const doc    = wrapDocument(title, metaLine, elements, numbering);
  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

// ── Upload to Supabase Storage (shared by both paths) ─────────────────────────

export async function uploadDocxAndGetUrl(
  sb:        any,
  bytes:     Uint8Array,
  userId:    string,
  docType:   DocType,
  subject?:  string,
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename  = `${docType}-${timestamp}.docx`;
  const path      = `${userId}/${filename}`;
  const bucket    = "teacher-documents";

  const { error: uploadError } = await sb.storage
    .from(bucket)
    .upload(path, bytes, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: signedData, error: signError } = await sb.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);

  if (signError || !signedData?.signedUrl) {
    throw new Error(`Signed URL creation failed: ${signError?.message}`);
  }

  console.log(`[DocX] Uploaded: ${path} (${bytes.length} bytes)`);
  return signedData.signedUrl;
}
