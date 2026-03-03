// ============================================================================
//  docx-converter.ts
//  Converts LLM-generated markdown into a properly formatted .docx file.
//  Uses the docx npm library via esm.sh (Deno-compatible).
//  Uploads to Supabase Storage and returns a signed download URL.
// ============================================================================

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, Header, Footer, PageNumber, NumberFormat,
  TableOfContents,
} from "https://esm.sh/docx@8.5.0";

// ── Document type detection ───────────────────────────────────────────────────
// Determines how to style the document based on content keywords.

export type DocType =
  | "scheme_of_work"
  | "lesson_plan"
  | "assessment"
  | "topic_summary"
  | "generic";

function detectDocType(markdown: string, prompt: string): DocType {
  const text = (markdown + " " + prompt).toLowerCase();
  if (text.includes("scheme of work") || text.includes("scheme"))  return "scheme_of_work";
  if (text.includes("lesson plan")    || text.includes("lesson"))  return "lesson_plan";
  if (text.includes("assessment")     || text.includes("exam")
   || text.includes("test")           || text.includes("quiz"))    return "assessment";
  if (text.includes("summary")        || text.includes("overview")) return "topic_summary";
  return "generic";
}

// ── Colour palette ────────────────────────────────────────────────────────────

const COLORS = {
  primary:     "1B4F8A",   // dark blue — headings
  secondary:   "2E75B6",   // mid blue — subheadings
  accent:      "D6E4F0",   // light blue — table header fill
  headerBg:    "1B4F8A",   // document header background
  white:       "FFFFFF",
  black:       "000000",
  gray:        "666666",
  lightGray:   "F2F2F2",
  border:      "CCCCCC",
};

// ── Border helper ─────────────────────────────────────────────────────────────

const cellBorder = {
  style: BorderStyle.SINGLE,
  size:  1,
  color: COLORS.border,
};
const allBorders = {
  top: cellBorder, bottom: cellBorder,
  left: cellBorder, right: cellBorder,
};

// ── Markdown parser ───────────────────────────────────────────────────────────
// Converts markdown text into docx Paragraph/Table elements.
// Handles: headings, bold/italic inline, tables, bullets, numbered lists,
// horizontal rules, and plain paragraphs.

interface ParsedElement {
  type: "paragraph" | "table" | "spacer";
  element: Paragraph | Table;
}

function parseInline(text: string): TextRun[] {
  // Handle **bold**, *italic*, ***bold-italic**, `code`
  const runs: TextRun[] = [];
  const pattern = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|(.+?))/gs;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (!match[0]) break;
    if (match[1]) {
      // bold-italic
      runs.push(new TextRun({ text: match[2], bold: true, italics: true }));
    } else if (match[3] !== undefined) {
      // bold
      runs.push(new TextRun({ text: match[3], bold: true }));
    } else if (match[4] !== undefined) {
      // italic
      runs.push(new TextRun({ text: match[4], italics: true }));
    } else if (match[5] !== undefined) {
      // code
      runs.push(new TextRun({ text: match[5], font: "Courier New", size: 20 }));
    } else if (match[6] !== undefined) {
      runs.push(new TextRun({ text: match[6] }));
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text })];
}

function makeHeading(text: string, level: 1 | 2 | 3): Paragraph {
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
  // lines[0] = header row, lines[1] = separator, lines[2..] = data rows
  const parseRow = (line: string): string[] =>
    line.split("|").map((c) => c.trim()).filter((c) => c !== "");

  const headers  = parseRow(lines[0]);
  const dataRows = lines.slice(2);  // skip separator line

  const colCount = headers.length;
  const tableWidth = 9026;  // A4 content width in DXA
  const colWidth   = Math.floor(tableWidth / colCount);
  const colWidths  = Array(colCount).fill(colWidth);

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) =>
      new TableCell({
        borders: allBorders,
        width:   { size: colWidth, type: WidthType.DXA },
        shading: { fill: COLORS.accent, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({ text: h, bold: true, font: "Arial", size: 20 })],
        })],
      })
    ),
  });

  const bodyRows = dataRows.map((line) => {
    const cells = parseRow(line);
    // Pad or trim to match header count
    while (cells.length < colCount) cells.push("");
    return new TableRow({
      children: cells.slice(0, colCount).map((cell, i) =>
        new TableCell({
          borders: allBorders,
          width:   { size: colWidths[i], type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: parseInline(cell) })],
        })
      ),
    });
  });

  return new Table({
    width:        { size: tableWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows:         [headerRow, ...bodyRows],
  });
}

function markdownToElements(
  markdown: string,
  numbering: ReturnType<typeof buildNumbering>,
): Array<Paragraph | Table> {
  const elements: Array<Paragraph | Table> = [];
  const lines     = markdown.split("\n");
  let   i         = 0;
  let   bulletRef = 0;  // cycling bullet references for independent lists

  while (i < lines.length) {
    const line = lines[i];

    // ── Blank line ────────────────────────────────────────────────────────────
    if (!line.trim()) {
      elements.push(new Paragraph({ children: [], spacing: { after: 80 } }));
      i++;
      continue;
    }

    // ── Horizontal rule ───────────────────────────────────────────────────────
    if (/^[-*_]{3,}$/.test(line.trim())) {
      elements.push(new Paragraph({
        children: [],
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.primary, space: 1 } },
        spacing: { before: 120, after: 120 },
      }));
      i++;
      continue;
    }

    // ── Headings ──────────────────────────────────────────────────────────────
    const h1 = line.match(/^# (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h3 = line.match(/^### (.+)/);
    if (h1) { elements.push(makeHeading(h1[1], 1)); i++; continue; }
    if (h2) { elements.push(makeHeading(h2[1], 2)); i++; continue; }
    if (h3) { elements.push(makeHeading(h3[1], 3)); i++; continue; }

    // ── Markdown table ────────────────────────────────────────────────────────
    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) {
        elements.push(makeTableFromMarkdown(tableLines));
        elements.push(new Paragraph({ children: [], spacing: { after: 120 } }));
      }
      continue;
    }

    // ── Bullet list ───────────────────────────────────────────────────────────
    if (/^[\-\*\•] /.test(line)) {
      // Start a new bullet group — use a fresh reference so they don't merge
      const ref = `bullets-${bulletRef++}`;
      while (i < lines.length && /^[\-\*\•] /.test(lines[i])) {
        const text = lines[i].replace(/^[\-\*\•] /, "");
        elements.push(new Paragraph({
          numbering: { reference: ref, level: 0 },
          children:  parseInline(text),
        }));
        i++;
      }
      continue;
    }

    // ── Numbered list ─────────────────────────────────────────────────────────
    if (/^\d+\. /.test(line)) {
      const ref = `numbers-${bulletRef++}`;
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const text = lines[i].replace(/^\d+\. /, "");
        elements.push(new Paragraph({
          numbering: { reference: ref, level: 0 },
          children:  parseInline(text),
        }));
        i++;
      }
      continue;
    }

    // ── Regular paragraph ─────────────────────────────────────────────────────
    elements.push(new Paragraph({
      children: parseInline(line),
      spacing:  { after: 120 },
    }));
    i++;
  }

  return elements;
}

// ── Numbering config builder ──────────────────────────────────────────────────
// Pre-generates enough bullet/number references for a typical document.

function buildNumbering(maxGroups = 50) {
  const config = [];
  for (let i = 0; i < maxGroups; i++) {
    config.push({
      reference: `bullets-${i}`,
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "•",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    });
    config.push({
      reference: `numbers-${i}`,
      levels: [{
        level: 0, format: LevelFormat.DECIMAL, text: "%1.",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    });
  }
  return config;
}

// ── Document builder ──────────────────────────────────────────────────────────

function extractTitle(markdown: string, docType: DocType): string {
  const firstH1 = markdown.match(/^# (.+)/m);
  if (firstH1) return firstH1[1];
  const labels: Record<DocType, string> = {
    scheme_of_work: "Scheme of Work",
    lesson_plan:    "Lesson Plan",
    assessment:     "Assessment",
    topic_summary:  "Topic Summary",
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
  const docType    = detectDocType(markdown, prompt);
  const title      = extractTitle(markdown, docType);
  const numbering  = buildNumbering(60);
  const elements   = markdownToElements(markdown, numbering);

  const metaLine = [subject, classVal, term ? `Term ${term}` : ""]
    .filter(Boolean).join(" | ");

  const doc = new Document({
    numbering: { config: numbering },

    styles: {
      default: {
        document: { run: { font: "Arial", size: 22 } },  // 11pt default
      },
      paragraphStyles: [
        {
          id: "Heading1", name: "Heading 1",
          basedOn: "Normal", next: "Normal", quickFormat: true,
          run:       { size: 32, bold: true, font: "Arial", color: COLORS.primary },
          paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 },
        },
        {
          id: "Heading2", name: "Heading 2",
          basedOn: "Normal", next: "Normal", quickFormat: true,
          run:       { size: 28, bold: true, font: "Arial", color: COLORS.secondary },
          paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 },
        },
        {
          id: "Heading3", name: "Heading 3",
          basedOn: "Normal", next: "Normal", quickFormat: true,
          run:       { size: 24, bold: true, font: "Arial", color: COLORS.secondary },
          paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 },
        },
      ],
    },

    sections: [{
      properties: {
        page: {
          size:   { width: 11906, height: 16838 },  // A4
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },  // 2cm margins
        },
      },

      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text:  "Uganda O-Level Curriculum",
                  color: COLORS.gray,
                  size:  18,
                  font:  "Arial",
                }),
                new TextRun({ text: metaLine ? `  |  ${metaLine}` : "", color: COLORS.gray, size: 18 }),
              ],
              alignment: AlignmentType.RIGHT,
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.primary, space: 1 },
              },
            }),
          ],
        }),
      },

      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `${title}  |  `, color: COLORS.gray, size: 18 }),
                new TextRun({ text: "Page ", color: COLORS.gray, size: 18 }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  color: COLORS.gray, size: 18,
                }),
              ],
              alignment: AlignmentType.CENTER,
              border: {
                top: { style: BorderStyle.SINGLE, size: 6, color: COLORS.primary, space: 1 },
              },
            }),
          ],
        }),
      },

      children: [
        // Title block
        new Paragraph({
          children: [
            new TextRun({
              text:  title,
              bold:  true,
              size:  40,
              font:  "Arial",
              color: COLORS.primary,
            }),
          ],
          spacing:   { before: 0, after: 120 },
          alignment: AlignmentType.LEFT,
        }),

        // Meta line (subject | class | term)
        ...(metaLine ? [new Paragraph({
          children: [new TextRun({ text: metaLine, color: COLORS.gray, size: 20, font: "Arial" })],
          spacing:  { before: 0, after: 40 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.primary, space: 1 },
          },
        })] : []),

        new Paragraph({ children: [], spacing: { after: 240 } }),

        // Document body
        ...elements,
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

// ── Upload to Supabase Storage ────────────────────────────────────────────────

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

  // Signed URL valid for 1 hour
  const { data: signedData, error: signError } = await sb.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);

  if (signError || !signedData?.signedUrl) {
    throw new Error(`Signed URL creation failed: ${signError?.message}`);
  }

  console.log(`[DocX] Uploaded: ${path} (${bytes.length} bytes)`);
  return signedData.signedUrl;
}
