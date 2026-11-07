/** Brazilian states (UF) and a gazetteer of the cities most likely to appear in searches. */

export const UFS = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
} as const;

export type Uf = keyof typeof UFS;
export const UF_CODES = Object.keys(UFS) as Uf[];

export const isUf = (value: string): value is Uf => value.toUpperCase() in UFS;

/**
 * UF codes that are also common Portuguese words. They only count as a state
 * when typed in uppercase ("SE") or right after "em/no/na/estado".
 */
export const AMBIGUOUS_UFS = new Set(["se", "to", "es", "pe", "ma", "pa", "ce", "al", "am"]);

/** Extra spellings for states (the official name is always accepted, except "Pará"). */
export const STATE_ALIASES: Record<string, Uf> = {
  minas: "MG",
  "estado de sao paulo": "SP",
  "estado de sp": "SP",
  "estado do rio": "RJ",
  "estado do rio de janeiro": "RJ",
  "estado do para": "PA",
  "rio grande": "RS",
};

export interface City {
  name: string;
  uf: Uf;
  aliases?: string[];
}

/**
 * Cities whose name is also a state name ("São Paulo", "Rio de Janeiro").
 * A bare mention means the STATE (broader); "cidade de …", "capital" or a
 * city alias means the CITY. The results page offers the narrower option.
 */
export const CITY_STATE_HOMONYMS: Record<string, { city: string; uf: Uf }> = {
  "sao paulo": { city: "São Paulo", uf: "SP" },
  "rio de janeiro": { city: "Rio de Janeiro", uf: "RJ" },
};

export const CITIES: City[] = [
  // Capitals
  { name: "São Paulo", uf: "SP", aliases: ["sampa", "cidade de sao paulo", "capital paulista"] },
  { name: "Rio de Janeiro", uf: "RJ", aliases: ["cidade do rio", "cidade do rio de janeiro"] },
  { name: "Belo Horizonte", uf: "MG", aliases: ["bh", "beaga"] },
  { name: "Brasília", uf: "DF" },
  { name: "Curitiba", uf: "PR", aliases: ["cwb"] },
  { name: "Porto Alegre", uf: "RS", aliases: ["poa"] },
  { name: "Florianópolis", uf: "SC", aliases: ["floripa"] },
  { name: "Salvador", uf: "BA" },
  { name: "Recife", uf: "PE" },
  { name: "Fortaleza", uf: "CE" },
  { name: "Goiânia", uf: "GO" },
  { name: "Vitória", uf: "ES" },
  { name: "Campo Grande", uf: "MS" },
  { name: "Cuiabá", uf: "MT" },
  { name: "Manaus", uf: "AM" },
  { name: "Belém", uf: "PA" },
  { name: "Natal", uf: "RN" },
  { name: "João Pessoa", uf: "PB" },
  { name: "Maceió", uf: "AL" },
  { name: "Aracaju", uf: "SE" },
  { name: "Teresina", uf: "PI" },
  { name: "São Luís", uf: "MA" },
  { name: "Palmas", uf: "TO" },
  { name: "Porto Velho", uf: "RO" },
  { name: "Rio Branco", uf: "AC" },
  { name: "Boa Vista", uf: "RR" },
  { name: "Macapá", uf: "AP" },
  // São Paulo
  { name: "Campinas", uf: "SP" },
  { name: "Santos", uf: "SP" },
  { name: "Ribeirão Preto", uf: "SP" },
  { name: "Sorocaba", uf: "SP" },
  { name: "São José dos Campos", uf: "SP", aliases: ["sjc"] },
  { name: "São Bernardo do Campo", uf: "SP" },
  { name: "Santo André", uf: "SP" },
  { name: "Guarulhos", uf: "SP" },
  { name: "Osasco", uf: "SP" },
  { name: "Barueri", uf: "SP", aliases: ["alphaville"] },
  { name: "Jundiaí", uf: "SP" },
  { name: "Piracicaba", uf: "SP" },
  { name: "Bauru", uf: "SP" },
  { name: "São José do Rio Preto", uf: "SP", aliases: ["rio preto"] },
  // Rio de Janeiro / Espírito Santo / Minas
  { name: "Niterói", uf: "RJ" },
  { name: "Petrópolis", uf: "RJ" },
  { name: "Vila Velha", uf: "ES" },
  { name: "Uberlândia", uf: "MG" },
  { name: "Contagem", uf: "MG" },
  { name: "Juiz de Fora", uf: "MG" },
  // South
  { name: "Londrina", uf: "PR" },
  { name: "Maringá", uf: "PR" },
  { name: "Ponta Grossa", uf: "PR" },
  { name: "Cascavel", uf: "PR" },
  { name: "Foz do Iguaçu", uf: "PR" },
  { name: "Joinville", uf: "SC" },
  { name: "Blumenau", uf: "SC" },
  { name: "Balneário Camboriú", uf: "SC", aliases: ["bc"] },
  { name: "Itajaí", uf: "SC" },
  { name: "Chapecó", uf: "SC" },
  { name: "São José", uf: "SC" },
  { name: "Caxias do Sul", uf: "RS" },
  { name: "Pelotas", uf: "RS" },
  { name: "Canoas", uf: "RS" },
  // Others
  { name: "Aparecida de Goiânia", uf: "GO" },
  { name: "Feira de Santana", uf: "BA" },
];
