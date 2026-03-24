"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AiCodeLineComment,
  ExerciseInput,
  ParsedSubmission,
  SubmissionDraftResult,
  SubmissionFile,
} from "@/types/domain";

function normPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function resolveFile(files: SubmissionFile[], commentPath: string): SubmissionFile | undefined {
  const want = normPath(commentPath);
  const normalizedFiles = files.map((f) => ({ f, n: normPath(f.path) }));
  const exact = normalizedFiles.find((x) => x.n === want);
  if (exact) return exact.f;
  return (
    normalizedFiles.find((x) => x.n.endsWith("/" + want) || x.n.endsWith(want))?.f ??
    normalizedFiles.find((x) => (x.n.split("/").pop() ?? "") === (want.split("/").pop() ?? ""))?.f
  );
}

function commentsForPath(comments: AiCodeLineComment[], filePath: string): AiCodeLineComment[] {
  const n = normPath(filePath);
  return comments.filter((c) => {
    const f = normPath(c.path);
    return f === n || n.endsWith(f) || f.endsWith(n);
  });
}

function commentsOnLine(lineNum: number, list: AiCodeLineComment[]): AiCodeLineComment[] {
  return list.filter((c) => {
    const end = c.lineEnd ?? c.line;
    return lineNum >= c.line && lineNum <= end;
  });
}

function commentTouchesCurrentFile(c: AiCodeLineComment, currentFile: SubmissionFile | undefined): boolean {
  if (!currentFile) return false;
  return commentsForPath([c], currentFile.path).length > 0;
}

type CommentGroup = {
  resolvedPath: string;
  /** Short label (filename). */
  label: string;
  comments: AiCodeLineComment[];
};

type DraftReviewModalProps = {
  open: boolean;
  onClose: () => void;
  draft: SubmissionDraftResult;
  submission: ParsedSubmission;
  exercise: ExerciseInput;
};

export function DraftReviewModal({
  open,
  onClose,
  draft,
  submission,
  exercise,
}: DraftReviewModalProps) {
  const [selectedPath, setSelectedPath] = useState(() => submission.files[0]?.path ?? "");
  const [scrollTargetLine, setScrollTargetLine] = useState<number | null>(null);
  /** Hover only affects code highlighting when the comment belongs to the selected file. */
  const [hoverPreview, setHoverPreview] = useState<AiCodeLineComment | null>(null);
  /** User override per file path; missing key → derive from selection / single-file rule. */
  const [sectionOpenOverride, setSectionOpenOverride] = useState<Record<string, boolean>>({});
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const lineComments = useMemo(
    () => draft.draft.lineComments ?? [],
    [draft.draft.lineComments],
  );

  const commentGroups: CommentGroup[] = useMemo(() => {
    const byPath = new Map<string, AiCodeLineComment[]>();
    for (const c of lineComments) {
      const f = resolveFile(submission.files, c.path);
      const key = f?.path ?? normPath(c.path);
      const arr = byPath.get(key) ?? [];
      arr.push(c);
      byPath.set(key, arr);
    }
    return Array.from(byPath.entries())
      .map(([resolvedPath, comments]) => ({
        resolvedPath,
        label: resolvedPath.split("/").pop() || resolvedPath,
        comments: [...comments].sort((a, b) => a.line - b.line || a.message.localeCompare(b.message)),
      }))
      .sort((a, b) => a.resolvedPath.localeCompare(b.resolvedPath));
  }, [lineComments, submission.files]);

  useEffect(() => {
    if (scrollTargetLine == null) return;
    const id = window.setTimeout(() => {
      lineRefs.current.get(scrollTargetLine)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setScrollTargetLine(null);
    }, 80);
    return () => window.clearTimeout(id);
  }, [scrollTargetLine, selectedPath]);

  const criterionLabel = (id?: string) => {
    if (!id) return null;
    return exercise.rubric.criteria.find((c) => c.id === id)?.label ?? id;
  };

  const currentFile = useMemo(
    () => submission.files.find((f) => f.path === selectedPath),
    [submission.files, selectedPath],
  );

  const lineCommentsForCurrentFile = useMemo(
    () => (currentFile ? commentsForPath(lineComments, currentFile.path) : []),
    [currentFile, lineComments],
  );

  const lines = useMemo(() => (currentFile ? currentFile.content.split(/\r?\n/) : []), [currentFile]);

  const hoverLightsCode =
    hoverPreview != null && commentTouchesCurrentFile(hoverPreview, currentFile ?? undefined);

  function goToComment(c: AiCodeLineComment) {
    setHoverPreview(null);
    const file = resolveFile(submission.files, c.path);
    if (file) {
      setSelectedPath(file.path);
    }
    setScrollTargetLine(c.line);
  }

  function isGroupOpen(path: string): boolean {
    if (Object.prototype.hasOwnProperty.call(sectionOpenOverride, path)) {
      return sectionOpenOverride[path];
    }
    if (commentGroups.length === 1) return true;
    return path === selectedPath;
  }

  function toggleSection(path: string) {
    const cur = isGroupOpen(path);
    setSectionOpenOverride((s) => ({ ...s, [path]: !cur }));
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="draft-review-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[100dvh] w-full max-w-6xl flex-col rounded-t-2xl border border-app app-surface shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-app p-4">
          <div className="min-w-0">
            <h2 id="draft-review-title" className="text-base font-bold app-text">
              Review: {draft.displayName ?? draft.studentRef}
            </h2>
            <p className="mt-1 text-xs app-text-muted">{draft.draft.summary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-app px-3 py-1.5 text-sm app-text-secondary hover:bg-[var(--theme-bg-subtle)]"
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="max-h-52 w-full shrink-0 overflow-y-auto border-b border-app lg:max-h-none lg:w-80 lg:border-b-0 lg:border-r">
            <p className="sticky top-0 z-[1] app-bg-subtle px-3 py-2 text-[11px] font-semibold uppercase app-text-muted">
              Inline comments
            </p>
            <div className="p-2">
              {commentGroups.length === 0 ? (
                <p className="px-1 py-2 text-xs app-text-muted">
                  No line-anchored comments in this draft. The model may not have returned
                  lineComments, or this was a local heuristic run. Rubric notes are below.
                </p>
              ) : (
                <div className="space-y-2">
                  {commentGroups.map((g) => {
                    const isOpen = isGroupOpen(g.resolvedPath);
                    const isSelectedFile = g.resolvedPath === selectedPath;
                    return (
                      <div
                        key={g.resolvedPath}
                        className="overflow-hidden rounded-lg border border-app bg-[var(--theme-bg-subtle)]/40"
                      >
                        <div className="flex items-stretch gap-0.5">
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            onClick={() => toggleSection(g.resolvedPath)}
                            className="flex shrink-0 items-center justify-center px-2 text-[10px] app-text-muted hover:app-text-secondary"
                            title={isOpen ? "Collapse" : "Expand"}
                          >
                            {isOpen ? "▼" : "▶"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPath(g.resolvedPath);
                              setSectionOpenOverride((s) => ({ ...s, [g.resolvedPath]: true }));
                            }}
                            className={`min-w-0 flex-1 py-2.5 pl-0 pr-2 text-left transition-colors ${
                              isSelectedFile ? "bg-[var(--theme-primary-muted)]/60" : "hover:bg-[var(--theme-input-bg)]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className="break-all text-xs font-semibold leading-tight app-text"
                                title={g.resolvedPath}
                              >
                                {g.label}
                              </span>
                              <span
                                className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                                style={{
                                  backgroundColor: "var(--theme-primary-muted)",
                                  color: "var(--theme-primary)",
                                }}
                              >
                                {g.comments.length}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-[10px] app-text-subtle">{g.resolvedPath}</p>
                          </button>
                        </div>
                        {isOpen ? (
                          <ul className="space-y-1.5 border-t border-app px-2 py-2 app-surface">
                            {g.comments.map((c, i) => {
                              const foreignFile = !commentTouchesCurrentFile(c, currentFile ?? undefined);
                              return (
                                <li key={`${g.resolvedPath}-${c.line}-${i}-${c.message.slice(0, 24)}`}>
                                  <button
                                    type="button"
                                    onClick={() => goToComment(c)}
                                    onMouseEnter={() => setHoverPreview(c)}
                                    onMouseLeave={() => setHoverPreview(null)}
                                    onFocus={() => setHoverPreview(c)}
                                    onBlur={(e) => {
                                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                                        setHoverPreview(null);
                                      }
                                    }}
                                    className={`w-full rounded-md border px-2 py-2 text-left text-xs transition-colors ${
                                      foreignFile
                                        ? "border-app border-dashed opacity-90 hover:bg-[var(--theme-bg-subtle)]"
                                        : "border-app hover:bg-[var(--theme-bg-subtle)]"
                                    }`}
                                  >
                                    <span className="font-mono text-[10px] app-text-subtle">
                                      L{c.line}
                                      {c.lineEnd != null && c.lineEnd !== c.line ? `–${c.lineEnd}` : ""}
                                    </span>
                                    {foreignFile ? (
                                      <span className="ml-1 text-[10px] font-medium text-amber-800/90">
                                        · other file
                                      </span>
                                    ) : null}
                                    {c.criterionId ? (
                                      <span className="ml-1 inline-block rounded bg-[var(--theme-primary-muted)] px-1 py-0.5 text-[10px] font-medium app-text-secondary">
                                        {criterionLabel(c.criterionId)}
                                      </span>
                                    ) : null}
                                    <p className="mt-1 app-text-secondary">{c.message}</p>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="border-t border-app px-3 py-2 text-[11px] font-semibold uppercase app-text-muted">
              Rubric feedback
            </p>
            <ul className="space-y-2 p-2 pb-4">
              {draft.draft.criteria.map((c) => (
                <li key={c.criterionId} className="rounded-lg app-bg-subtle px-2 py-2 text-xs">
                  <span className="font-semibold app-text">
                    {criterionLabel(c.criterionId) ?? c.criterionId}
                  </span>
                  <span className="ml-2 app-text-muted">{c.points.toFixed(1)} pts</span>
                  <p className="mt-1 app-text-secondary">{c.comment}</p>
                </li>
              ))}
            </ul>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-app px-3 py-2">
              <label className="flex flex-wrap items-center gap-2 text-xs font-medium app-text-secondary">
                <span className="shrink-0">File</span>
                <select
                  value={selectedPath}
                  onChange={(e) => {
                    setHoverPreview(null);
                    setSelectedPath(e.target.value);
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-app app-input-bg px-2 py-1.5 text-xs outline-none"
                >
                  {submission.files.map((f) => (
                    <option key={f.path} value={f.path}>
                      {f.path}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-1.5 text-[10px] leading-snug app-text-muted">
                Line hover highlights apply only to comments for this file — switch files via the group
                title or a comment.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-3">
              {!currentFile ? (
                <p className="text-sm app-text-muted">No file selected.</p>
              ) : (
                <div className="rounded-lg border border-app bg-[var(--theme-input-bg)] font-mono text-[11px] leading-relaxed sm:text-xs">
                  {lines.map((lineText, idx) => {
                    const lineNum = idx + 1;
                    const hits = commentsOnLine(lineNum, lineCommentsForCurrentFile);
                    const hoverLit =
                      hoverLightsCode &&
                      hoverPreview != null &&
                      lineNum >= hoverPreview.line &&
                      lineNum <= (hoverPreview.lineEnd ?? hoverPreview.line);
                    const highlighted = hits.length > 0;
                    const rowTitle = hoverLit
                      ? hoverPreview.message
                      : hits.map((h) => h.message).join(" · ") || undefined;
                    return (
                      <div
                        key={idx}
                        ref={(el) => {
                          if (el) lineRefs.current.set(lineNum, el);
                          else lineRefs.current.delete(lineNum);
                        }}
                        className={`flex border-b border-app/60 transition-[background-color,box-shadow] duration-150 ${
                          hoverLit
                            ? "bg-amber-400/28 shadow-[inset_0_0_0_2px_rgba(245,158,11,0.55)]"
                            : highlighted
                              ? "bg-amber-500/[0.12]"
                              : ""
                        }`}
                        title={rowTitle}
                      >
                        <span className="flex w-11 shrink-0 select-none flex-col items-end border-r border-app/60 px-1 py-0.5 text-end app-text-subtle sm:w-[3.25rem]">
                          <span className="text-[9px] leading-none opacity-80">
                            {hoverLit ? "◆" : highlighted ? "●" : ""}
                          </span>
                          <span>{lineNum}</span>
                        </span>
                        <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all px-2 py-0.5 app-text">
                          {lineText || " "}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
