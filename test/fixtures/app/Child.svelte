<script lang="ts">
    let { value = $bindable(0) }: { value?: number } = $props()
</script>
<button name="child-inc" text={`child ${value}`} onclick={() => value++} />
