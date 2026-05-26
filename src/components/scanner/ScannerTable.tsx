"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo, type ReactNode } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PhaseBadge } from "./PhaseBadge";
import { SignalBadge } from "./SignalBadge";
import {
  SignalSummaryBar,
  type SignalSummaryItem,
} from "./SignalSummaryBar";
import type { TableSortKey, TableSortState } from "./ScannerPageClient";
import type { ScannerSignalState, ScanResult } from "@/lib/shared/scannerTypes";

type ScannerTableProps = {
  rows: ScanResult[];
  signalSummary: SignalSummaryItem[];
  activeSignal: ScannerSignalState | "ALL";
  selectedSymbol: string | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage: string;
  cached: boolean;
  updatedAt: string | null;
  sourceItemCount: number;
  partialErrors: { symbol: string; message: string }[];
  tableSort: TableSortState | null;
  onRefresh: () => void;
  onSignalSelect: (signal: ScannerSignalState | "ALL") => void;
  onSelect: (symbol: string) => void;
  onSortChange: (key: TableSortKey) => void;
};

export function ScannerTable({
  rows,
  signalSummary,
  activeSignal,
  selectedSymbol,
  isLoading,
  isFetching,
  isError,
  errorMessage,
  cached,
  updatedAt,
  sourceItemCount,
  partialErrors,
  tableSort,
  onRefresh,
  onSignalSelect,
  onSelect,
  onSortChange,
}: ScannerTableProps) {
  const { dictionary: t } = useLanguage();
  const columns = useMemo<ColumnDef<ScanResult>[]>(
    () => [
      {
        id: "rank",
        header: t.scanner.columns.rank,
        cell: ({ row }) => (
          <span className="tabular-nums text-[var(--muted)]">{row.index + 1}</span>
        ),
      },
      {
        accessorKey: "symbol",
        header: t.scanner.columns.symbol,
        cell: ({ row }) => (
          <div className="font-semibold leading-tight text-[var(--foreground)]">
            {row.original.symbol}
          </div>
        ),
      },
      {
        accessorKey: "phase",
        header: t.scanner.columns.setup,
        cell: ({ row }) => <PhaseBadge phase={row.original.phase} />,
      },
      {
        accessorKey: "signal.state",
        header: t.scanner.columns.signalCompact,
        cell: ({ row }) => <SignalBadge signal={row.original.signal} />,
      },
      {
        accessorKey: "rankScore",
        header: t.scanner.columns.score,
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-[var(--foreground)]">
            {formatNumber(row.original.rankScore, 1)}
          </span>
        ),
      },
      {
        id: "ocr",
        header: t.scanner.columns.ocr,
        cell: ({ row }) => <CompactScores result={row.original} />,
      },
      {
        accessorKey: "rsi14",
        header: t.scanner.columns.rsi,
        cell: ({ row }) => formatNullable(row.original.rsi14, 1),
      },
      {
        accessorKey: "bbWidthPercentile",
        header: t.scanner.columns.bbCompact,
        cell: ({ row }) => formatNullable(row.original.bbWidthPercentile, 0),
      },
      {
        accessorKey: "volumeRatio",
        header: t.scanner.columns.volCompact,
        cell: ({ row }) => formatNullable(row.original.volume.ratio20, 2),
      },
      {
        id: "macd",
        header: "MACD",
        cell: ({ row }) => <MacdCell result={row.original} />,
      },
      {
        id: "maStatus",
        header: t.scanner.columns.maStatus,
        cell: ({ row }) => <MaStatus result={row.original} />,
      },
      {
        id: "warnings",
        header: t.scanner.columns.warnCompact,
        cell: ({ row }) =>
          row.original.warnings.length > 0 ? (
            <span
              aria-label={`${row.original.warnings.length} ${t.scanner.warnings}`}
              className="inline-flex border border-[#8f6b24]/40 bg-[#1b1710] px-1 py-0.5 text-[10px] font-semibold text-[var(--warning)]"
            >
              W{row.original.warnings.length}
            </span>
          ) : (
            <span className="text-[var(--muted)]">-</span>
          ),
      },
    ],
    [t],
  );
  // TanStack Table intentionally returns callable table helpers from this hook.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <section className="min-w-0 overflow-hidden border border-[var(--border)] bg-[var(--panel)] xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-2.5 py-1.5">
        <div>
          <h2 className="text-sm font-semibold leading-none">{t.scanner.results}</h2>
          <p className="mt-1 text-[10px] text-[var(--muted)]">
            {updatedAt
              ? `${sourceItemCount} ${t.scanner.scanned} · ${
                  cached ? t.common.cached : t.common.fresh
                } · ${new Date(
                  updatedAt,
                ).toLocaleTimeString()}`
              : t.scanner.waiting}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching}
          className="h-6 border border-[var(--border)] px-2 text-[11px] font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isFetching ? t.common.refreshing : t.common.refresh}
        </button>
      </div>

      <SignalSummaryBar
        items={signalSummary}
        activeSignal={activeSignal}
        onSelect={onSignalSelect}
      />

      {partialErrors.length > 0 && (
        <div className="border-b border-[var(--border)] bg-[#1b1710] px-2.5 py-1 text-[11px] text-[var(--warning)]">
          {partialErrors.length} {t.scanner.partialErrors}
        </div>
      )}

      {isError ? (
        <StateMessage title={t.scanner.errorTitle} message={errorMessage} />
      ) : isLoading ? (
        <StateMessage
          title={t.scanner.loadingTitle}
          message={t.scanner.loadingMessage}
        />
      ) : rows.length === 0 ? (
        <StateMessage
          title={t.scanner.noMatchesTitle}
          message={t.scanner.noMatchesMessage}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[690px] table-fixed border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[#090f15] text-[10px] uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      aria-sort={getAriaSort(header.id, tableSort)}
                      className={`whitespace-nowrap px-1.5 py-1 font-semibold ${getColumnClass(
                        header.id,
                      )}`}
                    >
                      <SortableHeader
                        columnId={header.id}
                        tableSort={tableSort}
                        onSortChange={onSortChange}
                        title={
                          header.id === "ocr"
                            ? t.scanner.sortOpportunityHelp
                            : undefined
                        }
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </SortableHeader>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const isSelected = row.original.symbol === selectedSymbol;

                return (
                  <tr
                    key={row.original.symbol}
                    tabIndex={0}
                    role="button"
                    onClick={() => onSelect(row.original.symbol)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(row.original.symbol);
                      }
                    }}
                    className={`cursor-pointer border-t border-[var(--border)] transition ${
                      isSelected ? "bg-[#0d1b15]" : "hover:bg-[#101923]/75"
                    }`}
                  >
                    {row.getVisibleCells().map((cell, cellIndex) => (
                      <td
                        key={cell.id}
                        className={`h-[34px] overflow-hidden whitespace-nowrap border-l-2 px-1.5 py-0.5 align-middle ${
                          cellIndex === 0 && isSelected
                            ? "border-l-[var(--accent)]"
                            : cellIndex === 0
                              ? "border-l-transparent"
                              : "border-l-transparent"
                        } ${getColumnClass(
                          cell.column.id,
                        )}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MaStatus({ result }: { result: ScanResult }) {
  const items = [
    ["20", result.maStatus.aboveMA20],
    ["50", result.maStatus.aboveMA50],
    ["200", result.maStatus.aboveMA200],
  ] as const;

  return (
    <div className="flex gap-0.5">
      {items.map(([label, active]) => (
        <span
          key={label}
          className={`inline-flex h-4 min-w-5 items-center justify-center border px-0.5 text-[10px] font-semibold ${
            active
              ? "border-[#2f7d46] bg-[#132119] text-[var(--accent)]"
              : "border-[var(--border)] bg-[#0b0f14] text-[var(--muted)]"
          }`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function CompactScores({ result }: { result: ScanResult }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums">
      <span className="text-[var(--accent)]">O{result.opportunityScore.toFixed(0)}</span>
      <span className="text-[#60a5fa]">
        C{result.confirmationScore.toFixed(0)}
      </span>
      <span className={getRiskTextClass(result.riskScore)}>
        R{result.riskScore.toFixed(0)}
      </span>
    </span>
  );
}

function MacdCell({ result }: { result: ScanResult }) {
  const { dictionary: t } = useLanguage();

  if (!result.macd) {
    return <span className="text-[var(--muted)]">-</span>;
  }

  if (result.macd.bearishCross) {
    return <span className="text-[var(--warning)]">{t.scanner.macdTableWeak}</span>;
  }

  if (!result.macd.histogramRising) {
    return <span className="text-[var(--warning)]">{t.scanner.macdTableFade}</span>;
  }

  if (result.macd.bullishCross) {
    return <span className="text-[var(--accent)]">{t.scanner.macdTableCross}</span>;
  }

  if (result.macd.aboveZero) {
    return <span className="text-[#60a5fa]">{t.scanner.macdTableFlat}</span>;
  }

  return <span className="text-[var(--muted)]">{t.scanner.macdTableImproving}</span>;
}

function getRiskTextClass(riskScore: number) {
  if (riskScore >= 55) {
    return "text-[var(--danger)]";
  }

  if (riskScore >= 30) {
    return "text-[var(--warning)]";
  }

  return "text-[var(--accent)]";
}

function StateMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-6 py-10 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
        {message}
      </p>
    </div>
  );
}

function formatNullable(value: number | null, decimals: number) {
  return value === null ? "n/a" : formatNumber(value, decimals);
}

function formatNumber(value: number, decimals: number) {
  return value.toFixed(decimals);
}

function getColumnClass(columnId: string) {
  switch (columnId) {
    case "rank":
      return "w-[26px]";
    case "symbol":
      return "w-[78px]";
    case "phase":
      return "w-[102px]";
    case "signal_state":
      return "w-[72px]";
    case "rankScore":
      return "w-12";
    case "ocr":
      return "w-[84px]";
    case "rsi14":
    case "bbWidthPercentile":
      return "w-[38px]";
    case "volumeRatio":
      return "w-[42px]";
    case "macd":
      return "w-12";
    case "maStatus":
      return "w-16";
    case "warnings":
      return "w-[26px]";
    default:
      return "";
  }
}

function SortableHeader({
  columnId,
  tableSort,
  title,
  onSortChange,
  children,
}: {
  columnId: string;
  tableSort: TableSortState | null;
  title?: string;
  onSortChange: (key: TableSortKey) => void;
  children: ReactNode;
}) {
  const sortKey = getSortKeyForColumn(columnId);
  const isActive = sortKey !== null && tableSort?.key === sortKey;

  if (!sortKey) {
    return <span>{children}</span>;
  }

  return (
    <button
      type="button"
      title={title}
      onClick={() => onSortChange(sortKey)}
      className={`inline-flex w-full items-center gap-1 text-left uppercase transition hover:text-[var(--foreground)] focus-visible:outline-offset-1 ${
        isActive ? "text-[var(--foreground)]" : ""
      }`}
    >
      <span>{children}</span>
      <span className="w-2 text-[9px] text-[var(--info)]">
        {isActive ? (tableSort.direction === "desc" ? "↓" : "↑") : ""}
      </span>
    </button>
  );
}

function getSortKeyForColumn(columnId: string): TableSortKey | null {
  switch (columnId) {
    case "rank":
      return "rank";
    case "symbol":
      return "symbol";
    case "phase":
      return "phase";
    case "signal_state":
      return "signal";
    case "rankScore":
      return "score";
    case "ocr":
      return "ocr";
    case "rsi14":
      return "rsi";
    case "bbWidthPercentile":
      return "bb";
    case "volumeRatio":
      return "vol";
    case "macd":
      return "macd";
    case "maStatus":
      return "ma";
    case "warnings":
      return "warnings";
    default:
      return null;
  }
}

function getAriaSort(columnId: string, tableSort: TableSortState | null) {
  const sortKey = getSortKeyForColumn(columnId);

  if (!sortKey || tableSort?.key !== sortKey) {
    return "none";
  }

  return tableSort.direction === "desc" ? "descending" : "ascending";
}
