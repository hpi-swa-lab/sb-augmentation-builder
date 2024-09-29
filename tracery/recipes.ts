import { languageFor } from "../core/languages.js";
import { RegexModel } from "../core/model-regex.ts";
import { SBBlock, SBLanguage } from "../core/model.js";
import { useSignal } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import { appendCss } from "../utils.js";
import {
  Augmentation,
  SelectionInteraction,
  VitrailPane,
} from "../vitrail/vitrail.ts";

appendCss(`
.md-tag {
  background: #ff9999;
  padding: 0.1rem;
  border-radius: 0.3rem;
}

.md-link {
  color: #3333ff;
  border-bottom: 1px solid;
  cursor: pointer;
}`);

const TagModel = new RegexModel("tags", {
  tag: /@[A-Za-z0-9-_]+/g,
  // FIXME
  link: /https:\/\/[^\s]+/g,
});

class _RecipeModel extends SBLanguage {
  dependencies = [languageFor("markdown"), TagModel];

  constructor() {
    super({ name: "recipes", extensions: [], defaultExtensions: [] });
  }

  _parse(text: string) {
    const [markdown, tags] = this.getDependencies();

    const root = SBBlock.root(text);
    for (const node of markdown.childBlocks.filter(
      (b) => b.type === "section" && b.atType("atx_heading"),
    )) {
      const recipe = SBBlock.named("recipe", node.range);
      const name = node.atType("atx_heading")!.atType("inline");
      recipe.appendChild(SBBlock.named("title", name?.range ?? ""));
      recipe.appendAll(
        [...tags.leafsInRange(recipe.range)].map((t) => t.shallowClone()),
      );
      root.appendChild(recipe);
    }
    return root;
  }
}
const RecipeModel = new _RecipeModel();

export const recipesList: Augmentation<any> = {
  name: "recipes-list",
  match: (node) => (node.isRoot ? {} : null),
  matcherDepth: 1,
  model: RecipeModel,
  view: ({ nodes }) => {
    const search = useSignal("");
    return h(
      "div",
      {
        style: {
          display: "inline-flex",
          width: "100%",
          flexDirection: "column",
        },
      },
      h("input", {
        value: search.value,
        onInput: (e) => (search.value = e.target.value),
        placeholder: "Filter ...",
      }),
      search.value
        ? nodes[0].children
            .filter((n) => n.atType("title").text.includes(search.value))
            .map((n) =>
              h(
                "div",
                {
                  key: n.id,
                  onClick: () => {
                    search.value = "";
                    setTimeout(() => {
                      // n.editor.selectRange([n.range[0], n.range[0]]);
                      n.editor.showRange(n.range);
                    });
                  },
                },
                n.atType("title").text,
              ),
            )
        : h(VitrailPane, { nodes, className: "pane-full-width" }),
    );
  },
  type: "replace" as const,
  selectionInteraction: SelectionInteraction.Skip,
};

export const markdownTag: Augmentation<any> = {
  name: "markdown-tag",
  type: "mark" as const,
  match: (node) => (node.type === "tag" ? {} : null),
  model: TagModel,
  view: () => [
    {
      attributes: { class: "md-tag" },
    },
  ],
};

export const markdownLink: Augmentation<any> = {
  name: "markdown-link",
  type: "mark" as const,
  match: (node) => (node.type === "link" ? {} : null),
  model: TagModel,
  view: ({ nodes }) => [
    {
      attributes: { class: "md-link" },
      eventHandlers: { click: () => window.open(nodes[0].text) },
    },
  ],
};

export const markdownImage: Augmentation<any> = {
  name: "markdown-image",
  type: "insert" as const,
  match: (node) =>
    node.type === "image" && node.atType("link_destination")
      ? { link: node.atType("link_destination")!.sourceString }
      : null,
  insertPosition: "end",
  model: languageFor("markdown"),
  view: ({ link }) => h("img", { src: link }),
};
