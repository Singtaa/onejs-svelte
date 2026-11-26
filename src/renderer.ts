// Svelte's custom renderer onto UI Toolkit. Elements, props, styles, classes,
// text merging and children go through onejs-elements, the element operations
// onejs-react uses too. What is new here is a JS shadow tree: Svelte walks
// first child and next sibling and anchors blocks on comment nodes, which UI
// Toolkit has no node for, so comments and fragments live only in JS and each
// element or text node is attached beside its nearest real sibling.
import { createRenderer } from "svelte/renderer"
import { hostConfig, type Instance } from "onejs-elements/host-config"

declare const __eventAPI: {
    addEventListener(el: unknown, type: string, fn: Function): void
    removeEventListener(el: unknown, type: string, fn: Function): void
}

type Kind = "fragment" | "element" | "text" | "comment"

/**
 * The renderer's node. A `use:` action or an `{@attach}` receives one: its
 * `element` is the UI Toolkit VisualElement (or TextElement for text).
 */
export interface Node {
    kind: Kind
    parent: Node | null
    children: Node[]
    /** The C# element, for an element or text node */
    element?: any
    inst?: Instance
    data?: string
    attrs?: Map<string, unknown>
}

function make(kind: Kind, extra: Partial<Node> = {}): Node {
    return { kind, parent: null, children: [], ...extra }
}

function isHost(n: Node) {
    return n.kind === "element" || n.kind === "text"
}

// The nearest element above a node, through fragments. Null while the node
// sits in a detached fragment: it is attached when Svelte inserts it.
function hostParent(n: Node): Node | null {
    let p = n.parent
    while (p && p.kind === "fragment") p = p.parent
    return p
}

function detachHost(n: Node, destroy: boolean) {
    const hp = hostParent(n)
    if (!hp || !isHost(n)) return
    if (destroy) {
        hostConfig.removeChild(hp.inst!, n.inst!)
    } else {
        // A move keeps its listeners, which removeChild would strip
        n.inst!.element.RemoveFromHierarchy()
    }
}

function attachHost(n: Node) {
    if (!isHost(n)) return
    const hp = hostParent(n)
    if (!hp) return
    const siblings = n.parent!.children
    let before: Node | null = null
    for (let i = siblings.indexOf(n) + 1; i < siblings.length; i++) {
        if (isHost(siblings[i])) { before = siblings[i]; break }
    }
    if (before) hostConfig.insertBefore(hp.inst!, n.inst!, before.inst!)
    else hostConfig.appendChild(hp.inst!, n.inst!)
}

// style="width: 10px; flex-grow: 1" as the style object onejs-elements takes.
// A unitless value is a number, as a React style gives it: onejs-elements
// passes flexGrow, opacity and the like through as they come.
function parseStyle(css: string): Record<string, string | number> {
    const out: Record<string, string | number> = {}
    for (const decl of css.split(";")) {
        const i = decl.indexOf(":")
        if (i < 0) continue
        const key = decl.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())
        const value = decl.slice(i + 1).trim()
        out[key] = /^-?(\d+\.?\d*|\.\d+)$/.test(value) ? Number(value) : value
    }
    return out
}

function propKey(name: string) {
    return name === "class" ? "className" : name
}

function propValue(name: string, value: unknown) {
    return name === "style" && typeof value === "string" ? parseStyle(value) : value
}

function setProp(el: Node, name: string, value: unknown) {
    if (value == null) el.attrs!.delete(name)
    else el.attrs!.set(name, value)
    const inst = el.inst!
    const next: Record<string, unknown> = { ...inst.props, [propKey(name)]: propValue(name, value) }
    if (value == null) delete next[propKey(name)]
    hostConfig.commitUpdate(inst, inst.type, inst.props, next as any, null)
}

/** Wraps a OneJS root (`__root`) as the node Svelte mounts into. */
export function rootNode(container: unknown): Node {
    const inst = {
        element: container,
        type: "ojs-view",
        props: {},
        eventHandlers: new Map(),
        appliedStyle: new Map(),
    } as unknown as Instance
    return make("element", { inst, element: container, attrs: new Map() })
}

const renderer = createRenderer<{ fragment: Node; element: Node; text: Node; comment: Node }>({
    createFragment: () => make("fragment"),
    // <label> is onejs-elements' ojs-label; a tag registerElement added is ojs-<tag>
    createElement: (name) => {
        const inst = hostConfig.createInstance(`ojs-${name}`, {} as any)
        return make("element", { inst, element: inst.element, attrs: new Map() })
    },
    createText: (data) => {
        const inst = hostConfig.createTextInstance(data)
        return make("text", { inst, element: inst.element })
    },
    createComment: (data) => make("comment", { data }),

    getNodeType: (n) => n.kind,
    getText: (n) => n.kind === "text" ? (n.inst!.text ?? "") : n.kind === "comment" ? n.data! : null,
    setText: (n, text) => {
        hostConfig.commitTextUpdate(n.inst!, n.inst!.text ?? "", text)
    },

    getAttribute: (el, name) => {
        const v = el.attrs!.get(name)
        return v == null ? null : String(v)
    },
    setAttribute: (el, name, value) => setProp(el, name, value),
    removeAttribute: (el, name) => setProp(el, name, undefined),
    hasAttribute: (el, name) => el.attrs!.has(name),

    getFirstChild: (n) => n.children[0] ?? null,
    getLastChild: (n) => n.children[n.children.length - 1] ?? null,
    getNextSibling: (n) => {
        if (!n.parent) return null
        const s = n.parent.children
        return s[s.indexOf(n) + 1] ?? null
    },
    getParent: (n) => n.parent,

    insert(parent, node, anchor) {
        if (node.kind === "fragment") {
            for (const child of [...node.children]) this.insert(parent, child, anchor)
            return
        }
        if (node.parent) {
            detachHost(node, false)
            node.parent.children.splice(node.parent.children.indexOf(node), 1)
        }
        const at = anchor ? parent.children.indexOf(anchor) : -1
        if (at < 0) parent.children.push(node)
        else parent.children.splice(at, 0, node)
        node.parent = parent
        attachHost(node)
    },

    remove(node) {
        if (!node.parent) return
        detachHost(node, true)
        node.parent.children.splice(node.parent.children.indexOf(node), 1)
        node.parent = null
    },

    // onclick={...} arrives as "click", the name the bridge dispatches
    addEventListener: (el, type, handler) => {
        __eventAPI.addEventListener(el.inst!.element, type, handler)
    },
    removeEventListener: (el, type, handler) => {
        __eventAPI.removeEventListener(el.inst!.element, type, handler)
    },
})

export default renderer
