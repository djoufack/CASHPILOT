const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function normalizeDateValue(value) {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value === 'string') {
    const match = value.match(DATE_INPUT_PATTERN);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }

  return new Date(value);
}

export function formatDateInput(value = new Date()) {
  const date = normalizeDateValue(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatStartOfYearInput(value = new Date()) {
  const date = normalizeDateValue(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return formatDateInput(new Date(date.getFullYear(), 0, 1));
}

export function addDaysToDateInput(value, days) {
  const date = normalizeDateValue(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  date.setDate(date.getDate() + days);
  return formatDateInput(date);
}
