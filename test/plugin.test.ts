import { buildFixture } from "./harness"

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

    it("drops Svelte's HTML-only warnings", async () => {
        const { warnings } = await buildFixture("app")
        expect(warnings.filter((w) => /a11y|self-closing/i.test(w.text))).toEqual([])
    })
})
