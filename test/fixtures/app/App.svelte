<script lang="ts">
    import { untrack } from "svelte"
    import { writable } from "svelte/store"
    import Child from "./Child.svelte"

    let { start = 0 }: { start?: number } = $props()
    let count = $state(untrack(() => start))
    let doubled = $derived(count * 2)
    let effectRuns = $state(0)
    $effect(() => {
        count
        untrack(() => effectRuns++)
        return () => console.log("cleanup")
    })
    let text = $state("hello")
    let shared = $state(5)
    let show = $state(true)
    let rows = $state([1, 2, 3])
    let k = $state(0)
    let resolve!: (v: string) => void
    const p = new Promise<string>((r) => { resolve = r })
    ;(globalThis as any).__resolveAwait = (v: string) => resolve(v)
    const store = writable(10)
    const tip = (node: any, text: string) => { node.element.tooltip = text }
    const mark = (node: any) => { node.element.AddToClassList("attached") }
</script>

{#snippet badge(t: string)}<label name="snippet" text={`snippet ${t}`} />{/snippet}

<view class="panel" name="panel">
    <button name="inc" text={`count ${count}`} onclick={() => count++} />
    <label name="derived" text={`doubled ${doubled}`} />
    <label name="effect" text={`effect ${effectRuns}`} />
    <textfield name="field" value={text} onchange={(e: any) => text = e.value} />
    <label name="field-echo" text={`text ${text}`} />
    <Child bind:value={shared} />
    <label name="shared" text={`shared ${shared}`} />
    <button name="toggle-if" text="if" onclick={() => show = !show} />
    {#if show}<label name="if-yes" text="shown" />{:else}<label name="if-no" text="hidden" />{/if}
    <button name="add" text="add" onclick={() => rows.push(rows.length + 1)} />
    <button name="rev" text="rev" onclick={() => rows.reverse()} />
    <view name="rows">
        {#each rows as row (row)}<label text={`r${row}`} />{/each}
    </view>
    {#await p}<label name="await" text="pending" />{:then v}<label name="await" text={v} />{/await}
    <button name="key" text="key" onclick={() => k++} />
    {#key k}<label name="keyed" text={`key ${k}`} />{/key}
    <button name="store" text="store" onclick={() => store.update((n) => n + 1)} />
    <label name="store-echo" text={`store ${$store}`} />
    <view name="cls" class:active={count > 3} />
    <view name="sty" style:width={`${10 + count}px`} style="height: 7px" />
    <label name="interp">Count is {count}</label>
    <view name="action" use:tip={"from action"} {@attach mark} />
    {@render badge("ok")}
</view>

<style>
    .panel { padding: 12px; }
    .active { background-color: rgb(0, 200, 0); }
</style>
