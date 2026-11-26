<script lang="ts">
    let n = $state(0)
</script>

<label text={n} />
<toggle onchange={(e) => { const s: string = e.value }} />
