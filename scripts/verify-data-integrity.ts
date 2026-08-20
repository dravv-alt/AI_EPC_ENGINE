import { config } from "dotenv";
config({ path: ".env.local" });
config();

import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "../src/lib/db/client";

type CountRow = { issue: string; count: number | string };

async function issueCounts(): Promise<CountRow[]> {
  const result = await db.execute(sql<CountRow>`
    select 'duplicate graph edges' as issue, count(*)::int as count
    from (
      select 1 from edges
      group by project_id, from_type, from_id, relationship_type, to_type, to_id
      having count(*) > 1
    ) duplicates
    union all
    select 'duplicate system names', count(*)::int
    from (
      select 1 from systems group by project_id, name having count(*) > 1
    ) duplicates
    union all
    select 'duplicate gate names per system', count(*)::int
    from (
      select 1 from gates group by project_id, system_id, name having count(*) > 1
    ) duplicates
    union all
    select 'asset/project/system mismatches', count(*)::int
    from assets a join systems s on s.id = a.system_id
    where a.project_id <> s.project_id
    union all
    select 'gate/project/system mismatches', count(*)::int
    from gates g join systems s on s.id = g.system_id
    where g.project_id <> s.project_id
    union all
    select 'evidence/project/system/asset mismatches', count(*)::int
    from evidence e
    join systems s on s.id = e.system_id
    left join assets a on a.id = e.asset_id
    where e.project_id <> s.project_id
       or (a.id is not null and (a.project_id <> e.project_id or a.system_id <> e.system_id))
    union all
    select 'Cx checklist scope mismatches', count(*)::int
    from cx_checklists c
    join projects p on p.id = c.project_id
    join systems s on s.id = c.system_id
    join gates g on g.id = c.gate_id
    join assets a on a.id = c.asset_id
    where c.generation_status <> 'failed'
      and (c.tenant_id <> p.tenant_id
       or s.project_id <> c.project_id
       or g.project_id <> c.project_id
       or a.project_id <> c.project_id
       or g.system_id <> c.system_id
       or a.system_id <> c.system_id)
    union all
    select 'shipment project/tenant/equipment mismatches', count(*)::int
    from shipments sh
    join projects p on p.id = sh.project_id
    join assets a on a.id = sh.equipment_id
    where sh.tenant_id <> p.tenant_id or a.project_id <> sh.project_id
    union all
    select 'missing deduplication indexes', count(*)::int
    from (values
      ('edges_project_edge_unique'),
      ('knowledge_chunks_project_hash_unique'),
      ('alerts_dedup_key_unique'),
      ('systems_project_name_unique'),
      ('gates_project_system_name_unique')
    ) expected(index_name)
    where not exists (
      select 1 from pg_indexes
      where schemaname = current_schema() and indexname = expected.index_name
    )
  `);
  return Array.from(result);
}

async function main() {
  const counts = await issueCounts();
  for (const row of counts) console.log(`${row.issue}: ${Number(row.count)}`);
  const failures = counts.filter((row) => Number(row.count) !== 0);
  assert.deepEqual(failures, [], `Relational integrity failures: ${failures.map((row) => `${row.issue}=${row.count}`).join(", ")}`);
  console.log("Database integrity verification passed: graph deduplication, business-key uniqueness, cross-feature scope, tenant/project ownership, and required indexes are valid.");
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
