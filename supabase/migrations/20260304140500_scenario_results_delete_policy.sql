drop policy if exists "Users can delete results for their scenarios" on public.scenario_results;

create policy "Users can delete results for their scenarios"
  on public.scenario_results
  for delete
  using (
    exists (
      select 1
      from public.financial_scenarios
      where id = scenario_results.scenario_id
        and user_id = auth.uid()
    )
  );
