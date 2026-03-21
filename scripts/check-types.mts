import { config } from "dotenv";
config({ path: ".env.test" });
import { sql } from "@vercel/postgres";
const res = await sql`
  SELECT table_name, column_name, data_type 
  FROM information_schema.columns 
  WHERE column_name IN ('id', 'tenant_id', 'inbound_shipment_id')
    AND table_schema = 'public'
    AND table_name IN ('qms_lots', 'ops_outbound_shipments', 'ops_inbound_shipments', 'ops_weight_entries', 'ops_lots', 'ops_production_runs', 'cmms_work_orders')
  ORDER BY table_name, column_name
`;
console.log(JSON.stringify(res.rows, null, 2));
process.exit(0);
