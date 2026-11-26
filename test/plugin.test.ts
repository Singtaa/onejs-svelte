import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { buildDir, buildFixture } from "./harness"

const here = path.dirname(fileURLToPath(import.meta.url))

describe("sveltePlugin", () => {
    it("bundles no React: only Svelte and its dependencies, onejs-elements, onejs-svelte and the app", async () => {
        const { metafile } = await buildFixture("app")
        const packages = new Set(Object.keys(metafile.inputs).map((p) => {
            const m = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(p) ?? /(onejs-elements|onejs-svelte)\//.exec(p)
            return m ? m[1] : "app"
        }))
        // clsx and esm-env are Svelte's own dependencies
        const allowed = new Set(["app", "svelte", "clsx", "esm-env", "onejs-elements", "onejs-svelte"])
        expect([...packages].filter((p) => !allowed.has(p))).toEqual([])
        expect(packages.has("onejs-elements") && packages.has("svelte")).toBe(true)
    })

    it("resolves Svelte's custom-renderer build", async () => {
        const { metafile } = await buildFixture("app")
        expect(Object.keys(metafile.inputs).some((p) => p.includes("custom-renderer"))).toBe(true)
    })

    it("builds Svelte's development build when dev, the production one when not", async () => {
        const dev = await buildFixture("app", { dev: true })
        const prod = await buildFixture("app", { dev: false })
        expect(Object.keys(dev.metafile.inputs).some((p) => p.includes("esm-env/dev-browser") || p.includes("esm-env/true"))).toBe(true)
        expect(dev.code.length).toBeGreaterThan(prod.code.length)
    })

    it("bundles the app's Svelte only, when onejs-svelte is linked with a Svelte of its own", async () => {
        fs.mkdirSync(path.join(here, "out"), { recursive: true })
        const dir = fs.mkdtempSync(path.join(here, "out", "linked-"))
        try {
            fs.cpSync(path.join(here, "fixtures", "app"), dir, { recursive: true })
            fs.writeFileSync(path.join(dir, "package.json"), `{ "name": "linked-app", "private": true, "type": "module" }`)
            fs.mkdirSync(path.join(dir, "node_modules"))
            // The app's own copy; the linked onejs-svelte resolves to this package, with its own
            fs.cpSync(path.join(here, "..", "node_modules", "svelte"), path.join(dir, "node_modules", "svelte"), { recursive: true })
            fs.symlinkSync(path.join(here, ".."), path.join(dir, "node_modules", "onejs-svelte"), "junction")
            const { metafile } = await buildDir(dir)
            const svelteFiles = Object.keys(metafile.inputs).filter((p) => /node_modules\/svelte\//.test(p))
            expect(svelteFiles.length).toBeGreaterThan(0)
            expect(svelteFiles.filter((p) => !p.startsWith("node_modules/svelte/"))).toEqual([])
        } finally {
            fs.rmSync(dir, { recursive: true, force: true })
        }
    })

    it("drops Svelte's HTML-only warnings", async () => {
        const { warnings } = await buildFixture("app")
        expect(warnings.filter((w) => /a11y|self-closing/i.test(w.text))).toEqual([])
    })
})
