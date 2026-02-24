export type CountryOverride = {
  from: string; // what the API currently reports / where to pull his ladder row from
  to: string;   // where you want him to live in your app
};

export const COUNTRY_OVERRIDE: Record<string, CountryOverride> = {
  "RaynaCruz#1385": { from: "US", to: "RU" },
  "zhoolikaz#2787": { from: "US", to: "RU" },
  "SoYmaFans#1524": { from: "IM", to: "US" },
  "MangoIsNice#1230": { from: "CN", to: "US" },
  
};

export function effectiveCountry(battletag: string, apiCountry: string) {
  const o = COUNTRY_OVERRIDE[battletag];
  return (o?.to ?? apiCountry).toUpperCase();
}