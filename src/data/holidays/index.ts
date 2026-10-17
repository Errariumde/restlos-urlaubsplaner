// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { CountryData } from "../../engine/holidays/types";
import de from "./de.json";

/** Embedded country data by country code. Every file is checked by validateCountryData in the tests. */
export const countries: Readonly<Record<string, CountryData>> = {
  DE: de as unknown as CountryData,
};
