// What Svelte compiles against onejs-svelte's renderer and what it refuses.
// The refusals are Svelte's own for every custom renderer: when one starts
// compiling, a Svelte release has added it, and the docs should say so.
import { compile } from "svelte/compiler"

const options = { filename: "/app/T.svelte", generate: "client" as const, css: "external" as const, experimental: { customRenderer: "onejs-svelte/renderer" } }
const tryCompile = (source: string) => { try { compile(source, options); return "ok" } catch (e: any) { return e.code ?? e.message } }

describe("compiles", () => {
    it.each([
        ["runes", `<script>let { a = 0 } = $props(); let n = $state(a); let d = $derived(n * 2); $effect(() => { d })</script><label text={"" + d} />`],
        ["event attributes", `<script>let n = $state(0)</script><button onclick={() => n++} />`],
        ["bind: on a component", `<script>import C from "./C.svelte"; let v = $state(1)</script><C bind:value={v} />`],
        ["if, each, await, key", `<script>let a = $state(true); let xs = $state([1]); let p = Promise.resolve(1)</script>{#if a}<view />{/if}{#each xs as x (x)}<view />{/each}{#await p}<view />{:then v}<view />{/await}{#key a}<view />{/key}`],
        ["snippets", `{#snippet row(t)}<label text={t} />{/snippet}{@render row("x")}`],
        ["use: and {@attach}", `<script>const act = (n) => {}; const at = (n) => {}</script><view use:act {@attach at} />`],
        ["class: and style:", `<script>let on = $state(true)</script><view class:active={on} style:width="10px" />`],
        ["scoped and :global styles", `<view class="a" /><style>.a { flex-grow: 1 } :global(.b) { flex-grow: 2 }</style>`],
        ["stores", `<script>import { writable } from "svelte/store"; const s = writable(0)</script><label text={"" + $s} />`],
        ["TypeScript", `<script lang="ts">let n: number = $state(0)</script><label text={"" + n} />`],
        ["<svelte:element> and <svelte:boundary>", `<svelte:boundary><svelte:element this={"view"} /></svelte:boundary>`],
    ])("%s", (_, source) => {
        expect(tryCompile(source)).toBe("ok")
    })
})

describe("refuses", () => {
    it.each([
        ["bind:value on an element", `<script>let v = $state("")</script><textfield bind:value={v} />`],
        ["bind:this", `<script>let el</script><view bind:this={el} />`],
        ["transition:", `<script>import { fade } from "svelte/transition"; let a = $state(true)</script>{#if a}<view transition:fade />{/if}`],
        ["in: and out:", `<script>import { fly } from "svelte/transition"; let a = $state(true)</script>{#if a}<view in:fly />{/if}`],
        ["animate:", `<script>import { flip } from "svelte/animate"; let xs = $state([1])</script>{#each xs as x (x)}<view animate:flip />{/each}`],
        ["on:click", `<button on:click={() => {}} />`],
        ["{@html}", `{@html "<b>x</b>"}`],
        ["out:", `<script>import { fade } from "svelte/transition"; let a = $state(true)</script>{#if a}<view out:fade />{/if}`],
        ["<svelte:window>", `<svelte:window onkeydown={() => {}} />`],
        ["<svelte:head>", `<svelte:head><title>x</title></svelte:head>`],
        ["<svelte:body>", `<svelte:body onclick={() => {}} />`],
        ["<svelte:document>", `<svelte:document onclick={() => {}} />`],
    ])("%s", (_, source) => {
        expect(tryCompile(source)).toBe("incompatible_with_custom_renderer")
    })
})
