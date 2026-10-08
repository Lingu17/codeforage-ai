interface ScanActivity {
  status?: string;
  started_at?: string;
  completed_at?: string;
}

export function RecentScanActivity({ job }: { job?: ScanActivity }) {
  return <section className="rounded-xl border border-border bg-white p-5 text-left">
    <h3 className="text-xs font-bold">Recent scan activity</h3>
    {job ? <p className="mt-2 text-xs text-zinc-600">Scan status: {job.status ?? "Unknown"} · {job.completed_at ?? job.started_at ?? "Time unavailable"}</p>
      : <p className="mt-2 text-xs text-zinc-600">No scan activity is available.</p>}
  </section>;
}
