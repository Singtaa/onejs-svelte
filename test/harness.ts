// Builds a fixture app with the real sveltePlugin and runs its bundle against
// onejs-elements' UI Toolkit mocks, the way JSRunner runs it in QuickJS.
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import * as esbuild from "esbuild"
import { installMockRuntime, createMockContainer, getCreatedElements, flushMicrotasks, type MockVisualElement } from "onejs-elements/testing"
import { sveltePlugin } from "../src/esbuild.mjs"
import { scaffoldHash } from "../src/init.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))

export async function buildFixture(name: string, { dev = false } = {}) {
    return buildDir(path.join(here, "fixtures", name), { dev })
}

/** Builds `dir`'s index.ts; "onejs-svelte" and Svelte must resolve from `dir`. */
export async function buildDir(dir: string, { dev = false } = {}) {
    const result = await esbuild.build({
        absWorkingDir: dir,
        entryPoints: ["index.ts"],
        bundle: true,
        write: false,
        format: "iife",
        globalName: "__exports",
        target: "es2022",
        logLevel: "silent",
        metafile: true,
        plugins: [sveltePlugin({ dev })],
    })
    return { code: result.outputFiles[0].text, warnings: result.warnings, metafile: result.metafile }
}

export interface Running {
    root: MockVisualElement
    sheets: [string, string][]
    teardown(): void
    byName(name: string): any
    fire(el: unknown, type: string, data?: object): Promise<void>
    logs: unknown[][]
}

export async function runBundle(code: string): Promise<Running> {
    installMockRuntime()
    const g = globalThis as any
    const root = createMockContainer()
    const sheets: [string, string][] = []
    const teardowns: (() => void)[] = []
    const logs: unknown[][] = []
    g.__root = root
    g.compileStyleSheet = (css: string, name: string) => { sheets.push([css, name]); return true }
    g.__onTeardown = (cb: () => void) => teardowns.push(cb)
    const realLog = console.log
    console.log = (...a: unknown[]) => { logs.push(a) }
    try {
        new Function(code)()
        await flushMicrotasks()
    } finally {
        console.log = realLog
    }
    const api = g.__eventAPI
    return {
        root, sheets, logs,
        teardown() {
            console.log = (...a: unknown[]) => { logs.push(a) }
            try { for (const cb of teardowns) cb() } finally { console.log = realLog }
        },
        byName(name) {
            const found = getCreatedElements().filter((e: any) => e.name === name && isAttached(e, root))
            if (found.length !== 1) throw new Error(`${found.length} attached elements named ${name}`)
            return found[0]
        },
        async fire(el, type, data = {}) {
            const calls = api.addEventListener.mock.calls.filter((c: unknown[]) => c[0] === el && c[1] === type)
            const removed = new Set(api.removeEventListener.mock.calls.filter((c: unknown[]) => c[0] === el && c[1] === type).map((c: unknown[]) => c[2]))
            const live = calls.map((c: unknown[]) => c[2] as Function).filter((f: Function) => !removed.has(f))
            if (live.length === 0) throw new Error(`no ${type} handler on ${(el as any).name}`)
            for (const f of live) f(data)
            await flushMicrotasks()
        },
    }
}

export function isAttached(el: MockVisualElement, root: MockVisualElement): boolean {
    let p: MockVisualElement | null = el
    while (p) {
        if (p === root) return true
        p = (p as any)._parent ?? null
    }
    return false
}

const TEMPLATE_FILES = ["package.json", "tsconfig.json", "esbuild.config.mjs", "index.tsx", "AGENTS.md"]

/**
 * A ~ folder as Initialize Project leaves it: the templates, and the record
 * JSRunner keeps. In `parent` when it must resolve this package's node_modules.
 */
export function scaffold(parent = os.tmpdir()): string {
    const dir = fs.mkdtempSync(path.join(parent, "onejs-svelte-init-"))
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
