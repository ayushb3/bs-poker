/** Tiny hyperscript helper so render functions stay readable without a framework. */
type Child = Node | string | number | null | undefined | false | readonly Child[];

type Attrs = Record<string, string | number | boolean | null | undefined | ((ev: Event) => void)>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null || value === false) continue;
      if (typeof value === "function") {
        el.addEventListener(key.startsWith("on") ? key.slice(2).toLowerCase() : key, value);
      } else if (key === "class") {
        el.className = String(value);
      } else if (key === "style") {
        el.setAttribute("style", String(value));
      } else if (value === true) {
        el.setAttribute(key, "");
        if (key === "disabled") (el as HTMLButtonElement).disabled = true;
      } else {
        el.setAttribute(key, String(value));
      }
    }
  }
  append(el, children);
  return el;
}

function append(parent: Node, children: readonly Child[]): void {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(parent, c);
    else if (c instanceof Node) parent.appendChild(c);
    else parent.appendChild(document.createTextNode(String(c)));
  }
}

/** A real <button>; `key` lets the renderer restore keyboard focus across re-renders. */
export function button(
  label: Child,
  onClick: () => void,
  opts: { class?: string; disabled?: boolean; key?: string; ariaLabel?: string; pressed?: boolean } = {},
): HTMLButtonElement {
  return h(
    "button",
    {
      type: "button",
      class: opts.class ?? "",
      disabled: opts.disabled ?? false,
      "data-key": opts.key,
      "aria-label": opts.ariaLabel,
      "aria-pressed": opts.pressed == null ? undefined : String(opts.pressed),
      onclick: () => onClick(),
    },
    label,
  );
}
