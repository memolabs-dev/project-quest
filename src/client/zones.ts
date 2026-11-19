// Board columns and the locales' zone names. Pure.

/** The known zone key for a board column, whatever its case ("In Progress" is "In progress"); the name itself otherwise. */
export const zoneKey = (zone: string, known: string[]) => known.find((k) => k.toLowerCase() === zone.toLowerCase()) ?? zone;
