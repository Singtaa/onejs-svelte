// render(App, __root): mounts a Svelte component on a OneJS root, and unmounts
// it when the JS context is torn down (a hot reload, the runner disabled), so
// $effect cleanups run then, as React's effect cleanups do.
import { mount, unmount, type Component } from "svelte"
import renderer, { rootNode } from "./renderer"

declare const __onTeardown: ((cb: () => void) => void) | undefined

export function render<Props extends Record<string, any>>(
    component: Component<Props>,
    root: { Clear(): void },
    props?: Props,
): Record<string, any> {
    root.Clear()
    const app = mount(component as Component<any>, { target: rootNode(root), renderer, props: props ?? {} } as any)
    if (typeof __onTeardown === "function") __onTeardown(() => unmount(app))
    return app
}
