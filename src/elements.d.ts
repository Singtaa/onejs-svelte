// The UI Toolkit tags for Svelte's type checker (svelte-check, the editor
// extension). Without this, Svelte reads <label> and <button> as HTML's.
// Name it in tsconfig.json: "types": ["svelte", "onejs-svelte/elements"].
//
// An event attribute is the bridge's event name with "on" in front
// (onclick, onpointerdown, onchange); its argument is the data the bridge
// delivers, typed in onejs-elements.
import type {
    PointerEventData, MouseEventData, WheelEventData, KeyEventData, ChangeEventData,
    FocusEventData, GeometryEventData, NavigationEventData, InputEventData, TransitionEventData,
    GenerateVisualContentCallback,
} from "onejs-elements/types"

type Handler<E> = (event: E) => void

interface OneJSElementAttributes {
    class?: string | null
    style?: string | null
    name?: string
    pickingMode?: "Position" | "Ignore"
    focusable?: boolean
    disabled?: boolean
    passThrough?: boolean
    onGenerateVisualContent?: GenerateVisualContentCallback
    onclick?: Handler<PointerEventData>
    onpointerdown?: Handler<PointerEventData>
    onpointerup?: Handler<PointerEventData>
    onpointermove?: Handler<PointerEventData>
    onpointerenter?: Handler<PointerEventData>
    onpointerleave?: Handler<PointerEventData>
    onpointercancel?: Handler<PointerEventData>
    onpointercapture?: Handler<PointerEventData>
    onpointercaptureout?: Handler<PointerEventData>
    onmousedown?: Handler<MouseEventData>
    onmouseup?: Handler<MouseEventData>
    onmousemove?: Handler<MouseEventData>
    onmouseenter?: Handler<MouseEventData>
    onmouseleave?: Handler<MouseEventData>
    onmouseover?: Handler<MouseEventData>
    onmouseout?: Handler<MouseEventData>
    onwheel?: Handler<WheelEventData>
    onfocus?: Handler<FocusEventData>
    onblur?: Handler<FocusEventData>
    onfocusin?: Handler<FocusEventData>
    onfocusout?: Handler<FocusEventData>
    onkeydown?: Handler<KeyEventData>
    onkeyup?: Handler<KeyEventData>
    oninput?: Handler<InputEventData>
    ongeometrychanged?: Handler<GeometryEventData>
    onnavigationmove?: Handler<NavigationEventData>
    onnavigationsubmit?: Handler<NavigationEventData>
    onnavigationcancel?: Handler<NavigationEventData>
    ontransitionrun?: Handler<TransitionEventData>
    ontransitionstart?: Handler<TransitionEventData>
    ontransitionend?: Handler<TransitionEventData>
    ontransitioncancel?: Handler<TransitionEventData>
    // Any other property of the C# element is set as written
    [property: string]: unknown
}

interface TextAttributes extends OneJSElementAttributes { text?: string }

interface FieldAttributes<T> extends OneJSElementAttributes {
    label?: string
    value?: T
    onchange?: Handler<ChangeEventData<T>>
}

declare global {
    namespace svelteHTML {
        interface IntrinsicElements {
            view: OneJSElementAttributes
            text: TextAttributes
            label: TextAttributes
            button: TextAttributes
            textfield: FieldAttributes<string> & { multiline?: boolean; readOnly?: boolean; maxLength?: number; isPasswordField?: boolean }
            toggle: FieldAttributes<boolean> & { text?: string }
            slider: FieldAttributes<number> & { lowValue?: number; highValue?: number; showInputField?: boolean }
            scrollview: OneJSElementAttributes & { mouseWheelScrollSize?: number }
            image: OneJSElementAttributes
            listview: OneJSElementAttributes
            treeview: OneJSElementAttributes
            frostedglass: OneJSElementAttributes & { blurRadius?: number }
        }
    }
}

export {}
