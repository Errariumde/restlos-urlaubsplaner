// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { mount } from "svelte";
import App from "./App.svelte";

const target = document.getElementById("app");
if (!target) throw new Error("The page has no #app element.");

export default mount(App, { target });
