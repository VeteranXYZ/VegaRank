"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo, type ReactNode } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import { explainCode } from "@/lib/vegarank-codebook/explainCode";
import { RefreshIconButton } from "@/components/ui/workspace";
import {
  SignalSummaryBar,
  type SignalSummaryItem,
} from "./SignalSummaryBar";
import type { TableSortKey, TableSortState } from "./RankingsPageClient";
import type { ScannerCodeContractResult } from "@/lib/vegarank-codebook/serializeScanResult";
import type { ScannerSignalState } from "@/lib/shared/rankingTypes";
import { formatDisplayDateTime } from "@/lib/utils/format";

type RankingsTableProps = {
  rows: ScannerCodeContractResult[];
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

export function RankingsTable({
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
}: RankingsTableProps) {
  const { dictionary: t } = useLanguage();
  const { language } = useAppLanguage();
  const columns = useMemo<ColumnDef<ScannerCodeContractResult>[]>(
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
        accessorKey: "setupCode",
        header: t.scanner.columns.setup,
        cell: ({ row }) => (
          <span className="truncate text-[11px] font-semibold text-[var(--foreground)]">
            {explainCode(row.original.setupCode, language).label}
          </span>
        ),
      },
      {
        accessorKey: "signalCodes",
        header: t.scanner.columns.signalCompact,
        cell: ({ row }) => <SignalCell result={row.original} />,
      },
      {
        accessorKey: "actionCode",
        header: "Research Priority",
        cell: ({ row }) => (
          <span className="font-semibold text-[var(--info)]">
            {explainCode(row.original.actionCode, language).label}
          </span>
        ),
      },
      {
        accessorKey: "metrics.finalSignalScore",
        header: "Risk-Adjusted Score",
        cell: ({ row }) => (
          <span
            className={`font-semibold tabular-nums ${getFinalScoreTextClass(
              row.original.metrics.finalSignalScore,
            )}`}
          >
            {formatSigned(row.original.metrics.finalSignalScore, 1)}
          </span>
        ),
      },
      {
        id: "ocr",
        header: t.scanner.columns.ocr,
        cell: ({ row }) => <CompactScores result={row.original} />,
      },
      {
        accessorKey: "metrics.trendScore",
        header: "Trend",
        cell: ({ row }) => formatSigned(row.original.metrics.trendScore, 0),
      },
      {
        accessorKey: "metrics.momentumScore",
        header: "Momentum",
        cell: ({ row }) => formatSigned(row.original.metrics.momentumScore, 0),
      },
      {
        accessorKey: "metrics.volumeScore",
        header: "Liquidity",
        cell: ({ row }) => formatSigned(row.original.metrics.volumeScore, 0),
      },
      {
        accessorKey: "metrics.rsi14",
        header: t.scanner.columns.rsi,
        cell: ({ row }) => formatNullable(row.original.metrics.rsi14, 1),
      },
      {
        accessorKey: "metrics.bbWidthPercentile",
        header: t.scanner.columns.bbCompact,
        cell: ({ row }) => formatNullable(row.original.metrics.bbWidthPercentile, 0),
      },
      {
        accessorKey: "metrics.volumeRatio",
        header: t.scanner.columns.volCompact,
        cell: ({ row }) => formatNullable(row.original.metrics.volumeRatio, 2),
      },
      {
        id: "macd",
        header: "MACD",
        cell: () => <span className="text-[var(--muted)]">N/A</span>,
      },
      {
        id: "maStatus",
        header: t.scanner.columns.maStatus,
        cell: () => <span className="text-[var(--muted)]">N/A</span>,
      },
      {
        id: "warnings",
        header: t.scanner.columns.warnCompact,
        cell: ({ row }) =>
          row.original.riskCodes.length > 0 || row.original.reasonCodes.length > 0 ? (
            <span
              aria-label={`${row.original.riskCodes.length || row.original.reasonCodes.length} ${t.scanner.warnings}`}
              className="inline-flex border border-[var(--warning-border)] bg-[var(--warning-bg)] px-1 py-0.5 text-[10px] font-semibold text-[var(--warning)]"
            >
              W{row.original.riskCodes.length || row.original.reasonCodes.length}
            </span>
          ) : (
            <span className="text-[var(--muted)]">N/A</span>
          ),
      },
    ],
    [language, t],
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
        <RefreshIconButton
          onClick={onRefresh}
          disabled={isFetching}
          isRefreshing={isFetching}
          label={t.common.refresh}
          refreshingLabel={t.common.refreshing}
        />
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

function CompactScores({ result }: { result: ScannerCodeContractResult }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] tabular-nums">
      <span className="text-[var(--accent)]">
        O {formatSigned(result.metrics.opportunityScore, 0)}
      </span>
      <span className="text-[var(--info)]">
        C {formatSigned(result.metrics.confirmationScore, 0)}
      </span>
      <span className={getRiskTextClass(result.metrics.riskScore)}>
        R {formatSigned(result.metrics.riskScore, 0)}
      </span>
    </span>
  );
}

function SignalCell({ result }: { result: ScannerCodeContractResult }) {
  const { language } = useAppLanguage();
  const signal = explainCode(result.signalCodes[0] ?? result.phaseCode, language);

  return (
    <span
      className={`inline-flex h-5 items-center border px-1.5 text-[11px] font-semibold leading-none ${getSignalTextClass(
        result.groupCode,
      )}`}
    >
      {signal.label}
    </span>
  );
}

function getRiskTextClass(riskScore: number | null) {
  if (riskScore === null) {
    return "text-[var(--muted)]";
  }

  if (riskScore > 100) {
    return "text-[var(--danger)]";
  }

  if (riskScore > 70) {
    return "text-[var(--warning)]";
  }

  return "text-[var(--muted)]";
}

function getFinalScoreTextClass(finalSignalScore: number | null) {
  if (finalSignalScore === null) {
    return "text-[var(--foreground)]";
  }

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

function getSignalTextClass(groupCode: string) {
  switch (groupCode) {
    case "GR_201":
    case "GR_501":
    case "GR_601":
      return "border-[var(--eligible-border)] bg-[var(--eligible-bg)] text-[var(--eligible)]";
    case "GR_101":
      return "border-[var(--watch-border)] bg-[var(--watch-bg)] text-[var(--watch)]";
    case "GR_301":
      return "border-[var(--risk-border)] bg-[var(--risk-bg)] text-[var(--risk)]";
    case "GR_302":
      return "border-[var(--overheated-border)] bg-[var(--overheated-bg)] text-[var(--overheated)]";
    default:
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
  return value === null ? "N/A" : formatNumber(value, decimals);
}

function formatNumber(value: number, decimals: number) {
  return value.toFixed(decimals);
}

function formatSigned(value: number | null, decimals: number) {
  if (value === null) {
    return "N/A";
  }

  const formatted = value.toFixed(decimals);
  return value > 0 ? `+${formatted}` : formatted;
}

function getColumnClass(columnId: string) {
  switch (columnId) {
    case "rank":
      return "w-[26px]";
    case "symbol":
      return "w-[78px]";
    case "setupCode":
      return "w-[92px]";
    case "signalCodes":
      return "w-[72px]";
    case "actionCode":
      return "w-[78px]";
    case "metrics_finalSignalScore":
    case "metrics.finalSignalScore":
      return "w-[56px]";
    case "ocr":
      return "w-[122px]";
    case "metrics_trendScore":
    case "metrics_momentumScore":
    case "metrics_volumeScore":
    case "metrics.trendScore":
    case "metrics.momentumScore":
    case "metrics.volumeScore":
      return "w-[58px]";
    case "metrics_rsi14":
    case "metrics_bbWidthPercentile":
    case "metrics.rsi14":
    case "metrics.bbWidthPercentile":
      return "w-[38px]";
    case "metrics_volumeRatio":
    case "metrics.volumeRatio":
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
    case "setupCode":
      return "phase";
    case "signalCodes":
      return "signal";
    case "metrics_finalSignalScore":
    case "metrics.finalSignalScore":
      return "score";
    case "ocr":
      return "ocr";
    case "metrics_rsi14":
    case "metrics.rsi14":
      return "rsi";
    case "metrics_bbWidthPercentile":
    case "metrics.bbWidthPercentile":
      return "bb";
    case "metrics_volumeRatio":
    case "metrics.volumeRatio":
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
