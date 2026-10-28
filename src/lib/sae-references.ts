/**
 * Display rules for assessment reference materials (built-in precalc set +
 * professor-assigned library files). Pure functions, shared by the publisher
 * pages and the reference library.
 */

import type {
  SAEAssessmentRow,
  SAEReferenceAssignment,
  SAEReferenceFilesUsed,
  SAEReferenceKind,
} from "@/types/sae";

// Mirror the backend limits in app/services/sae_service.py.
export const REFERENCE_FILE_MAX_BYTES = 12 * 1024 * 1024;
export const REFERENCE_ASSESSMENT_MAX_FILES = 5;
export const REFERENCE_ASSESSMENT_MAX_TOTAL_BYTES = 12 * 1024 * 1024;

export const REFERENCE_KINDS: { value: SAEReferenceKind; label: string }[] = [
  { value: "rubric", label: "Rubric" },
  { value: "answer_key", label: "Answer key" },
  { value: "worked_solution", label: "Worked solution" },
  { value: "other", label: "Other" },
];

export function kindLabel(kind: string): string {
  return REFERENCE_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function files(n: number): string {
  return `${n} file${n === 1 ? "" : "s"}`;
}

/** Short summary for the badge next to "Edit Prompt for Grading". */
export function referencesBadgeText(
  a: Pick<SAEAssessmentRow, "include_reference_files" | "include_custom_reference_files" | "reference_assignments">,
): string {
  const n = a.reference_assignments?.length ?? 0;
  const parts: string[] = [];
  if (a.include_reference_files) parts.push("Precalc");
  if (n > 0) parts.push(a.include_custom_reference_files ? files(n) : `${files(n)} (off)`);
  return `References: ${parts.length ? parts.join(" + ") : "None"}`;
}

// The system default prompt describes the five-PDF precalc setup.
export function isDefaultStylePrompt(prompt: string): boolean {
  return /receive five PDFs|Static Reference Context/i.test(prompt);
}

export interface PromptReferenceCheck {
  /** Save must stay disabled. */
  block: string | null;
  /** Amber warning, Save still allowed. */
  warn: string | null;
  /** Neutral note. */
  note: string | null;
}

/** Warnings shown in the prompt window for the current switches and assigned files. */
export function checkPromptAgainstReferences(
  prompt: string,
  includeBuiltIn: boolean,
  includeCustom: boolean,
  assignments: SAEReferenceAssignment[],
): PromptReferenceCheck {
  const defaultStyle = isDefaultStylePrompt(prompt);
  const customSent = includeCustom && assignments.length > 0;
  const result: PromptReferenceCheck = { block: null, warn: null, note: null };

  if (!includeBuiltIn && defaultStyle) {
    result.block =
      "This prompt still refers to the built-in precalc reference PDFs, which are turned off. " +
      "Replace it with your own grading instructions before saving.";
  } else if (customSent && defaultStyle) {
    result.warn =
      "Your prompt describes the five precalc PDFs. Update it to refer to your assigned reference files.";
  }
  if (!includeBuiltIn && !customSent) {
    result.note =
      "No reference files will be sent. The AI only sees the student's two PDFs, so your prompt " +
      "must contain the solutions, point values and grading rules.";
  }
  return result;
}

/** Human-readable lines for what a submission was graded with (result_json.details.reference_files_used). */
export function describeReferencesUsed(raw: unknown): string[] {
  if (typeof raw === "boolean") {
    return [`Reference materials: ${raw ? "On" : "Off"}`];
  }
  if (!raw || typeof raw !== "object") {
    return ["Reference materials: not recorded for this submission"];
  }
  const used = raw as SAEReferenceFilesUsed;
  const lines = [`Built-in precalc references: ${used.default_set ? "On" : "Off"}`];
  const custom = used.custom ?? [];
  if (!used.custom_set_enabled) {
    lines.push("Assigned reference files: Off");
  } else if (custom.length === 0) {
    lines.push("Assigned reference files: none");
  } else {
    lines.push(`Assigned reference files (${custom.length}):`);
    for (const f of custom) {
      lines.push(`• ${kindLabel(f.kind)}${f.label ? ` — ${f.label}` : ""} (${f.filename}, v${f.version})`);
    }
  }
  return lines;
}
