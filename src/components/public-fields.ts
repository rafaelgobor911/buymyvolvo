/**
 * Firm, touch-sized fields for the public forms (seller form, authorization,
 * removal, claim, search filters, seller panel). Put it on the <form>: every
 * input and select inside becomes 44px tall with 16px text (no iOS zoom on
 * focus), on the paper surface in light mode. The admin keeps the denser default.
 */
export const PUBLIC_FIELDS =
  "[&_[data-slot=input]]:h-11 [&_[data-slot=input]]:px-3 [&_[data-slot=native-select]]:h-11 [&_[data-slot=native-select]]:pl-3 [&_[data-slot=native-select]]:text-base sm:[&_[data-slot=native-select]]:text-sm [&_[data-slot=input]]:bg-card [&_[data-slot=native-select]]:bg-card [&_textarea]:bg-card dark:[&_[data-slot=input]]:bg-input/30 dark:[&_[data-slot=native-select]]:bg-input/30 dark:[&_textarea]:bg-input/30";

/** Radio or checkbox row with a 44px hit area; the box itself is 20px. */
export const CHOICE_ROW = "flex min-h-11 cursor-pointer items-center gap-3 text-sm";
export const CHOICE_BOX = "size-5 shrink-0 accent-primary";
