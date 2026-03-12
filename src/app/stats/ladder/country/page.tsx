import Link from "next/link";
import { fetchCountryLadder } from "@/services/w3cApi";
import { flattenCountryLadder } from "@/lib/ranking";
import { PlayerHeader, Section } from "@/components/PlayerUI";

export const revalidate = 300;

const GATEWAY = 20;
const GAMEMODE = 1;
const SEASON = 24;

const KNOWN_COUNTRIES = [
"AF","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ",
"BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BA","BW","BV","BR",
"IO","BN","BG","BF","BI","KH","CM","CA","CV","KY","CF","TD","CL","CN","CX",
"CC","CO","KM","CG","CD","CK","CR","CI","HR","CU","CY","CZ",
"DK","DJ","DM","DO",
"EC","EG","SV","GQ","ER","EE","ET",
"FK","FO","FJ","FI","FR",
"GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT",
"GN","GW","GY",
"HT","HM","VA","HN","HK","HU",
"IS","IN","ID","IR","IQ","IE","IL","IT",
"JM","JP","JO",
"KZ","KE","KI","KP","KR","KW","KG",
"LA","LV","LB","LS","LR","LY","LI","LT","LU",
"MO","MK","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM",
"MD","MC","MN","MS","MA","MZ","MM",
"NA","NR","NP","NL","NC","NZ","NI","NE","NG","NU","NF","MP","NO",
"OM",
"PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR",
"QA",
"RE","RO","RU","RW",
"BL","SH","KN","LC","MF","PM","VC","WS","SM","ST","SA","SN","RS","SC","SL",
"SG","SX","SK","SI","SB","SO","ZA","GS","ES","LK","SD","SR","SJ","SZ","SE",
"CH","SY",
"TW","TJ","TZ","TH","TL","TG","TK","TO","TT","TN","TR","TM","TC","TV",
"UG","UA","AE","GB","US","UM","UY","UZ",
"VU","VE","VN","VG","VI",
"WF","EH",
"YE",
"ZM","ZW"
];

const COUNTRY_NAMES: Record<string, string> = {
  AF: "Afghanistan",
  AL: "Albania",
  DZ: "Algeria",
  AS: "American Samoa",
  AD: "Andorra",
  AO: "Angola",
  AI: "Anguilla",
  AQ: "Antarctica",
  AG: "Antigua and Barbuda",
  AR: "Argentina",
  AM: "Armenia",
  AW: "Aruba",
  AU: "Australia",
  AT: "Austria",
  AZ: "Azerbaijan",

  BS: "Bahamas",
  BH: "Bahrain",
  BD: "Bangladesh",
  BB: "Barbados",
  BY: "Belarus",
  BE: "Belgium",
  BZ: "Belize",
  BJ: "Benin",
  BM: "Bermuda",
  BT: "Bhutan",
  BO: "Bolivia",
  BA: "Bosnia and Herzegovina",
  BW: "Botswana",
  BR: "Brazil",

  BG: "Bulgaria",
  KH: "Cambodia",
  CM: "Cameroon",
  CA: "Canada",
  CV: "Cape Verde",
  KY: "Cayman Islands",
  CF: "Central African Republic",
  TD: "Chad",
  CL: "Chile",
  CN: "China",
  CO: "Colombia",
  KM: "Comoros",
  CG: "Congo",
  CD: "Congo (DRC)",
  CR: "Costa Rica",
  CI: "Côte d'Ivoire",
  HR: "Croatia",
  CU: "Cuba",
  CY: "Cyprus",
  CZ: "Czech Republic",

  DK: "Denmark",
  DJ: "Djibouti",
  DM: "Dominica",
  DO: "Dominican Republic",

  EC: "Ecuador",
  EG: "Egypt",
  SV: "El Salvador",
  GQ: "Equatorial Guinea",
  ER: "Eritrea",
  EE: "Estonia",
  ET: "Ethiopia",

  FI: "Finland",
  FR: "France",

  GE: "Georgia",
  DE: "Germany",
  GH: "Ghana",
  GI: "Gibraltar",
  GR: "Greece",
  GL: "Greenland",
  GD: "Grenada",
  GU: "Guam",
  GT: "Guatemala",
  GN: "Guinea",
  GW: "Guinea-Bissau",
  GY: "Guyana",

  HT: "Haiti",
  HK: "Hong Kong",
  HU: "Hungary",

  IS: "Iceland",
  IN: "India",
  ID: "Indonesia",
  IR: "Iran",
  IQ: "Iraq",
  IE: "Ireland",
  IL: "Israel",
  IT: "Italy",

  JM: "Jamaica",
  JP: "Japan",
  JO: "Jordan",

  KZ: "Kazakhstan",
  KE: "Kenya",
  KP: "North Korea",
  KR: "South Korea",
  KW: "Kuwait",
  KG: "Kyrgyzstan",

  LA: "Laos",
  LV: "Latvia",
  LB: "Lebanon",
  LS: "Lesotho",
  LR: "Liberia",
  LY: "Libya",
  LI: "Liechtenstein",
  LT: "Lithuania",
  LU: "Luxembourg",

  MO: "Macau",
  MK: "North Macedonia",
  MG: "Madagascar",
  MW: "Malawi",
  MY: "Malaysia",
  MV: "Maldives",
  ML: "Mali",
  MT: "Malta",
  MX: "Mexico",
  MD: "Moldova",
  MC: "Monaco",
  MN: "Mongolia",
  MA: "Morocco",
  MZ: "Mozambique",
  MM: "Myanmar",

  NA: "Namibia",
  NP: "Nepal",
  NL: "Netherlands",
  NZ: "New Zealand",
  NI: "Nicaragua",
  NE: "Niger",
  NG: "Nigeria",
  NO: "Norway",

  OM: "Oman",

  PK: "Pakistan",
  PS: "Palestine",
  PA: "Panama",
  PG: "Papua New Guinea",
  PY: "Paraguay",
  PE: "Peru",
  PH: "Philippines",
  PL: "Poland",
  PT: "Portugal",
  PR: "Puerto Rico",

  QA: "Qatar",

  RO: "Romania",
  RU: "Russia",
  RW: "Rwanda",

  SA: "Saudi Arabia",
  SN: "Senegal",
  RS: "Serbia",
  SC: "Seychelles",
  SL: "Sierra Leone",
  SG: "Singapore",
  SK: "Slovakia",
  SI: "Slovenia",
  SO: "Somalia",
  ZA: "South Africa",
  ES: "Spain",
  LK: "Sri Lanka",
  SD: "Sudan",
  SR: "Suriname",
  SE: "Sweden",
  CH: "Switzerland",
  SY: "Syria",

  TW: "Taiwan",
  TJ: "Tajikistan",
  TZ: "Tanzania",
  TH: "Thailand",
  TN: "Tunisia",
  TR: "Turkey",
  TM: "Turkmenistan",

  UG: "Uganda",
  UA: "Ukraine",
  AE: "United Arab Emirates",
  GB: "United Kingdom",
  US: "United States",
  UY: "Uruguay",
  UZ: "Uzbekistan",

  VE: "Venezuela",
  VN: "Vietnam",

  YE: "Yemen",

  ZM: "Zambia",
  ZW: "Zimbabwe"
};

export default async function CountryHubPage() {
  const found: string[] = [];

  await Promise.all(
    KNOWN_COUNTRIES.map(async (code) => {
      try {
        const payload = await fetchCountryLadder(code, GATEWAY, GAMEMODE, SEASON);
        const rows = flattenCountryLadder(payload);

        if (rows.length) found.push(code);
      } catch {}
    })
  );

  found.sort();

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-3 sm:px-4 md:px-0">

      <Section title="Country Selection">
        {found.length === 0 ? (
          <div className="text-sm text-zinc-500 text-center py-6">
            No countries available.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-2">
            {found.map((code) => (
              <Link
                key={code}
                href={`/stats/ladder/country/${code}`}
                className="
                  h-11 rounded-md border border-zinc-400 dark:border-zinc-800
                  bg-white dark:bg-zinc-900
                  flex items-center justify-center
                  text-sm font-medium
                  text-zinc-700 dark:text-zinc-200
                  hover:bg-zinc-100 dark:hover:bg-zinc-800
                  hover:border-emerald-500 dark:hover:border-emerald-500
                  transition-colors text-center px-2
                "
              >
                {COUNTRY_NAMES[code] ?? code}
              </Link>
            ))}
          </div>
        )}
      </Section>

    </div>
  );
}