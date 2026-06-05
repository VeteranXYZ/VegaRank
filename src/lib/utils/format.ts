export function formatScore(value: number) {
  return value.toFixed(0);
}

type DisplayDateTimeInput = string | number | Date | null | undefined;

type DisplayDateTimeOptions = {
  fallback?: string;
  mode?: "datetime" | "compact-datetime" | "date" | "time";
  timeZone?: "local" | "utc";
};

export function formatDisplayDateTime(
  value: DisplayDateTimeInput,
  {
    fallback = "Not available",
    mode = "datetime",
    timeZone = "local",
  }: DisplayDateTimeOptions = {},
) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const parts =
    timeZone === "utc" ? getUtcDateTimeParts(date) : getLocalDateTimeParts(date);
  const datePart = `${parts.year}-${padDateTimePart(parts.month)}-${padDateTimePart(parts.day)}`;
  const compactDatePart = `${padDateTimePart(parts.month)}-${padDateTimePart(parts.day)}`;
  const timePart = `${padDateTimePart(parts.hour)}:${padDateTimePart(parts.minute)}`;

  switch (mode) {
    case "compact-datetime":
      return `${compactDatePart} ${timePart}`;
    case "date":
      return datePart;
    case "time":
      return timePart;
    case "datetime":
      return `${datePart} ${timePart}`;
  }
}

function getLocalDateTimeParts(date: Date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

function getUtcDateTimeParts(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
}

function padDateTimePart(value: number) {
  return String(value).padStart(2, "0");
}
