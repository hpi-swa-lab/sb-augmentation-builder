const editor = document.createElement("div");
render(h("button", { onclick: () => {} }, "Open Browser"), editor);
document.body.appendChild(editor);
