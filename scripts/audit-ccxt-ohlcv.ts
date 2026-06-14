import {
  auditCcxtOhlcv,
  createCcxtOhlcvClient,
  type CcxtAuditTimeframe,
  type CcxtClientLike,
  type CcxtExchangeId,
  type CcxtOhlcvAuditResult,
} from "@/lib/market-data/providers/ccxtOhlcvProvider";

const validExchanges: CcxtExchangeId[] = ["binance", "coinbase"];
const defaultTimeframes: CcxtAuditTimeframe[] = ["1h", "4h", "1d", "1w"];
const validTimeframes: CcxtAuditTimeframe[] = ["1h", "4h", "1d", "1w"];

export type CcxtAuditCliConsole = {
  log: (message?: unknown, ...optionalParams: unknown[]) => void;
};

export type CcxtAuditReport = {
  generatedAt: string;
  provider: "ccxt";
  readOnly: true;
  noDatabaseWrites: true;
  exchange: CcxtExchangeId;
  limit: number;
  results: CcxtAuditCliResult[];
};

export type CcxtAuditCliResult = Omit<CcxtOhlcvAuditResult, "candles">;

if (process.argv[1]?.endsWith("audit-ccxt-ohlcv.ts")) {
  await runCcxtAuditCli(process.argv.slice(2), console);
}

export async function runCcxtAuditCli(
  args: string[],
  output: CcxtAuditCliConsole = console,
  injectedClient?: CcxtClientLike,
): Promise<CcxtAuditReport> {
  const parsed = parseArgs(args);
  const client = injectedClient ?? (await createCcxtOhlcvClient(parsed.exchange));

  try {
    const results: CcxtAuditCliResult[] = [];

    for (const symbol of parsed.symbols) {
      for (const timeframe of parsed.timeframes) {
        const result = await auditCcxtOhlcv(client, {
          exchange: parsed.exchange,
          symbol,
          timeframe,
          limit: parsed.limit,
        });
        results.push(stripCandles(result));
      }
    }

    const report: CcxtAuditReport = {
      generatedAt: new Date().toISOString(),
      provider: "ccxt",
      readOnly: true,
      noDatabaseWrites: true,
      exchange: parsed.exchange,
      limit: parsed.limit,
      results,
    };

    output.log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    if (!injectedClient) {
      await client.close?.();
    }
  }
}

function parseArgs(args: string[]) {
  const exchange = parseStringFlag(args, "--exchange");
  if (!exchange || !validExchanges.includes(exchange as CcxtExchangeId)) {
    throw new Error(`--exchange must be one of: ${validExchanges.join(", ")}`);
  }

  const symbols = parseListFlag(args, "--symbols");
  if (symbols.length === 0) {
    throw new Error("--symbols must include at least one symbol.");
  }

  const timeframes = parseListFlag(args, "--timeframes", defaultTimeframes).map((timeframe) => {
    if (!validTimeframes.includes(timeframe as CcxtAuditTimeframe)) {
      throw new Error(`Unsupported timeframe '${timeframe}'. Valid timeframes: ${validTimeframes.join(", ")}`);
    }
    return timeframe as CcxtAuditTimeframe;
  });

  return {
    exchange: exchange as CcxtExchangeId,
    symbols,
    timeframes,
    limit: parseNumberFlag(args, "--limit") ?? 300,
  };
}

function parseStringFlag(args: string[], name: string) {
  const raw = args.find((arg) => arg.startsWith(`${name}=`));
  return raw?.slice(name.length + 1).trim();
}

function parseListFlag<T extends string>(
  args: string[],
  name: string,
  defaultValue: readonly T[] = [],
) {
  const raw = args.find((arg) => arg.startsWith(`${name}=`));
  if (!raw) {
    return [...defaultValue];
  }

  return raw
    .slice(name.length + 1)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseNumberFlag(args: string[], name: string) {
  const raw = args.find((arg) => arg.startsWith(`${name}=`));
  if (!raw) {
    return undefined;
  }

  const value = Number(raw.slice(name.length + 1));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

function stripCandles(result: CcxtOhlcvAuditResult): CcxtAuditCliResult {
  const rest: Partial<CcxtOhlcvAuditResult> = { ...result };
  delete rest.candles;
  return rest as CcxtAuditCliResult;
}
