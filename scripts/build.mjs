import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { minify as minifyHtml } from "html-minifier-terser";
import { minify as minifyJs } from "terser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const apps = ["VR_DoF_Tester", "WebXR_AR_Paint"];

await main();

async function main() {
  for (const app of apps) {
    await buildApp(app);
  }
}

async function buildApp(app) {
  const sourceDir = path.join(repoRoot, app);
  const targetDir = path.join(repoRoot, "out", app);
  const fileNames = (await readdir(sourceDir)).filter((name) => name !== "spec.md");

  if (fileNames.length === 0) {
    throw new Error(`ビルド対象ファイルが見つかりません: ${sourceDir}`);
  }

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  for (const fileName of fileNames) {
    const sourcePath = path.join(sourceDir, fileName);
    const targetPath = path.join(targetDir, fileName);
    const sourceText = await readFile(sourcePath, "utf8");
    const outputText = await transformFile(fileName, sourceText);
    await writeFile(targetPath, outputText, "utf8");
  }

  console.log(`built ${app} -> ${targetDir}`);
}

async function transformFile(fileName, sourceText) {
  if (fileName.endsWith(".html")) {
    return minifyHtml(sourceText, {
      collapseWhitespace: true,
      minifyCSS: true,
      removeComments: true,
      removeRedundantAttributes: true,
      useShortDoctype: true
    });
  }

  if (fileName.endsWith(".js")) {
    const result = await minifyJs(sourceText, {
      compress: true,
      format: {
        comments: false
      },
      mangle: true,
      module: true
    });

    if (!result.code) {
      throw new Error(`JavaScript の minify に失敗しました: ${fileName}`);
    }

    return result.code;
  }

  return sourceText;
}
