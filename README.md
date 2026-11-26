# onejs-svelte

Svelte 5 for [OneJS](https://onejs.com): Svelte components rendered to Unity's
UI Toolkit. No React is installed or bundled. Elements are made by
[onejs-elements](https://github.com/Singtaa/onejs-elements), the same code
onejs-react uses, so a `<label>` here is the `Label` a React app gets.

## Start

In a JSRunner's `~` folder, after Initialize Project:

```bash
npx onejs-svelte init
```

It swaps the React packages for Svelte's, writes `index.ts`, `App.svelte` and
`svelte.config.js`, adds the plugin to `esbuild.config.mjs`, points
`tsconfig.json` at the UI Toolkit tag types, runs `npm install` and the first
build. A file you changed after OneJS wrote it is left alone, and init prints
what to change by hand. By hand, the whole setup is:

```js
// esbuild.config.mjs
import { oneJSConfig } from "onejs-unity/esbuild"
import { sveltePlugin } from "onejs-svelte/esbuild"

export default oneJSConfig({
    entry: "index.ts",
    tailwind: { content: ["./**/*.{svelte,ts,js}"] },
    plugins: [sveltePlugin()],
})
```

```ts
// index.ts
import { render } from "onejs-svelte"
import App from "./App.svelte"

render(App, __root)
```

```svelte
<!-- App.svelte -->
<script lang="ts">
    let count = $state(0)
</script>

<view class="app">
    <button text={`Clicked ${count} times`} onclick={() => count++} />
</view>

<style>
    .app { flex-grow: 1; padding: 24px; }
</style>
```

## What works

Runes, components and their `bind:` props, `{#if}`, keyed `{#each}`,
`{#await}`, `{#key}`, snippets, `use:` actions, `{@attach}`, `class:`,
`style:`, scoped `<style>` (registered as USS), stores, TypeScript, Tailwind
classes, and hot reload (state resets; `$effect` cleanups run).

Tags are onejs-react's without `ojs-`: `view`, `text`, `label`, `button`,
`textfield`, `toggle`, `slider`, `scrollview`, `image`, `listview`, `treeview`,
`frostedglass`, and any tag `registerElement` added. An event attribute is the
bridge's event name after `on` (`onclick`, `onpointerdown`, `onchange`); a
field's `onchange` carries `{ value }`.

Svelte refuses these for every custom renderer, as compile errors:
`bind:` on an element (`bind:value`, `bind:this`), `transition:`, `in:`,
`out:`, `animate:`, `on:click`, `{@html}`, and `<svelte:window>`, `<svelte:head>`,
`<svelte:body>`, `<svelte:document>`. Two-way binding on a field is
`value={v} onchange={(e) => v = e.value}`.

onejs-unity's `assets`, `audio`, `interop`, `sl` and `physics2d` work. Its
`.`, `input`, `gpu`, `fx` and `proc` are React hooks and need React.

## Svelte version

Svelte's custom renderer is experimental: it first shipped in 5.59.0, and a
Svelte patch may change it. So the `svelte` peer dependency is exact, the
version this package was tested with, and `.github/workflows/nightly.yml` runs
the suite against `svelte@latest` every night.

## Files

| File | Purpose |
|------|---------|
| `src/renderer.ts` | Svelte's `Renderer` onto onejs-elements. A JS shadow tree holds Svelte's fragments and comment anchors, which UI Toolkit has no node for; elements and text attach beside their nearest real sibling |
| `src/index.ts` | `render(App, root, props?)`: mount, and unmount on the context's teardown |
| `src/esbuild.mjs` | `sveltePlugin()` and `warningFilter`: compile `.svelte` against the renderer, the `svelte-custom-renderer` and (in the editor) `development` conditions, scoped CSS to `compileStyleSheet` |
| `src/elements.d.ts` | `svelteHTML.IntrinsicElements` for the UI Toolkit tags, so svelte-check types them (`"types": ["svelte", "onejs-svelte/elements"]`) |
| `src/init.mjs`, `src/cli.mjs` | `npx onejs-svelte init` |

## Testing

```bash
npm test          # vitest: render, compile matrix, plugin, tag types, init
npm run typecheck
npm run lint
```

`test/render.test.ts` builds `test/fixtures/app` with the real plugin and runs
the bundle against onejs-elements' UI Toolkit mocks. The OneJS container runs
the same app in a Unity editor (its `SvelteChecks` PlayMode test).

## Releasing

Bump `package.json`, push `main`, wait for CI, then push a tag `v<version>`:
`.github/workflows/publish.yml` publishes through npm trusted publishing, so no
token exists anywhere. 0.1.0 was published by hand, because npm attaches a
trusted publisher only to a package that already exists.

In the OneJS container this package is checked out at `JSModules/onejs-svelte`
and links onejs-elements and unity-types with `file:../` dev dependencies
beside their `^` ranges.
