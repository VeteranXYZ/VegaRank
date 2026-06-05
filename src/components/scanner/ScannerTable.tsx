"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo, type ReactNode } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  SignalSummaryBar,
  type SignalSummaryItem,
} from "./SignalSummaryBar";
import {
  mapActionBiasToChinese,
  mapSignalLabelToChinese,
  mapStructureToChinese,
} from "@/lib/scanner/scoring";
import type { TableSortKey, TableSortState } from "./ScannerPageClient";
import type { ScannerSignalState, ScanResult } from "@/lib/shared/scannerTypes";
import { formatDisplayDateTime } from "@/lib/utils/format";

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
        accessorKey: "primaryStructure",
        header: t.scanner.columns.setup,
        cell: ({ row }) => (
          <span className="truncate text-[11px] font-semibold text-[var(--foreground)]">
            {mapStructureToChinese(row.original.primaryStructure)}
          </span>
        ),
      },
      {
        accessorKey: "signalLabel",
        header: t.scanner.columns.signalCompact,
        cell: ({ row }) => <SignalCell result={row.original} />,
      },
      {
        accessorKey: "actionBias",
        header: "Action",
        cell: ({ row }) => (
          <span className={getActionTextClass(row.original.actionBias)}>
            {mapActionBiasToChinese(row.original.actionBias)}
          </span>
        ),
      },
      {
        accessorKey: "finalSignalScore",
        header: t.scanner.columns.score,
        cell: ({ row }) => (
          <span
            className={`font-semibold tabular-nums ${getFinalScoreTextClass(
              row.original.finalSignalScore,
            )}`}
          >
            {formatSigned(row.original.finalSignalScore, 1)}
          </span>
        ),
      },
      {
        id: "ocr",
        header: t.scanner.columns.ocr,
        cell: ({ row }) => <CompactScores result={row.original} />,
      },
      {
        accessorKey: "trendScore",
        header: "Trend",
        cell: ({ row }) => formatSigned(row.original.trendScore, 0),
      },
      {
        accessorKey: "momentumScore",
        header: "Momentum",
        cell: ({ row }) => formatSigned(row.original.momentumScore, 0),
      },
      {
        accessorKey: "volumeScore",
        header: "Volume",
        cell: ({ row }) => formatSigned(row.original.volumeScore, 0),
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
          row.original.detectedRiskTypes.length > 0 ||
          row.original.warnings.length > 0 ? (
            <span
              aria-label={`${
                row.original.detectedRiskTypes.length ||
                row.original.warnings.length
              } ${t.scanner.warnings}`}
              className="inline-flex border border-[var(--warning-border)] bg-[var(--warning-bg)] px-1 py-0.5 text-[10px] font-semibold text-[var(--warning)]"
            >
              W{row.original.detectedRiskTypes.length || row.original.warnings.length}
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
                } · ${formatDisplayDateTime(updatedAt, { mode: "time" })}`
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
        <div className="border-b border-[var(--border)] bg-[var(--warning-bg)] px-2.5 py-1 text-[11px] text-[var(--warning)]">
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
          <table className="w-full min-w-[940px] table-fixed border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[var(--table-header)] text-[10px] uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
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
                      isSelected ? "bg-[var(--positive-bg)]" : "hover:bg-[var(--row-hover)]"
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
              ? "border-[var(--positive-border)] bg-[var(--positive-bg)] text-[var(--positive)]"
              : "border-[var(--border)] bg-[var(--control)] text-[var(--muted)]"
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
    <span className="inline-flex items-center gap-1 font-mono text-[10px] tabular-nums">
      <span className="text-[var(--accent)]">
        O {formatSigned(result.opportunityScore, 0)}
      </span>
      <span className="text-[var(--info)]">
        C {formatSigned(result.confirmationScore, 0)}
      </span>
      <span className={getRiskTextClass(result.riskScore)}>
        R {formatSigned(result.riskScore, 0)}
      </span>
    </span>
  );
}

function SignalCell({ result }: { result: ScanResult }) {
  return (
    <span
      className={`inline-flex h-5 items-center border px-1.5 text-[11px] font-semibold leading-none ${getSignalTextClass(
        result.signalLabel,
      )}`}
    >
      {mapSignalLabelToChinese(result.signalLabel)}
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
    return <span className="text-[var(--info)]">{t.scanner.macdTableFlat}</span>;
  }

  return <span className="text-[var(--muted)]">{t.scanner.macdTableImproving}</span>;
}

function getRiskTextClass(riskScore: number) {
  if (riskScore > 100) {
    return "text-[var(--danger)]";
  }

  if (riskScore > 70) {
    return "text-[var(--warning)]";
  }

  return "text-[var(--muted)]";
}

function getFinalScoreTextClass(finalSignalScore: number) {
  if (finalSignalScore > 100) {
    return "text-[var(--accent)]";
  }

  if (finalSignalScore > 50) {
    return "text-[var(--positive)]";
  }

  if (finalSignalScore < 0) {
    return "text-[var(--danger)]";
  }

  return "text-[var(--foreground)]";
}

function getActionTextClass(actionBias: ScanResult["actionBias"]) {
  switch (actionBias) {
    case "eligible":
      return "font-semibold text-[var(--accent)]";
    case "watch_only":
      return "font-semibold text-[var(--info)]";
    case "do_not_chase":
      return "font-semibold text-[var(--warning)]";
    case "avoid":
      return "font-semibold text-[var(--danger)]";
    case "ignore":
      return "text-[var(--muted)]";
  }
}

function getSignalTextClass(signalLabel: ScanResult["signalLabel"]) {
  switch (signalLabel) {
    case "confirmed":
      return "border-[var(--eligible-border)] bg-[var(--eligible-bg)] text-[var(--eligible)]";
    case "watch":
    case "trend":
      return "border-[var(--watch-border)] bg-[var(--watch-bg)] text-[var(--watch)]";
    case "overheated":
      return "border-[var(--overheated-border)] bg-[var(--overheated-bg)] text-[var(--overheated)]";
    case "distribution_risk":
    case "breakdown_risk":
      return "border-[var(--risk-border)] bg-[var(--risk-bg)] text-[var(--risk)]";
    case "weak_bounce":
    case "weak":
      return "border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral)]";
    case "neutral":
      return "border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral)]";
  }
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

function formatSigned(value: number, decimals: number) {
  const formatted = value.toFixed(decimals);
  return value > 0 ? `+${formatted}` : formatted;
}

function getColumnClass(columnId: string) {
  switch (columnId) {
    case "rank":
      return "w-[26px]";
    case "symbol":
      return "w-[78px]";
    case "primaryStructure":
      return "w-[92px]";
    case "signalLabel":
      return "w-[72px]";
    case "actionBias":
      return "w-[78px]";
    case "finalSignalScore":
      return "w-[56px]";
    case "ocr":
      return "w-[122px]";
    case "trendScore":
    case "momentumScore":
    case "volumeScore":
      return "w-[58px]";
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
    case "primaryStructure":
      return "phase";
    case "signalLabel":
      return "signal";
    case "finalSignalScore":
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
