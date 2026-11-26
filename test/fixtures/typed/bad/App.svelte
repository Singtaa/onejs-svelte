<script lang="ts">
    let n = $state(0)
    const html = (node: HTMLInputElement) => { node.focus() }
</script>

<label text={n} />
<toggle onchange={(e) => { const s: string = e.value }} />
<slider lowValue="low" />
<button notAProp={1} />
<div class="web"></div>
<textfield use:html />
