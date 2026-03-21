/**
 * Deletes ALL items from the Miro board
 * Run: node scripts/miro-clear.mjs
 */
const BOARD_ID = "uXjVGzJ_7XM=";
const TOKEN    = "eyJtaXJvLm9yaWdpbiI6ImV1MDEifQ_2fagmTC3t0D_uixhhgCawAOOKSk";
const BASE     = `https://api.miro.com/v2/boards/${encodeURIComponent(BOARD_ID)}`;
const H        = { "Authorization": `Bearer ${TOKEN}`, "Accept": "application/json" };
const sleep    = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log("🗑️  Clearing Miro board...\n");

  const types = ["frames", "shapes", "connectors", "texts", "sticky_notes"];
  let deleted = 0;

  for (const type of types) {
    let cursor = null;
    do {
      const qs  = cursor ? `?cursor=${cursor}&limit=50` : "?limit=50";
      const res = await fetch(`${BASE}/${type}${qs}`, { headers: H });
      const d   = await res.json();
      const items = d.data || [];

      for (const item of items) {
        await sleep(150);
        const r = await fetch(`${BASE}/items/${item.id}`, {
          method: "DELETE",
          headers: H,
        });
        if (r.status === 204 || r.status === 200) {
          deleted++;
          process.stdout.write(`\r  Deleted: ${deleted}`);
        }
      }
      cursor = items.length === 50 ? d.cursor : null;
      if (cursor) await sleep(300);
    } while (cursor);
  }

  console.log(`\n\n✅ Done — ${deleted} items deleted.`);
}

main().catch(console.error);
