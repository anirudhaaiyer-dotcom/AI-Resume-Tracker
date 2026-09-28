import Link from "next/link";
import { uploadCvs } from "@/app/actions";
import { Submit } from "@/app/candidate/[id]/buttons";

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams;
  let results: { file: string; status: string; id?: number }[] = [];
  try {
    results = done ? JSON.parse(done) : [];
  } catch {
    results = [];
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Upload CVs</h1>
      <form action={uploadCvs} className="space-y-4 rounded-lg border border-line bg-panel p-5">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Role</span>
          <select name="role" className="w-full rounded-md border border-line p-2 text-sm">
            <option value="PM">Product Manager</option>
            <option value="SPM">Senior Product Manager</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">CV files (.pdf, .docx, .txt) — select one or many</span>
          <input
            type="file"
            name="files"
            multiple
            accept=".pdf,.docx,.txt"
            required
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-quote file:px-3 file:py-1.5 file:text-sm"
          />
        </label>
        <Submit pendingText="Reading and scoring… (about 15–30 s per CV)">Upload and score</Submit>
        <p className="text-xs text-muted">
          Names, contact details and colleges are removed before the CV is scored. Scoring never sends an email.
        </p>
      </form>

      {results.length > 0 && (
        <section className="rounded-lg border border-line bg-panel p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Result</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {results.map((r) => (
              <li key={r.file}>
                {r.id ? (
                  <Link href={`/candidate/${r.id}`} className="hover:underline">
                    {r.file}
                  </Link>
                ) : (
                  r.file
                )}{" "}
                — <span className={r.status === "scored" ? "text-strong" : "text-danger"}>{r.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
