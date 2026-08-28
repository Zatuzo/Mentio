/** Returns default startDate + dueDate (today → today+3 days) when not explicitly set. */
export function defaultTaskDates(startDate?: string | Date | null, dueDate?: string | Date | null) {
  const start = startDate ? new Date(startDate) : (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const due = dueDate ? new Date(dueDate) : (() => {
    const d = new Date(start);
    d.setDate(d.getDate() + 3);
    return d;
  })();

  return { startDate: start, dueDate: due };
}
