const fs = require("node:fs/promises");
const path = require("node:path");
const products = require("../../backend/products");

const catalogPath = path.resolve(__dirname, "../public/products.json");

async function exportCatalog() {
  await fs.mkdir(path.dirname(catalogPath), { recursive: true });
  await fs.writeFile(catalogPath, `${JSON.stringify({ products }, null, 2)}\n`);
}

exportCatalog().catch(error => {
  console.error("Unable to export the storefront product catalog:", error);
  process.exitCode = 1;
});
