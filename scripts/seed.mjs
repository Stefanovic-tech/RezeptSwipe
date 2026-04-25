import { createConnection } from "./_db.mjs";
import { loadEnv } from "./_env.mjs";
import { syncMealDbRandomRecipes } from "./mealdb-sync.mjs";

loadEnv();

async function main() {
  const mealdbPerRun = Number(process.env.MEALDB_RANDOM_PER_RUN ?? 24);
  const mealdbDelay = Number(process.env.MEALDB_REQUEST_DELAY_MS ?? 150);
  const conn = await createConnection();
  try {
    const [delResult] = await conn.execute(
      "DELETE FROM recipe_cache WHERE source = ?",
      ["seed"]
    );
    const removed = delResult.affectedRows ?? 0;
    if (removed > 0) {
      console.log(`[seed] ${removed} alte Seed-Rezepte (source=seed) entfernt.`);
    }
    await syncMealDbRandomRecipes(conn, {
      count: mealdbPerRun,
      delayMs: mealdbDelay,
    });
    console.log("[seed] fertig.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("[seed] Fehler:", err.message);
  process.exit(1);
});
