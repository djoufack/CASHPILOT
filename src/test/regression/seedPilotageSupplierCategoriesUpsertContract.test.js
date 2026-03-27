import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptPath = path.resolve(process.cwd(), 'scripts/seed-pilotage-demos.mjs');

describe('seed-pilotage-demos supplier_product_categories upsert contract', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');

  it('upserts supplier_product_categories by primary key id', () => {
    const supplierCategoryUpsertCall = source.match(
      /upsertRows\(\s*client,\s*'supplier_product_categories'[\s\S]*?\);/
    )?.[0];

    expect(supplierCategoryUpsertCall).toBeTruthy();
    expect(supplierCategoryUpsertCall).toMatch(/'id'/);
    expect(supplierCategoryUpsertCall).not.toMatch(/'user_id,name'/);
  });
});
