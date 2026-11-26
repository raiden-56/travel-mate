"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { ListChecks, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  useAddChecklistItem,
  useChecklistSuggestions,
  useChecklistTemplates,
  useChecklists,
  useCreateChecklist,
  useDeleteChecklist,
  useDeleteChecklistItem,
  useUpdateChecklistItem,
} from "@/features/checklist/hooks";
import { EmptyState, ErrorState } from "@/components/common/states";
import { SourceLabel } from "@/components/common/labels";
import { Dialog, DialogContent, DialogFooter, ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, Progress, Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/api-client";
import { cn, titleCase } from "@/lib/utils";
import { CHECKLIST_CATEGORIES, type ChecklistCategory, type ChecklistDto, type ChecklistSuggestion } from "@/types/api";

function ChecklistCard({ tripId, list }: { tripId: string; list: ChecklistDto }) {
  const toggle = useUpdateChecklistItem(tripId);
  const remove = useDeleteChecklistItem(tripId);
  const add = useAddChecklistItem(tripId);
  const delList = useDeleteChecklist(tripId);
  const [label, setLabel] = React.useState("");
  const [category, setCategory] = React.useState<ChecklistCategory>("ESSENTIALS");
  const [hideDone, setHideDone] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const groups = CHECKLIST_CATEGORIES.map((c) => ({
    category: c,
    items: list.items.filter((i) => i.category === c && (!hideDone || !i.completed)).sort((a, b) => a.position - b.position),
  })).filter((g) => g.items.length > 0);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">{list.name}</h3>
          <p className="text-xs text-ink-muted">{list.completedCount} of {list.totalCount} done</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setHideDone((h) => !h)} className="rounded px-2 py-1 text-xs text-ink-muted hover:bg-surface-muted" aria-pressed={hideDone}>
            {hideDone ? "Show done" : "Hide done"}
          </button>
          <button onClick={() => setConfirmDelete(true)} className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-danger" aria-label={`Delete ${list.name}`}>
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      <Progress className="mt-3" value={list.totalCount ? (list.completedCount / list.totalCount) * 100 : 0} label={`${list.name} progress`} />

      <div className="mt-5 space-y-5">
        {groups.map((g) => (
          <section key={g.category}>
            <h4 className="mb-1.5 text-xs font-medium text-ink-muted">{titleCase(g.category)}</h4>
            <ul>
              {g.items.map((i) => (
                <li key={i.id} className="group flex items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-surface-muted/60">
                  <input
                    type="checkbox"
                    id={`ci-${i.id}`}
                    checked={i.completed}
                    onChange={(e) => toggle.mutate({ id: i.id, completed: e.target.checked }, { onError: (err) => toast.error(errorMessage(err)) })}
                    className="size-4 accent-[var(--sage)]"
                  />
                  <label htmlFor={`ci-${i.id}`} className={cn("flex-1 text-sm", i.completed && "text-ink-muted line-through")}>
                    {i.label}
                    {i.suggested && i.reason && <span className="block text-[11.5px] text-ink-muted no-underline">{i.reason}</span>}
                  </label>
                  <button
                    onClick={() => remove.mutate(i.id, { onError: (err) => toast.error(errorMessage(err)) })}
                    className="rounded p-1 text-ink-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100"
                    aria-label={`Remove ${i.label}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {list.items.length === 0 && <p className="text-sm text-ink-muted">Empty — add the first item below.</p>}
      </div>

      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = label.trim();
          if (!v) return;
          add.mutate({ checklistId: list.id, label: v, category }, { onSuccess: () => setLabel(""), onError: (err) => toast.error(errorMessage(err)) });
        }}
      >
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add an item" aria-label="New item" maxLength={160} />
        <Select value={category} onChange={(e) => setCategory(e.target.value as ChecklistCategory)} className="w-36" aria-label="Category">
          {CHECKLIST_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
        </Select>
        <Button type="submit" variant="secondary" size="icon" loading={add.isPending} aria-label="Add item" className="h-10 w-10">
          {!add.isPending && <Plus />}
        </Button>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${list.name}”?`}
        description="All items in this checklist will be removed."
        confirmLabel="Delete checklist"
        destructive
        loading={delList.isPending}
        onConfirm={() => delList.mutate(list.id, { onSuccess: () => { toast.success("Checklist deleted"); setConfirmDelete(false); }, onError: (e) => toast.error(errorMessage(e)) })}
      />
    </Card>
  );
}

export default function ChecklistPage() {
  const { id } = useParams<{ id: string }>();
  const lists = useChecklists(id);
  const templates = useChecklistTemplates();
  const create = useCreateChecklist(id);
  const suggest = useChecklistSuggestions(id);
  const add = useAddChecklistItem(id);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState("Packing list");
  const [templateKey, setTemplateKey] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<ChecklistSuggestion | null>(null);
  const [picked, setPicked] = React.useState<Set<number>>(new Set());
  const [target, setTarget] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  const openSuggestions = () =>
    suggest.mutate(undefined, {
      onSuccess: (s) => {
        const existing = new Set(lists.data?.flatMap((l) => l.items.map((i) => i.label.toLowerCase())));
        setSuggestions(s);
        setPicked(new Set(s.items.map((_, i) => i).filter((i) => !existing.has(s.items[i].label.toLowerCase()))));
        setTarget(lists.data?.[0]?.id ?? "");
      },
      onError: (e) => toast.error(errorMessage(e)),
    });

  const addSuggestions = async () => {
    if (!suggestions) return;
    setAdding(true);
    try {
      let checklistId = target;
      if (!checklistId) checklistId = (await create.mutateAsync({ name: "Packing list" })).id;
      for (const i of Array.from(picked).sort((a, b) => a - b)) {
        const s = suggestions.items[i];
        await add.mutateAsync({ checklistId, label: s.label, category: s.category, suggested: true, reason: s.reason });
      }
      toast.success(`Added ${picked.size} item${picked.size === 1 ? "" : "s"}`);
      setSuggestions(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setAdding(false);
    }
  };

  if (lists.isLoading) return <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>;
  if (lists.isError) return <ErrorState error={lists.error} onRetry={() => lists.refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Checklists</h2>
        <div className="flex gap-2">
          <Button variant="subtle" size="sm" onClick={openSuggestions} loading={suggest.isPending}><Sparkles /> Suggest for this trip</Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus /> New checklist</Button>
        </div>
      </div>

      {lists.data?.length === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title="Nothing to pack yet"
          description="Start from a template like Beach vacation or Trekking, or get suggestions based on this trip's destination, weather and length."
          action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={() => setCreateOpen(true)}>Start a checklist</Button><Button variant="subtle" onClick={openSuggestions} loading={suggest.isPending}><Sparkles /> Suggest items</Button></div>}
        />
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {lists.data?.map((l) => <ChecklistCard key={l.id} tripId={id} list={l} />)}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="New checklist">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              create.mutate(
                { name: name.trim(), templateKey: templateKey || undefined },
                { onSuccess: () => { toast.success("Checklist created"); setCreateOpen(false); setTemplateKey(""); }, onError: (err) => toast.error(errorMessage(err)) },
              );
            }}
          >
            <Field label="Name" htmlFor="cl-name"><Input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
            <Field label="Start from a template" htmlFor="cl-template" optional>
              <Select id="cl-template" value={templateKey} onChange={(e) => {
                setTemplateKey(e.target.value);
                const t = templates.data?.find((x) => x.key === e.target.value);
                if (t) setName(t.name);
              }}>
                <option value="">Blank checklist</option>
                {templates.data?.map((t) => <option key={t.key} value={t.key}>{t.name} ({t.items.length} items)</option>)}
              </Select>
            </Field>
            {templateKey && <p className="text-xs text-ink-muted">{templates.data?.find((t) => t.key === templateKey)?.description}</p>}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" loading={create.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!suggestions} onOpenChange={(o) => !o && setSuggestions(null)}>
        <DialogContent title="Suggested for this trip" description="Untick anything you don't need. Nothing is added until you confirm." wide>
          {suggestions && (
            <div className="space-y-4">
              <SourceLabel provenance={suggestions.provenance} />
              {suggestions.items.length === 0 ? (
                <p className="text-sm text-ink-muted">No suggestions beyond what you already have.</p>
              ) : (
                <ul className="grid gap-1 sm:grid-cols-2">
                  {suggestions.items.map((s, i) => (
                    <li key={i}>
                      <label className="flex items-start gap-2.5 rounded-md p-2 text-sm hover:bg-surface-muted">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 accent-[var(--sage)]"
                          checked={picked.has(i)}
                          onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(i); else n.delete(i); return n; })}
                        />
                        <span>
                          {s.label} <span className="text-xs text-ink-muted">· {titleCase(s.category)}</span>
                          <span className="block text-xs text-ink-muted">{s.reason}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {(lists.data?.length ?? 0) > 0 && (
                <Field label="Add to" htmlFor="target">
                  <Select id="target" value={target} onChange={(e) => setTarget(e.target.value)}>
                    {lists.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </Select>
                </Field>
              )}
              <DialogFooter>
                <Button variant="secondary" onClick={() => setSuggestions(null)}>Cancel</Button>
                <Button disabled={picked.size === 0} loading={adding} onClick={addSuggestions}>Add {picked.size} item{picked.size === 1 ? "" : "s"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
