import { useEffect, useState } from "../../external/preact-hooks.mjs";
import { h, render } from "../../external/preact.mjs";
import htm from "../../external/htm.mjs";

const html = htm.bind(h);

export default function Tab({ title, content }) {
  const [expanded, setExpanded] = useState(true);
  const [expandedWidth, setExpandedWidth] = useState(150);
  return html` ${expanded
    ? html`<div
        style=${{
          id: "expanded div",
          "box-shadow": "0 4px 8px 0 rgba(0,0,0,0.2)",
          display: "flex",
          "align-items": "left",
          "justify-content": "left",
          resize: "horizontal",
          overflow: "hidden",
          padding: "0px 0px",
          border: "2px solid black",
          "border-radius": "25px",
          height: "100%",
          "min-width": "150px",
        }}
      >
        <div style=${{ width: "100%", padding: "10px" }}>
          <h1 style=${{ margin: "0px" }}>${title}</h1>
          <div style=${{ width: "100%" }}>${content}</div>
        </div>
        <div
          style=${{
            display: "flex",
            "justify-content": "center",
            "align-items": "center",
            height: "100%",
          }}
        >
          <div
            style=${{
              width: "100%",
              "justify-content": "right",
              "align-items": "right",
            }}
          >
            <button
              onClick=${() => setExpanded(!expanded)}
              style=${{ float: "right", height: "50px" }}
            >
              ˂
            </button>
          </div>
        </div>
      </div>`
    : html` <div
        style=${{
          id: "closed div",
          "box-shadow": "0 4px 8px 0 rgba(0,0,0,0.2)",
          display: "flex",
          "align-items": "left",
          "justify-content": "left",
          width: "60px",
          overflow: "auto",
          padding: "0px 0px",
          border: "2px solid black",
          "border-radius": "25px",
          height: "100%",
        }}
      >
        <div
          style=${{
            display: "flex",
            "justify-content": "center",
            "align-items": "center",
            width: "100%",
            height: "100%",
          }}
        >
          <div
            style=${{
              "align-items": "top",
              "writing-mode": "vertical-lr",
              "justify-content": "top",
              width: "100%",
              height: "100%",
            }}
          >
            <h1
              style=${{
                "margin-top": "50px",
                "text-orientation": "mixed",
                "justify-content": "left",
                "align-items": "start",
                "padding-top": "10px",
                "padding-left": "10px",
                margin: "0px",
                display: "flex",
              }}
            >
              ${title}
            </h1>
          </div>
          <div
            style=${{
              display: "flex",
              "justify-content": "center",
              "align-items": "center",
              height: "100%",
            }}
          >
            <div
              style=${{
                width: "100%",
                "justify-content": "right",
                "align-items": "right",
              }}
            >
              <button
                onClick=${() => setExpanded(!expanded)}
                style=${{ float: "right", height: "50px" }}
              >
                ˃
              </button>
            </div>
          </div>
        </div>
      </div>`}`;
}
