import { languageFor } from "../core/languages.js";
import { RegexModel } from "../core/model-regex.ts";
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

export const recipesList: Augmentation<any> = {
  name: "recipes-list",
  match: (node) => (node.isRoot ? {} : null),
  matcherDepth: 1,
  model: languageFor("markdown"),
  view: ({ nodes }) =>
    h(
      "div",
      {
        style: {
          display: "inline-flex",
          width: "100%",
          flexDirection: "column",
        },
      },
      h("input", { placeholder: "Filter ..." }),
      h(VitrailPane, { nodes, className: "pane-full-width" }),
    ),
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
      eventHandlers: { click: () => window.open(nodes[0].sourceString) },
    },
  ],
};

export const markdownImage: Augmentation<any> = {
  name: "markdown-image",
  type: "insert" as const,
  match: (node) =>
    node.type === "image"
      ? {
          link: node.atType("link_destination")?.sourceString,
        }
      : null,
  insertPosition: "end",
  model: languageFor("markdown"),
  view: ({ link }) => h("img", { src: link }),
};
