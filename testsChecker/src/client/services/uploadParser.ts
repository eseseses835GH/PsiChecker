import JSZip from "jszip";
import type { ParsedSubmission, SubmissionFile } from "@/types/domain";

const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".cs",
  ".go",
  ".rb",
  ".rs",
  ".php",
  ".kt",
  ".swift",
  ".sql",
  ".html",
  ".css",
  ".scss",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".md",
  ".vue",
  ".svelte",
]);

/** Use folder-relative paths when the teacher picks a directory (webkitdirectory). */
function relativePathForFile(file: File): string {
  const wr = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (typeof wr === "string" && wr.length > 0) {
    return wr.replace(/\\/g, "/");
  }
  return file.name;
}

export function normalizeStudentRef(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .toLowerCase();
}

/**
 * When the teacher specifies who the upload is for, merge all parsed files
 * into one submission under that student (bulk ZIP with many files becomes one student).
 */
export function attributeSubmissionsToExplicitStudent(
  submissions: ParsedSubmission[],
  explicitDisplayName: string,
): ParsedSubmission[] {
  const trimmed = explicitDisplayName.trim();
  if (!trimmed) {
    return submissions;
  }
  const studentRef = normalizeStudentRef(trimmed);
  const allFiles = submissions.flatMap((s) => s.files);
  if (allFiles.length === 0) {
    return [];
  }
  return [
    {
      studentRef,
      displayName: trimmed,
      source: submissions[0]?.source ?? "files",
      files: allFiles,
    },
  ];
}

function extension(path: string): string {
  const idx = path.lastIndexOf(".");
  return idx >= 0 ? path.slice(idx).toLowerCase() : "";
}

function inferStudentFromPath(path: string): string {
  const cleaned = path.replace(/\\/g, "/");
  const [firstSegment] = cleaned.split("/");
  const candidate = firstSegment.includes(".")
    ? (firstSegment.split("__")[0] ?? firstSegment.split("-")[0] ?? "unknown")
    : firstSegment;
  return normalizeStudentRef(candidate || "unknown");
}

function inferStudentFromFilename(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  const token = base.split("__")[0] ?? base.split("-")[0] ?? base;
  return normalizeStudentRef(token || "unknown");
}

async function parseZipFile(file: File): Promise<ParsedSubmission[]> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const grouped = new Map<string, SubmissionFile[]>();

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  for (const entry of entries) {
    const ext = extension(entry.name);
    if (!CODE_EXTENSIONS.has(ext)) {
      continue;
    }

    const content = await entry.async("string");
    const studentRef = inferStudentFromPath(entry.name);
    const files = grouped.get(studentRef) ?? [];
    files.push({ path: entry.name, content });
    grouped.set(studentRef, files);
  }

  return Array.from(grouped.entries()).map(([studentRef, files]) => ({
    studentRef,
    source: "zip",
    files,
  }));
}

function inferStudentFromLoosePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.includes("/")) {
    return inferStudentFromPath(normalized);
  }
  return inferStudentFromFilename(relativePath);
}

async function parseLooseFiles(files: File[]): Promise<ParsedSubmission[]> {
  const grouped = new Map<string, SubmissionFile[]>();

  await Promise.all(
    files.map(async (file) => {
      const relativePath = relativePathForFile(file);
      const ext = extension(relativePath);
      if (!CODE_EXTENSIONS.has(ext)) {
        return;
      }

      const content = await file.text();
      const studentRef = inferStudentFromLoosePath(relativePath);
      const bucket = grouped.get(studentRef) ?? [];
      bucket.push({ path: relativePath, content });
      grouped.set(studentRef, bucket);
    }),
  );

  return Array.from(grouped.entries()).map(([studentRef, studentFiles]) => ({
    studentRef,
    source: "files",
    files: studentFiles,
  }));
}

export async function parseBulkSubmissions(inputFiles: File[]): Promise<ParsedSubmission[]> {
  const parsed: ParsedSubmission[] = [];
  const zipFiles = inputFiles.filter((file) => file.name.toLowerCase().endsWith(".zip"));
  const looseFiles = inputFiles.filter((file) => !file.name.toLowerCase().endsWith(".zip"));

  for (const zipFile of zipFiles) {
    const zipSubmissions = await parseZipFile(zipFile);
    parsed.push(...zipSubmissions);
  }

  const looseSubmissions = await parseLooseFiles(looseFiles);
  parsed.push(...looseSubmissions);

  const merged = new Map<string, ParsedSubmission>();
  for (const submission of parsed) {
    const existing = merged.get(submission.studentRef);
    if (!existing) {
      merged.set(submission.studentRef, submission);
      continue;
    }

    merged.set(submission.studentRef, {
      ...existing,
      files: [...existing.files, ...submission.files],
    });
  }

  return Array.from(merged.values()).filter((item) => item.files.length > 0);
}
