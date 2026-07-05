import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

const SUPABASE_URL = "https://fwfbiotperunrdckqxcr.supabase.co";

// 36 caractères — pas de O/0 ni I/1 pour éviter les confusions visuelles
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// Seuil de rejet pour éliminer le biais modulo (256 - 256 % 32 = 256)
// 32 est une puissance de 2, donc pas de biais du tout ici
const CHARS_LEN = CHARS.length; // 32

function randomSegment(): string {
  // 4 caractères par segment, chacun tiré de CHARS (32 symboles, pas de biais)
  const bytes = crypto.randomBytes(4);
  return Array.from(bytes).map((b) => CHARS[b & 0x1f]).join("");
}

export function generateLicenseKey(): string {
  return `KERM-${randomSegment()}-${randomSegment()}-${randomSegment()}`;
}

function makeAdminClient(serviceRoleKey: string): SupabaseClient {
  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Génère `n` clés de licence uniques au format KERM-XXXX-XXXX-XXXX
 * et les insère dans la table Supabase `licenses`.
 *
 * @param n              Nombre de clés à générer
 * @param serviceRoleKey Clé service_role Supabase (bypass RLS) — NE PAS distribuer
 * @returns              Tableau des clés générées
 */
export async function generateLicenseKeys(
  n: number,
  serviceRoleKey: string
): Promise<string[]> {
  if (n <= 0) throw new Error("n doit être supérieur à 0");
  if (!serviceRoleKey) throw new Error("serviceRoleKey est requis");

  const admin = makeAdminClient(serviceRoleKey);

  // Charger les clés existantes pour éviter les doublons côté client
  const { data: existing, error: fetchError } = await admin
    .from("licenses")
    .select("key");

  if (fetchError) throw new Error(`Erreur lecture Supabase : ${fetchError.message}`);

  const existingSet = new Set<string>(
    (existing ?? []).map((r: { key: string }) => r.key)
  );

  const keys: string[] = [];
  let attempts = 0;
  const maxAttempts = n * 20;

  while (keys.length < n) {
    if (++attempts > maxAttempts) {
      throw new Error(`Impossible de générer ${n} clés uniques après ${maxAttempts} essais`);
    }
    const key = generateLicenseKey();
    if (!existingSet.has(key)) {
      existingSet.add(key);
      keys.push(key);
    }
  }

  const { error: insertError } = await admin
    .from("licenses")
    .insert(keys.map((key) => ({ key })));

  if (insertError) throw new Error(`Erreur insertion Supabase : ${insertError.message}`);

  return keys;
}

// ── CLI : npx tsx src/main/licenses.ts <count> [service_role_key] ────────────
if (require.main === module) {
  const count = parseInt(process.argv[2] ?? "10", 10);
  const serviceRoleKey =
    process.argv[3] ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (isNaN(count) || count <= 0) {
    console.error("Erreur : <count> doit être un entier positif");
    process.exit(1);
  }

  if (!serviceRoleKey) {
    console.error(
      "Usage  : npx tsx src/main/licenses.ts <count> <service_role_key>\n" +
      "         ou définir la variable SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }

  generateLicenseKeys(count, serviceRoleKey)
    .then((keys) => {
      console.log(`\n${keys.length} clés générées :\n`);
      keys.forEach((k) => console.log(k));
    })
    .catch((e: Error) => {
      console.error("Erreur :", e.message);
      process.exit(1);
    });
}
