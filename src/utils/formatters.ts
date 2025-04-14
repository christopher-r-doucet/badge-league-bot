/**
 * Formats a date to a readable string format
 * @param date The date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  
  return date.toLocaleString('en-US', options);
}
