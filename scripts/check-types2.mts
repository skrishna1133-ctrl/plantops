import { config } from "dotenv";
config({ path: ".env.test" });
import { sql } from "@vercel/postgres";
const res = await sql`
  SELECT table_name, column_name, data_type 
  FROM information_schema.columns 
  WHERE table_schema = 'public'
    AND table_name IN ('qms_material_types', 'qms_inspections', 'qms_templates', 'qms_parameters', 'qms_ncrs', 'users', 'tenants', 'cmms_machines', 'cmms_production_lines')
    AND column_name IN ('id', 'tenant_id', 'material_type_id', 'created_by_id', 'lot_id', 'template_id')
  ORDER BY table_name, column_name
`;
console.log(JSON.stringify(res.rows, null, 2));
process.exit(0);
