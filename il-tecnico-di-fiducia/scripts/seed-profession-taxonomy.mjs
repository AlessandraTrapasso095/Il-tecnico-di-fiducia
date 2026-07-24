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

  const previewOnly = process.argv.includes("--preview");
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
  const desiredCategorySlugs = new Set(categories.map((category) => category.slug));

  const { data: existingCategories, error: existingCategoriesError } = await supabase
    .from("categories")
    .select("id, name, slug, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (existingCategoriesError) {
    throw new Error(`Failed to load existing categories: ${existingCategoriesError.message}`);
  }

  const { data: professionalCategories, error: professionalCategoriesError } = await supabase
    .from("professional_categories")
    .select("category_id");

  if (professionalCategoriesError) {
    throw new Error(
      `Failed to load professional category associations: ${professionalCategoriesError.message}`,
    );
  }

  const professionalCounts = new Map();
  for (const row of professionalCategories ?? []) {
    const categoryId = String(row.category_id);
    professionalCounts.set(categoryId, (professionalCounts.get(categoryId) ?? 0) + 1);
  }

  const obsoleteCategories = (existingCategories ?? [])
    .filter((category) => !desiredCategorySlugs.has(category.slug))
    .map((category) => ({
      ...category,
      professional_count: professionalCounts.get(String(category.id)) ?? 0,
    }));

  const preview = {
    mode: previewOnly ? "preview" : "apply",
    categories: categories.map((category, categoryIndex) => ({
      name: category.name,
      slug: category.slug,
      sort_order: category.sort_order ?? (categoryIndex + 1) * 1000,
      image_url: category.image_url,
      icon: category.icon,
      subcategory_count: category.subcategories.length,
      subcategories: category.subcategories.map((subcategory, subcategoryIndex) => ({
        name: subcategory.name,
        slug: subcategory.slug,
        sort_order: (subcategoryIndex + 1) * 1000,
      })),
    })),
    obsolete_categories_to_deactivate: obsoleteCategories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      professional_count: category.professional_count,
    })),
  };

  console.log(JSON.stringify(preview, null, 2));

  if (previewOnly) {
    console.log("Preview completed: no database changes applied.");
    return;
  }

  let categoryCount = 0;
  let subcategoryCount = 0;
  let deactivatedCategoryCount = 0;
  let deactivatedSubcategoryCount = 0;

  for (const [categoryIndex, category] of categories.entries()) {
    const categorySortOrder = category.sort_order ?? (categoryIndex + 1) * 1000;
    const { data: savedCategory, error: categoryError } = await supabase
      .from("categories")
      .upsert(
        {
          name: category.name,
          slug: category.slug,
          image_url: category.image_url,
          icon: category.icon,
          description: category.description ?? null,
          sort_order: categorySortOrder,
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
    const desiredSubcategorySlugs = new Set(subcategories.map((subcategory) => subcategory.slug));

    for (const [subcategoryIndex, subcategory] of subcategories.entries()) {
      const { error: subcategoryError } = await supabase
        .from("subcategories")
        .upsert(
          {
            category_id: savedCategory.id,
            name: subcategory.name,
            slug: subcategory.slug,
            sort_order: (subcategoryIndex + 1) * 1000,
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

    const { data: existingSubcategories, error: existingSubcategoriesError } = await supabase
      .from("subcategories")
      .select("id, slug, is_active")
      .eq("category_id", savedCategory.id);

    if (existingSubcategoriesError) {
      throw new Error(
        `Failed to load existing subcategories for ${category.slug}: ${existingSubcategoriesError.message}`,
      );
    }

    for (const existingSubcategory of existingSubcategories ?? []) {
      if (desiredSubcategorySlugs.has(existingSubcategory.slug)) continue;
      if (existingSubcategory.is_active === false) continue;

      const { error: deactivateSubcategoryError } = await supabase
        .from("subcategories")
        .update({ is_active: false })
        .eq("id", existingSubcategory.id);

      if (deactivateSubcategoryError) {
        throw new Error(
          `Failed to deactivate obsolete subcategory ${category.slug}/${existingSubcategory.slug}: ${deactivateSubcategoryError.message}`,
        );
      }

      deactivatedSubcategoryCount += 1;
    }
  }

  for (const obsoleteCategory of obsoleteCategories) {
    const { error: deactivateCategoryError } = await supabase
      .from("categories")
      .update({ is_active: false })
      .eq("id", obsoleteCategory.id);

    if (deactivateCategoryError) {
      throw new Error(
        `Failed to deactivate obsolete category ${obsoleteCategory.slug}: ${deactivateCategoryError.message}`,
      );
    }

    deactivatedCategoryCount += obsoleteCategory.is_active === false ? 0 : 1;

    const { data: obsoleteSubcategories, error: obsoleteSubcategoriesError } = await supabase
      .from("subcategories")
      .select("id, is_active")
      .eq("category_id", obsoleteCategory.id);

    if (obsoleteSubcategoriesError) {
      throw new Error(
        `Failed to load obsolete subcategories for ${obsoleteCategory.slug}: ${obsoleteSubcategoriesError.message}`,
      );
    }

    for (const obsoleteSubcategory of obsoleteSubcategories ?? []) {
      if (obsoleteSubcategory.is_active === false) continue;
      const { error: deactivateObsoleteSubcategoryError } = await supabase
        .from("subcategories")
        .update({ is_active: false })
        .eq("id", obsoleteSubcategory.id);

      if (deactivateObsoleteSubcategoryError) {
        throw new Error(
          `Failed to deactivate obsolete subcategory ${obsoleteCategory.slug}: ${deactivateObsoleteSubcategoryError.message}`,
        );
      }

      deactivatedSubcategoryCount += 1;
    }
  }

  console.log(
    [
      `Seed completed: ${categoryCount} categories and ${subcategoryCount} subcategories upserted.`,
      `${deactivatedCategoryCount} obsolete categories deactivated.`,
      `${deactivatedSubcategoryCount} obsolete subcategories deactivated.`,
    ].join(" "),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
