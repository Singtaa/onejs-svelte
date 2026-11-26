// A Svelte app end to end: built with sveltePlugin, run against the UI Toolkit
// mocks. The same checks run on a real editor in the container's SvelteChecks
// scene; this is the part Node can answer.
import { buildFixture, runBundle, type Running } from "./harness"

let app: Running
const text = (name: string) => app.byName(name).text

beforeEach(async () => {
    const { code } = await buildFixture("app")
    app = await runBundle(code)
})

describe("render", () => {
    it("mounts into __root with props", () => {
        expect(app.root.childCount).toBe(1)
        expect(text("inc")).toBe("count 3")
        expect(text("derived")).toBe("doubled 6")
    })

    it("runs runes: $state, $derived and $effect", async () => {
        await app.fire(app.byName("inc"), "click")
        expect(text("inc")).toBe("count 4")
        expect(text("derived")).toBe("doubled 8")
        expect(text("effect")).toBe("effect 2")
        expect(text("interp")).toBe("Count is 4")
    })

    it("takes a value back through onchange", async () => {
        await app.fire(app.byName("field"), "change", { value: "typed" })
        expect(text("field-echo")).toBe("text typed")
        expect(app.byName("field").value).toBe("typed")
    })

    it("binds a component prop both ways", async () => {
        await app.fire(app.byName("child-inc"), "click")
        expect(text("shared")).toBe("shared 6")
        expect(text("child-inc")).toBe("child 6")
    })

    it("swaps an if block", async () => {
        expect(text("if-yes")).toBe("shown")
        await app.fire(app.byName("toggle-if"), "click")
        expect(text("if-no")).toBe("hidden")
        expect(() => app.byName("if-yes")).toThrow()
    })

    it("keeps a keyed each in order through adds and moves", async () => {
        const rows = () => app.byName("rows").children.map((c: any) => c.text)
        expect(rows()).toEqual(["r1", "r2", "r3"])
        await app.fire(app.byName("add"), "click")
        await app.fire(app.byName("rev"), "click")
        expect(rows()).toEqual(["r4", "r3", "r2", "r1"])
    })

    it("moves an element without dropping its listeners", async () => {
        const before = app.byName("rows").children.map((c: any) => c)
        await app.fire(app.byName("rev"), "click")
        const after = app.byName("rows").children.map((c: any) => c)
        expect(after).toEqual([...before].reverse())
        const api = (globalThis as any).__eventAPI
        expect(api.removeAllEventListeners).not.toHaveBeenCalled()
    })

    it("resolves an await block", async () => {
        expect(text("await")).toBe("pending")
        ;(globalThis as any).__resolveAwait("resolved")
        await new Promise((r) => setTimeout(r, 0))
        await app.fire(app.byName("key"), "click")
        expect(text("await")).toBe("resolved")
    })

    it("recreates a key block", async () => {
        const first = app.byName("keyed")
        await app.fire(app.byName("key"), "click")
        expect(text("keyed")).toBe("key 1")
        expect(app.byName("keyed")).not.toBe(first)
    })

    it("follows a store", async () => {
        await app.fire(app.byName("store"), "click")
        expect(text("store-echo")).toBe("store 11")
    })

    it("applies class: and style: directives", async () => {
        const cls = app.byName("cls")
        expect(cls.ClassListContains("active")).toBe(false)
        await app.fire(app.byName("inc"), "click")
        expect(cls.ClassListContains("active")).toBe(true)
        const sty = app.byName("sty")
        expect([...sty.classList].some((c: string) => c.startsWith("svelte-"))).toBe(false)
        expect(cls.ClassListContains(scopeClass())).toBe(true)
    })

    it("merges style= with style: and gives unitless values as numbers", async () => {
        const sty = app.byName("sty")
        expect(sty.style.height).toEqual({ value: 7, unit: 0 })
        expect(sty.style.width).toEqual({ value: 13, unit: 0 })
        expect(sty.style.flexShrink).toBe(0)
        expect(sty.style.opacity).toBe(0.5)
        await app.fire(app.byName("inc"), "click")
        expect(sty.style.width).toEqual({ value: 14, unit: 0 })
        expect(sty.style.height).toEqual({ value: 7, unit: 0 })
    })

    it("hands a use: action and an {@attach} the node, whose element is the VisualElement", () => {
        const el = app.byName("action")
        expect(el.tooltip).toBe("from action")
        expect(el.ClassListContains("attached")).toBe(true)
    })

    it("renders a snippet", () => {
        expect(text("snippet")).toBe("snippet ok")
    })

    it("registers each component's scoped style as USS, keyed by file", () => {
        expect(app.sheets).toHaveLength(1)
        const [css, name] = app.sheets[0]
        expect(name).toBe("App.svelte")
        expect(css).toContain(`.panel.${scopeClass()}`)
        expect(app.byName("panel").ClassListContains(scopeClass())).toBe(true)
    })

    it("runs $effect cleanups on teardown", () => {
        app.teardown()
        expect(app.logs.some((l) => l[0] === "cleanup")).toBe(true)
    })
})

function scopeClass(): string {
    const m = /\.panel\.(svelte-[a-z0-9]+)/.exec(app.sheets[0][0])
    if (!m) throw new Error("no scope class in the sheet")
    return m[1]
}
