import { BODY_LABELS, generationsFor, getModel } from "@/lib/taxonomy";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Text for the model plate shown when a listing has no photos: the base model
 * name, large ("V40" for the V40 Cross Country), and a short spec line taken
 * from the taxonomy ("Cross Country · Hatch", "SUV · 2ª geração"). Only what
 * the taxonomy says; no market data.
 */
export function plateText(
  modelId: string,
  modelName: string,
  yearModel: number | null,
): { name: string; details: string } {
  const model = getModel(modelId);
  if (!model) return { name: modelName, details: "" };

  const parts: string[] = [];
  let name = model.name;
  const parent = model.parentId ? getModel(model.parentId) : undefined;
  if (parent && model.name.startsWith(`${parent.name} `)) {
    name = parent.name;
    parts.push(model.name.slice(parent.name.length + 1));
  }

  // One body type only: models sold with several bodies name it in the generation.
  if (model.bodyTypes.length === 1) parts.push(capitalize(BODY_LABELS[model.bodyTypes[0]!]));

  if (model.generations.length > 1 && yearModel !== null) {
    const generations = generationsFor(modelId, { min: yearModel, max: yearModel });
    if (generations.length === 1) parts.push(generations[0]!.name);
  }

  return { name, details: parts.join(" · ") };
}
