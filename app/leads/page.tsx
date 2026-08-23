"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ContactForm, ContactFormActions } from "@/components/contact-form";
import { btnPrimary, btnSecondary, inputClass, Modal } from "@/components/modal";
import { EmptyHint, PageHeader, Panel, StatusBadge } from "@/components/ui";
import {
  contactWriteFromLead,
  emptyContactWrite,
  tagList,
  type ContactDetails,
  type ContactWrite,
} from "@/lib/crm/contact-details";
import { useCrm } from "@/lib/crm-store";
import { type Lead, type LeadStatus } from "@/lib/demo-data";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { leadTone } from "@/lib/status";

const STAGES: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];
const PAGE_SIZE = 75;
const FORM_ID = "lead-contact-form";

type SortKey = "completeness" | "name" | "email" | "updated";
type LeadRow = { lead: Lead; details: ContactDetails; score?: number };

export default function LeadsPage() {
  const { sales, addSale, pushToast } = useCrm();
  const { t, locale } = useLocale();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [stage, setStage] = useState<LeadStatus | "all">("all");
  const [country, setCountry] = useState("all");
  const [kind, setKind] = useState<"all" | "person" | "company">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "completeness",
    dir: "desc",
  });
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<ContactWrite>(emptyContactWrite);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [countries, setCountries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(draft.trim());
      setPage(0);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      q: query,
      stage,
      country,
      kind,
      sort: sort.key,
      dir: sort.dir,
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    const res = await fetch(`/api/leads?${params}`);
    const json = (await res.json()) as {
      rows?: LeadRow[];
      total?: number;
      countries?: string[];
    };
    if (!res.ok) {
      setRows([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setRows(json.rows ?? []);
    setTotal(json.total ?? 0);
    if (json.countries?.length) setCountries(json.countries);
    setLoading(false);
  }, [country, kind, page, query, sort.dir, sort.key, stage]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => rows.find((row) => row.lead.id === selectedId) ?? null,
    [rows, selectedId],
  );

  useEffect(() => {
    if (adding) {
      setForm(emptyContactWrite());
      setFormError("");
      return;
    }
    if (selected) {
      setForm(contactWriteFromLead(selected.lead, selected.details));
      setFormError("");
    }
  }, [adding, selected]);

  const booked = selected
    ? sales.some(
        (s) =>
          s.leadId === selected.lead.id ||
          (selected.lead.email &&
            s.email.toLowerCase() === selected.lead.email.toLowerCase()),
      )
    : false;

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function closeEditor() {
    setAdding(false);
    setSelectedId(null);
    setFormError("");
  }

  async function saveContact() {
    if (!form.name.trim()) {
      setFormError(t("pages.leads.nameRequired"));
      return;
    }
    setSaving(true);
    setFormError("");
    const res = await fetch("/api/leads", {
      method: adding ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adding ? form : { ...form, id: selectedId }),
    });
    const json = (await res.json()) as {
      error?: string;
      row?: LeadRow;
    };
    setSaving(false);
    if (!res.ok) {
      setFormError(json.error || t("toast.saveFailed"));
      return;
    }
    pushToast(
      adding
        ? t("toast.leadAdded", { name: form.name.trim() })
        : t("toast.leadSaved"),
    );
    const savedId = json.row?.lead.id;
    setAdding(false);
    if (savedId) setSelectedId(savedId);
    await load();
  }

  function toggleSort(key: Exclude<SortKey, "completeness">) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "updated" ? "desc" : "asc" },
    );
    setPage(0);
  }

  return (
    <div>
      <PageHeader
        title={t("pages.leads.title")}
        description={t("pages.leads.tableDescription", { n: total })}
        action={
          <button
            type="button"
            className={btnPrimary}
            onClick={() => {
              setSelectedId(null);
              setAdding(true);
            }}
          >
            {t("pages.leads.addLead")}
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <input
          className={`${inputClass} col-span-2 lg:col-span-1`}
          placeholder={t("pages.leads.searchTable")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <select
          className={inputClass}
          value={stage}
          onChange={(e) => {
            setStage(e.target.value as LeadStatus | "all");
            setPage(0);
          }}
        >
          <option value="all">{t("common.allStatuses")}</option>
          {STAGES.map((id) => (
            <option key={id} value={id}>
              {t(`stages.${id}`)}
            </option>
          ))}
        </select>
        <select
          className={inputClass}
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">{t("pages.leads.allCountries")}</option>
          {countries.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          className={`${inputClass} col-span-2 lg:col-span-1`}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as "all" | "person" | "company");
            setPage(0);
          }}
        >
          <option value="all">{t("pages.leads.allKinds")}</option>
          <option value="person">{t("pages.leads.person")}</option>
          <option value="company">{t("pages.leads.company")}</option>
        </select>
        <select
          className={`${inputClass} col-span-2 lg:hidden`}
          value={`${sort.key}:${sort.dir}`}
          onChange={(e) => {
            const [key, dir] = e.target.value.split(":") as [SortKey, "asc" | "desc"];
            setSort({ key, dir });
            setPage(0);
          }}
          aria-label={t("pages.leads.sortBy")}
        >
          <option value="completeness:desc">{t("pages.leads.sortCompleteness")}</option>
          <option value="name:asc">{t("common.name")} A–Z</option>
          <option value="name:desc">{t("common.name")} Z–A</option>
          <option value="email:asc">{t("common.email")} A–Z</option>
          <option value="email:desc">{t("common.email")} Z–A</option>
          <option value="updated:desc">{t("pages.leads.updated")}</option>
        </select>
      </div>

      <div className="mt-4">
        <Panel
          title={t("pages.leads.count", {
            shown: rows.length,
            total,
          })}
        >
          {loading && rows.length === 0 ? (
            <EmptyHint>{t("common.loading")}</EmptyHint>
          ) : rows.length === 0 ? (
            <EmptyHint>
              {total === 0 && !query
                ? t("pages.leads.noLeads")
                : t("pages.leads.nothingMatches")}
            </EmptyHint>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {rows.map((row) => (
                  <ContactCard
                    key={row.lead.id}
                    lead={row.lead}
                    details={row.details}
                    onOpen={() => setSelectedId(row.lead.id)}
                  />
                ))}
              </div>
              <div className="table-wrap -mx-5 hidden sm:-mx-6 lg:block">
                <table className="data-table data-table-contacts">
                  <thead>
                    <tr>
                      <SortHead
                        label={t("common.name")}
                        active={sort.key === "name"}
                        dir={sort.dir}
                        onClick={() => toggleSort("name")}
                      />
                      <SortHead
                        label={t("common.email")}
                        active={sort.key === "email"}
                        dir={sort.dir}
                        onClick={() => toggleSort("email")}
                      />
                      <th>{t("common.phone")}</th>
                      <th>{t("common.company")}</th>
                      <th>{t("pages.leads.city")}</th>
                      <th>{t("pages.leads.country")}</th>
                      <th>{t("pages.leads.tags")}</th>
                      <th>{t("pages.leads.kind")}</th>
                      <SortHead
                        label={t("pages.leads.updated")}
                        active={sort.key === "updated"}
                        dir={sort.dir}
                        onClick={() => toggleSort("updated")}
                      />
                      <th>{t("pages.leads.nextActivity")}</th>
                      <th>{t("pages.leads.stage")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ lead, details }) => (
                      <tr
                        key={lead.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedId(lead.id)}
                      >
                        <td className="font-medium">{lead.name || "—"}</td>
                        <td>
                          {lead.email ? (
                            <a
                              href={`mailto:${lead.email}`}
                              className="text-sand hover:text-gold"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {lead.email}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          {lead.phone ? (
                            <a
                              href={`tel:${lead.phone}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {lead.phone}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{lead.company || "—"}</td>
                        <td>{details.city || "—"}</td>
                        <td>{details.country || "—"}</td>
                        <td>
                          {details.tags ? (
                            <span className="flex flex-wrap gap-1">
                              {tagList(details.tags).map((tag) => (
                                <span
                                  key={tag}
                                  className="bg-ash px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sand"
                                >
                                  {tag}
                                </span>
                              ))}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {details.isCompany
                            ? t("pages.leads.company")
                            : t("pages.leads.person")}
                        </td>
                        <td className="whitespace-nowrap text-mute">
                          {formatDate(
                            (details.updated || lead.lastContact).slice(0, 10),
                            locale,
                          )}
                        </td>
                        <td className="max-w-[14rem]">
                          <span className="line-clamp-2">
                            {details.nextActivity || details.activityStatus || "—"}
                          </span>
                        </td>
                        <td>
                          <StatusBadge compact tone={leadTone(lead.status)}>
                            {t(`stagesShort.${lead.status}`)}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-col gap-3 text-sm text-mute sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <p>
                  {t("pages.leads.pageOf", {
                    from: total === 0 ? 0 : page * PAGE_SIZE + 1,
                    to: Math.min(total, page * PAGE_SIZE + rows.length),
                    total,
                  })}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    {t("common.back")}
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={page >= pageCount - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t("pages.leads.nextPage")}
                  </button>
                </div>
              </div>
            </>
          )}
        </Panel>
      </div>

      <Modal
        open={adding || Boolean(selected)}
        title={
          adding
            ? t("pages.leads.newContact")
            : selected?.lead.name || t("pages.leads.editContact")
        }
        onClose={closeEditor}
        wide
        footer={
          <ContactFormActions
            formId={FORM_ID}
            saving={saving}
            error={formError}
            onCancel={closeEditor}
            extraActions={
              selected && !adding ? (
                <>
                  {selected.lead.email ? (
                    <Link
                      href={`/inbox?chat=${encodeURIComponent(selected.lead.email)}`}
                      className={btnSecondary}
                    >
                      {t("pages.leads.openChat")}
                    </Link>
                  ) : null}
                  {!booked ? (
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() =>
                        void addSale({
                          customer: selected.lead.name,
                          email: selected.lead.email,
                          product:
                            selected.lead.notes.slice(0, 80) ||
                            t("pages.leads.tourBooking"),
                          amount: selected.lead.value || 0,
                          source: "lead",
                          inquiryId: null,
                          leadId: selected.lead.id,
                          notes: selected.lead.notes,
                        })
                      }
                    >
                      {t("pages.leads.createSale")}
                    </button>
                  ) : null}
                </>
              ) : null
            }
          />
        }
      >
        <ContactForm
          formId={FORM_ID}
          value={form}
          onChange={setForm}
          onSubmit={() => void saveContact()}
        />
      </Modal>
    </div>
  );
}

function SortHead({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th>
      <button
        type="button"
        onClick={onClick}
        className={`uppercase tracking-[0.12em] ${active ? "text-gold" : "text-mute"}`}
      >
        {label}
        {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

function ContactCard({
  lead,
  details,
  onOpen,
}: {
  lead: Lead;
  details: ContactDetails;
  onOpen: () => void;
}) {
  const { t, locale } = useLocale();
  const tags = tagList(details.tags);

  return (
    <article>
      <button
        type="button"
        onClick={onOpen}
        className="w-full border border-line bg-canvas px-3.5 py-3 text-left transition-colors active:bg-ash"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium leading-snug break-words">{lead.name || "—"}</p>
            {lead.company && lead.company !== lead.name ? (
              <p className="mt-0.5 text-sm text-mute break-words">{lead.company}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge compact tone={leadTone(lead.status)}>
              {t(`stagesShort.${lead.status}`)}
            </StatusBadge>
            <span className="text-lg leading-none text-mute" aria-hidden>
              ›
            </span>
          </div>
        </div>

        <dl className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          <CardField label={t("common.email")} value={lead.email} />
          <CardField label={t("common.phone")} value={lead.phone} />
          <CardField label={t("pages.leads.city")} value={details.city} />
          <CardField label={t("pages.leads.country")} value={details.country} />
          <CardField
            label={t("pages.leads.kind")}
            value={details.isCompany ? t("pages.leads.company") : t("pages.leads.person")}
          />
          <CardField
            label={t("pages.leads.updated")}
            value={formatDate((details.updated || lead.lastContact).slice(0, 10), locale)}
          />
          <CardField
            label={t("pages.leads.nextActivity")}
            value={details.nextActivity || details.activityStatus}
            wide
          />
        </dl>
        {tags.length ? (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {tags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="bg-ash px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sand"
              >
                {tag}
              </span>
            ))}
            {tags.length > 6 ? (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold text-mute">
                +{tags.length - 6}
              </span>
            ) : null}
          </div>
        ) : null}
      </button>
      {(lead.email || lead.phone) && (
        <div className="flex border-x border-b border-line">
          {lead.phone ? (
            <a
              href={`tel:${lead.phone}`}
              className="flex min-h-11 flex-1 items-center justify-center border-r border-line text-xs font-semibold uppercase tracking-[0.08em] text-sand"
            >
              {t("common.phone")}
            </a>
          ) : null}
          {lead.email ? (
            <a
              href={`mailto:${lead.email}`}
              className="flex min-h-11 flex-1 items-center justify-center text-xs font-semibold uppercase tracking-[0.08em] text-sand"
            >
              {t("common.email")}
            </a>
          ) : null}
        </div>
      )}
    </article>
  );
}

function CardField({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  const text = value.trim();
  if (!text) return null;
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm leading-snug">{text}</dd>
    </div>
  );
}

