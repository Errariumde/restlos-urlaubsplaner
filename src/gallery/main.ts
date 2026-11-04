// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The component gallery (dev only, not in the app's build). It adds its own texts and the two
// pseudo-locales to the app's catalogs before anything renders (Ruling N: they stay out of the app).
import "../ui/styles/layers.css";
import "../ui/styles/reset.css";
import "../ui/styles/tokens.css";
import "../ui/styles/base.css";
import "../ui/styles/layout.css";
import { mount } from "svelte";
import en from "../ui/i18n/en.json";
import { i18n, registerCatalog } from "../ui/i18n/i18n.svelte.ts";
import { pseudoCatalog } from "../ui/i18n/pseudo.ts";
import Gallery from "./Gallery.svelte";
import galleryDe from "./i18n/de.json";
import galleryEn from "./i18n/en.json";
import { combinationFrom } from "./params.ts";

registerCatalog("de", galleryDe);
registerCatalog("en", galleryEn);
registerCatalog("en-XA", pseudoCatalog({ ...en, ...galleryEn }, "long"));
registerCatalog("en-XB", pseudoCatalog({ ...en, ...galleryEn }, "rtl"));

const target = document.getElementById("app");
if (!target) throw new Error("The page has no #app element.");

const combination = combinationFrom(location.search);
if (combination) i18n.locale = combination.locale;

export default mount(Gallery, { target, props: { combination } });
