/**
 * Optional editorial paragraph per landing page, keyed by the path after
 * /volvo ("xc60", "xc60/t8", "v40/r-design"). Shown after the facts generated
 * from the taxonomy. DRAFT texts (REVISAR): keep them descriptive, no market
 * data (prices, FIPE, depreciation) without a source.
 */
export const LANDING_TEXTS: Record<string, string> = {};

export const landingText = (path: string) => LANDING_TEXTS[path.replace(/^\/volvo\//, "")] ?? null;
