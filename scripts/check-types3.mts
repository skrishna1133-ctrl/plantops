import { config } from "dotenv";
config({ path: ".env.test" });
import { sql } from "@vercel/postgres";
const res = await sql`
  SELECT table_name, column_name, data_type 
  FROM information_schema.columns 
  WHERE table_schema = 'public'
    AND column_name IN ('entered_by_id', 'created_by_id', 'reported_by_id', 'assigned_to_id', 'operator_id', 'inspected_by_id')
  ORDER BY table_name, column_name
`;
console.log(JSON.stringify(res.rows, null, 2));
process.exit(0);
