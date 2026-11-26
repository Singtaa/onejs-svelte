<script lang="ts">
    let n = $state(0)
    let text = $state("")
    let on = $state(false)
    const grab = (node: { element: CS.UnityEngine.UIElements.VisualElement }) => { node.element.Focus() }
</script>

<view class="row" style="flex-grow: 1" name="root" pickingMode="Ignore">
    <label text={`n ${n}`} />
    <button text="inc" onclick={(e) => { n += e.x > 0 ? 1 : 1 }} />
    <textfield label="Name" value={text} onchange={(e) => text = e.value} use:grab />
    <toggle value={on} onchange={(e) => on = e.value} />
    <slider lowValue={0} highValue={10} value={n} onchange={(e) => n = e.value} />
    <scrollview><image /></scrollview>
</view>
