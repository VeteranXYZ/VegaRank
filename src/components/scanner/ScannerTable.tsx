"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PhaseBadge } from "./PhaseBadge";
import { RiskBadge } from "./RiskBadge";
import { ScoreBadge } from "./ScoreBadge";
import { SignalBadge } from "./SignalBadge";
import {
  SignalSummaryBar,
  type SignalSummaryItem,
} from "./SignalSummaryBar";
import type { ScannerSignalState, ScanResult } from "@/lib/scanner/types";

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
  onRefresh: () => void;
  onSignalSelect: (signal: ScannerSignalState | "ALL") => void;
  onSelect: (symbol: string) => void;
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
  onRefresh,
  onSignalSelect,
  onSelect,
}: ScannerTableProps) {
  const { dictionary: t } = useLanguage();
  const columns = useMemo<ColumnDef<ScanResult>[]>(
    () => [
      {
        id: "rank",
        header: t.common.rank,
        cell: ({ row }) => row.index + 1,
      },
      {
        accessorKey: "symbol",
        header: t.scanner.columns.symbol,
        cell: ({ row }) => (
          <span className="font-semibold text-[var(--foreground)]">
            {row.original.symbol}
          </span>
        ),
      },
      {
        accessorKey: "phase",
        header: t.common.phase,
        cell: ({ row }) => <PhaseBadge phase={row.original.phase} />,
      },
      {
        accessorKey: "signal.state",
        header: t.common.signal,
        cell: ({ row }) => <SignalBadge signal={row.original.signal} />,
      },
      {
        id: "multiTimeframe",
        header: t.common.alignment,
        cell: ({ row }) =>
          row.original.multiTimeframe ? (
            <span className="inline-flex rounded-md border border-[var(--border)] bg-[#0b0f14] px-2 py-1 text-xs font-semibold text-[var(--foreground)]">
              {t.alignment[row.original.multiTimeframe.alignment]}
            </span>
          ) : (
            <span className="text-[var(--muted)]">{t.common.single}</span>
          ),
      },
      {
        accessorKey: "opportunityScore",
        header: t.scanner.columns.opportunity,
        cell: ({ row }) => (
          <ScoreBadge
            label={t.scanner.columns.opportunity}
            value={row.original.opportunityScore}
          />
        ),
      },
      {
        accessorKey: "confirmationScore",
        header: t.scanner.columns.confirmation,
        cell: ({ row }) => (
          <ScoreBadge
            label={t.scanner.columns.confirmation}
            value={row.original.confirmationScore}
          />
        ),
      },
      {
        accessorKey: "riskScore",
        header: t.common.risk,
        cell: ({ row }) => (
          <ScoreBadge
            label={t.common.risk}
            value={row.original.riskScore}
            tone="risk"
          />
        ),
      },
      {
        accessorKey: "rankScore",
        header: t.scanner.columns.score,
        cell: ({ row }) => formatNumber(row.original.rankScore, 1),
      },
      {
        accessorKey: "rsi14",
        header: t.scanner.columns.rsi,
        cell: ({ row }) => formatNullable(row.original.rsi14, 1),
      },
      {
        accessorKey: "bbWidthPercentile",
        header: t.scanner.columns.bbWidth,
        cell: ({ row }) => formatNullable(row.original.bbWidthPercentile, 0),
      },
      {
        accessorKey: "volumeRatio",
        header: t.scanner.columns.volumeRatio,
        cell: ({ row }) => formatNullable(row.original.volumeRatio, 2),
      },
      {
        id: "maStatus",
        header: t.scanner.columns.maStatus,
        cell: ({ row }) => <MaStatus result={row.original} />,
      },
      {
        id: "warnings",
        header: t.scanner.columns.warnings,
        cell: ({ row }) =>
          row.original.warnings.length > 0 ? (
            <RiskBadge
              label={`${row.original.warnings.length} ${t.scanner.warnings}`}
            />
          ) : (
            <span className="text-[var(--muted)]">{t.common.none}</span>
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
    <section className="min-w-0 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">{t.scanner.results}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
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
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
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
        <div className="border-b border-[var(--border)] bg-[#2b2111] px-4 py-3 text-sm text-[var(--warning)]">
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] border-collapse text-left text-sm">
            <thead className="bg-[#0d131a] text-xs uppercase text-[var(--muted)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-3 py-3 font-semibold">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
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
                    onClick={() => onSelect(row.original.symbol)}
                    className={`cursor-pointer border-t border-[var(--border)] transition ${
                      isSelected ? "bg-[#132119]" : "hover:bg-[#101923]"
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-3 align-middle">
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
    <div className="flex gap-1">
      {items.map(([label, active]) => (
        <span
          key={label}
          className={`inline-flex h-7 min-w-9 items-center justify-center rounded-md border px-2 text-xs font-semibold ${
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
