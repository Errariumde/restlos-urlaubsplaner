// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import "./styles/layers.css";
import "./styles/reset.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import { mount } from "svelte";
import workerSource from "virtual:restlos-worker";
import example from "../../examples/plans/beispiel-gmbh-2027.urlaub.json?raw";
import App from "./App.svelte";
import { startEngine } from "./worker/client.ts";

const target = document.getElementById("app");
if (!target) throw new Error("The page has no #app element.");

export default mount(App, { target });

// Until the start screen exists (Task 8), the engine opens the example right away; the e2e test waits on
// `data-engine="ready"`.
const engine = startEngine(workerSource, (url) => new Worker(url));
engine.open(example, true).then(
  () => (document.body.dataset["engine"] = "ready"),
  (error: unknown) => {
    document.body.dataset["engine"] = "failed";
    console.error(error);
  },
);
