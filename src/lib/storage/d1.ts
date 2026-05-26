import { getCloudflareContext } from "@opennextjs/cloudflare";

export type D1Result<T> = {
  results?: T[];
};

export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
};

export type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch?(statements: D1PreparedStatement[]): Promise<unknown[]>;
};

export async function getD1Database() {
  const { env } = await getCloudflareContext({ async: true });
  return ((env as { DB?: D1Database }).DB ?? null) as D1Database | null;
}

export function isMissingD1TableError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("no such table")
  );
}
