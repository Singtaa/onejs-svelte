#!/usr/bin/env node
// npx onejs-svelte init [--no-install]: see init.mjs for what it changes.
import { spawnSync } from "node:child_process"
import { init } from "./init.mjs"

function main(argv) {
    const [command, ...rest] = argv
    if (command !== "init") {
        console.log("Usage: npx onejs-svelte init [--no-install]\n\nRun it in a JSRunner's ~ folder to make that app a Svelte app.")
        return command ? 2 : 0
    }
    const dir = process.cwd()
    console.log(`onejs-svelte: making ${dir} a Svelte app`)
    let result
    try {
        result = init(dir)
    } catch (e) {
        console.error(`onejs-svelte: ${e.message}`)
        return 1
    }
    if (!rest.includes("--no-install")) {
        const npm = process.platform === "win32" ? "npm.cmd" : "npm"
        const r = spawnSync(npm, ["install"], { cwd: dir, stdio: "inherit", shell: process.platform === "win32" })
        if (r.status !== 0) {
            console.error("onejs-svelte: npm install failed; run it again in this folder.")
            return 1
        }
        const b = spawnSync(npm, ["run", "build"], { cwd: dir, stdio: "inherit", shell: process.platform === "win32" })
        if (b.status !== 0) {
            console.error("onejs-svelte: the first build failed; fix what it says, then npm run build.")
            return 1
        }
    }
    if (result.manual.length) console.log("onejs-svelte: done, with the steps above left to you.")
    else console.log("onejs-svelte: done. Unity reloads the app from the new bundle.")
    console.log("If the Unity editor is open, its watcher still builds with the old config: enter and leave Play mode once to restart it.")
    return 0
}

process.exitCode = main(process.argv.slice(2))
