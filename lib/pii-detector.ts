/**
 * PII (Personal Identifiable Information) Detection Module
 * Uses regex patterns and heuristics to detect potential personal information
 * No external API calls - all detection is done locally
 */

export interface PIIDetectionResult {
  hasPII: boolean;
  flags: PIIFlag[];
  message: string;
}

export interface PIIFlag {
  type: PIIType;
  match: string;
  confidence: "high" | "medium" | "low";
}

export type PIIType =
  | "email"
  | "phone"
  | "ssn"
  | "government_id"
  | "social_profile_url"
  | "physical_address"
  | "person_name"
  | "company_name"
  | "specific_location";

// Regex patterns for PII detection
const PATTERNS = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,

  // Phone numbers (various formats)
  phone: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,

  // Social Security Numbers (US)
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,

  // Government IDs (passport-like patterns, driver's license patterns)
  governmentId: /\b[A-Z]{1,2}\d{6,9}\b/gi,

  // Social media profile URLs
  socialProfileUrl:
    /https?:\/\/(?:www\.)?(?:linkedin\.com\/in\/|facebook\.com\/|twitter\.com\/|instagram\.com\/|tiktok\.com\/@)[A-Za-z0-9._-]+/gi,

  // Physical addresses - street number + street name patterns
  physicalAddress:
    /\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Circle|Cir|Place|Pl)\.?\b/gi,

  // ZIP codes (US)
  zipCode: /\b\d{5}(?:-\d{4})?\b/g,

  // Company suffixes
  companyName:
    /\b[A-Z][A-Za-z0-9\s&]+\s+(?:Inc\.?|LLC|Corp\.?|Corporation|Ltd\.?|Limited|LLP|Co\.?|Company|Group|Holdings|Partners|Associates)\b/gi,
};

// Common first names to help detect person names (partial list, case-insensitive)
const COMMON_FIRST_NAMES = new Set([
  "james",
  "john",
  "robert",
  "michael",
  "david",
  "william",
  "richard",
  "joseph",
  "thomas",
  "christopher",
  "charles",
  "daniel",
  "matthew",
  "anthony",
  "mark",
  "donald",
  "steven",
  "paul",
  "andrew",
  "joshua",
  "mary",
  "patricia",
  "jennifer",
  "linda",
  "barbara",
  "elizabeth",
  "susan",
  "jessica",
  "sarah",
  "karen",
  "lisa",
  "nancy",
  "betty",
  "margaret",
  "sandra",
  "ashley",
  "kimberly",
  "emily",
  "donna",
  "michelle",
  "emma",
  "olivia",
  "ava",
  "sophia",
  "isabella",
  "mia",
  "charlotte",
  "amelia",
  "harper",
  "evelyn",
  "liam",
  "noah",
  "oliver",
  "elijah",
  "lucas",
  "mason",
  "logan",
  "alexander",
  "ethan",
  "jacob",
  "benjamin",
  "henry",
  "sebastian",
  "jack",
  "aiden",
  "owen",
  "samuel",
  "ryan",
  "nathan",
  "brian",
  "kevin",
  "jason",
  "jeffrey",
  "scott",
  "timothy",
  "frank",
  "raymond",
  "gregory",
  "jose",
  "carlos",
  "maria",
  "anna",
  "katherine",
  "catherine",
  "stephanie",
  "rebecca",
  "rachel",
  "laura",
  "heather",
  "nicole",
  "amy",
  "angela",
  "melissa",
  "brenda",
  "deborah",
  "carolyn",
  "janet",
  "samantha",
  "amanda",
  "christine",
  "diane",
  "alice",
  "julie",
]);

// Words that indicate generic references (not flagged)
const GENERIC_REFERENCES = new Set([
  "my manager",
  "my boss",
  "my coworker",
  "my colleague",
  "my friend",
  "my partner",
  "my spouse",
  "my wife",
  "my husband",
  "my ex",
  "my therapist",
  "my doctor",
  "the company",
  "a company",
  "the startup",
  "a startup",
  "tech company",
  "the user",
  "a user",
  "the client",
  "a client",
]);

// Specific location indicators (cities, states often appear with these)
const LOCATION_INDICATORS = [
  /\bin\s+(?:downtown\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s+(?:CA|NY|TX|FL|IL|PA|OH|GA|NC|MI|NJ|VA|WA|AZ|MA|TN|IN|MO|MD|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|IA|UT|NV|AR|MS|KS|NM|NE|ID|WV|HI|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY|DC)\b/gi,
  /\b(?:San\s+Francisco|Los\s+Angeles|New\s+York|Chicago|Houston|Phoenix|Philadelphia|San\s+Antonio|San\s+Diego|Dallas|Austin|Seattle|Boston|Denver|Atlanta|Miami|Portland|Las\s+Vegas|Detroit|Minneapolis|Charlotte)\b/gi,
];

/**
 * Detects potential PII in text
 */
export function detectPII(text: string): PIIDetectionResult {
  const flags: PIIFlag[] = [];

  // Check email addresses
  const emails = text.match(PATTERNS.email);
  if (emails) {
    emails.forEach((match) => {
      flags.push({ type: "email", match, confidence: "high" });
    });
  }

  // Check phone numbers
  const phones = text.match(PATTERNS.phone);
  if (phones) {
    phones.forEach((match) => {
      // Filter out numbers that are likely not phone numbers (like years)
      if (!/^(19|20)\d{2}$/.test(match.replace(/\D/g, "").slice(0, 4))) {
        flags.push({ type: "phone", match, confidence: "high" });
      }
    });
  }

  // Check SSNs
  const ssns = text.match(PATTERNS.ssn);
  if (ssns) {
    ssns.forEach((match) => {
      // SSNs shouldn't start with 000, 666, or 9xx
      const digits = match.replace(/\D/g, "");
      if (
        !digits.startsWith("000") &&
        !digits.startsWith("666") &&
        !digits.startsWith("9")
      ) {
        flags.push({ type: "ssn", match, confidence: "high" });
      }
    });
  }

  // Check social profile URLs
  const socialUrls = text.match(PATTERNS.socialProfileUrl);
  if (socialUrls) {
    socialUrls.forEach((match) => {
      flags.push({ type: "social_profile_url", match, confidence: "high" });
    });
  }

  // Check physical addresses
  const addresses = text.match(PATTERNS.physicalAddress);
  if (addresses) {
    addresses.forEach((match) => {
      flags.push({ type: "physical_address", match, confidence: "medium" });
    });
  }

  // Check company names
  const companies = text.match(PATTERNS.companyName);
  if (companies) {
    companies.forEach((match) => {
      // Skip if it's a well-known tech company that's commonly discussed
      const commonCompanies = [
        "google",
        "microsoft",
        "apple",
        "amazon",
        "meta",
        "openai",
        "anthropic",
      ];
      if (!commonCompanies.some((c) => match.toLowerCase().includes(c))) {
        flags.push({ type: "company_name", match, confidence: "medium" });
      }
    });
  }

  // Check for specific locations
  LOCATION_INDICATORS.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        flags.push({ type: "specific_location", match, confidence: "medium" });
      });
    }
  });

  // Check for person names (First Last pattern with common first names)
  const personNamePattern = /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g;
  let nameMatch;
  while ((nameMatch = personNamePattern.exec(text)) !== null) {
    const firstName = nameMatch[1].toLowerCase();
    const fullMatch = nameMatch[0];

    // Skip if it matches a generic reference pattern
    const textLower = text.toLowerCase();
    const isGeneric = Array.from(GENERIC_REFERENCES).some((ref) =>
      textLower.includes(ref)
    );

    // Skip common non-name phrases
    const skipPhrases = [
      "United States",
      "New York",
      "Los Angeles",
      "San Francisco",
      "Last Week",
      "Next Week",
      "Last Month",
      "Next Month",
    ];
    if (skipPhrases.some((phrase) => fullMatch === phrase)) {
      continue;
    }

    if (COMMON_FIRST_NAMES.has(firstName) && !isGeneric) {
      flags.push({
        type: "person_name",
        match: fullMatch,
        confidence: "medium",
      });
    }
  }

  // Build the result
  const hasPII = flags.length > 0;
  const message = hasPII
    ? buildWarningMessage(flags)
    : "No personal information detected.";

  return { hasPII, flags, message };
}

/**
 * Builds a user-friendly warning message based on detected flags
 */
function buildWarningMessage(flags: PIIFlag[]): string {
  const flagTypes = [...new Set(flags.map((f) => f.type))];

  const typeMessages: Record<PIIType, string> = {
    email: "email addresses",
    phone: "phone numbers",
    ssn: "Social Security numbers",
    government_id: "government ID numbers",
    social_profile_url: "social media profile links",
    physical_address: "physical addresses",
    person_name: "what appears to be real names",
    company_name: "specific company names",
    specific_location: "specific location names",
  };

  const detectedTypes = flagTypes
    .map((type) => typeMessages[type])
    .filter(Boolean);

  return `Your submission may contain personal or identifying information (${detectedTypes.join(", ")}). Please review and remove any real names, companies, or locations before resubmitting. Use fake names or descriptions like "my manager" or "a tech company" instead.`;
}

/**
 * Sanitizes text by replacing detected PII with generic placeholders
 * This is an optional function if you want to auto-scrub instead of reject
 */
export function sanitizePII(text: string): string {
  let sanitized = text;

  // Replace emails
  sanitized = sanitized.replace(PATTERNS.email, "[email removed]");

  // Replace phone numbers
  sanitized = sanitized.replace(PATTERNS.phone, "[phone removed]");

  // Replace SSNs
  sanitized = sanitized.replace(PATTERNS.ssn, "[SSN removed]");

  // Replace social profile URLs
  sanitized = sanitized.replace(
    PATTERNS.socialProfileUrl,
    "[social profile removed]"
  );

  return sanitized;
}

/**
 * Quick check if text likely contains PII (for performance)
 */
export function quickPIICheck(text: string): boolean {
  // Quick regex tests for most common PII patterns
  if (PATTERNS.email.test(text)) return true;
  if (PATTERNS.phone.test(text)) return true;
  if (PATTERNS.socialProfileUrl.test(text)) return true;

  // Reset lastIndex after test()
  PATTERNS.email.lastIndex = 0;
  PATTERNS.phone.lastIndex = 0;
  PATTERNS.socialProfileUrl.lastIndex = 0;

  return false;
}
