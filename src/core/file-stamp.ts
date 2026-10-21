const pad = (value: number) => String(value).padStart(2, '0');

/** Local date and time as `YYYY-MM-DD_HHmmss`, for file and folder names. */
export function fileTimestamp(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}
