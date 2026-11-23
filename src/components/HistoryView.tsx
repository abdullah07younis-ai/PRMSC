import {ArrowDownLeft, ArrowUpRight, Download, PackagePlus, Search} from 'lucide-react';
import {useMemo, useState} from 'react';
import type {HistoryAction, PortalState} from '../types';

interface HistoryViewProps {
  state: PortalState;
  onBackToInventory: () => void;
}

type ActionFilter = 'All' | HistoryAction;

export function HistoryView({state, onBackToInventory}: HistoryViewProps) {
  const [actionFilter, setActionFilter] = useState<ActionFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.history.filter((entry) => {
      if (actionFilter !== 'All' && entry.action !== actionFilter) {
        return false;
      }
      if (!q) return true;
      return (
        entry.employeeName.toLowerCase().includes(q) ||
        entry.designation.toLowerCase().includes(q) ||
        entry.itemName.toLowerCase().includes(q) ||
        (entry.note ?? '').toLowerCase().includes(q)
      );
    });
  }, [state.history, actionFilter, searchQuery]);

  const counts = useMemo(() => {
    let issued = 0;
    let returned = 0;
    let stockUpdated = 0;
    for (const h of state.history) {
      if (h.action === 'Issued') issued += 1;
      else if (h.action === 'Returned') returned += 1;
      else stockUpdated += 1;
    }
    return {all: state.history.length, issued, returned, stockUpdated};
  }, [state.history]);

  function exportCsv() {
    const headers = [
      'Log ID',
      'Timestamp',
      'Action',
      'Employee Name',
      'Designation',
      'Hardware Item',
      'Quantity',
      'Remaining Available',
      'Notes',
    ];
    const escapeCell = (val: string | number) => {
      const str = String(val ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };
    const rows = filteredHistory.map((h) =>
      [
        h.id,
        h.timestamp,
        h.action,
        h.employeeName,
        h.designation,
        h.itemName,
        h.quantity,
        h.remainingAvailable,
        h.note ?? '',
      ]
        .map(escapeCell)
        .join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prmsc-asset-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function renderActionLabel(action: HistoryAction) {
    if (action === 'Issued') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#145346]">
          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Issued</span>
        </span>
      );
    }
    if (action === 'Returned') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#15803D]">
          <ArrowDownLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Returned</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#52635E]">
        <PackagePlus className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Stock Updated</span>
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#111917]">
            Employee Issuance &amp; Return History
          </h2>
          <p className="mt-1 text-sm text-[#52635E]">
            Complete chronological record of PRMSC employees issued laptops or desktops, returned
            items, and stock updates.
          </p>
        </div>

        <button
          type="button"
          onClick={exportCsv}
          disabled={filteredHistory.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#DCE4E0] bg-white text-xs font-medium text-[#1F2D29] hover:bg-[#F8FAF9] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Download CSV</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#E9EFEC] rounded-lg self-start">
          {(
            [
              {id: 'All', label: `All (${counts.all})`},
              {id: 'Issued', label: `Issued (${counts.issued})`},
              {id: 'Returned', label: `Returned (${counts.returned})`},
              {id: 'Stock Updated', label: `Stock Updates (${counts.stockUpdated})`},
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActionFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                actionFilter === tab.id
                  ? 'bg-white text-[#111917] shadow-xs'
                  : 'text-[#52635E] hover:text-[#111917]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <Search
            className="w-4 h-4 text-[#64746F] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee, designation, or item..."
            aria-label="Search history records"
            className="w-full rounded-lg border border-[#D1DCD7] bg-white pl-10 pr-3.5 py-2 text-sm text-[#111917] placeholder:text-[#869690] focus:border-[#145346] focus:outline-none focus:ring-2 focus:ring-[#145346]/15"
          />
        </div>
      </div>

      {/* Ledger Table */}
      <section className="rounded-xl border border-[#DCE4E0] bg-white overflow-hidden">
        {filteredHistory.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#111917]">No matching history entries</p>
            <p className="mt-1 text-xs text-[#52635E]">
              {state.history.length === 0
                ? 'Once hardware quantities are fixed, issued to employees, or returned, every event will appear here.'
                : 'Try adjusting your filter or search terms.'}
            </p>
            {state.history.length === 0 && (
              <button
                type="button"
                onClick={onBackToInventory}
                className="mt-4 px-4 py-2 rounded-lg bg-[#145346] text-white text-xs font-medium hover:bg-[#0E3F35] transition-colors"
              >
                Go to Inventory &amp; Issue
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EDF2EF] bg-[#F9FBFA] text-xs font-medium text-[#52635E]">
                  <th className="py-3 px-6">Date &amp; Time</th>
                  <th className="py-3 px-4">Activity</th>
                  <th className="py-3 px-4">Employee / Source</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Hardware Item</th>
                  <th className="py-3 px-4 text-right">Qty</th>
                  <th className="py-3 px-6 text-right">Available After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2EF] text-sm">
                {filteredHistory.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#F8FAF9] transition-colors">
                    <td className="py-3 px-6 font-mono text-xs text-[#52635E] whitespace-nowrap tabular-nums">
                      {new Date(entry.timestamp).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderActionLabel(entry.action)}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#111917]">{entry.employeeName}</td>
                    <td className="py-3 px-4 text-[#52635E]">{entry.designation}</td>
                    <td className="py-3 px-4 text-[#111917]">{entry.itemName}</td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-[#111917] tabular-nums">
                      {entry.quantity}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-[#52635E] tabular-nums">
                      {entry.remainingAvailable}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
