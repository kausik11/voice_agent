"use client";
import { useEffect, useState } from "react";
import {
  Save,
  Plus,
  BookOpen,
  Pencil,
  Trash2,
  RefreshCw,
  ShieldCheck,
  CircleDollarSign,
  Eye,
  X,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { api } from "./admin-dashboard";
import { Button } from "./ui/button";
import { Modal } from "./modal";
import { defaults, MODELS, VOICES, type AgentConfig } from "@/lib/config";
type Entry = {
  id?: string;
  question: string;
  answer: string;
  category: string;
  enabled: boolean;
  sample: boolean;
};
type Pricing = {
  id: string;
  model: string;
  currency: string;
  effectiveAt: string;
  rates: Record<string, string>;
  sourceUrl: string;
};
type BudgetConfig = {
  daily: string | null;
  monthly: string | null;
  blockNew: boolean;
  inrRate: string | null;
  exchangeEffectiveAt: string | null;
  hostingMonthly: string | null;
  telephoneMonthly: string | null;
};
type Budget = {
  config: BudgetConfig | null;
  daily: { amount: string; incomplete: number };
  monthly: { amount: string; incomplete: number };
  alerts: {
    id: string;
    period: string;
    amount: string;
    threshold: string;
    createdAt: string;
  }[];
};
const emptyEntry: Entry = {
  question: "",
  answer: "",
  category: "General information",
  enabled: false,
  sample: false,
};
const emptyBudget: BudgetConfig = {
  daily: null,
  monthly: null,
  blockNew: false,
  inrRate: null,
  exchangeEffectiveAt: null,
  hostingMonthly: null,
  telephoneMonthly: null,
};
const meta: Record<string, { title: string; description: string }> = {
  settings: {
    title: "Make MMA Assistant your own.",
    description: "Set the voice, guidance, and boundaries for your assistant.",
  },
  knowledge: {
    title: "Good answers start here.",
    description: "Give your assistant approved information it can rely on.",
  },
  pricing: {
    title: "Know what goes into a cost.",
    description: "Versioned model rates for transparent API estimates.",
  },
  budget: {
    title: "A little peace of mind.",
    description: "Keep an eye on spending and set sensible limits.",
  },
};
export default function AdminSettings({
  section,
  demo,
}: {
  section: string;
  demo: boolean;
}) {
  const [config, setConfig] = useState<AgentConfig>(defaults);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [preview, setPreview] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [edit, setEdit] = useState<Entry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig>(emptyBudget);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState("All categories");
  async function load() {
    setLoading(true);
    try {
      if (section === "settings") setConfig(await api<AgentConfig>("settings"));
      if (section === "knowledge") {
        const data = await api<{ entries: Entry[]; preview: string }>(
          "knowledge",
        );
        setEntries(data.entries);
        setPreview(data.preview);
      }
      if (section === "pricing") setPricing(await api<Pricing[]>("pricing"));
      if (section === "budget") {
        const data = await api<Budget>("budget");
        setBudget(data);
        setBudgetConfig(data.config ?? emptyBudget);
      }
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (section === "settings") {
          const d = await api<AgentConfig>("settings");
          if (!cancelled) setConfig(d);
        }
        if (section === "knowledge") {
          const d = await api<{ entries: Entry[]; preview: string }>(
            "knowledge",
          );
          if (!cancelled) {
            setEntries(d.entries);
            setPreview(d.preview);
          }
        }
        if (section === "pricing") {
          const d = await api<Pricing[]>("pricing");
          if (!cancelled) setPricing(d);
        }
        if (section === "budget") {
          const d = await api<Budget>("budget");
          if (!cancelled) {
            setBudget(d);
            setBudgetConfig(d.config ?? emptyBudget);
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section]);
  async function save(data: unknown, method = "POST") {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(section, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setSuccess(
        method === "DELETE" ? "Entry deleted." : "Changes saved successfully.",
      );
      setEdit(null);
      setDeleteId(null);
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const update = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A THOUGHTFULLY CONFIGURED ASSISTANT</span>
          <h1>{meta[section].title}</h1>
          <p>{meta[section].description}</p>
        </div>
        {section === "knowledge" && (
          <div className="heading-actions">
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye size={16} />
              Preview context
            </Button>
            <Button onClick={() => setEdit({ ...emptyEntry })}>
              <Plus size={16} />
              Add FAQ
            </Button>
          </div>
        )}
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
          <Button variant="ghost" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      )}
      {success && (
        <div className="notice success" role="status">
          <CheckCircle2 size={17} />
          {success}
        </div>
      )}
      {loading ? (
        <div className="loading-state">
          <RefreshCw className="spin" />
          Loading configuration…
        </div>
      ) : (
        <>
          {section === "settings" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save(config);
              }}
            >
              <div className="settings-columns">
                <section className="panel form-panel">
                  <div className="form-section-title">
                    <span className="form-number">01</span>
                    <div>
                      <h2>Personality & purpose</h2>
                      <p>A familiar name and a helpful first impression.</p>
                    </div>
                  </div>
                  <label>
                    Agent name
                    <input
                      required
                      maxLength={80}
                      value={config.name}
                      onChange={(e) => update("name", e.target.value)}
                    />
                  </label>
                  <label>
                    Welcome message
                    <input
                      required
                      maxLength={400}
                      value={config.welcome}
                      onChange={(e) => update("welcome", e.target.value)}
                    />
                  </label>
                  <label>
                    System instructions
                    <textarea
                      rows={8}
                      required
                      minLength={20}
                      maxLength={8000}
                      value={config.instructions}
                      onChange={(e) => update("instructions", e.target.value)}
                    />
                    <small>
                      Instructions and approved knowledge are snapshotted when
                      each conversation starts.
                    </small>
                  </label>
                  <div className="form-section-title separated">
                    <span className="form-number">02</span>
                    <div>
                      <h2>Voice & language</h2>
                      <p>Make every conversation feel natural.</p>
                    </div>
                  </div>
                  <div className="form-row">
                    <label>
                      Preferred language
                      <select
                        value={config.language}
                        onChange={(e) =>
                          update(
                            "language",
                            e.target.value as AgentConfig["language"],
                          )
                        }
                      >
                        {["English", "Bengali", "Hindi"].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Voice
                      <select
                        value={config.voice}
                        onChange={(e) =>
                          update(
                            "voice",
                            e.target.value as AgentConfig["voice"],
                          )
                        }
                      >
                        {VOICES.map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Supported model
                    <select
                      value={config.model}
                      onChange={(e) =>
                        update("model", e.target.value as AgentConfig["model"])
                      }
                    >
                      {MODELS.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                    <small>
                      Language preference is included in the instructions.
                      Native audio selects the spoken language.
                    </small>
                  </label>
                </section>
                <div>
                  <section className="panel form-panel">
                    <div className="form-section-title">
                      <span className="form-number">03</span>
                      <div>
                        <h2>Session boundaries</h2>
                        <p>Small limits that make a difference.</p>
                      </div>
                    </div>
                    {[
                      {
                        key: "maxDuration",
                        label: "Maximum duration (seconds)",
                        min: 30,
                        max: 540,
                      },
                      {
                        key: "retentionDays",
                        label: "Transcript retention (days)",
                        min: 1,
                        max: 365,
                      },
                      {
                        key: "maxConcurrent",
                        label: "Concurrent conversations",
                        min: 1,
                        max: 100,
                      },
                      {
                        key: "rateLimit",
                        label: "New sessions per minute / client",
                        min: 1,
                        max: 100,
                      },
                    ].map((f) => (
                      <label key={f.key}>
                        {f.label}
                        <input
                          type="number"
                          required
                          min={f.min}
                          max={f.max}
                          value={config[f.key as keyof AgentConfig]}
                          onChange={(e) =>
                            update(
                              f.key as "maxDuration",
                              Number(e.target.value),
                            )
                          }
                        />
                      </label>
                    ))}
                    <label>
                      Display timezone
                      <input
                        required
                        value={config.timezone}
                        onChange={(e) => update("timezone", e.target.value)}
                      />
                    </label>
                  </section>
                  <div className="guidance-card">
                    <ShieldCheck size={23} />
                    <h3>Thoughtful by design</h3>
                    <p>
                      Use approved information for Academy-specific facts.
                      General questions can use the model’s knowledge. Course
                      eligibility, fees, and certification details should be
                      confirmed by academy staff.
                    </p>
                  </div>
                </div>
              </div>
              <div className="form-save">
                <span>
                  {demo
                    ? "Demo configuration is read-only."
                    : "Changes apply to new conversations."}
                </span>
                <Button disabled={busy || demo}>
                  <Save size={16} />
                  {busy ? "Saving…" : "Save configuration"}
                </Button>
              </div>
            </form>
          )}
          {section === "knowledge" && (
            <>
              {showPreview && (
                <section className="panel form-panel context-preview">
                  <h2>Approved context preview</h2>
                  <p>
                    Up to 20 non-sample entries and 12,000 characters are
                    included per conversation.
                  </p>
                  <pre>
                    {preview ||
                      "No approved Academy knowledge yet. General questions are supported; missing Academy details need staff confirmation."}
                  </pre>
                </section>
              )}
              <div className="knowledge-toolbar">
                <span>{entries.length} knowledge entries</span>
                <select
                  aria-label="Filter category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option>All categories</option>
                  {Array.from(new Set(entries.map((e) => e.category))).map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
              </div>
              <div className="knowledge-list">
                {entries
                  .filter(
                    (e) =>
                      category === "All categories" || e.category === category,
                  )
                  .map((entry) => (
                    <section className="panel knowledge-card" key={entry.id}>
                      <span className="knowledge-icon">
                        <BookOpen size={21} />
                      </span>
                      <div className="knowledge-copy">
                        <div className="knowledge-tags">
                          <span>{entry.category}</span>
                          {entry.sample && (
                            <span className="sample-tag">
                              Sample · excluded from context
                            </span>
                          )}
                          <span
                            className={
                              entry.enabled && !entry.sample
                                ? "enabled-tag"
                                : "disabled-tag"
                            }
                          >
                            {entry.enabled && !entry.sample
                              ? "Enabled"
                              : "Disabled"}
                          </span>
                        </div>
                        <h2>{entry.question}</h2>
                        <p>{entry.answer}</p>
                      </div>
                      <div className="knowledge-actions">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${entry.question}`}
                          onClick={() => setEdit({ ...entry })}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${entry.question}`}
                          disabled={demo}
                          onClick={() => setDeleteId(entry.id!)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                      {deleteId === entry.id && (
                        <div className="delete-confirm">
                          Delete this FAQ?{" "}
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => save({ id: entry.id }, "DELETE")}
                          >
                            Delete
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </section>
                  ))}
              </div>
              {!entries.length && (
                <div className="empty-state">
                  <BookOpen size={32} />
                  <h2>A home for helpful answers.</h2>
                  <p>Add your first approved FAQ to get started.</p>
                  <Button onClick={() => setEdit({ ...emptyEntry })}>
                    <Plus size={16} />
                    Add your first FAQ
                  </Button>
                </div>
              )}
              {edit && (
                <Modal onClose={() => setEdit(null)} labelledBy="faq-title">
                  <div className="panel-heading">
                    <h2 id="faq-title">
                      {edit.id ? "Edit FAQ" : "Add an approved FAQ"}
                    </h2>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Close editor"
                      onClick={() => setEdit(null)}
                    >
                      <X size={19} />
                    </Button>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save(edit);
                    }}
                  >
                    <label>
                      Question
                      <input
                        autoFocus
                        required
                        minLength={3}
                        maxLength={200}
                        value={edit.question}
                        onChange={(e) =>
                          setEdit({ ...edit, question: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Approved answer
                      <textarea
                        required
                        minLength={3}
                        maxLength={2000}
                        rows={5}
                        value={edit.answer}
                        onChange={(e) =>
                          setEdit({ ...edit, answer: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Category
                      <input
                        required
                        maxLength={60}
                        value={edit.category}
                        onChange={(e) =>
                          setEdit({ ...edit, category: e.target.value })
                        }
                      />
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={edit.enabled}
                        onChange={(e) =>
                          setEdit({ ...edit, enabled: e.target.checked })
                        }
                      />
                      Enable for new conversations
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={edit.sample}
                        onChange={(e) =>
                          setEdit({ ...edit, sample: e.target.checked })
                        }
                      />
                      Sample content (always excluded from context)
                    </label>
                    <div className="form-save">
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => setEdit(null)}
                      >
                        Cancel
                      </Button>
                      <Button disabled={busy || demo}>
                        <Save size={16} />
                        Save FAQ
                      </Button>
                    </div>
                  </form>
                </Modal>
              )}
            </>
          )}
          {section === "pricing" && (
            <div className="settings-columns">
              <section className="panel form-panel">
                <div className="form-section-title">
                  <span className="form-number">
                    <CircleDollarSign size={19} />
                  </span>
                  <div>
                    <h2>Create a pricing version</h2>
                    <p>Rates are USD per one million tokens.</p>
                  </div>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const rates: Record<string, string> = {};
                    for (const k of [
                      "input.TEXT",
                      "input.AUDIO",
                      "output.TEXT",
                      "output.AUDIO",
                      "cache.TEXT",
                      "cache.AUDIO",
                      "thoughts",
                      "tool",
                    ]) {
                      const v = String(f.get(k) ?? "").trim();
                      if (v) rates[k] = v;
                    }
                    void save({
                      model: f.get("model"),
                      currency: "USD",
                      effectiveAt: new Date(
                        String(f.get("effectiveAt")),
                      ).toISOString(),
                      sourceUrl: f.get("sourceUrl"),
                      rates,
                    });
                  }}
                >
                  <label>
                    Model
                    <select name="model">
                      {MODELS.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <div className="form-row">
                    {[
                      "input.TEXT",
                      "input.AUDIO",
                      "output.TEXT",
                      "output.AUDIO",
                      "cache.TEXT",
                      "cache.AUDIO",
                      "thoughts",
                      "tool",
                    ].map((k) => (
                      <label key={k}>
                        {k.replace(".", " · ")}
                        <input
                          name={k}
                          placeholder="Not configured"
                          inputMode="decimal"
                          pattern="\d+(\.\d+)?"
                        />
                      </label>
                    ))}
                  </div>
                  <label>
                    Effective from (your browser’s local time)
                    <input name="effectiveAt" type="datetime-local" required />
                  </label>
                  <label>
                    Official pricing source
                    <input
                      name="sourceUrl"
                      type="url"
                      placeholder="https://ai.google.dev/gemini-api/docs/pricing"
                      required
                    />
                  </label>
                  <div className="notice">
                    <strong>No rates are assumed.</strong> Verify each category
                    against Google’s official pricing. Blank rates are
                    unavailable, not zero.
                  </div>
                  <Button disabled={busy || demo}>
                    <Plus size={16} />
                    Create immutable version
                  </Button>
                </form>
              </section>
              <div>
                <section className="panel form-panel">
                  <h2>Pricing history</h2>
                  <p className="muted-text">
                    Existing versions are never overwritten.
                  </p>
                  {pricing.length ? (
                    pricing.map((p) => (
                      <div className="pricing-version" key={p.id}>
                        <strong>{p.model}</strong>
                        <small>
                          Effective {new Date(p.effectiveAt).toLocaleString()}
                        </small>
                        {Object.entries(p.rates).map(([k, v]) => (
                          <div key={k}>
                            <span>{k}</span>
                            <b>${v} / 1M</b>
                          </div>
                        ))}
                        <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                          Official source ↗
                        </a>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state compact">
                      <CircleDollarSign size={28} />
                      <h3>Pricing unavailable</h3>
                      <p>
                        Add verified model rates to enable estimates when
                        billable usage is available.
                      </p>
                    </div>
                  )}
                </section>
                <div className="guidance-card">
                  <AlertTriangle size={22} />
                  <h3>Estimates need complete data</h3>
                  <p>
                    Live counter periods still require provider verification.
                    Raw usage is preserved; unverified periods remain
                    incomplete, even with pricing configured.
                  </p>
                </div>
              </div>
            </div>
          )}
          {section === "budget" && (
            <>
              <div className="budget-summary">
                {(["daily", "monthly"] as const).map((period) => (
                  <section className="panel budget-card" key={period}>
                    <span>
                      {period === "daily"
                        ? "Today’s estimated spend"
                        : "This month’s estimated spend"}
                    </span>
                    <strong>
                      ${Number(budget?.[period].amount ?? 0).toFixed(4)}
                    </strong>
                    <small>
                      {budget?.[period].incomplete ?? 0} sessions with
                      incomplete costs · UTC calendar
                    </small>
                    {budgetConfig.inrRate && (
                      <small>
                        ≈ ₹
                        {(
                          Number(budget?.[period].amount ?? 0) *
                          Number(budgetConfig.inrRate)
                        ).toFixed(2)}{" "}
                        · configured exchange rate
                      </small>
                    )}
                  </section>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save(budgetConfig);
                }}
              >
                <div className="settings-columns">
                  <section className="panel form-panel">
                    <h2>Spending thresholds</h2>
                    <p className="muted-text">
                      Leave a threshold blank to keep it unconfigured.
                    </p>
                    <div className="form-row">
                      <label>
                        Daily threshold (USD)
                        <input
                          inputMode="decimal"
                          pattern="\d+(\.\d+)?"
                          value={budgetConfig.daily ?? ""}
                          onChange={(e) =>
                            setBudgetConfig({
                              ...budgetConfig,
                              daily: e.target.value || null,
                            })
                          }
                          placeholder="Not configured"
                        />
                      </label>
                      <label>
                        Monthly threshold (USD)
                        <input
                          inputMode="decimal"
                          pattern="\d+(\.\d+)?"
                          value={budgetConfig.monthly ?? ""}
                          onChange={(e) =>
                            setBudgetConfig({
                              ...budgetConfig,
                              monthly: e.target.value || null,
                            })
                          }
                          placeholder="Not configured"
                        />
                      </label>
                    </div>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={budgetConfig.blockNew}
                        onChange={(e) =>
                          setBudgetConfig({
                            ...budgetConfig,
                            blockNew: e.target.checked,
                          })
                        }
                      />
                      Block new conversations when a threshold is reached or
                      spending is unknown
                    </label>
                    <div className="notice">
                      <AlertTriangle size={17} />
                      <span>
                        Estimated spending can lag provider billing. These
                        controls are not an exact billing cap. Unverified usage
                        is not included in estimates. When blocking is enabled,
                        a configured period with incomplete spending blocks new
                        sessions until reconciled.
                      </span>
                    </div>
                    <h2 className="separated">Optional INR display</h2>
                    <div className="form-row">
                      <label>
                        INR per 1 USD
                        <input
                          inputMode="decimal"
                          pattern="\d+(\.\d+)?"
                          value={budgetConfig.inrRate ?? ""}
                          placeholder="No exchange rate configured"
                          onChange={(e) =>
                            setBudgetConfig({
                              ...budgetConfig,
                              inrRate: e.target.value || null,
                            })
                          }
                        />
                      </label>
                      <label>
                        Exchange rate effective date
                        <input
                          type="date"
                          value={
                            budgetConfig.exchangeEffectiveAt?.slice(0, 10) ?? ""
                          }
                          onChange={(e) =>
                            setBudgetConfig({
                              ...budgetConfig,
                              exchangeEffectiveAt: e.target.value
                                ? new Date(e.target.value).toISOString()
                                : null,
                            })
                          }
                        />
                      </label>
                    </div>
                  </section>
                  <section className="panel form-panel">
                    <h2>Other monthly expenses</h2>
                    <p className="muted-text">
                      Recorded separately from Estimated API Cost.
                    </p>
                    <label>
                      Hosting (USD)
                      <input
                        inputMode="decimal"
                        pattern="\d+(\.\d+)?"
                        value={budgetConfig.hostingMonthly ?? ""}
                        onChange={(e) =>
                          setBudgetConfig({
                            ...budgetConfig,
                            hostingMonthly: e.target.value || null,
                          })
                        }
                        placeholder="Not configured"
                      />
                    </label>
                    <label>
                      Telephone / other services (USD)
                      <input
                        inputMode="decimal"
                        pattern="\d+(\.\d+)?"
                        value={budgetConfig.telephoneMonthly ?? ""}
                        onChange={(e) =>
                          setBudgetConfig({
                            ...budgetConfig,
                            telephoneMonthly: e.target.value || null,
                          })
                        }
                        placeholder="Not configured"
                      />
                    </label>
                    <div className="guidance-card">
                      <ShieldCheck size={22} />
                      <h3>Alerts stay in your workspace.</h3>
                      <p>
                        No external email or SMS alerts are sent. Session
                        duration, concurrency and rate limits are managed in
                        Agent settings.
                      </p>
                    </div>
                  </section>
                </div>
                <div className="form-save">
                  <span>
                    {demo
                      ? "Demo configuration is read-only."
                      : "Thresholds use UTC calendar days and months."}
                  </span>
                  <Button disabled={busy || demo}>
                    <Save size={16} />
                    Save budget settings
                  </Button>
                </div>
              </form>
              <section className="panel form-panel">
                <h2>Budget alerts</h2>
                {budget?.alerts?.length ? (
                  budget.alerts.map((a) => (
                    <div className="notice" key={a.id}>
                      {a.period} estimate ${a.amount} reached the ${a.threshold}{" "}
                      threshold · {new Date(a.createdAt).toLocaleString()}
                    </div>
                  ))
                ) : (
                  <p className="muted-text">
                    No budget alerts. New threshold alerts will appear here.
                  </p>
                )}
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}
