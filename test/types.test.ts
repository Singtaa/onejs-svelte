// The tag types, as svelte-check reads them in an app init made: the tsconfig.json
// and svelte.config.js init writes, and this package installed in its node_modules.
// The app's other packages (svelte, unity-types, onejs-unity) resolve from this
// package's own node_modules above it, as they would from the app's.
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { init } from "../src/init.mjs"
import { scaffold } from "./harness"

const here = path.dirname(fileURLToPath(import.meta.url))
const bin = path.join(here, "..", "node_modules", "svelte-check", "bin", "svelte-check")
const out = path.join(here, "out")
fs.mkdirSync(out, { recursive: true })
let dir: string
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

function check(name: string) {
    dir = scaffold(out)
    init(dir, { log: () => {} })
    fs.copyFileSync(path.join(here, "fixtures", "typed", name, "App.svelte"), path.join(dir, "App.svelte"))
    fs.mkdirSync(path.join(dir, "node_modules"))
    fs.symlinkSync(path.join(here, ".."), path.join(dir, "node_modules", "onejs-svelte"), "junction")
    const r = spawnSync(process.execPath, [bin, "--workspace", dir, "--tsconfig", path.join(dir, "tsconfig.json"), "--output", "machine"], { encoding: "utf8" })
    const lines = r.stdout.split("\n")
    return {
        status: r.status,
        files: Number(/COMPLETED (\d+) FILES/.exec(r.stdout)?.[1]),
        // A message's first line, without its closing quote when it had more: the
        // elaboration below counts lib.dom's members, which a TypeScript release changes
        errors: lines.filter((l) => / ERROR /.test(l)).map((l) => l.replace(/^\d+ ERROR /, "").replace(/\\n.*$/, "")),
        warnings: lines.filter((l) => / WARNING /.test(l)),
    }
}

describe("tag types", () => {
    it("accept UI Toolkit tags, their properties, typed event data and an action's node, with no HTML warnings", () => {
        const r = check("good")
        expect(r.errors).toEqual([])
        expect(r.warnings).toEqual([])
        expect(r.files).toBeGreaterThan(0)
        expect(r.status).toBe(0)
    })

    it("catch a wrong property type, a wrong event value type, a camelCase prop's type, an unknown prop, an HTML tag, an HTML action and the image src that only onejs-react's component reads", () => {
        const r = check("bad")
        expect(r.status).toBe(1)
        expect(r.errors).toEqual([
            `"App.svelte" 6:8 "Type 'number' is not assignable to type 'string'."`,
            `"App.svelte" 7:34 "Type 'boolean' is not assignable to type 'string'."`,
            `"App.svelte" 8:9 "Type 'string' is not assignable to type 'number'."`,
            `"App.svelte" 9:9 "Object literal may only specify known properties, and '\\"notaprop\\"' does not exist in type 'Checked<TextAttributes>'."`,
            `"App.svelte" 10:1 "Argument of type '\\"div\\"' is not assignable to parameter of type 'keyof IntrinsicElements | null | undefined'."`,
            `"App.svelte" 11:20 "Argument of type 'OneJSNode' is not assignable to parameter of type 'HTMLInputElement'.`,
            // onejs-react's <Image src> loads a file; the tag takes the loaded image, so src would be set and ignored.
            // The message spells out the whole tag type, so only its start is held.
            expect.stringMatching(/^"App\.svelte" 12:8 "Object literal may only specify known properties, and '\\"src\\"' does not exist in type 'Checked<OneJSElementAttributes & \{ image\?/),
        ])
    })
})
