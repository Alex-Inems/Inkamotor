"use client";

import { useMemo, useState } from "react";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  Field,
  inputClass,
  Modal,
} from "@/components/modal";
import { EmptyHint, KpiCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { useCrm } from "@/lib/crm-store";
import { OWNERS, todayIso, type FollowUp, type FollowUpStatus } from "@/lib/demo-data";
import { formatDate, formatNumber } from "@/lib/format";
import { followUpTone } from "@/lib/status";
import { useLocale } from "@/lib/i18n";

export default function FollowUpsPage() {
  const { followUps, addFollowUp, updateFollowUpStatus } = useCrm();
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FollowUpStatus | "all">("all");
  const [openAdd, setOpenAdd] = useState(false);
  const [selected, setSelected] = useState<FollowUp | null>(null);
  const [form, setForm] = useState({
    title: "",
    relatedTo: "",
    dueAt: todayIso(),
    owner: OWNERS[0] as string,
    notes: "",
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return followUps.filter((f) => {
      if (status !== "all" && f.status !== status) return false;
      if (!q) return true;
      return `${f.title} ${f.relatedTo} ${f.notes}`.toLowerCase().includes(q);
    });
  }, [followUps, query, status]);

  const open = followUps.filter((f) => f.status === "open").length;
  const overdue = followUps.filter((f) => f.status === "overdue").length;
  const done = followUps.filter((f) => f.status === "done").length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.relatedTo.trim()) return;
    addFollowUp({
      title: form.title.trim(),
      relatedTo: form.relatedTo.trim(),
      relatedType: "lead",
      relatedId: "manual",
      dueAt: form.dueAt,
      owner: form.owner,
      notes: form.notes.trim() || "Manual follow-up from CRM",
    });
    setForm({
      title: "",
      relatedTo: "",
      dueAt: todayIso(),
      owner: OWNERS[0],
      notes: "",
    });
    setOpenAdd(false);
  }

  return (
    <div>
      <PageHeader
        title={t("pages.followUps.title")}
        description={t("pages.followUps.description")}
        action={
          <button type="button" className={btnPrimary} onClick={() => setOpenAdd(true)}>
            {t("pages.followUps.add")}
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label={t("pages.followUps.open")} value={formatNumber(open)} />
        <KpiCard label={t("pages.followUps.overdue")} value={formatNumber(overdue)} />
        <KpiCard label={t("pages.followUps.done")} value={formatNumber(done)} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <input
          className={inputClass}
          placeholder="Search follow-ups…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={inputClass}
          value={status}
          onChange={(e) => setStatus(e.target.value as FollowUpStatus | "all")}
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="overdue">Overdue</option>
          <option value="done">Done</option>
        </select>
      </div>

      <div className="mt-4">
        <Panel title={`${filtered.length} follow-ups`}>
          {filtered.length === 0 ? (
            <EmptyHint>No follow-ups match these filters.</EmptyHint>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Related to</th>
                    <th>Type</th>
                    <th>Owner</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <p className="font-medium">{f.title}</p>
                        <p className="max-w-sm truncate text-xs text-mute">
                          {f.notes}
                        </p>
                      </td>
                      <td>{f.relatedTo}</td>
                      <td className="capitalize text-mute">{f.relatedType}</td>
                      <td className="text-mute">{f.owner}</td>
                      <td className="whitespace-nowrap text-mute">
                        {formatDate(f.dueAt)}
                      </td>
                      <td>
                        <StatusBadge tone={followUpTone(f.status)}>
                          {f.status}
                        </StatusBadge>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => setSelected(f)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Modal open={openAdd} title="Add follow-up" onClose={() => setOpenAdd(false)}>
        <form className="grid gap-3" onSubmit={submit}>
          <Field label="Task">
            <input
              required
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Related to">
            <input
              required
              className={inputClass}
              value={form.relatedTo}
              onChange={(e) => setForm({ ...form, relatedTo: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Due date">
              <input
                type="date"
                className={inputClass}
                value={form.dueAt}
                onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
              />
            </Field>
            <Field label="Owner">
              <select
                className={inputClass}
                value={form.owner}
                onChange={(e) => setForm({ ...form, owner: e.target.value })}
              >
                {OWNERS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              className={`${inputClass} min-h-20`}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <div className="flex gap-2">
            <button type="submit" className={btnPrimary}>
              Save
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setOpenAdd(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!selected}
        title={selected?.title ?? "Follow-up"}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="space-y-4">
            <p className="text-sm text-mute">{selected.relatedTo}</p>
            <p className="text-sm">{selected.notes}</p>
            <p className="text-xs text-mute">
              Due {formatDate(selected.dueAt)} · {selected.owner}
            </p>
            <div className="flex flex-wrap gap-2">
              {selected.status !== "done" ? (
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => {
                    updateFollowUpStatus(selected.id, "done");
                    setSelected({ ...selected, status: "done" });
                  }}
                >
                  Mark done
                </button>
              ) : null}
              {selected.status === "open" ? (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    updateFollowUpStatus(selected.id, "overdue");
                    setSelected({ ...selected, status: "overdue" });
                  }}
                >
                  Mark overdue
                </button>
              ) : null}
              {selected.status === "overdue" ? (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    updateFollowUpStatus(selected.id, "open");
                    setSelected({ ...selected, status: "open" });
                  }}
                >
                  Reopen
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
