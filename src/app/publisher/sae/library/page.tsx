"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  createReferenceSet,
  deleteLibraryFile,
  deleteReferenceSet,
  listLibraryFiles,
  listReferenceSets,
  setReferenceSetFiles,
  updateLibraryFile,
  updateReferenceSet,
  uploadLibraryFile,
  uploadLibraryFileVersion,
} from "@/lib/sae-api";
import { REFERENCE_FILE_MAX_BYTES, REFERENCE_KINDS, formatBytes, kindLabel } from "@/lib/sae-references";
import { openReferencePdf } from "@/components/sae/ReferenceMaterialsPanel";
import type { SAELibraryFile, SAEReferenceKind, SAEReferenceSet } from "@/types/sae";

type Toast = { id: number; text: string; kind: "success" | "error" };

export default function ReferenceLibraryPage() {
  const [files, setFiles] = useState<SAELibraryFile[]>([]);
  const [sets, setSets] = useState<SAEReferenceSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadKind, setUploadKind] = useState<SAEReferenceKind>("answer_key");
  const [uploadLabel, setUploadLabel] = useState("");
  const uploadInput = useRef<HTMLInputElement>(null);
  const [newSetName, setNewSetName] = useState("");

  function toast(text: string, kind: "success" | "error" = "success") {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, text, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  async function reload() {
    const [f, s] = await Promise.all([listLibraryFiles(), listReferenceSets()]);
    setFiles(f);
    setSets(s);
  }

  async function run(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await action();
      await reload();
      if (success) toast(success);
      return true;
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Something went wrong.", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    reload()
      .catch((err: unknown) => toast(err instanceof Error ? err.message : "Failed to load library.", "error"))
      .finally(() => setLoading(false));
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;
    const ok = await run(() => uploadLibraryFile(uploadFile, uploadKind, uploadLabel), "File added to your library.");
    if (ok) {
      setUploadFile(null);
      setUploadLabel("");
      if (uploadInput.current) uploadInput.current.value = "";
    }
  }

  function replaceVersion(file: SAELibraryFile) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,application/pdf";
    input.onchange = () => {
      const picked = input.files?.[0];
      if (picked) {
        run(
          () => uploadLibraryFileVersion(file.id, picked),
          `Uploaded version ${file.version + 1}. Assessments keep their current version until you update them.`,
        );
      }
    };
    input.click();
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id}
            className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
              t.kind === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
            {t.text}
          </div>
        ))}
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reference Library</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your rubrics, answer keys and worked solutions. Files here are private to you and are not
          used for grading until you assign them to an assessment (in{" "}
          <Link href="/publisher/sae" className="text-blue-600 hover:underline">Edit Prompt for Grading</Link>).
          Changing a file here never changes an assessment that already uses it.
        </p>
      </div>

      {/* ── Files ─────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">Files</h2>

        <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-2 rounded-xl border bg-white p-4 shadow-sm">
          <label className="text-xs text-slate-600">
            PDF (max {formatBytes(REFERENCE_FILE_MAX_BYTES)})
            <input ref={uploadInput} type="file" accept=".pdf,application/pdf"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="mt-1 block text-xs text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs" />
          </label>
          <label className="text-xs text-slate-600">
            Type
            <select value={uploadKind} onChange={(e) => setUploadKind(e.target.value as SAEReferenceKind)}
              className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm">
              {REFERENCE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
          <label className="min-w-[200px] flex-1 text-xs text-slate-600">
            Label (optional)
            <input type="text" value={uploadLabel} maxLength={200} onChange={(e) => setUploadLabel(e.target.value)}
              placeholder="e.g. FoM Q1–Q5 key"
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <button type="submit" disabled={busy || !uploadFile}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            Upload
          </button>
        </form>

        <div className="rounded-xl border bg-white shadow-sm">
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
          ) : files.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No files yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {files.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <select value={f.kind} disabled={busy}
                    onChange={(e) => run(() => updateLibraryFile(f.id, { kind: e.target.value as SAEReferenceKind }), "Type updated.")}
                    className="rounded border border-slate-200 px-2 py-1 text-xs">
                    {REFERENCE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                  <input key={`${f.id}-${f.label ?? ""}`} type="text" defaultValue={f.label ?? ""} maxLength={200}
                    placeholder="Add a label"
                    onBlur={(e) => {
                      if (e.target.value !== (f.label ?? "")) {
                        run(() => updateLibraryFile(f.id, { label: e.target.value }), "Label updated.");
                      }
                    }}
                    className="min-w-[160px] flex-1 rounded border border-transparent px-2 py-1 text-sm hover:border-slate-200 focus:border-blue-400 focus:outline-none" />
                  <span className="text-xs text-slate-500">
                    {f.filename} · v{f.version} · {formatBytes(f.size_bytes)}
                  </span>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => openReferencePdf(f.id).catch((e) => toast(e.message, "error"))}
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">View</button>
                    <button type="button" disabled={busy} onClick={() => replaceVersion(f)}
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                      Replace with new version
                    </button>
                    <button type="button" disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Remove "${f.filename}" from your library and its sets? Assessments that already use it keep it.`)) {
                          run(() => deleteLibraryFile(f.id), "Removed from your library.");
                        }
                      }}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── Sets ──────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Sets</h2>
          <p className="text-xs text-slate-500">
            Optional named groups, e.g. everything for one course. Assigning a set copies its current
            files to the assessment; editing the set later doesn&apos;t change assessments.
          </p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => createReferenceSet(newSetName.trim()), "Set created.")) setNewSetName("");
          }}
          className="flex gap-2"
        >
          <input type="text" value={newSetName} maxLength={200} onChange={(e) => setNewSetName(e.target.value)}
            placeholder="New set name, e.g. FoM midterm"
            className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" disabled={busy || !newSetName.trim()}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            + Create set
          </button>
        </form>

        {sets.length === 0 && !loading && <p className="text-sm text-slate-400">No sets yet.</p>}

        <div className="grid gap-4 md:grid-cols-2">
          {sets.map((s) => {
            const ids = s.files.map((f) => f.id);
            const inSet = new Set(s.files.map((f) => f.lineage_id));
            const addable = files.filter((f) => !inSet.has(f.lineage_id));
            const save = (next: string[], msg: string) => run(() => setReferenceSetFiles(s.id, next), msg);
            return (
              <div key={s.id} className="space-y-2 rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <input key={`${s.id}-${s.name}`} type="text" defaultValue={s.name} maxLength={200}
                    onBlur={(e) => {
                      const name = e.target.value.trim();
                      if (name && name !== s.name) run(() => updateReferenceSet(s.id, { name }), "Set renamed.");
                    }}
                    className="min-w-0 flex-1 rounded border border-transparent px-2 py-1 font-medium text-slate-800 hover:border-slate-200 focus:border-blue-400 focus:outline-none" />
                  <button type="button" disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Delete the set "${s.name}"? Its files stay in your library.`)) {
                        run(() => deleteReferenceSet(s.id), "Set deleted.");
                      }
                    }}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">
                    Delete set
                  </button>
                </div>
                {s.files.length === 0 ? (
                  <p className="text-xs text-slate-400">Empty set.</p>
                ) : (
                  <ol className="space-y-1">
                    {s.files.map((f, i) => (
                      <li key={f.id} className="flex items-center gap-2 text-xs">
                        <span className="w-4 text-slate-400">{i + 1}.</span>
                        <span className="min-w-0 flex-1 truncate text-slate-700">
                          {kindLabel(f.kind)}{f.label ? ` — ${f.label}` : ""} ({f.filename}, v{f.version})
                        </span>
                        <button type="button" disabled={busy || i === 0} title="Move up"
                          onClick={() => {
                            const next = [...ids];
                            [next[i - 1], next[i]] = [next[i], next[i - 1]];
                            save(next, "Order updated.");
                          }}
                          className="rounded px-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">↑</button>
                        <button type="button" disabled={busy || i === ids.length - 1} title="Move down"
                          onClick={() => {
                            const next = [...ids];
                            [next[i + 1], next[i]] = [next[i], next[i + 1]];
                            save(next, "Order updated.");
                          }}
                          className="rounded px-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">↓</button>
                        <button type="button" disabled={busy} title="Remove from set"
                          onClick={() => save(ids.filter((id) => id !== f.id), "Removed from set.")}
                          className="rounded px-1 text-red-500 hover:bg-red-50 disabled:opacity-30">✕</button>
                      </li>
                    ))}
                  </ol>
                )}
                {addable.length > 0 && (
                  <select value="" disabled={busy}
                    onChange={(e) => e.target.value && save([...ids, e.target.value], "Added to set.")}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs text-slate-600">
                    <option value="">+ Add a file to this set…</option>
                    {addable.map((f) => (
                      <option key={f.id} value={f.id}>
                        {kindLabel(f.kind)}{f.label ? ` — ${f.label}` : ""} ({f.filename})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
