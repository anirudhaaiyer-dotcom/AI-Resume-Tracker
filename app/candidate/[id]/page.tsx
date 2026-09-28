import Link from "next/link";
import { notFound } from "next/navigation";
import { confirmRole, decide, redraft, sendEmail } from "@/app/actions";
import { Band, Flags, Level } from "@/app/ui";
import { candidate } from "@/lib/queries";
import { CRITERIA, rubric, type Role } from "@/lib/rubric";
import { Submit } from "./buttons";

const ROLE_NAME: Record<Role, string> = { PM: "Product Manager", SPM: "Senior PM" };

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await candidate(Number(id));
  if (!data) notFound();
  const { c, scores, decisions, emails } = data;
  const role = (c.role ?? "PM") as Role;
  const other: Role = role === "PM" ? "SPM" : "PM";
  const s = scores.find((x) => x.weighting === role);
  const so = scores.find((x) => x.weighting === other);
  const latestDecision = decisions[0];
  const latestEmail = latestDecision ? emails.find((e) => e.decision_id === latestDecision.id) : undefined;
  const w = rubric.weights[role];

  return (
    <div className="space-y-6">
      <Link href={`/role/${role}`} className="text-sm text-muted hover:underline">
        ← {ROLE_NAME[role]} list
      </Link>

      {/* Header */}
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-line bg-panel p-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{c.name || c.source_file}</h1>
          <p className="text-sm text-muted">
            {[c.email, c.phone].filter(Boolean).join(" · ")} · {c.source_file}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
            <span>
              Applying for <b>{ROLE_NAME[role]}</b>
            </span>
            {!c.role_tag && !c.role_confirmed && (
              <form action={confirmRole} className="flex items-center gap-1">
                <input type="hidden" name="candidateId" value={c.id} />
                <span className="text-muted">(suggested from years of PM experience)</span>
                <Submit name="role" value={role} pendingText="…" variant="secondary">
                  Confirm {role}
                </Submit>
                <Submit name="role" value={other} pendingText="…" variant="secondary">
                  Switch to {other}
                </Submit>
              </form>
            )}
          </div>
          <div className="pt-1">
            <Flags flags={c.parse_failed ? ["parse_failed"] : s?.flags} />
          </div>
        </div>
        {s && (
          <div className="text-right">
            <div className="text-4xl font-semibold tabular-nums">{s.total.toFixed(1)}</div>
            <div className="mt-1">
              <Band band={s.band} />
            </div>
            {so && (
              <div className="mt-2 text-xs text-muted">
                {other} weights: {so.total.toFixed(1)} · {so.band}
              </div>
            )}
            {s.years_pm != null && <div className="text-xs text-muted">~{s.years_pm} yrs PM-type ownership</div>}
          </div>
        )}
      </section>

      {c.parse_failed && (
        <p className="rounded-lg border border-danger p-4 text-sm text-danger">
          This CV could not be read ({c.parse_error}). It is unscored — please open the original file and decide
          manually.
        </p>
      )}

      {s && (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            {/* Why + evidence */}
            <section className="rounded-lg border border-line bg-panel p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Why ranked here</h2>
              <p className="mt-2 leading-relaxed">{s.why_ranked_here}</p>
            </section>

            <section className="rounded-lg border border-line bg-panel">
              <h2 className="border-b border-line px-5 py-3 text-sm font-semibold uppercase tracking-wide text-muted">
                Evidence, criterion by criterion
              </h2>
              <ul>
                {CRITERIA.map((k) => {
                  const e = s.evidence[k] ?? { level: 0 };
                  const pts = (w[k] * e.level) / 4;
                  return (
                    <li key={k} className="border-b border-line px-5 py-4 last:border-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {k}. {rubric.criteria[k].name}
                        </span>
                        <span className="flex items-center gap-3 text-sm tabular-nums">
                          <Level level={e.level} />
                          <span className="w-20 text-right text-muted">
                            {pts.toFixed(2)} / {w[k]}
                          </span>
                        </span>
                      </div>
                      {e.quote ? (
                        <blockquote className="mt-2 rounded-md bg-quote px-3 py-2 text-sm leading-relaxed">
                          “{e.quote}”
                        </blockquote>
                      ) : (
                        <p className="mt-2 text-sm text-muted">No evidence in the CV — level 0.</p>
                      )}
                      {e.dropped_quote && (
                        <p className="mt-1 text-xs text-muted">
                          A higher-level quote was proposed but is not in the CV verbatim, so it was not counted.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Interview questions */}
            <section className="rounded-lg border border-line bg-panel p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Ask in the interview</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                {(s.probes ?? []).map((q: string, i: number) => (
                  <li key={i} className="leading-relaxed">
                    {q}
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-muted">
                Aimed at the weakest evidence (A or B), the specifics behind the strongest quote, and a kill /
                post-mortem / live incident.
              </p>
            </section>
          </div>

          {/* Decision + email */}
          <aside className="space-y-6">
            <section className="rounded-lg border border-line bg-panel p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Your decision</h2>
              {latestDecision && (
                <p className="mt-2 text-sm">
                  Last:{" "}
                  <b>
                    {latestDecision.action === "advance"
                      ? "Advance"
                      : latestDecision.action === "pass"
                        ? "Pass"
                        : "Consider for PM"}
                  </b>{" "}
                  <span className="text-muted">· {new Date(latestDecision.decided_at).toLocaleString("en-IN")}</span>
                </p>
              )}
              <form action={decide} className="mt-3 space-y-3">
                <input type="hidden" name="candidateId" value={c.id} />
                <input type="hidden" name="role" value={role} />
                <textarea
                  name="note"
                  rows={2}
                  placeholder="Optional note for the log (why)"
                  className="w-full rounded-md border border-line p-2 text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <Submit name="action" value="advance" pendingText="Drafting invite…">
                    Advance
                  </Submit>
                  <Submit name="action" value="pass" pendingText="Drafting rejection…" variant="danger">
                    Pass
                  </Submit>
                  {role === "SPM" && (
                    <Submit name="action" value="consider_for_pm" pendingText="Moving…" variant="secondary">
                      Consider for PM
                    </Submit>
                  )}
                </div>
                <p className="text-xs text-muted">Advance drafts an invite, Pass drafts a rejection. Nothing is sent yet.</p>
              </form>
            </section>

            {latestEmail && (
              <section id="email" className="rounded-lg border border-line bg-panel p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {latestEmail.kind === "invite" ? "Interview invite" : "Rejection email"}
                </h2>
                {latestEmail.status === "sent" ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      Sent {new Date(latestEmail.sent_at).toLocaleString("en-IN")} to <b>{latestEmail.sent_to}</b>
                    </p>
                    <p className="font-medium">{latestEmail.final_subject}</p>
                    <pre className="whitespace-pre-wrap rounded-md bg-quote p-3 font-sans">{latestEmail.final_body}</pre>
                    <p className="text-xs text-muted">Resend id: {latestEmail.resend_id}</p>
                  </div>
                ) : latestEmail.status === "failed" && !latestEmail.draft_body ? (
                  <form action={redraft} className="mt-3 space-y-2 text-sm">
                    <input type="hidden" name="emailId" value={latestEmail.id} />
                    <p className="text-danger">{latestEmail.error}</p>
                    <Submit pendingText="Drafting…" variant="secondary">
                      Try drafting again
                    </Submit>
                  </form>
                ) : (
                  <form action={sendEmail} className="mt-3 space-y-2">
                    <input type="hidden" name="emailId" value={latestEmail.id} />
                    <input
                      name="subject"
                      defaultValue={latestEmail.final_subject}
                      className="w-full rounded-md border border-line p-2 text-sm font-medium"
                    />
                    <textarea
                      name="body"
                      rows={14}
                      defaultValue={latestEmail.final_body}
                      className="w-full rounded-md border border-line p-2 text-sm leading-relaxed"
                    />
                    {latestEmail.error && <p className="text-sm text-danger">Last send failed: {latestEmail.error}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                      <Submit pendingText="Sending…">Send</Submit>
                      <Submit pendingText="Redrafting…" variant="secondary" formAction={redraft}>
                        Redraft
                      </Submit>
                    </div>
                    <p className="text-xs text-muted">
                      Edit freely. Send goes to your own inbox (EMAIL_OVERRIDE_TO) with the candidate named in the
                      subject — never to the address on the CV.
                    </p>
                  </form>
                )}
              </section>
            )}

            {decisions.length > 1 && (
              <section className="rounded-lg border border-line bg-panel p-5 text-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">History</h2>
                <ul className="mt-2 space-y-1">
                  {decisions.map((d) => (
                    <li key={d.id}>
                      {d.action} <span className="text-muted">· {new Date(d.decided_at).toLocaleString("en-IN")}</span>
                      {d.note && <span className="text-muted"> — {d.note}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
