import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { getCreatedElements } from "onejs-elements/testing"
import { init, scaffoldHash } from "../src/init.mjs"
import { buildDir, runBundle } from "./harness"

const here = path.dirname(fileURLToPath(import.meta.url))
fs.mkdirSync(path.join(here, "out"), { recursive: true })
const TEMPLATE_FILES = ["package.json", "tsconfig.json", "esbuild.config.mjs", "index.tsx", "AGENTS.md"]
const quiet = { log: () => {} }

// A ~ folder as Initialize Project leaves it: the templates, and the record JSRunner keeps
function scaffold(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "onejs-svelte-init-"))
    const lines: string[] = []
    for (const f of TEMPLATE_FILES) {
        const text = fs.readFileSync(path.join(here, "fixtures", "scaffold", f), "utf8")
        fs.writeFileSync(path.join(dir, f), text)
        lines.push(`${f}\t${scaffoldHash(text)}`)
    }
    fs.mkdirSync(path.join(dir, ".onejs"))
    fs.writeFileSync(path.join(dir, ".onejs", "scaffold"), lines.sort().join("\n") + "\n")
    return dir
}

const read = (dir: string, f: string) => fs.readFileSync(path.join(dir, f), "utf8")
const json = (dir: string, f: string) => JSON.parse(read(dir, f))
let dir: string
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe("init on a fresh scaffold", () => {
    beforeEach(() => { dir = scaffold() })

    it("leaves nothing by hand", () => {
        expect(init(dir, quiet).manual).toEqual([])
    })

    it("swaps React's packages for Svelte's", () => {
        init(dir, quiet)
        const pkg = json(dir, "package.json")
        const all = { ...pkg.dependencies, ...pkg.devDependencies }
        for (const name of ["react", "onejs-react", "onejs-ui", "ojplay", "@types/react", "@types/react-reconciler"]) expect(all[name]).toBeUndefined()
        expect(pkg.dependencies["onejs-svelte"]).toMatch(/^\^\d/)
        expect(pkg.dependencies.svelte).toBe("5.59.2")
        expect(pkg.dependencies["onejs-unity"]).toBeDefined()
        expect(pkg.scripts.build).toBe("onejs-unity build")
        expect(pkg.scripts.typecheck).toMatch(/^svelte-check/)
    })

    it("gives the app the TypeScript svelte-check takes, in place of the template's 7", () => {
        expect(json(dir, "package.json").devDependencies.typescript).toBe("^7.0.0")
        init(dir, quiet)
        const own = json(path.join(here, ".."), "package.json")
        expect(json(dir, "package.json").devDependencies.typescript).toBe(own.devDependencies.typescript)
        const peer = json(path.join(here, "..", "node_modules", "svelte-check"), "package.json").peerDependencies.typescript
        expect(peer).toContain(`^${own.devDependencies.typescript.match(/\d+/)[0]}.`)
    })

    it("replaces index.tsx with index.ts and App.svelte", () => {
        init(dir, quiet)
        expect(fs.existsSync(path.join(dir, "index.tsx"))).toBe(false)
        expect(read(dir, "index.ts")).toContain("render(App, __root)")
        expect(read(dir, "App.svelte")).toContain("$state")
        expect(read(dir, "svelte.config.js")).toContain("warningFilter")
    })

    it("writes the plugin and the Tailwind content into esbuild.config.mjs", () => {
        init(dir, quiet)
        const cfg = read(dir, "esbuild.config.mjs")
        expect(cfg).toContain(`import { sveltePlugin } from "onejs-svelte/esbuild"`)
        expect(cfg).toContain(`entry: "index.ts"`)
        expect(cfg).toContain(`tailwind: { content: ["./**/*.{svelte,ts,js}"] }`)
    })

    it("points tsconfig at Svelte's types and the UI Toolkit tags", () => {
        init(dir, quiet)
        const o = json(dir, "tsconfig.json").compilerOptions
        expect(o.jsx).toBeUndefined()
        expect(o.paths).toBeUndefined()
        expect(o.types).toEqual(["unity-types", "onejs-unity/globals", "svelte", "onejs-svelte/elements"])
    })

    it("adds a Svelte section to AGENTS.md", () => {
        init(dir, quiet)
        expect(read(dir, "AGENTS.md")).toContain("## This app is Svelte, not React")
    })

    it("changes nothing more on a second run", () => {
        init(dir, quiet)
        const before = Object.fromEntries(fs.readdirSync(dir).filter((f) => f !== ".onejs").map((f) => [f, read(dir, f)]))
        const second = init(dir, quiet)
        const after = Object.fromEntries(fs.readdirSync(dir).filter((f) => f !== ".onejs").map((f) => [f, read(dir, f)]))
        expect(after).toEqual(before)
        expect(second.manual.map((m) => m.split(" ")[0])).toEqual(["index.ts"])
    })
})

describe("the app init writes", () => {
    it("builds, mounts and counts clicks", async () => {
        dir = fs.mkdtempSync(path.join(here, "out", "init-"))
        const fresh = scaffold()
        fs.cpSync(fresh, dir, { recursive: true })
        fs.rmSync(fresh, { recursive: true })
        init(dir, quiet)
        // What npm install gives the app; Svelte itself resolves from this package's node_modules above
        fs.mkdirSync(path.join(dir, "node_modules"))
        fs.symlinkSync(path.join(here, ".."), path.join(dir, "node_modules", "onejs-svelte"), "junction")
        const { code } = await buildDir(dir)
        const app = await runBundle(code)
        const labels = getCreatedElements().filter((e: any) => e.__csType.endsWith(".Label"))
        expect(labels.map((l: any) => l.text)).toContain("Hello from Svelte")
        const button = getCreatedElements().find((e: any) => e.__csType.endsWith(".Button"))!
        await app.fire(button, "click")
        expect((button as any).text).toBe("Clicked 1 times")
        expect(app.sheets.map(([, name]) => name)).toEqual(["App.svelte"])
    })
})

describe("init on an app with your changes", () => {
    beforeEach(() => {
        dir = scaffold()
        fs.appendFileSync(path.join(dir, "index.tsx"), "\n// mine\n")
        fs.writeFileSync(path.join(dir, "esbuild.config.mjs"), read(dir, "esbuild.config.mjs").replace("export default", "// mine\nexport default"))
        fs.appendFileSync(path.join(dir, "AGENTS.md"), "\nmine\n")
    })

    it("keeps each changed file and says what to do instead", () => {
        const { manual } = init(dir, quiet)
        expect(read(dir, "index.tsx")).toContain("// mine")
        expect(read(dir, "esbuild.config.mjs")).toContain("// mine")
        expect(read(dir, "AGENTS.md")).not.toContain("This app is Svelte")
        expect(manual.map((m) => m.split(" ")[0])).toEqual(["index.tsx", "esbuild.config.mjs", "AGENTS.md"])
        expect(manual[1]).toContain("plugins: [sveltePlugin()]")
    })

    it("still writes the new files", () => {
        init(dir, quiet)
        expect(fs.existsSync(path.join(dir, "index.ts"))).toBe(true)
        expect(fs.existsSync(path.join(dir, "App.svelte"))).toBe(true)
    })

    it("leaves a file alone when there is no scaffold record", () => {
        fs.rmSync(path.join(dir, ".onejs"), { recursive: true })
        fs.writeFileSync(path.join(dir, "esbuild.config.mjs"), fs.readFileSync(path.join(here, "fixtures", "scaffold", "esbuild.config.mjs")))
        init(dir, quiet)
        expect(read(dir, "esbuild.config.mjs")).not.toContain("sveltePlugin")
    })
})

describe("the onejs-svelte command", () => {
    const cli = path.join(here, "..", "src", "cli.mjs")
    const run = (args: string[], cwd: string) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" })

    it("exits 1 where there is no package.json", () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "onejs-svelte-init-"))
        const r = run(["init", "--no-install"], dir)
        expect(r.status).toBe(1)
        expect(r.stderr).toContain("No package.json")
    })

    it("exits 2 on an unknown command", () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "onejs-svelte-init-"))
        expect(run(["nope"], dir).status).toBe(2)
    })

    it("converts with init --no-install and exits 0", () => {
        dir = scaffold()
        const r = run(["init", "--no-install"], dir)
        expect(r.status).toBe(0)
        expect(fs.existsSync(path.join(dir, "App.svelte"))).toBe(true)
    })
})
