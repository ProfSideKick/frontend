"use client";

import { useState } from "react";
import Link from "next/link";
import {
  SAEApiError,
  assignReferenceFiles,
  fetchLibraryFile,
  listLibraryFiles,
  listReferenceSets,
  unassignReferenceFile,
  updateReferenceAssignmentVersion,
  uploadLibraryFile,
} from "@/lib/sae-api";
import {
  REFERENCE_ASSESSMENT_MAX_FILES,
  REFERENCE_ASSESSMENT_MAX_TOTAL_BYTES,
  REFERENCE_KINDS,
  formatBytes,
  kindLabel,
} from "@/lib/sae-references";
import type { SAEAssessmentRow, SAELibraryFile, SAEReferenceKind, SAEReferenceSet } from "@/types/sae";

const BUILT_IN_FILES = ["Sample rubric", "Graded WebAssign", "Graded handwritten solution"];

/** Opens a stored PDF in a new tab. */
export async function openReferencePdf(fileId: string) {
  const data = await fetchLibraryFile(fileId);
  const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-blue-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function ReferenceMaterialsPanel({
  assessment,
  includeRefs,
  onIncludeRefsChange,
  includeCustomRefs,
  onIncludeCustomRefsChange,
  onAssessmentUpdated,
  onError,
  onNotice,
}: {
  assessment: SAEAssessmentRow;
  includeRefs: boolean;
  onIncludeRefsChange: (v: boolean) => void;
  includeCustomRefs: boolean;
  onIncludeCustomRefsChange: (v: boolean) => void;
  onAssessmentUpdated: (row: SAEAssessmentRow) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const assignments = assessment.reference_assignments ?? [];
  const usedBytes = assignments.reduce((sum, a) => sum + a.size_bytes, 0);
  const atLimit = assignments.length >= REFERENCE_ASSESSMENT_MAX_FILES;

  const [mode, setMode] = useState<"none" | "library" | "upload">("none");
  const [busy, setBusy] = useState(false);
  const [library, setLibrary] = useState<SAELibraryFile[] | null>(null);
  const [sets, setSets] = useState<SAEReferenceSet[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pickedSetId, setPickedSetId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadKind, setUploadKind] = useState<SAEReferenceKind>("answer_key");
  const [uploadLabel, setUploadLabel] = useState("");

  const assignedLineages = new Set(assignments.map((a) => a.lineage_id));

  async function run(action: () => Promise<SAEAssessmentRow | void>, success?: string) {
    setBusy(true);
    try {
      const updated = await action();
      if (updated) onAssessmentUpdated(updated);
      if (success) onNotice(success);
      return true;
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function openLibraryPicker() {
    setMode("library");
    setPicked(new Set());
    setPickedSetId("");
    await run(async () => {
      const [files, allSets] = await Promise.all([listLibraryFiles(), listReferenceSets()]);
      setLibrary(files);
      setSets(allSets);
    });
  }

  async function assignPicked() {
    const ok = await run(
      () => assignReferenceFiles(assessment.id, { fileIds: [...picked], setId: pickedSetId || undefined }),
      "Reference files assigned.",
    );
    if (ok) setMode("none");
  }

  async function uploadAndAssign() {
    if (!uploadFile) return;
    const ok = await run(async () => {
      let fileId: string;
      try {
        fileId = (await uploadLibraryFile(uploadFile, uploadKind, uploadLabel)).id;
      } catch (err) {
        // Same PDF already in the library: assign that file instead of a copy.
        if (err instanceof SAEApiError && err.code === "duplicate" && err.existingId) {
          fileId = err.existingId;
          onNotice("That PDF is already in your library — assigned the existing file.");
        } else {
          throw err;
        }
      }
      return assignReferenceFiles(assessment.id, { fileIds: [fileId] });
    }, "File uploaded to your library and assigned.");
    if (ok) {
      setMode("none");
      setUploadFile(null);
      setUploadLabel("");
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-semibold text-slate-800">Reference materials</h3>
        <p className="text-xs text-slate-500">Files sent to the AI with every submission.</p>
      </div>

      {/* Built-in Math Placement Exam set */}
      <section className="rounded-md border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-slate-800">Built-in set: Math Placement Exam</p>
          <Switch checked={includeRefs} onChange={onIncludeRefsChange} label="Use built-in Math Placement Exam references" />
        </div>
        <ul className={`mt-2 space-y-0.5 text-xs ${includeRefs ? "text-slate-600" : "text-slate-400 line-through"}`}>
          {BUILT_IN_FILES.map((f) => (
            <li key={f}>• {f} <span className="text-slate-400">(built-in)</span></li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-slate-500">Turn this off for any assessment that isn&apos;t the Math Placement Exam.</p>
      </section>

      {/* Assigned reference files */}
      <section className="rounded-md border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-slate-800">Assigned reference files</p>
          <Switch
            checked={includeCustomRefs}
            onChange={onIncludeCustomRefsChange}
            label="Send assigned reference files"
          />
        </div>
        {!includeCustomRefs && assignments.length > 0 && (
          <p className="mt-1 text-xs font-medium text-slate-500">Not sent to the AI.</p>
        )}

        {assignments.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No files assigned. Nothing is attached automatically.</p>
        ) : (
          <ul className={`mt-2 space-y-2 ${includeCustomRefs ? "" : "opacity-50"}`}>
            {assignments.map((a) => (
              <li key={a.id} className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs">
                      <span className="font-semibold text-slate-700">{kindLabel(a.kind)}</span>
                      {a.label && <span className="text-slate-700"> — {a.label}</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {a.filename} · v{a.version} · {formatBytes(a.size_bytes)}
                    </p>
                    <div className="mt-0.5 flex flex-wrap gap-1.5">
                      {a.newer_version_available && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => run(
                            () => updateReferenceAssignmentVersion(assessment.id, a.id),
                            "Updated to the latest version.",
                          )}
                          className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-200 disabled:opacity-50"
                        >
                          Newer version available → Update
                        </button>
                      )}
                      {a.removed_from_library && (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600">
                          Removed from library (still used here)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openReferencePdf(a.file_id).catch((e) => onError(e.message))}
                      className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-white"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      title="Remove from this assessment (stays in your library)"
                      onClick={() => run(() => unassignReferenceFile(assessment.id, a.id), "Removed from this assessment.")}
                      className="rounded border border-red-200 px-1.5 py-0.5 text-[11px] text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || atLimit}
            onClick={openLibraryPicker}
            className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            + Add from library
          </button>
          <button
            type="button"
            disabled={busy || atLimit}
            onClick={() => setMode("upload")}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Upload new file
          </button>
          <span className="text-xs text-slate-500">
            {assignments.length} of {REFERENCE_ASSESSMENT_MAX_FILES} files · {formatBytes(usedBytes)} of{" "}
            {formatBytes(REFERENCE_ASSESSMENT_MAX_TOTAL_BYTES)}
          </span>
        </div>

        {mode === "library" && (
          <div className="mt-3 space-y-2 rounded-md border border-blue-100 bg-blue-50/40 p-2">
            {library === null ? (
              <p className="text-xs text-slate-500">Loading your library…</p>
            ) : (
              <>
                {sets.length > 0 && (
                  <label className="block text-xs text-slate-700">
                    Assign a whole set
                    <select
                      value={pickedSetId}
                      onChange={(e) => setPickedSetId(e.target.value)}
                      className="mt-0.5 block w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    >
                      <option value="">— none —</option>
                      {sets.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.files.length})</option>
                      ))}
                    </select>
                  </label>
                )}
                {library.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Your library is empty. Use <span className="font-medium">Upload new file</span>, or manage
                    files on the <Link href="/publisher/sae/library" className="text-blue-600 underline">Reference library</Link> page.
                  </p>
                ) : (
                  <ul className="max-h-40 space-y-1 overflow-y-auto">
                    {library.map((f) => {
                      const already = assignedLineages.has(f.lineage_id);
                      return (
                        <li key={f.id}>
                          <label className={`flex items-center gap-2 text-xs ${already ? "text-slate-400" : "text-slate-700"}`}>
                            <input
                              type="checkbox"
                              disabled={already}
                              checked={picked.has(f.id)}
                              onChange={(e) => {
                                const next = new Set(picked);
                                if (e.target.checked) next.add(f.id);
                                else next.delete(f.id);
                                setPicked(next);
                              }}
                            />
                            <span className="truncate">
                              {kindLabel(f.kind)}{f.label ? ` — ${f.label}` : ""} ({f.filename}, v{f.version})
                              {already && " · already assigned"}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || (picked.size === 0 && !pickedSetId)}
                onClick={assignPicked}
                className="rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Assign
              </button>
              <button type="button" onClick={() => setMode("none")} className="rounded px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
            </div>
          </div>
        )}

        {mode === "upload" && (
          <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-white file:px-2 file:py-1 file:text-xs"
            />
            <div className="flex gap-2">
              <select
                value={uploadKind}
                onChange={(e) => setUploadKind(e.target.value as SAEReferenceKind)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                {REFERENCE_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={uploadLabel}
                maxLength={200}
                onChange={(e) => setUploadLabel(e.target.value)}
                placeholder="Label (optional), e.g. FoM Q1–Q5 key"
                className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || !uploadFile}
                onClick={uploadAndAssign}
                className="rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Uploading…" : "Upload & assign"}
              </button>
              <button type="button" onClick={() => setMode("none")} className="rounded px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        ⓘ Assigning and removing files take effect immediately. The two switches save with &quot;Save Prompt&quot;.
      </p>
    </div>
  );
}
