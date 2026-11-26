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
}

interface TextAttributes extends OneJSElementAttributes { text?: string }

interface FieldAttributes<T> extends OneJSElementAttributes {
    label?: string
    value?: T
    onchange?: Handler<ChangeEventData<T>>
}

// The props onejs-elements applies to each element, as onejs-react's
// ViewProps, TextFieldProps, ... type them. ListView and TreeView are left
// out: their rows are React components in onejs-react, and a Svelte app
// renders a list with a keyed {#each} inside a <scrollview>.
// svelte-check reads an attribute name on a lowercase tag in lowercase, as
// HTML's are, so the keys it checks against are lowercased here. The compiled
// component keeps the case as written (lowValue), which is what UI Toolkit needs.
type Checked<T> = { [K in keyof T as Lowercase<K & string>]: T[K] }

type Visibility = "Auto" | "AlwaysVisible" | "Hidden"
type Rect = { x: number; y: number; width: number; height: number }

declare global {
    namespace svelteHTML {
        interface IntrinsicElements {
            view: Checked<OneJSElementAttributes>
            text: Checked<TextAttributes>
            label: Checked<TextAttributes>
            button: Checked<TextAttributes>
            textfield: Checked<FieldAttributes<string> & {
                placeholder?: string; multiline?: boolean; readOnly?: boolean; maxLength?: number
                isPasswordField?: boolean; maskChar?: string; isDelayed?: boolean
                selectAllOnFocus?: boolean; selectAllOnMouseUp?: boolean; hideMobileInput?: boolean; autoCorrection?: boolean
                inputClassName?: string
            }>
            toggle: Checked<FieldAttributes<boolean> & { text?: string; toggleOnLabelClick?: boolean }>
            slider: Checked<FieldAttributes<number> & {
                min?: number; max?: number; lowValue?: number; highValue?: number
                direction?: "Horizontal" | "Vertical"; pageSize?: number; showInputField?: boolean; inverted?: boolean; fill?: boolean
            }>
            scrollview: Checked<OneJSElementAttributes & {
                mode?: "Vertical" | "Horizontal" | "VerticalAndHorizontal"
                horizontalScrollerVisibility?: Visibility; verticalScrollerVisibility?: Visibility
                elasticity?: number; elasticAnimationIntervalMs?: number; scrollDecelerationRate?: number
                mouseWheelScrollSize?: number; horizontalPageSize?: number; verticalPageSize?: number
                touchScrollBehavior?: "Unrestricted" | "Elastic" | "Clamped"
                nestedInteractionKind?: "Default" | "StopScrolling" | "ForwardScrolling"
            }>
            image: Checked<OneJSElementAttributes & {
                src?: string; image?: object; sprite?: object
                scaleMode?: "StretchToFill" | "ScaleAndCrop" | "ScaleToFit"; tintColor?: string
                sourceRect?: Rect; uv?: Rect
            }>
            frostedglass: Checked<OneJSElementAttributes & { blurRadius?: number; tintColor?: unknown }>
        }
    }
}

export {}
