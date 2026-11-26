// The tag types, as svelte-check reads them with the svelte.config.js init writes
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const bin = path.join(here, "..", "node_modules", "svelte-check", "bin", "svelte-check")

function check(name: string) {
    const dir = path.join(here, "fixtures", "typed", name)
    const r = spawnSync(process.execPath, [bin, "--workspace", dir, "--tsconfig", path.join(dir, "tsconfig.json"), "--output", "machine"], { encoding: "utf8" })
    const lines = r.stdout.split("\n")
    return {
        status: r.status,
        errors: lines.filter((l) => / ERROR /.test(l)).map((l) => l.replace(/^\d+ ERROR /, "")),
        warnings: lines.filter((l) => / WARNING /.test(l)),
    }
}

describe("tag types", () => {
    it("accept UI Toolkit tags, their properties and typed event data, with no HTML warnings", () => {
        const r = check("good")
        expect(r.errors).toEqual([])
        expect(r.warnings).toEqual([])
        expect(r.status).toBe(0)
    })

    it("catch a wrong property type and a wrong event value type", () => {
        const r = check("bad")
        expect(r.status).toBe(1)
        expect(r.errors).toEqual([
            `"App.svelte" 5:8 "Type 'number' is not assignable to type 'string'."`,
            `"App.svelte" 6:34 "Type 'boolean' is not assignable to type 'string'."`,
        ])
    })
})
