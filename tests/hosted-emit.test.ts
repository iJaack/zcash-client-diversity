import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

test("compiled hosted entrypoint resolves every relative module without TypeScript sources", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const folder = await mkdtemp(join(tmpdir(), "zeclens-emitted-"));
  const config = ts.readConfigFile(
    join(root, "tsconfig.json"),
    ts.sys.readFile,
  ).config;
  const options = ts.convertCompilerOptionsFromJson(
    config.compilerOptions,
    root,
  ).options;
  try {
    await writeFile(
      join(folder, "package.json"),
      JSON.stringify({ type: "module" }),
    );
    for (const name of [
      "api/dashboard.ts",
      "server/hosted.ts",
      "server/app.ts",
      "src/lib/census.ts",
    ]) {
      const source = await readFile(join(root, name), "utf8");
      const output = ts.transpileModule(source, {
        compilerOptions: options,
        fileName: join(root, name),
      }).outputText;
      const target = join(folder, name.replace(/\.ts$/, ".js"));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, output);
    }
    const route = await import(
      pathToFileURL(join(folder, "api/dashboard.js")).href
    );
    const response = await route.GET(
      new Request("https://zeclens.vercel.app/api/dashboard?period=invalid"),
    );
    assert.equal(response.status, 400);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
