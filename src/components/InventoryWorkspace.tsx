import {
  AlertCircle,
  CheckCircle2,
  Laptop,
  Monitor,
  PackagePlus,
  RotateCcw,
  UserCheck,
  X,
} from 'lucide-react';
import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {
  adjustItemStock,
  fixTotalQuantities,
  issueHardware,
  returnHardware,
} from '../api';
import type {InventoryItem, IssuanceRecord, PortalState} from '../types';

interface InventoryWorkspaceProps {
  token: string;
  state: PortalState;
  onStateChange: (next: PortalState) => void;
  onOpenHistory: () => void;
}

export function InventoryWorkspace({
  token,
  state,
  onStateChange,
  onOpenHistory,
}: InventoryWorkspaceProps) {
  const [draftTotals, setDraftTotals] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const item of state.items) {
      initial[item.id] = String(item.totalQuantity);
    }
    return initial;
  });

  useEffect(() => {
    const updated: Record<string, string> = {};
    for (const item of state.items) {
      updated[item.id] = String(item.totalQuantity);
    }
    setDraftTotals(updated);
  }, [state.items]);

  // Issue form state
  const [selectedItemId, setSelectedItemId] = useState<string>(state.items[0]?.id ?? 'laptop-i3');
  const [employeeName, setEmployeeName] = useState('');
  const [designation, setDesignation] = useState('');
  const [issueQty, setIssueQty] = useState('1');
  const [isPrmscEmployee, setIsPrmscEmployee] = useState(true);

  // Stock adjustment modal state
  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null);
  const [adjustMode, setAdjustMode] = useState<'add' | 'set'>('add');
  const [adjustAmount, setAdjustAmount] = useState('1');

  // Return modal state
  const [returnTarget, setReturnTarget] = useState<IssuanceRecord | null>(null);
  const [returnQty, setReturnQty] = useState('1');

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'success' | 'error'; message: string} | null>(
    null,
  );

  const laptops = useMemo(
    () => state.items.filter((item) => item.category === 'laptop'),
    [state.items],
  );
  const desktops = useMemo(
    () => state.items.filter((item) => item.category === 'desktop'),
    [state.items],
  );
  const activeIssuances = useMemo(
    () => state.issuances.filter((record) => record.quantity - record.returnedQuantity > 0),
    [state.issuances],
  );

  const selectedItem = useMemo(
    () => state.items.find((it) => it.id === selectedItemId) ?? state.items[0],
    [state.items, selectedItemId],
  );

  async function handleFixTotals(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const parsed: Record<string, number> = {};
    for (const item of state.items) {
      const num = Number(draftTotals[item.id]);
      if (!Number.isInteger(num) || num < 0) {
        setFeedback({
          type: 'error',
          message: `Please enter a valid whole number (0 or more) for ${item.name}.`,
        });
        return;
      }
      parsed[item.id] = num;
    }

    setBusy(true);
    try {
      const next = await fixTotalQuantities(token, parsed);
      onStateChange(next);
      setFeedback({
        type: 'success',
        message: 'Total hardware quantities fixed and saved. You may now issue items to PRMSC employees.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to fix total quantities.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleIssueSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!state.quantitiesFixed) {
      setFeedback({
        type: 'error',
        message: 'Please fix the total quantities for all items before issuing.',
      });
      return;
    }

    const qty = Number(issueQty);
    if (!employeeName.trim() || !designation.trim()) {
      setFeedback({
        type: 'error',
        message: 'Both Employee Name and Designation blanks must be filled before issuing.',
      });
      return;
    }
    if (!isPrmscEmployee) {
      setFeedback({
        type: 'error',
        message: 'Hardware can only be issued to confirmed PRMSC company employees.',
      });
      return;
    }
    if (!Number.isInteger(qty) || qty < 1) {
      setFeedback({
        type: 'error',
        message: 'Issue quantity must be at least 1.',
      });
      return;
    }

    setBusy(true);
    try {
      const next = await issueHardware(token, {
        itemId: selectedItemId,
        employeeName: employeeName.trim(),
        designation: designation.trim(),
        quantity: qty,
        isPrmscEmployee,
      });
      onStateChange(next);
      setEmployeeName('');
      setDesignation('');
      setIssueQty('1');
      setFeedback({
        type: 'success',
        message: `Issued ${qty} × ${selectedItem?.name ?? 'item'} to ${employeeName.trim()} (${designation.trim()}). Stock updated.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to complete issuance.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleAdjustSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adjustTarget) return;
    setFeedback(null);

    const amt = Number(adjustAmount);
    if (!Number.isInteger(amt) || amt < 0) {
      setFeedback({type: 'error', message: 'Please enter a valid whole number.'});
      return;
    }

    setBusy(true);
    try {
      const next = await adjustItemStock(token, adjustTarget.id, adjustMode, amt);
      onStateChange(next);
      setFeedback({
        type: 'success',
        message: `Updated stock for ${adjustTarget.name} and saved to registry.`,
      });
      setAdjustTarget(null);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to update item stock.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleReturnSubmit(e: FormEvent) {
    e.preventDefault();
    if (!returnTarget) return;
    setFeedback(null);

    const qty = Number(returnQty);
    if (!Number.isInteger(qty) || qty < 1) {
      setFeedback({type: 'error', message: 'Return quantity must be at least 1.'});
      return;
    }

    setBusy(true);
    try {
      const next = await returnHardware(token, returnTarget.id, qty);
      onStateChange(next);
      setFeedback({
        type: 'success',
        message: `Returned ${qty} × ${returnTarget.itemName} from ${returnTarget.employeeName}. Added back to available stock.`,
      });
      setReturnTarget(null);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to process return.',
      });
    } finally {
      setBusy(false);
    }
  }

  function openIssueFor(item: InventoryItem) {
    setSelectedItemId(item.id);
    setIssueQty('1');
    const el = document.getElementById('issue-employee-name');
    if (el) {
      el.focus();
      el.scrollIntoView({behavior: 'smooth', block: 'center'});
    }
  }

  function renderHardwareCard(item: InventoryItem) {
    const available = item.totalQuantity - item.issuedQuantity;
    const isOut = available <= 0;
    const isLow = available > 0 && available <= 2 && item.totalQuantity > 2;

    const statusLabel = !state.quantitiesFixed
      ? 'Awaiting Fixed Stock'
      : isOut
        ? 'Out of Stock'
        : isLow
          ? 'Low Stock'
          : 'Available';

    const statusColorClass = !state.quantitiesFixed
      ? 'text-[#52635E]'
      : isOut
        ? 'text-[#B91C1C]'
        : isLow
          ? 'text-[#B45309]'
          : 'text-[#15803D]';

    return (
      <div
        key={item.id}
        className="rounded-xl border border-[#DCE4E0] bg-white p-5 flex flex-col justify-between gap-4"
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-base font-semibold text-[#111917]">{item.name}</h4>
              <p className="mt-1 text-xs text-[#52635E]">{item.spec}</p>
            </div>
            <span className={`text-xs font-medium whitespace-nowrap ${statusColorClass}`}>
              {statusLabel}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-[#EDF2EF] pt-4">
            <div>
              <p className="text-xs text-[#64746F]">Total Fixed</p>
              <p className="mt-0.5 font-mono text-lg font-semibold text-[#111917] tabular-nums">
                {item.totalQuantity}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#64746F]">Issued</p>
              <p className="mt-0.5 font-mono text-lg font-semibold text-[#52635E] tabular-nums">
                {item.issuedQuantity}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#64746F]">Available</p>
              <p
                className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${
                  available > 0 ? 'text-[#145346]' : 'text-[#B91C1C]'
                }`}
              >
                {available}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#EDF2EF]">
          <button
            type="button"
            disabled={!state.quantitiesFixed || available <= 0}
            onClick={() => openIssueFor(item)}
            className="px-3.5 py-2 rounded-lg bg-[#145346] text-white text-xs font-medium hover:bg-[#0E3F35] disabled:bg-[#E2E8E5] disabled:text-[#7D8C87] disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
          >
            Issue Item
          </button>
          <button
            type="button"
            onClick={() => {
              setAdjustTarget(item);
              setAdjustMode('add');
              setAdjustAmount('1');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#DCE4E0] bg-[#F8FAF9] text-xs font-medium text-[#1F2D29] hover:bg-[#EDF2EF] transition-colors whitespace-nowrap shrink-0"
          >
            <PackagePlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add / Update</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Feedback banner */}
      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-sm ${
            feedback.type === 'error'
              ? 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]'
              : 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss notification"
            className="p-1 rounded hover:bg-black/5 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Initial Total Quantities Setup Section */}
      {!state.quantitiesFixed && (
        <section className="rounded-xl border border-[#C7D7D0] bg-white p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-[#EDF2EF]">
            <div>
              <h2 className="text-lg font-semibold text-[#111917]">
                Step 1: Set &amp; Fix Total Quantities
              </h2>
              <p className="mt-1 text-sm text-[#52635E]">
                Enter the total quantity for each of the 3 laptop models and 3 desktop models.
                Once fixed, issuing to PRMSC employees will be unlocked.
              </p>
            </div>
          </div>

          <form onSubmit={handleFixTotals} className="mt-5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {state.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-[#DCE4E0] bg-[#F9FBFA] p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <label
                      htmlFor={`fix-${item.id}`}
                      className="block text-sm font-medium text-[#111917] truncate"
                    >
                      {item.name}
                    </label>
                    <p className="text-xs text-[#64746F] mt-0.5">
                      {item.category === 'laptop' ? 'Laptop' : 'Desktop'} · {item.processor}
                    </p>
                  </div>
                  <input
                    id={`fix-${item.id}`}
                    type="number"
                    min={item.issuedQuantity}
                    step={1}
                    required
                    value={draftTotals[item.id] ?? '0'}
                    onChange={(e) =>
                      setDraftTotals((prev) => ({...prev, [item.id]: e.target.value}))
                    }
                    className="w-24 rounded-lg border border-[#CBD8D2] bg-white px-3 py-2 text-right font-mono text-sm font-medium text-[#111917] tabular-nums focus:border-[#145346] focus:outline-none focus:ring-2 focus:ring-[#145346]/15"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2.5 rounded-lg bg-[#145346] text-white text-sm font-medium hover:bg-[#0E3F35] disabled:opacity-60 transition-colors"
              >
                {busy ? 'Saving...' : 'Fix Total Quantities'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Main Split: Inventory Grid (Left 7 cols) + Issue Form (Right 5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        <div className="xl:col-span-8 space-y-8">
          {/* Laptops Section */}
          <section>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <Laptop className="w-5 h-5 text-[#145346]" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-[#111917]">
                  Laptops (Core i3, Core i5, Core i7)
                </h2>
              </div>
              <span className="text-xs text-[#52635E] font-mono tabular-nums">
                {laptops.reduce((s, i) => s + (i.totalQuantity - i.issuedQuantity), 0)} available
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {laptops.map(renderHardwareCard)}
            </div>
          </section>

          {/* Desktops Section */}
          <section>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <Monitor className="w-5 h-5 text-[#145346]" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-[#111917]">
                  Desktops (Three Configurations)
                </h2>
              </div>
              <span className="text-xs text-[#52635E] font-mono tabular-nums">
                {desktops.reduce((s, i) => s + (i.totalQuantity - i.issuedQuantity), 0)} available
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {desktops.map(renderHardwareCard)}
            </div>
          </section>
        </div>

        {/* Right Column: Issue to PRMSC Employee Form */}
        <aside className="xl:col-span-4 rounded-xl border border-[#DCE4E0] bg-white p-6">
          <div className="pb-4 border-b border-[#EDF2EF]">
            <div className="flex items-center gap-2 text-[#145346] mb-1">
              <UserCheck className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs font-medium">Company Employees Only</span>
            </div>
            <h2 className="text-lg font-semibold text-[#111917]">Issue Hardware to Employee</h2>
            <p className="mt-1 text-xs text-[#52635E] leading-relaxed">
              Issuing deducts from total available stock. Both Employee Name and Designation are
              mandatory.
            </p>
          </div>

          <form onSubmit={handleIssueSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="issue-hardware-select"
                className="block text-sm font-medium text-[#1F2D29] mb-1.5"
              >
                Hardware Type
              </label>
              <select
                id="issue-hardware-select"
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                disabled={!state.quantitiesFixed}
                className="w-full rounded-lg border border-[#D1DCD7] bg-[#FBFDFC] px-3 py-2.5 text-sm text-[#111917] focus:border-[#145346] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145346]/15 disabled:opacity-60"
              >
                {state.items.map((item) => {
                  const avail = item.totalQuantity - item.issuedQuantity;
                  return (
                    <option key={item.id} value={item.id}>
                      {item.name} ({avail} available)
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label
                htmlFor="issue-employee-name"
                className="block text-sm font-medium text-[#1F2D29] mb-1.5"
              >
                Employee Name
              </label>
              <input
                id="issue-employee-name"
                type="text"
                required
                disabled={!state.quantitiesFixed}
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="Enter full name of PRMSC employee"
                className="w-full rounded-lg border border-[#D1DCD7] bg-[#FBFDFC] px-3.5 py-2.5 text-sm text-[#111917] placeholder:text-[#869690] focus:border-[#145346] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145346]/15 disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="issue-employee-designation"
                className="block text-sm font-medium text-[#1F2D29] mb-1.5"
              >
                Designation
              </label>
              <input
                id="issue-employee-designation"
                type="text"
                required
                disabled={!state.quantitiesFixed}
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Municipal Officer, IT Coordinator"
                className="w-full rounded-lg border border-[#D1DCD7] bg-[#FBFDFC] px-3.5 py-2.5 text-sm text-[#111917] placeholder:text-[#869690] focus:border-[#145346] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145346]/15 disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="issue-quantity"
                className="block text-sm font-medium text-[#1F2D29] mb-1.5"
              >
                Quantity
              </label>
              <input
                id="issue-quantity"
                type="number"
                min={1}
                max={
                  selectedItem
                    ? Math.max(1, selectedItem.totalQuantity - selectedItem.issuedQuantity)
                    : 1
                }
                step={1}
                required
                disabled={!state.quantitiesFixed}
                value={issueQty}
                onChange={(e) => setIssueQty(e.target.value)}
                className="w-full rounded-lg border border-[#D1DCD7] bg-[#FBFDFC] px-3.5 py-2.5 font-mono text-sm text-[#111917] tabular-nums focus:border-[#145346] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145346]/15 disabled:opacity-60"
              />
            </div>

            <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPrmscEmployee}
                onChange={(e) => setIsPrmscEmployee(e.target.checked)}
                disabled={!state.quantitiesFixed}
                className="mt-0.5 h-4 w-4 rounded border-[#CBD8D2] text-[#145346] focus:ring-[#145346]"
              />
              <span className="text-xs text-[#52635E] leading-relaxed">
                Confirm recipient is an active employee of Punjab Rural Municipal Services Company
                (PRMSC).
              </span>
            </label>

            <button
              type="submit"
              disabled={
                busy ||
                !state.quantitiesFixed ||
                !selectedItem ||
                selectedItem.totalQuantity - selectedItem.issuedQuantity <= 0
              }
              className="w-full py-2.5 px-4 rounded-lg bg-[#145346] text-white text-sm font-medium hover:bg-[#0E3F35] disabled:bg-[#E2E8E5] disabled:text-[#7D8C87] disabled:cursor-not-allowed transition-colors"
            >
              {!state.quantitiesFixed
                ? 'Fix Total Quantities First'
                : busy
                  ? 'Issuing...'
                  : 'Submit Issuance'}
            </button>
          </form>
        </aside>
      </div>

      {/* Currently Issued Hardware & Return Desk */}
      <section className="rounded-xl border border-[#DCE4E0] bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EDF2EF] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#111917]">
              Currently Issued Items &amp; Return Desk
            </h2>
            <p className="text-xs text-[#52635E] mt-0.5">
              Return any issued laptop or desktop to add units back to available inventory.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenHistory}
            className="text-xs font-medium text-[#145346] hover:underline whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            View Full Issuance &amp; Return History &rarr;
          </button>
        </div>

        {activeIssuances.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium text-[#111917]">No hardware currently issued out</p>
            <p className="mt-1 text-xs text-[#52635E]">
              {state.quantitiesFixed
                ? 'Use the Issue Hardware form to assign a laptop or desktop to a PRMSC employee.'
                : 'Fix your total hardware quantities above to start issuing items.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EDF2EF] bg-[#F9FBFA] text-xs font-medium text-[#52635E]">
                  <th className="py-3 px-6">Record ID</th>
                  <th className="py-3 px-4">Employee Name</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Hardware Item</th>
                  <th className="py-3 px-4 text-right">Qty Held</th>
                  <th className="py-3 px-4">Issued Date</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2EF] text-sm">
                {activeIssuances.map((record) => {
                  const held = record.quantity - record.returnedQuantity;
                  return (
                    <tr key={record.id} className="hover:bg-[#F8FAF9] transition-colors">
                      <td className="py-3 px-6 font-mono text-xs text-[#52635E] whitespace-nowrap">
                        {record.id}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#111917]">{record.employeeName}</td>
                      <td className="py-3 px-4 text-[#52635E]">{record.designation}</td>
                      <td className="py-3 px-4 text-[#111917]">{record.itemName}</td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-[#111917] tabular-nums">
                        {held}
                        {record.returnedQuantity > 0 && (
                          <span className="ml-1 text-xs text-[#64746F]">
                            /{record.quantity}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#52635E] whitespace-nowrap tabular-nums">
                        {new Date(record.issuedAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-6 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setReturnTarget(record);
                            setReturnQty(String(held));
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DCE4E0] bg-white text-xs font-medium text-[#145346] hover:bg-[#F0F7F4] transition-colors whitespace-nowrap"
                        >
                          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Return Item</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal: Add / Update Stock */}
      {adjustTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="adjust-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-[#DCE4E0] bg-white p-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#EDF2EF]">
              <div>
                <h3 id="adjust-modal-title" className="text-lg font-semibold text-[#111917]">
                  Update Stock — {adjustTarget.name}
                </h3>
                <p className="mt-1 text-xs text-[#52635E]">
                  Current Total: <span className="font-mono">{adjustTarget.totalQuantity}</span> ·
                  Issued: <span className="font-mono">{adjustTarget.issuedQuantity}</span> ·
                  Available:{' '}
                  <span className="font-mono">
                    {adjustTarget.totalQuantity - adjustTarget.issuedQuantity}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                aria-label="Close dialog"
                className="p-1.5 text-[#52635E] hover:text-[#111917] rounded-md"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="mt-5 space-y-4">
              <div className="flex items-center gap-1 p-1 bg-[#F1F5F3] rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustMode('add');
                    setAdjustAmount('1');
                  }}
                  className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                    adjustMode === 'add'
                      ? 'bg-white text-[#111917] shadow-xs'
                      : 'text-[#52635E] hover:text-[#111917]'
                  }`}
                >
                  Add New Units
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdjustMode('set');
                    setAdjustAmount(String(adjustTarget.totalQuantity));
                  }}
                  className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                    adjustMode === 'set'
                      ? 'bg-white text-[#111917] shadow-xs'
                      : 'text-[#52635E] hover:text-[#111917]'
                  }`}
                >
                  Set Total Stock
                </button>
              </div>

              <div>
                <label
                  htmlFor="adjust-amount-input"
                  className="block text-sm font-medium text-[#1F2D29] mb-1.5"
                >
                  {adjustMode === 'add' ? 'Units to Add' : 'New Total Quantity'}
                </label>
                <input
                  id="adjust-amount-input"
                  type="number"
                  min={adjustMode === 'add' ? 1 : adjustTarget.issuedQuantity}
                  step={1}
                  required
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full rounded-lg border border-[#D1DCD7] bg-[#FBFDFC] px-3.5 py-2.5 font-mono text-sm text-[#111917] tabular-nums focus:border-[#145346] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145346]/15"
                />
                {adjustMode === 'set' && adjustTarget.issuedQuantity > 0 && (
                  <p className="mt-1.5 text-xs text-[#64746F]">
                    Minimum allowed is {adjustTarget.issuedQuantity} (currently issued units).
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="px-4 py-2 rounded-lg border border-[#DCE4E0] text-sm font-medium text-[#1F2D29] hover:bg-[#F6F8F7] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-[#145346] text-sm font-medium text-white hover:bg-[#0E3F35] disabled:opacity-60 transition-colors"
                >
                  {busy ? 'Submitting...' : 'Submit Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Return Item */}
      {returnTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="return-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-[#DCE4E0] bg-white p-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#EDF2EF]">
              <div>
                <h3 id="return-modal-title" className="text-lg font-semibold text-[#111917]">
                  Return Hardware to Inventory
                </h3>
                <p className="mt-1 text-xs text-[#52635E]">
                  {returnTarget.employeeName} · {returnTarget.designation}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReturnTarget(null)}
                aria-label="Close dialog"
                className="p-1.5 text-[#52635E] hover:text-[#111917] rounded-md"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="mt-5 space-y-4">
              <div className="rounded-lg border border-[#EDF2EF] bg-[#F8FAF9] p-3.5 text-sm">
                <p className="font-medium text-[#111917]">{returnTarget.itemName}</p>
                <p className="text-xs text-[#52635E] mt-0.5 font-mono tabular-nums">
                  Currently held: {returnTarget.quantity - returnTarget.returnedQuantity} unit(s)
                </p>
              </div>

              <div>
                <label
                  htmlFor="return-qty-input"
                  className="block text-sm font-medium text-[#1F2D29] mb-1.5"
                >
                  Quantity Returning
                </label>
                <input
                  id="return-qty-input"
                  type="number"
                  min={1}
                  max={returnTarget.quantity - returnTarget.returnedQuantity}
                  step={1}
                  required
                  value={returnQty}
                  onChange={(e) => setReturnQty(e.target.value)}
                  className="w-full rounded-lg border border-[#D1DCD7] bg-[#FBFDFC] px-3.5 py-2.5 font-mono text-sm text-[#111917] tabular-nums focus:border-[#145346] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145346]/15"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReturnTarget(null)}
                  className="px-4 py-2 rounded-lg border border-[#DCE4E0] text-sm font-medium text-[#1F2D29] hover:bg-[#F6F8F7] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-[#145346] text-sm font-medium text-white hover:bg-[#0E3F35] disabled:opacity-60 transition-colors"
                >
                  {busy ? 'Processing...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
