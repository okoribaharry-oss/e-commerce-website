const fs = require("node:fs/promises");
const path = require("node:path");
const products = require("../../backend/products");

const catalog = `${JSON.stringify({ products }, null, 2)}\n`;
const publicCatalogPath = path.resolve(__dirname, "../public/products.json");
const sourceCatalogPath = path.resolve(__dirname, "../products.json");

async function exportCatalog() {
  await fs.mkdir(path.dirname(publicCatalogPath), { recursive: true });
  await Promise.all([
    fs.writeFile(publicCatalogPath, catalog),
    fs.writeFile(sourceCatalogPath, catalog)
  ]);
}

exportCatalog().catch(error => {
  console.error("Unable to export the storefront product catalog:", error);
  process.exitCode = 1;
});
