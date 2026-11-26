/**
 * What `npx onejs-svelte init` does to a folder (cli.mjs runs it, then npm).
 *
 * Turns the OneJS app folder it runs in (a JSRunner's `~` folder, as Initialize
 * Project makes it) into a Svelte app: React out of package.json, index.ts and
 * App.svelte in, the plugin in esbuild.config.mjs, Svelte's types in
 * tsconfig.json, then npm install.
 *
 * It only replaces a file OneJS wrote that is still as OneJS wrote it, which
 * the folder's .onejs/scaffold record says. A file you changed is left alone,
 * and init says what to change by hand.
 */
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const own = JSON.parse(fs.readFileSync(path.join(here, "..", "package.json"), "utf8"))

const REACT_PACKAGES = ["react", "onejs-react", "onejs-ui", "ojplay", "@types/react", "@types/react-reconciler"]

const INDEX_TS = `import { render } from "onejs-svelte"
import App from "./App.svelte"

render(App, __root)
`

const APP_SVELTE = `<script lang="ts">
    let count = $state(0)
</script>

<view class="app">
    <label class="title" text="Hello from Svelte" />
    <button text={\`Clicked \${count} times\`} onclick={() => count++} />
</view>

<style>
    .app {
        flex-grow: 1;
        padding: 24px;
        background-color: rgb(35, 35, 35);
    }
    .title {
        font-size: 28px;
        color: white;
        margin-bottom: 12px;
    }
</style>
`

// svelte-check and the editor extension read this; the build does not
const SVELTE_CONFIG = `import { warningFilter } from "onejs-svelte/esbuild"

// Drops Svelte's HTML-only warnings (a11y, self-closing tags) in svelte-check and the editor.
export default { compilerOptions: { warningFilter } }
`

const ESBUILD_CONFIG = `import { oneJSConfig } from "onejs-unity/esbuild"
import { sveltePlugin } from "onejs-svelte/esbuild"

// The whole build: index.ts bundled into ../app.js.txt, where JSRunner reads it.
// \`npm run watch\` rebuilds on every save, and Unity hot-reloads the new bundle.
//
// A player build runs \`npm run build\` with NODE_ENV=production, which ships
// Svelte's production build; the editor keeps the development one, with its warnings.
// Any esbuild option can be added beside entry, for example alias or define.
export default oneJSConfig({
    entry: "index.ts",
    // Tailwind reads class names from these files.
    tailwind: { content: ["./**/*.{svelte,ts,js}"] },
    plugins: [
        sveltePlugin(),
        // Your own esbuild plugins go here.
    ],
})
`

const AGENTS_SECTION = `
## This app is Svelte, not React

\`npx onejs-svelte init\` made it a Svelte 5 app, so the React rules above do not apply here.

- The entry is \`index.ts\`, ending with \`render(App, __root)\` from \`onejs-svelte\`. Components are \`.svelte\` files.
- \`esbuild.config.mjs\` keeps \`sveltePlugin()\` from \`onejs-svelte/esbuild\` in its plugins.
- Tags are UI Toolkit elements: \`<view>\`, \`<label text="...">\`, \`<button onclick={...}>\`, \`<textfield value={v} onchange={(e) => v = e.value}>\`.
- Svelte refuses these under OneJS: \`bind:\` on an element (\`bind:this\` too), \`transition:\`, \`animate:\`, \`on:click\`, \`{@html}\`, \`<svelte:window>\`. \`bind:\` on a component prop works.
- onejs-unity's \`.\`, \`input\`, \`gpu\`, \`fx\` and \`proc\` need React; \`assets\`, \`audio\`, \`interop\`, \`sl\` and \`physics2d\` do not.
- \`npm run typecheck\` runs svelte-check.
`

const AGENTS_MARKER = "## This app is Svelte, not React"

/** The hash JSRunner's scaffold record keeps (OneJS ScaffoldRecord.Hash). */
export function scaffoldHash(text) {
    return crypto.createHash("sha256").update(text.replace(/\r\n/g, "\n"), "utf8").digest().subarray(0, 8).toString("hex")
}

function readRecord(dir) {
    const file = path.join(dir, ".onejs", "scaffold")
    const record = new Map()
    if (!fs.existsSync(file)) return record
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        if (!line.trim()) continue
        const [p, h] = line.split("\t")
        record.set(p.trim().replace(/\\/g, "/"), h?.trim() || null)
    }
    return record
}

/** True when OneJS wrote `file` and it still holds what OneJS wrote. */
function untouched(dir, record, file) {
    const full = path.join(dir, file)
    const hash = record.get(file)
    return !!hash && fs.existsSync(full) && scaffoldHash(fs.readFileSync(full, "utf8")) === hash
}

/**
 * Converts `dir`. Returns { changed: string[], manual: string[] }; manual lists
 * what init could not do safely, for the user to do by hand.
 */
export function init(dir, { log = console.log } = {}) {
    const pkgPath = path.join(dir, "package.json")
    if (!fs.existsSync(pkgPath)) {
        throw new Error(`No package.json in ${dir}. Run this in a JSRunner's ~ folder, after Initialize Project.`)
    }
    const record = readRecord(dir)
    const changed = [], manual = []

    // package.json: React out, Svelte in
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
    for (const field of ["dependencies", "devDependencies"]) {
        for (const name of REACT_PACKAGES) if (pkg[field]?.[name]) delete pkg[field][name]
    }
    pkg.dependencies = { ...pkg.dependencies, "onejs-svelte": `^${own.version}`, svelte: own.peerDependencies.svelte }
    pkg.devDependencies = { ...pkg.devDependencies, "svelte-check": own.devDependencies["svelte-check"] }
    pkg.scripts = { ...pkg.scripts, typecheck: "svelte-check --tsconfig ./tsconfig.json" }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")
    changed.push("package.json")

    // The entry: index.tsx goes only if it is still the template's
    const tsx = path.join(dir, "index.tsx")
    if (fs.existsSync(tsx)) {
        if (untouched(dir, record, "index.tsx")) {
            fs.rmSync(tsx)
            changed.push("index.tsx (removed, it was the template's)")
        } else {
            manual.push("index.tsx has your changes, so it stays. It is no longer built: move what you need into Svelte components, then delete it.")
        }
    }
    for (const [file, text] of [["index.ts", INDEX_TS], ["App.svelte", APP_SVELTE], ["svelte.config.js", SVELTE_CONFIG]]) {
        if (fs.existsSync(path.join(dir, file))) {
            if (file === "index.ts") manual.push(`index.ts already exists, so it stays. It should mount a component: render(App, __root) from "onejs-svelte".`)
        } else {
            fs.writeFileSync(path.join(dir, file), text)
            changed.push(file)
        }
    }

    // esbuild.config.mjs
    const cfgPath = path.join(dir, "esbuild.config.mjs")
    const cfg = fs.existsSync(cfgPath) ? fs.readFileSync(cfgPath, "utf8") : null
    if (cfg?.includes("sveltePlugin")) {
        // already converted
    } else if (cfg === null || untouched(dir, record, "esbuild.config.mjs")) {
        fs.writeFileSync(cfgPath, ESBUILD_CONFIG)
        changed.push("esbuild.config.mjs")
    } else {
        manual.push(`esbuild.config.mjs has your changes, so it stays. Add to it:
    import { sveltePlugin } from "onejs-svelte/esbuild"
    entry: "index.ts",
    tailwind: { content: ["./**/*.{svelte,ts,js}"] },
    plugins: [sveltePlugin()],`)
    }

    // tsconfig.json: Svelte's types and the UI Toolkit tags, not React's
    const tsPath = path.join(dir, "tsconfig.json")
    if (fs.existsSync(tsPath)) {
        try {
            const ts = JSON.parse(fs.readFileSync(tsPath, "utf8"))
            const o = (ts.compilerOptions ??= {})
            delete o.jsx
            if (o.paths) {
                delete o.paths["onejs-react"]
                delete o.paths["oj"]
                if (Object.keys(o.paths).length === 0) delete o.paths
            }
            const types = (o.types ?? []).filter((t) => t !== "react")
            for (const t of ["svelte", "onejs-svelte/elements"]) if (!types.includes(t)) types.push(t)
            o.types = types
            fs.writeFileSync(tsPath, JSON.stringify(ts, null, 2) + "\n")
            changed.push("tsconfig.json")
        } catch {
            manual.push(`tsconfig.json could not be read as JSON, so it stays. In compilerOptions, drop "jsx", and make "types" include "svelte" and "onejs-svelte/elements" instead of "react".`)
        }
    }

    // AGENTS.md: the scaffold's guide is React's; say what differs
    const agentsPath = path.join(dir, "AGENTS.md")
    if (fs.existsSync(agentsPath) && !fs.readFileSync(agentsPath, "utf8").includes(AGENTS_MARKER)) {
        if (untouched(dir, record, "AGENTS.md")) {
            fs.appendFileSync(agentsPath, AGENTS_SECTION)
            changed.push("AGENTS.md (a Svelte section added)")
        } else {
            manual.push("AGENTS.md has your changes, so it stays. Its rules are React's: tell your agent the entry is index.ts with render(App, __root) from onejs-svelte.")
        }
    }

    for (const c of changed) log(`  changed ${c}`)
    for (const m of manual) log(`  by hand: ${m}`)
    return { changed, manual }
}

