import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const clean = line.trim();
    if (!clean || clean.startsWith("#")) continue;
    const separatorIndex = clean.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = clean.slice(0, separatorIndex).trim();
    const rawValue = clean.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function loadProfessionCategories() {
  const taxonomyPath = path.join(process.cwd(), "src/lib/professions/taxonomy.ts");
  const source = fs.readFileSync(taxonomyPath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const compiledModule = { exports: {} };
  const sandbox = {
    exports: compiledModule.exports,
    module: compiledModule,
    require(name) {
      throw new Error(`Unexpected require while loading taxonomy: ${name}`);
    },
  };

  vm.runInNewContext(output, sandbox, { filename: taxonomyPath });
  const categories = compiledModule.exports.PROFESSION_CATEGORIES;

  if (!Array.isArray(categories)) {
    throw new Error("PROFESSION_CATEGORIES is not an array.");
  }

  return categories;
}

async function main() {
  loadDotEnv(path.join(process.cwd(), ".env.local"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run this script from the project root after configuring the environment.",
    );
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const categories = loadProfessionCategories();

  let categoryCount = 0;
  let subcategoryCount = 0;

  for (const [categoryIndex, category] of categories.entries()) {
    const { data: savedCategory, error: categoryError } = await supabase
      .from("categories")
      .upsert(
        {
          name: category.name,
          slug: category.slug,
          image_url: category.image_url,
          icon: category.icon,
          description: category.description ?? null,
          sort_order: categoryIndex,
          is_active: true,
        },
        { onConflict: "slug" },
      )
      .select("id, slug")
      .single();

    if (categoryError || !savedCategory) {
      throw new Error(
        `Failed to upsert category ${category.slug}: ${categoryError?.message ?? "missing row"}`,
      );
    }

    categoryCount += 1;

    const subcategories = Array.isArray(category.subcategories) ? category.subcategories : [];
    for (const [subcategoryIndex, subcategory] of subcategories.entries()) {
      const { error: subcategoryError } = await supabase
        .from("subcategories")
        .upsert(
          {
            category_id: savedCategory.id,
            name: subcategory.name,
            slug: subcategory.slug,
            sort_order: subcategoryIndex,
            is_active: true,
          },
          { onConflict: "category_id,slug" },
        );

      if (subcategoryError) {
        throw new Error(
          `Failed to upsert subcategory ${category.slug}/${subcategory.slug}: ${subcategoryError.message}`,
        );
      }

      subcategoryCount += 1;
    }
  }

  console.log(
    `Seed completed: ${categoryCount} categories and ${subcategoryCount} subcategories upserted.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
