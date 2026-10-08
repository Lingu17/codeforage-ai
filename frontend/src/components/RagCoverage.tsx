export interface Coverage {
  status?: string;
  files_discovered?: number | null;
  files_indexed?: number | null;
  chunks_expected?: number | null;
  chunks_indexed?: number | null;
  chunks_failed?: number | null;
  coverage_percentage?: number | null;
}

export function RagCoverage({ coverage }: { coverage?: Coverage }) {
  return (
    <section aria-label="Repository indexing coverage" className="rounded-xl border border-border bg-white p-4 text-left">
      <h3 className="text-xs font-bold">RAG index · {coverage?.status ?? "NOT VERIFIED"}</h3>
      <p className="mt-2 text-sm font-mono">
        {coverage?.chunks_indexed ?? "—"} / {coverage?.chunks_expected ?? "—"} chunks indexed
        {coverage?.coverage_percentage != null && ` · ${coverage.coverage_percentage}% coverage`}
      </p>
      <p className="mt-1 text-xs text-zinc-600">
        Files indexed: {coverage?.files_indexed ?? "—"} / {coverage?.files_discovered ?? "—"}
        {coverage?.chunks_failed != null && ` · ${coverage.chunks_failed} chunks failed`}
      </p>
    </section>
  );
}
