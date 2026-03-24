-- Clean up orphan records: timesheets with no matching task, accounting_entries with no matching expense
-- Found 3 orphan timesheets and 5 orphan accounting_entries (2026-03-08)

BEGIN;
-- Delete 3 timesheets referencing non-existent tasks (task_id IS NULL)
DELETE FROM timesheets
WHERE id IN (
  'f368d5b9-2329-4ca6-8b3e-400da1bb5f9d',
  'c4070260-09fa-454b-9958-f80d49744d4b',
  '9ed18673-7553-4265-8a92-8735e11b481c'
);
-- Delete 5 accounting_entries referencing non-existent expenses (source_id IS NULL, source_type = 'expense')
DELETE FROM accounting_entries
WHERE id IN (
  'f86ab63a-76d9-4136-9951-1daac07cd2e4',
  'abd758cc-2f05-4ec6-bf8a-1c97e2ff825b',
  '2d43d374-9a63-4d4e-9551-9ee283862d9b',
  '89b9801f-643f-415b-9c2c-c6dd0f34e822',
  '38dae404-4fec-4cc3-9f81-a8bdb44cd179'
);
COMMIT;
