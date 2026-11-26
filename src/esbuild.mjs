/**
 * sveltePlugin(): the one esbuild plugin a OneJS app adds to compile .svelte.
 *
 *   import { oneJSConfig } from "onejs-unity/esbuild"
 *   import { sveltePlugin } from "onejs-svelte/esbuild"
 *   export default oneJSConfig({ entry: "index.ts", plugins: [sveltePlugin()] })
 *
 * It compiles each component against onejs-svelte's renderer, resolves Svelte's
 * custom-renderer build, and registers each component's scoped <style> as USS.
 * The editor gets Svelte's development build, with its warnings; a player build
 * (NODE_ENV=production, as OneJS builds one) gets the production one.
 */
import fs from "node:fs"
import path from "node:path"
import { compile } from "svelte/compiler"

// Svelte judges markup as HTML. UI Toolkit's <label> and <button> are not
// HTML's, so these say nothing true about a OneJS app.
const HTML_ONLY_WARNING = /^(a11y_|element_invalid_self_closing_tag$|attribute_invalid_property_name$|node_invalid_placement_ssr$)/

/**
 * Svelte's warningFilter for a OneJS app: false for the HTML-only warnings.
 * sveltePlugin applies it; svelte.config.js passes it to svelte-check and the
 * editor extension:
 *
 *   import { warningFilter } from "onejs-svelte/esbuild"
 *   export default { compilerOptions: { warningFilter } }
 *
 * @param {{ code: string }} warning
 */
export function warningFilter(warning) {
    return !HTML_ONLY_WARNING.test(warning.code)
}

/**
 * @param {{ dev?: boolean }} [options] `dev` overrides the NODE_ENV choice.
 * @returns {import("esbuild").Plugin}
 */
export function sveltePlugin(options = {}) {
    return {
        name: "onejs-svelte",
        setup(build) {
            const o = build.initialOptions
            const dev = options.dev ?? process.env.NODE_ENV !== "production"
            const conditions = ["svelte-custom-renderer", ...(dev ? ["development"] : [])]
            o.conditions = [...new Set([...(o.conditions ?? []), ...conditions])]
            o.resolveExtensions = [...new Set([...(o.resolveExtensions ?? [".tsx", ".ts", ".jsx", ".js", ".css", ".json"]), ".svelte"])]
            const root = o.absWorkingDir ?? process.cwd()

            build.onLoad({ filter: /\.svelte$/ }, async (args) => {
                const source = await fs.promises.readFile(args.path, "utf8")
                let out
                try {
                    out = compile(source, {
                        filename: args.path,
                        generate: "client",
                        dev,
                        css: "external",
                        experimental: { customRenderer: "onejs-svelte/renderer" },
                    })
                } catch (e) {
                    return { errors: [toMessage(e, args.path, source)] }
                }
                let contents = out.js.code
                if (out.css?.code) {
                    // Keyed by file, so a hot reload replaces the sheet rather than adding one
                    const key = path.relative(root, args.path).replace(/\\/g, "/")
                    contents += `\ncompileStyleSheet(${JSON.stringify(out.css.code)}, ${JSON.stringify(key)});\n`
                }
                return {
                    contents,
                    loader: "js",
                    resolveDir: path.dirname(args.path),
                    warnings: out.warnings.filter(warningFilter).map((w) => toMessage(w, args.path, source)),
                }
            })
        },
    }
}

function toMessage(e, file, source) {
    const start = e.start
    const lineText = start ? source.split("\n")[start.line - 1] : undefined
    return {
        text: (e.message ?? String(e)).split("\n")[0],
        location: start ? { file, line: start.line, column: start.column, lineText } : { file },
    }
}
