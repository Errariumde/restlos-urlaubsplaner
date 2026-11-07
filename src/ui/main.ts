// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import "./styles/layers.css";
import "./styles/reset.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import { mount } from "svelte";
import App from "./App.svelte";

const target = document.getElementById("app");
if (!target) throw new Error("The page has no #app element.");

export default mount(App, { target });
