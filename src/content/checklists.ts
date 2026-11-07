/**
 * "O que checar neste modelo" — DRAFT content, to be reviewed with the
 * Made by Sweden community before launch (REVISAR). Keep items conservative:
 * general inspection advice, no claims about defect rates.
 */
import { getEngine, getModel, impliedFuel, type Fuel } from "@/lib/taxonomy";

export const MADE_BY_SWEDEN_URL = "https://madebysweden.com.br";

const GENERAL = [
  "Peça o histórico de revisões e confira se ele bate com a quilometragem.",
  "Consulte recalls pelo número do chassi junto à rede Volvo.",
  "Faça uma vistoria cautelar e uma avaliação mecânica independente antes de fechar.",
];

const BY_FUEL: Partial<Record<Fuel, string[]>> = {
  hibrido_plugin: [
    "Peça o histórico de manutenção do sistema híbrido, incluindo a bateria de alta tensão.",
    "Teste a recarga pelo cabo e a condução no modo 100% elétrico.",
  ],
  eletrico: [
    "Peça um relatório do estado de saúde da bateria na concessionária.",
    "Teste a recarga lenta (AC) e, se possível, a rápida (DC).",
  ],
  hibrido_leve: ["Confira se não há alertas do sistema elétrico de 48 V no painel."],
  diesel: ["Verifique o histórico do sistema de injeção, do turbo e do filtro de partículas."],
};

const BY_ENGINE: Record<string, string[]> = {
  t8: [
    "No T8, confirme o funcionamento do motor elétrico traseiro (ERAD), responsável pela tração elétrica no eixo traseiro.",
  ],
  t5r: ["Em um T-5R, confira a originalidade de rodas, bancos e acabamento específicos da série."],
};

export function checklistFor(input: {
  modelId: string;
  engineId: string | null;
  fuel: Fuel | null;
  yearModel: number | null;
}): string[] {
  const items: string[] = [];
  const fuel = input.fuel ?? (input.engineId ? impliedFuel(input.engineId) : undefined);
  if (input.engineId && BY_ENGINE[input.engineId]) items.push(...BY_ENGINE[input.engineId]!);
  if (fuel && BY_FUEL[fuel]) items.push(...BY_FUEL[fuel]!);
  if (input.yearModel && input.yearModel < 2000) {
    items.push("Em clássicos, confira pontos de ferrugem, borrachas e a originalidade das peças.");
  } else if (
    input.engineId &&
    getEngine(input.engineId) &&
    fuel === "gasolina" &&
    (input.yearModel ?? 0) < 2011
  ) {
    items.push(
      "Em motores turbo mais antigos, verifique o estado do turbo e se há vazamentos de óleo.",
    );
  }
  items.push(...GENERAL);
  return items;
}

export const checklistTitle = (modelId: string) =>
  `O que checar em um ${getModel(modelId)?.name ?? "Volvo"}`;
