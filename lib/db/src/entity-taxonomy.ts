/**
 * Small Town Watchdog — Entity Taxonomy
 *
 * Master list of government entity types and public record types.
 * This is the source of truth used by:
 *   - The source registry schema
 *   - The coverage checker
 *   - The crawler (to know what to look for in each location)
 *   - The location checklist generator
 *
 * When a user selects a state + county/parish, the system uses this taxonomy
 * to know exactly which government bodies to look for and which record types
 * to search for at each body.
 */

// ─── Levels ──────────────────────────────────────────────────────────────────

export type EntityLevel =
  | "state"
  | "county"
  | "city"
  | "school"
  | "special-district"
  | "court";

// ─── Record Types ─────────────────────────────────────────────────────────────

export interface RecordTypeSpec {
  key: string;
  displayName: string;
  /** Keywords that suggest a page contains this record type */
  keywords: string[];
  /** File types commonly used for this record */
  fileTypes: ("pdf" | "html" | "doc" | "csv")[];
}

export const RECORD_TYPES: RecordTypeSpec[] = [
  {
    key: "agenda",
    displayName: "Meeting Agendas",
    keywords: ["agenda", "meeting agenda", "board agenda", "council agenda", "upcoming meeting"],
    fileTypes: ["pdf", "html"],
  },
  {
    key: "minutes",
    displayName: "Meeting Minutes",
    keywords: ["minutes", "meeting minutes", "board minutes", "council minutes"],
    fileTypes: ["pdf", "html"],
  },
  {
    key: "ordinance",
    displayName: "Ordinances",
    keywords: ["ordinance", "ordinances", "municipal code", "code of ordinances"],
    fileTypes: ["pdf", "html"],
  },
  {
    key: "resolution",
    displayName: "Resolutions",
    keywords: ["resolution", "resolutions", "board resolution"],
    fileTypes: ["pdf", "html"],
  },
  {
    key: "budget",
    displayName: "Budgets / Appropriations",
    keywords: ["budget", "appropriation", "fiscal year budget", "annual budget", "operating budget"],
    fileTypes: ["pdf", "html", "csv"],
  },
  {
    key: "audit",
    displayName: "Audits / Financial Reports",
    keywords: ["audit", "financial audit", "annual audit", "comprehensive annual financial report", "CAFR", "financial statements"],
    fileTypes: ["pdf"],
  },
  {
    key: "financial-statement",
    displayName: "Financial Statements",
    keywords: ["financial statement", "financial report", "annual report", "treasurer report"],
    fileTypes: ["pdf", "html"],
  },
  {
    key: "public-notice",
    displayName: "Public Notices",
    keywords: ["public notice", "legal notice", "notice of public hearing", "public announcement"],
    fileTypes: ["pdf", "html"],
  },
  {
    key: "bid-rfp",
    displayName: "Bids / RFPs / Procurement",
    keywords: ["bid", "RFP", "request for proposal", "procurement", "solicitation", "invitation to bid"],
    fileTypes: ["pdf", "html"],
  },
  {
    key: "contract",
    displayName: "Contracts",
    keywords: ["contract", "agreement", "professional services agreement", "vendor contract"],
    fileTypes: ["pdf"],
  },
  {
    key: "election",
    displayName: "Elections / Results",
    keywords: ["election", "election results", "voting", "election notice", "precinct results"],
    fileTypes: ["pdf", "html", "csv"],
  },
  {
    key: "candidate-filing",
    displayName: "Candidate Filings",
    keywords: ["candidate", "candidate filing", "qualifying", "candidate list", "ballot access"],
    fileTypes: ["pdf", "html"],
  },
  {
    key: "ballot-measure",
    displayName: "Ballot Measures / Propositions",
    keywords: ["ballot measure", "proposition", "referendum", "amendment", "millage"],
    fileTypes: ["pdf", "html"],
  },
  {
    key: "tax-notice",
    displayName: "Tax Notices / Assessments",
    keywords: ["tax notice", "tax assessment", "property tax", "millage rate", "tax roll"],
    fileTypes: ["pdf", "html"],
  },
  {
    key: "public-hearing",
    displayName: "Public Hearings",
    keywords: ["public hearing", "hearing notice", "community meeting", "town hall"],
    fileTypes: ["pdf", "html"],
  },
  {
    key: "planning-case",
    displayName: "Planning / Zoning Cases",
    keywords: ["zoning", "planning", "variance", "subdivision", "conditional use", "land use"],
    fileTypes: ["pdf", "html"],
  },
  {
    key: "permit",
    displayName: "Permits / Licenses",
    keywords: ["permit", "building permit", "business license", "construction permit"],
    fileTypes: ["pdf", "html"],
  },
  {
    key: "meeting-calendar",
    displayName: "Meeting Calendars",
    keywords: ["meeting calendar", "calendar", "schedule", "meeting schedule"],
    fileTypes: ["html"],
  },
  {
    key: "press-release",
    displayName: "Press Releases / News",
    keywords: ["press release", "news release", "announcement", "news"],
    fileTypes: ["html"],
  },
  {
    key: "report",
    displayName: "Reports / Studies",
    keywords: ["report", "study", "analysis", "survey", "comprehensive plan"],
    fileTypes: ["pdf", "html"],
  },
];

export const RECORD_TYPE_KEYS = RECORD_TYPES.map((r) => r.key);

// ─── Entity Type Spec ─────────────────────────────────────────────────────────

export interface EntityTypeSpec {
  /** Machine-readable key used in database and API */
  key: string;
  /** Human-readable name */
  displayName: string;
  /** Alternate display names (for Louisiana vs. other states) */
  alternateNames?: string[];
  /** Which government level this entity belongs to */
  level: EntityLevel;
  /**
   * Priority 1 = must-have (elections, budget, council meetings)
   * Priority 2 = important
   * Priority 3 = nice-to-have / less common
   */
  priority: 1 | 2 | 3;
  /** Which record types to look for at this entity */
  recordTypes: string[];
  /** Search terms to find this entity's official website */
  searchTerms: string[];
  /** URL path segments that often appear in this entity's website */
  urlHints: string[];
  /** Notes about when this entity type applies */
  notes?: string;
}

// ─── STATE-LEVEL ENTITIES ────────────────────────────────────────────────────

export const STATE_ENTITY_TYPES: EntityTypeSpec[] = [
  {
    key: "secretary-of-state",
    displayName: "Secretary of State",
    level: "state",
    priority: 1,
    recordTypes: ["election", "candidate-filing", "ballot-measure", "public-notice", "report"],
    searchTerms: ["secretary of state", "SOS office"],
    urlHints: ["sos.", "secretary.state", "secretaryofstate"],
  },
  {
    key: "state-elections-office",
    displayName: "State Elections Office",
    level: "state",
    priority: 1,
    recordTypes: ["election", "candidate-filing", "ballot-measure", "public-notice", "voter-info"],
    searchTerms: ["state elections office", "board of elections", "elections division"],
    urlHints: ["elections.", "vote.", "voting."],
  },
  {
    key: "state-legislature",
    displayName: "State Legislature",
    alternateNames: ["State Senate and House", "General Assembly", "Legislative Assembly"],
    level: "state",
    priority: 1,
    recordTypes: ["agenda", "minutes", "ordinance", "resolution", "budget", "public-notice", "report"],
    searchTerms: ["state legislature", "state senate", "state house", "general assembly", "legislative session"],
    urlHints: ["legis.", "legislature.", "senate.", "house."],
  },
  {
    key: "governor-office",
    displayName: "Governor's Office",
    level: "state",
    priority: 2,
    recordTypes: ["press-release", "report", "public-notice", "budget"],
    searchTerms: ["governor", "governor's office"],
    urlHints: ["gov.", "governor."],
  },
  {
    key: "attorney-general",
    displayName: "Attorney General",
    level: "state",
    priority: 2,
    recordTypes: ["public-notice", "report", "press-release"],
    searchTerms: ["attorney general", "AG office"],
    urlHints: ["ag.", "attorneygeneral."],
  },
  {
    key: "state-auditor",
    displayName: "State Auditor / Legislative Auditor",
    level: "state",
    priority: 1,
    recordTypes: ["audit", "financial-statement", "report"],
    searchTerms: ["state auditor", "legislative auditor", "office of the auditor", "comptroller"],
    urlHints: ["auditor.", "osa.", "la."],
    notes: "In Louisiana called the Legislative Auditor (la.gov/la)",
  },
  {
    key: "state-treasurer",
    displayName: "State Treasurer",
    level: "state",
    priority: 2,
    recordTypes: ["financial-statement", "budget", "report"],
    searchTerms: ["state treasurer", "treasury department"],
    urlHints: ["treasury.", "treasurer."],
  },
  {
    key: "ethics-commission",
    displayName: "Ethics Commission",
    level: "state",
    priority: 2,
    recordTypes: ["public-notice", "report", "press-release"],
    searchTerms: ["ethics commission", "board of ethics", "ethics board"],
    urlHints: ["ethics."],
  },
  {
    key: "campaign-finance",
    displayName: "Campaign Finance / Disclosure Office",
    level: "state",
    priority: 2,
    recordTypes: ["candidate-filing", "report", "public-notice"],
    searchTerms: ["campaign finance", "campaign disclosure", "political finance", "ORCA"],
    urlHints: ["ethics.", "sos.", "elections."],
  },
  {
    key: "dept-revenue",
    displayName: "Department of Revenue",
    level: "state",
    priority: 2,
    recordTypes: ["tax-notice", "report", "public-notice"],
    searchTerms: ["department of revenue", "revenue department", "tax department"],
    urlHints: ["revenue.", "dor.", "tax."],
  },
  {
    key: "dept-transportation",
    displayName: "Department of Transportation",
    alternateNames: ["DOTD", "DOT", "Highway Department"],
    level: "state",
    priority: 3,
    recordTypes: ["bid-rfp", "contract", "report", "public-notice", "public-hearing"],
    searchTerms: ["department of transportation", "DOT", "highway department", "DOTD"],
    urlHints: ["dotd.", "dot.", "transportation."],
  },
  {
    key: "dept-education",
    displayName: "Department of Education",
    level: "state",
    priority: 2,
    recordTypes: ["report", "public-notice", "budget", "audit"],
    searchTerms: ["department of education", "education department", "state board of education"],
    urlHints: ["doe.", "education.", "bcee."],
  },
  {
    key: "dept-health",
    displayName: "Department of Health",
    level: "state",
    priority: 2,
    recordTypes: ["report", "public-notice", "press-release"],
    searchTerms: ["department of health", "health department", "department of health and hospitals"],
    urlHints: ["health.", "dhh.", "ldh."],
  },
  {
    key: "environmental-quality",
    displayName: "Environmental Quality / DEQ",
    level: "state",
    priority: 2,
    recordTypes: ["public-notice", "report", "permit", "public-hearing"],
    searchTerms: ["department of environmental quality", "DEQ", "environmental protection", "EPA state"],
    urlHints: ["deq.", "dep.", "epa."],
  },
  {
    key: "state-police",
    displayName: "State Police / Public Safety",
    level: "state",
    priority: 3,
    recordTypes: ["report", "press-release", "public-notice"],
    searchTerms: ["state police", "department of public safety", "highway patrol", "state patrol"],
    urlHints: ["lsp.", "dps.", "statepolice.", "patrol."],
  },
];

// ─── COUNTY / PARISH-LEVEL ENTITIES ─────────────────────────────────────────

export const COUNTY_ENTITY_TYPES: EntityTypeSpec[] = [
  {
    key: "county-government",
    displayName: "County / Parish Government",
    alternateNames: ["Parish Government", "County Administration", "Parish Administration"],
    level: "county",
    priority: 1,
    recordTypes: ["agenda", "minutes", "ordinance", "resolution", "budget", "audit", "public-notice", "bid-rfp", "contract", "press-release", "financial-statement", "report"],
    searchTerms: ["county government", "parish government", "county administration", "board of supervisors", "parish president"],
    urlHints: ["co.", "parish.", "county."],
  },
  {
    key: "county-council",
    displayName: "County / Parish Council",
    alternateNames: ["Parish Council", "County Commission", "Board of Supervisors"],
    level: "county",
    priority: 1,
    recordTypes: ["agenda", "minutes", "ordinance", "resolution", "budget", "public-hearing", "public-notice"],
    searchTerms: ["county council", "parish council", "board of supervisors", "county commission", "board of commissioners"],
    urlHints: ["council.", "commission.", "supervisors."],
  },
  {
    key: "clerk-of-court",
    displayName: "Clerk of Court",
    level: "county",
    priority: 2,
    recordTypes: ["public-notice", "report", "election", "minutes"],
    searchTerms: ["clerk of court", "parish clerk", "county clerk", "circuit clerk"],
    urlHints: ["clerkofcourt.", "clerk."],
  },
  {
    key: "registrar-of-voters",
    displayName: "Registrar of Voters / Elections Office",
    alternateNames: ["Election Commission", "Board of Elections", "Election Office"],
    level: "county",
    priority: 1,
    recordTypes: ["election", "candidate-filing", "ballot-measure", "voter-info", "public-notice"],
    searchTerms: ["registrar of voters", "election office", "board of elections", "election commission", "voter registration"],
    urlHints: ["registrar.", "elections.", "vote."],
  },
  {
    key: "sheriff-office",
    displayName: "Sheriff's Office",
    level: "county",
    priority: 1,
    recordTypes: ["budget", "report", "press-release", "public-notice", "bid-rfp"],
    searchTerms: ["sheriff", "sheriff's office", "sheriff department"],
    urlHints: ["sheriff.", "so."],
  },
  {
    key: "district-attorney",
    displayName: "District Attorney",
    alternateNames: ["District Attorney's Office", "DA's Office", "Prosecutor"],
    level: "county",
    priority: 2,
    recordTypes: ["press-release", "report", "public-notice"],
    searchTerms: ["district attorney", "DA office", "prosecutor", "prosecuting attorney"],
    urlHints: ["da.", "districtattorney."],
  },
  {
    key: "tax-assessor",
    displayName: "Tax Assessor",
    alternateNames: ["Assessor's Office", "Property Assessor", "Parish Assessor"],
    level: "county",
    priority: 2,
    recordTypes: ["tax-notice", "report", "public-notice"],
    searchTerms: ["tax assessor", "assessor office", "property assessment", "parish assessor"],
    urlHints: ["assessor.", "assessment."],
  },
  {
    key: "tax-collector",
    displayName: "Tax Collector",
    alternateNames: ["Revenue Collection", "Tax Office"],
    level: "county",
    priority: 2,
    recordTypes: ["tax-notice", "financial-statement", "report"],
    searchTerms: ["tax collector", "revenue collector", "tax office"],
    urlHints: ["taxcollector.", "revenue."],
  },
  {
    key: "county-treasurer",
    displayName: "County / Parish Treasurer",
    level: "county",
    priority: 2,
    recordTypes: ["financial-statement", "budget", "report", "audit"],
    searchTerms: ["county treasurer", "parish treasurer", "finance director", "chief financial officer"],
    urlHints: ["treasurer.", "finance."],
  },
  {
    key: "public-works",
    displayName: "Public Works",
    level: "county",
    priority: 2,
    recordTypes: ["bid-rfp", "contract", "report", "public-notice"],
    searchTerms: ["public works", "roads and bridges", "infrastructure", "road department"],
    urlHints: ["publicworks.", "roads.", "infrastructure."],
  },
  {
    key: "planning-zoning",
    displayName: "Planning and Zoning",
    level: "county",
    priority: 2,
    recordTypes: ["planning-case", "ordinance", "public-hearing", "report", "agenda", "minutes"],
    searchTerms: ["planning and zoning", "planning commission", "zoning board", "land use", "planning department"],
    urlHints: ["planning.", "zoning.", "landuse."],
  },
  {
    key: "permits-inspections",
    displayName: "Permits / Inspections",
    level: "county",
    priority: 3,
    recordTypes: ["permit", "report", "public-notice"],
    searchTerms: ["permits", "building permits", "inspections", "code compliance"],
    urlHints: ["permits.", "inspections.", "building."],
  },
  {
    key: "code-enforcement",
    displayName: "Code Enforcement",
    level: "county",
    priority: 3,
    recordTypes: ["report", "public-notice"],
    searchTerms: ["code enforcement", "property maintenance", "nuisance abatement"],
    urlHints: ["code.", "enforcement."],
  },
  {
    key: "emergency-management",
    displayName: "Emergency Management / OEP",
    level: "county",
    priority: 2,
    recordTypes: ["report", "press-release", "public-notice"],
    searchTerms: ["emergency management", "office of emergency preparedness", "OEP", "homeland security"],
    urlHints: ["oep.", "emergency.", "ema."],
  },
  {
    key: "coroner",
    displayName: "Coroner / Medical Examiner",
    level: "county",
    priority: 3,
    recordTypes: ["report", "public-notice"],
    searchTerms: ["coroner", "medical examiner", "coroner's office"],
    urlHints: ["coroner."],
  },
  {
    key: "animal-control",
    displayName: "Animal Control",
    level: "county",
    priority: 3,
    recordTypes: ["report", "public-notice"],
    searchTerms: ["animal control", "animal shelter", "humane society"],
    urlHints: ["animal.", "shelter."],
  },
  {
    key: "parish-jail",
    displayName: "Parish / County Jail",
    level: "county",
    priority: 3,
    recordTypes: ["budget", "report"],
    searchTerms: ["parish jail", "county jail", "detention center", "correctional center"],
    urlHints: ["jail.", "detention."],
  },
];

// ─── CITY / MUNICIPAL-LEVEL ENTITIES ─────────────────────────────────────────

export const CITY_ENTITY_TYPES: EntityTypeSpec[] = [
  {
    key: "city-government",
    displayName: "City / Town Government",
    alternateNames: ["Town Government", "Village Government", "Municipality"],
    level: "city",
    priority: 1,
    recordTypes: ["agenda", "minutes", "ordinance", "resolution", "budget", "audit", "public-notice", "bid-rfp", "contract", "financial-statement", "report"],
    searchTerms: ["city hall", "city of", "town of", "village of", "mayor's office", "city government"],
    urlHints: ["cityof", "townof", "villageof", "ci.", "city."],
  },
  {
    key: "city-council",
    displayName: "City Council / Board of Aldermen",
    alternateNames: ["Town Council", "Board of Aldermen", "City Commission"],
    level: "city",
    priority: 1,
    recordTypes: ["agenda", "minutes", "ordinance", "resolution", "budget", "public-hearing", "public-notice"],
    searchTerms: ["city council", "board of aldermen", "town council", "city commission", "aldermen"],
    urlHints: ["council.", "aldermen."],
  },
  {
    key: "city-clerk",
    displayName: "City Clerk",
    level: "city",
    priority: 2,
    recordTypes: ["agenda", "minutes", "ordinance", "public-notice", "election", "report"],
    searchTerms: ["city clerk", "town clerk", "municipal clerk"],
    urlHints: ["cityclerk.", "clerk."],
  },
  {
    key: "police-department",
    displayName: "Police Department",
    level: "city",
    priority: 2,
    recordTypes: ["budget", "report", "press-release", "bid-rfp"],
    searchTerms: ["police department", "city police", "town police", "chief of police"],
    urlHints: ["police.", "pd.", "cpd."],
  },
  {
    key: "fire-department",
    displayName: "Fire Department",
    level: "city",
    priority: 2,
    recordTypes: ["budget", "report", "bid-rfp", "press-release"],
    searchTerms: ["fire department", "city fire", "fire chief"],
    urlHints: ["fire.", "fd.", "cfd."],
  },
  {
    key: "city-public-works",
    displayName: "City Public Works",
    level: "city",
    priority: 2,
    recordTypes: ["bid-rfp", "contract", "report", "public-notice"],
    searchTerms: ["public works", "city public works", "streets and sanitation"],
    urlHints: ["publicworks.", "streets."],
  },
  {
    key: "city-planning-zoning",
    displayName: "City Planning and Zoning",
    level: "city",
    priority: 2,
    recordTypes: ["planning-case", "ordinance", "public-hearing", "report", "agenda", "minutes"],
    searchTerms: ["city planning", "planning commission", "zoning board of appeals", "city zoning"],
    urlHints: ["planning.", "zoning."],
  },
  {
    key: "city-permits",
    displayName: "City Permits / Inspections",
    level: "city",
    priority: 3,
    recordTypes: ["permit", "report"],
    searchTerms: ["building permits", "city permits", "inspections office"],
    urlHints: ["permits.", "building.", "inspections."],
  },
  {
    key: "city-code-enforcement",
    displayName: "City Code Enforcement",
    level: "city",
    priority: 3,
    recordTypes: ["report", "public-notice"],
    searchTerms: ["code enforcement", "property standards", "nuisance"],
    urlHints: ["code.", "enforcement."],
  },
  {
    key: "municipal-court",
    displayName: "Municipal Court",
    level: "city",
    priority: 3,
    recordTypes: ["public-notice", "report"],
    searchTerms: ["municipal court", "city court", "traffic court", "city judge"],
    urlHints: ["municipal-court.", "citycourt.", "court."],
  },
  {
    key: "city-finance",
    displayName: "City Finance / Budget Office",
    level: "city",
    priority: 1,
    recordTypes: ["budget", "financial-statement", "audit", "report", "bid-rfp"],
    searchTerms: ["city finance", "finance department", "city budget", "chief financial officer"],
    urlHints: ["finance.", "budget."],
  },
];

// ─── SCHOOL / EDUCATION-LEVEL ENTITIES ───────────────────────────────────────

export const SCHOOL_ENTITY_TYPES: EntityTypeSpec[] = [
  {
    key: "school-board",
    displayName: "School Board",
    alternateNames: ["Board of Education", "School Board of Directors"],
    level: "school",
    priority: 1,
    recordTypes: ["agenda", "minutes", "budget", "audit", "policy", "public-notice", "bid-rfp", "contract", "report", "financial-statement"],
    searchTerms: ["school board", "board of education", "board of school directors"],
    urlHints: ["schoolboard.", "boe.", "doe."],
  },
  {
    key: "school-district",
    displayName: "School District",
    alternateNames: ["Unified School District", "Parish School System", "County School System"],
    level: "school",
    priority: 1,
    recordTypes: ["budget", "audit", "report", "public-notice", "agenda", "minutes", "financial-statement", "bid-rfp"],
    searchTerms: ["school district", "unified school district", "parish school system", "county schools"],
    urlHints: [".k12.", "schools.", "pss."],
  },
  {
    key: "superintendent-office",
    displayName: "Superintendent's Office",
    level: "school",
    priority: 2,
    recordTypes: ["report", "press-release", "agenda", "public-notice"],
    searchTerms: ["superintendent", "school superintendent", "superintendent of schools"],
    urlHints: ["superintendent.", "schools."],
  },
];

// ─── SPECIAL DISTRICT-LEVEL ENTITIES ─────────────────────────────────────────

export const SPECIAL_DISTRICT_TYPES: EntityTypeSpec[] = [
  {
    key: "fire-district",
    displayName: "Fire Protection District",
    level: "special-district",
    priority: 2,
    recordTypes: ["budget", "agenda", "minutes", "audit", "bid-rfp", "public-notice"],
    searchTerms: ["fire protection district", "fire district", "volunteer fire district"],
    urlHints: ["fireprotection.", "fire.", "vfd."],
  },
  {
    key: "water-district",
    displayName: "Water District / Water System",
    level: "special-district",
    priority: 2,
    recordTypes: ["budget", "agenda", "minutes", "bid-rfp", "report", "public-notice"],
    searchTerms: ["water district", "waterworks district", "water system", "water board"],
    urlHints: ["water.", "waterworks.", "wwks."],
  },
  {
    key: "sewer-district",
    displayName: "Sewer / Wastewater District",
    level: "special-district",
    priority: 2,
    recordTypes: ["budget", "agenda", "minutes", "bid-rfp", "report", "public-notice"],
    searchTerms: ["sewer district", "wastewater district", "sewerage board", "sanitation district"],
    urlHints: ["sewer.", "wastewater.", "sewerage."],
  },
  {
    key: "drainage-district",
    displayName: "Drainage District",
    level: "special-district",
    priority: 2,
    recordTypes: ["budget", "agenda", "minutes", "bid-rfp", "report", "public-notice"],
    searchTerms: ["drainage district", "flood control district", "drainage board"],
    urlHints: ["drainage.", "flood."],
  },
  {
    key: "levee-district",
    displayName: "Levee District",
    level: "special-district",
    priority: 2,
    recordTypes: ["budget", "agenda", "minutes", "report", "public-notice"],
    searchTerms: ["levee district", "levee board", "flood protection authority"],
    urlHints: ["levee.", "floodprotection."],
    notes: "Especially relevant in Louisiana",
  },
  {
    key: "recreation-district",
    displayName: "Recreation District / Parks Board",
    level: "special-district",
    priority: 3,
    recordTypes: ["budget", "agenda", "minutes", "bid-rfp", "report"],
    searchTerms: ["recreation district", "parks and recreation", "parks board"],
    urlHints: ["recreation.", "parks.", "parksandrec."],
  },
  {
    key: "library-board",
    displayName: "Library Board / System",
    level: "special-district",
    priority: 3,
    recordTypes: ["budget", "agenda", "minutes", "report", "public-notice"],
    searchTerms: ["library board", "library system", "public library", "parish library"],
    urlHints: ["library.", "lib."],
  },
  {
    key: "hospital-district",
    displayName: "Hospital District / Health Authority",
    level: "special-district",
    priority: 3,
    recordTypes: ["budget", "agenda", "minutes", "audit", "report"],
    searchTerms: ["hospital district", "health authority", "hospital service district"],
    urlHints: ["hospital.", "health."],
  },
  {
    key: "port-authority",
    displayName: "Port Authority",
    level: "special-district",
    priority: 3,
    recordTypes: ["agenda", "minutes", "budget", "bid-rfp", "contract", "report"],
    searchTerms: ["port authority", "port commission", "port of"],
    urlHints: ["port.", "portof."],
  },
  {
    key: "airport-authority",
    displayName: "Airport Authority",
    level: "special-district",
    priority: 3,
    recordTypes: ["agenda", "minutes", "budget", "bid-rfp", "contract", "report"],
    searchTerms: ["airport authority", "airport commission", "airport district"],
    urlHints: ["airport.", "flythe."],
  },
  {
    key: "transit-authority",
    displayName: "Transit Authority",
    level: "special-district",
    priority: 3,
    recordTypes: ["agenda", "minutes", "budget", "bid-rfp", "report"],
    searchTerms: ["transit authority", "public transit", "bus authority", "regional transit"],
    urlHints: ["transit.", "rta.", "bus."],
  },
  {
    key: "mosquito-abatement",
    displayName: "Mosquito Abatement District",
    level: "special-district",
    priority: 3,
    recordTypes: ["budget", "agenda", "minutes", "report"],
    searchTerms: ["mosquito abatement", "mosquito control", "pest abatement district"],
    urlHints: ["mosquito.", "abatement."],
    notes: "Especially relevant in Louisiana and coastal counties",
  },
  {
    key: "housing-authority",
    displayName: "Housing Authority",
    level: "special-district",
    priority: 3,
    recordTypes: ["agenda", "minutes", "budget", "report", "public-notice", "bid-rfp"],
    searchTerms: ["housing authority", "public housing", "HUD housing"],
    urlHints: ["housing.", "ha."],
  },
  {
    key: "utility-district",
    displayName: "Utility District",
    level: "special-district",
    priority: 3,
    recordTypes: ["budget", "agenda", "minutes", "report", "public-notice"],
    searchTerms: ["utility district", "public utility", "utility authority"],
    urlHints: ["utility.", "utilities."],
  },
];

// ─── COURT / JUSTICE-LEVEL ENTITIES ─────────────────────────────────────────

export const COURT_ENTITY_TYPES: EntityTypeSpec[] = [
  {
    key: "district-court",
    displayName: "District Court",
    alternateNames: ["Circuit Court", "Superior Court", "Parish Court"],
    level: "court",
    priority: 2,
    recordTypes: ["public-notice", "report", "meeting-calendar"],
    searchTerms: ["district court", "circuit court", "superior court", "judicial district court"],
    urlHints: ["districtcourt.", "courts.", "judicial."],
  },
  {
    key: "justice-of-peace",
    displayName: "Justice of the Peace",
    level: "court",
    priority: 3,
    recordTypes: ["public-notice"],
    searchTerms: ["justice of the peace", "JP court", "magistrate"],
    urlHints: ["jp.", "jpcourt.", "magistrate."],
  },
  {
    key: "constable",
    displayName: "Constable",
    level: "court",
    priority: 3,
    recordTypes: ["public-notice", "report"],
    searchTerms: ["constable", "constable's office"],
    urlHints: ["constable."],
  },
];

// ─── Full taxonomy (all levels combined) ─────────────────────────────────────

export const ALL_ENTITY_TYPES: EntityTypeSpec[] = [
  ...STATE_ENTITY_TYPES,
  ...COUNTY_ENTITY_TYPES,
  ...CITY_ENTITY_TYPES,
  ...SCHOOL_ENTITY_TYPES,
  ...SPECIAL_DISTRICT_TYPES,
  ...COURT_ENTITY_TYPES,
];

/** Flat map of key → spec for O(1) lookup */
export const ENTITY_TYPE_MAP: Map<string, EntityTypeSpec> = new Map(
  ALL_ENTITY_TYPES.map((e) => [e.key, e])
);

/** All entity type keys as a string array */
export const ALL_ENTITY_TYPE_KEYS: string[] = ALL_ENTITY_TYPES.map((e) => e.key);

// ─── Location checklist helpers ───────────────────────────────────────────────

export interface LocationChecklist {
  stateCode: string;
  countyParish: string;
  countyType: "parish" | "county";
  expectedEntities: EntityTypeSpec[];
  totalExpected: number;
  priorityOneCount: number;
  priorityTwoCount: number;
  priorityThreeCount: number;
}

/**
 * Returns the standard set of entity types to look for at a given location.
 *
 * Rules:
 * - State-level entities are always included (applies to the whole state)
 * - County/Parish entities are always included
 * - City entities are included as templates (specific cities need individual discovery)
 * - School entities are always included
 * - Special districts depend on location (all included as "look for these")
 * - Court entities are always included
 *
 * For Louisiana specifically, levee and mosquito districts are elevated.
 */
export function getLocationChecklist(
  stateCode: string,
  countyParish: string,
  countyType: "parish" | "county" = "county"
): LocationChecklist {
  const state = stateCode.toUpperCase();

  // State entities — always look for these
  const stateEntities = STATE_ENTITY_TYPES;

  // County entities — always included
  const countyEntities = COUNTY_ENTITY_TYPES;

  // City entities — always include as a category to look for
  const cityEntities = CITY_ENTITY_TYPES;

  // School entities
  const schoolEntities = SCHOOL_ENTITY_TYPES;

  // Special districts — include all, some may not exist locally
  const districtEntities = SPECIAL_DISTRICT_TYPES.map((e) => {
    // Elevate levee and mosquito districts in Louisiana
    if (state === "LA" && (e.key === "levee-district" || e.key === "mosquito-abatement")) {
      return { ...e, priority: 2 as const };
    }
    return e;
  });

  // Court entities
  const courtEntities = COURT_ENTITY_TYPES;

  const all = [
    ...stateEntities,
    ...countyEntities,
    ...cityEntities,
    ...schoolEntities,
    ...districtEntities,
    ...courtEntities,
  ];

  return {
    stateCode: state,
    countyParish,
    countyType,
    expectedEntities: all,
    totalExpected: all.length,
    priorityOneCount: all.filter((e) => e.priority === 1).length,
    priorityTwoCount: all.filter((e) => e.priority === 2).length,
    priorityThreeCount: all.filter((e) => e.priority === 3).length,
  };
}

/** Source category keys aligned with the record type system */
export const SOURCE_CATEGORY_MAP: Record<string, string> = {
  "agenda":              "agenda-page",
  "minutes":             "minutes-page",
  "budget":              "budget-page",
  "audit":               "audit-page",
  "election":            "election-page",
  "public-notice":       "public-notice-page",
  "bid-rfp":             "bid-page",
  "contract":            "contract-page",
  "press-release":       "news-page",
  "report":              "news-page",
  "financial-statement": "budget-page",
  "ordinance":           "minutes-page",
  "resolution":          "minutes-page",
  "tax-notice":          "public-notice-page",
  "public-hearing":      "public-notice-page",
  "planning-case":       "public-notice-page",
  "permit":              "public-notice-page",
  "meeting-calendar":    "agenda-page",
  "candidate-filing":    "election-page",
  "ballot-measure":      "election-page",
};
