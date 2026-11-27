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
        // Svelte's DEV is esm-env's, which re-exports it from "esm-env/development":
        // true.js, false.js, or dev-fallback.js reading NODE_ENV at run time
        const devFlag = (m: typeof dev.metafile) => {
            const index = Object.entries(m.inputs).find(([p]) => p.endsWith("esm-env/index.js"))![1]
            return index.imports.find((i) => i.original === "esm-env/development")!.path.split("/").pop()
        }
        expect(devFlag(dev.metafile)).toBe("true.js")
        expect(devFlag(prod.metafile)).toBe("false.js")
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

    describe("names what to write instead of what Svelte refuses", () => {
        const refused = async (markup: string) => {
            const dir = fs.mkdtempSync(path.join(here, "out", "refused-"))
            try {
                fs.writeFileSync(path.join(dir, "index.ts"), `import { render } from "onejs-svelte"\nimport App from "./App.svelte"\nrender(App, __root)\n`)
                fs.writeFileSync(path.join(dir, "App.svelte"), `<script lang="ts">\n    let v = $state("")\n    const go = () => {}\n</script>\n\n${markup}\n`)
                await buildDir(dir)
                throw new Error("built")
            } catch (e: any) {
                if (!e.errors) throw e
                return e.errors[0] as { text: string, notes: { text: string }[] }
            } finally {
                fs.rmSync(dir, { recursive: true, force: true })
            }
        }

        it("bind:value on a field", async () => {
            const error = await refused(`<textfield bind:value={v} />`)
            expect(error.text).toContain("`bind:` is not compatible with `customRenderer`")
            expect(error.notes.map((n) => n.text).join("\n")).toContain("value={v} onchange={(e) => v = e.value}")
        })

        it("transition:, in: and out:", async () => {
            for (const directive of ["transition", "in", "out"]) {
                const error = await refused(`<script lang="ts" module>import { fade } from "svelte/transition"</script>\n<label text="Hi" ${directive}:fade />`)
                expect(error.text).toContain(`\`${directive}:\` is not compatible with \`customRenderer\``)
                expect(error.notes.map((n) => n.text).join("\n")).toContain("transition-property: opacity")
            }
        })

        it("on:click", async () => {
            const error = await refused(`<button text="Go" on:click={go} />`)
            expect(error.text).toContain("`on:` is not compatible with `customRenderer`")
            expect(error.notes.map((n) => n.text).join("\n")).toContain("onclick={...}")
        })
    })

    it("drops Svelte's HTML-only warnings", async () => {
        const { warnings } = await buildFixture("app")
        expect(warnings.filter((w) => /a11y|self-closing/i.test(w.text))).toEqual([])
    })
})
