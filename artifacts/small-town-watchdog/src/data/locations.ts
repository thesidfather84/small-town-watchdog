export interface StateEntry {
  code: string;
  name: string;
  available: boolean;
}

export interface CityEntry {
  state: string;
  city: string;
  parish: string;
  priority: boolean;
}

export interface EntityTypeEntry {
  type: string;
  label: string;
  description: string;
}

export const US_STATES: StateEntry[] = [
  { code: "LA", name: "Louisiana",    available: true  },
  { code: "MS", name: "Mississippi",  available: true  },
  { code: "AL", name: "Alabama",      available: true  },
  { code: "AK", name: "Alaska",       available: false },
  { code: "AZ", name: "Arizona",      available: false },
  { code: "AR", name: "Arkansas",     available: true  },
  { code: "CA", name: "California",   available: false },
  { code: "CO", name: "Colorado",     available: false },
  { code: "CT", name: "Connecticut",  available: false },
  { code: "DE", name: "Delaware",     available: false },
  { code: "FL", name: "Florida",      available: true  },
  { code: "GA", name: "Georgia",      available: true  },
  { code: "HI", name: "Hawaii",       available: false },
  { code: "ID", name: "Idaho",        available: false },
  { code: "IL", name: "Illinois",     available: false },
  { code: "IN", name: "Indiana",      available: false },
  { code: "IA", name: "Iowa",         available: false },
  { code: "KS", name: "Kansas",       available: false },
  { code: "KY", name: "Kentucky",     available: true  },
  { code: "ME", name: "Maine",        available: false },
  { code: "MD", name: "Maryland",     available: false },
  { code: "MA", name: "Massachusetts",available: false },
  { code: "MI", name: "Michigan",     available: false },
  { code: "MN", name: "Minnesota",    available: false },
  { code: "MO", name: "Missouri",     available: false },
  { code: "MT", name: "Montana",      available: false },
  { code: "NE", name: "Nebraska",     available: false },
  { code: "NV", name: "Nevada",       available: false },
  { code: "NH", name: "New Hampshire",available: false },
  { code: "NJ", name: "New Jersey",   available: false },
  { code: "NM", name: "New Mexico",   available: false },
  { code: "NY", name: "New York",     available: false },
  { code: "NC", name: "North Carolina",available: false },
  { code: "ND", name: "North Dakota", available: false },
  { code: "OH", name: "Ohio",         available: false },
  { code: "OK", name: "Oklahoma",     available: false },
  { code: "OR", name: "Oregon",       available: false },
  { code: "PA", name: "Pennsylvania", available: false },
  { code: "RI", name: "Rhode Island", available: false },
  { code: "SC", name: "South Carolina",available: false },
  { code: "SD", name: "South Dakota", available: false },
  { code: "TN", name: "Tennessee",    available: true  },
  { code: "TX", name: "Texas",        available: false },
  { code: "UT", name: "Utah",         available: false },
  { code: "VT", name: "Vermont",      available: false },
  { code: "VA", name: "Virginia",     available: true  },
  { code: "WA", name: "Washington",   available: false },
  { code: "WV", name: "West Virginia",available: false },
  { code: "WI", name: "Wisconsin",    available: false },
  { code: "WY", name: "Wyoming",      available: false },
];

export const PRIORITY_CITIES: CityEntry[] = [
  // Louisiana
  { state: "LA", city: "New Orleans",  parish: "Orleans Parish",              priority: true },
  { state: "LA", city: "Baton Rouge",  parish: "East Baton Rouge Parish",     priority: true },
  { state: "LA", city: "Metairie",     parish: "Jefferson Parish",            priority: true },
  { state: "LA", city: "Slidell",      parish: "St. Tammany Parish",          priority: true },
  { state: "LA", city: "Covington",    parish: "St. Tammany Parish",          priority: true },
  { state: "LA", city: "Mandeville",   parish: "St. Tammany Parish",          priority: true },
  { state: "LA", city: "Lafayette",    parish: "Lafayette Parish",            priority: true },
  { state: "LA", city: "Lake Charles", parish: "Calcasieu Parish",            priority: true },
  { state: "LA", city: "Shreveport",   parish: "Caddo Parish",                priority: true },
  { state: "LA", city: "Bossier City", parish: "Bossier Parish",              priority: true },
  { state: "LA", city: "Kenner",       parish: "Jefferson Parish",            priority: true },
  { state: "LA", city: "Hammond",      parish: "Tangipahoa Parish",           priority: true },
  { state: "LA", city: "Houma",        parish: "Terrebonne Parish",           priority: true },
  { state: "LA", city: "Monroe",       parish: "Ouachita Parish",             priority: true },
  { state: "LA", city: "Alexandria",   parish: "Rapides Parish",              priority: true },
  // Mississippi
  { state: "MS", city: "Jackson",       parish: "Hinds County",               priority: true },
  { state: "MS", city: "Gulfport",      parish: "Harrison County",            priority: true },
  { state: "MS", city: "Biloxi",        parish: "Harrison County",            priority: true },
  { state: "MS", city: "Hattiesburg",   parish: "Forrest County",             priority: true },
  { state: "MS", city: "Bay St. Louis", parish: "Hancock County",             priority: true },
  { state: "MS", city: "Waveland",      parish: "Hancock County",             priority: true },
  { state: "MS", city: "Diamondhead",   parish: "Hancock County",             priority: true },
];

export const GOVERNMENT_ENTITY_TYPES: EntityTypeEntry[] = [
  {
    type: "city-government",
    label: "City Government",
    description: "Mayor, city council, ordinances, budgets, contracts",
  },
  {
    type: "parish-government",
    label: "Parish / County Government",
    description: "Parish president, council, budgets, millages, zoning",
  },
  {
    type: "school-board",
    label: "School Board",
    description: "Budgets, agendas, tax proposals, contracts",
  },
  {
    type: "sheriff",
    label: "Sheriff / Police",
    description: "Budget, contracts, public notices",
  },
  {
    type: "election-office",
    label: "Registrar of Voters",
    description: "Election notices, sample ballots, voter registration info",
  },
  {
    type: "auditor",
    label: "Legislative Auditor",
    description: "Annual audits, financial reports, findings",
  },
];

export function getCitiesForState(state: string): CityEntry[] {
  return PRIORITY_CITIES.filter((c) => c.state === state);
}

export function getStateName(code: string): string {
  return US_STATES.find((s) => s.code === code)?.name ?? code;
}
