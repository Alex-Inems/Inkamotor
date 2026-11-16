import type { Lead } from "@/lib/demo-data";
import { parseLeadDetails } from "@/lib/crm/contact-details";

export type ClientLanguage = "en" | "fr" | "es" | "unknown";

export type LanguageDetectionResult = {
  language: ClientLanguage;
  confidence: "high" | "medium" | "low";
  reason: string;
};

// Common language stop-words and domain vocabulary for tourism/tours
const FR_WORDS =
  /\b(bonjour|bonsoir|merci|cordialement|vous|nous|avec|dans|cette|votre|notre|pour|roadtrip|circuit|devis|journée|ravie|ravie?|rencontre|moto|formule|inscrire|places|départ|hébergement|salutations|bien\s+à\s+vous|excellente)\b/i;

const ES_WORDS =
  /\b(hola|buenos\s+d[ií]as|buenas\s+tardes|gracias|saludos|cordiales|usted|nosotros|para|con|este|esta|su|nuestro|nuestra|viaje|cotizaci[oó]n|precio|inscripci[oó]n|salida|alojamiento|atentamente|un\s+saludo)\b/i;

const EN_WORDS =
  /\b(hello|hi|thanks|thank\s+you|regards|sincerely|cheers|you|we|our|your|with|for|quote|tour|trip|booking|pricing|deposit|departure|accommodation|motorcycle|ride|best\s+regards)\b/i;

const FR_COUNTRIES =
  /^(france|belgique|belgium|suisse|switzerland|luxembourg|monaco|senegal|sénégal|côte\s+d'ivoire|cote\s+d'ivoire|madagascar|algerie|algérie|tunisie|maroc|morocco)$/i;

const ES_COUNTRIES =
  /^(espagne|spain|españa|mexique|mexico|méxico|colombie|colombia|argentine|argentina|chili|chile|pérou|peru|perú|équateur|ecuador|bolivie|bolivia|guatemala|costa\s+rica|panama|panamá|uruguay|paraguay|venezuela)$/i;

const EN_COUNTRIES =
  /^(united\s+states|usa|u\.s\.a\.|etats-unis|états-unis|united\s+kingdom|uk|u\.k\.|royaume-uni|england|angleterre|scotland|ecosse|écosse|australia|australie|canada|ireland|irlande|new\s+zealand|nouvelle-zélande|south\s+africa|afrique\s+du\s+sud)$/i;

/**
 * Detect language of a freeform text string (email body, inquiry message, etc.).
 */
export function detectTextLanguage(text: string): {
  language: ClientLanguage;
  confidence: "high" | "medium" | "low";
} {
  const clean = text.trim();
  if (!clean || clean.length < 4) {
    return { language: "unknown", confidence: "low" };
  }

  const frMatches = (clean.match(new RegExp(FR_WORDS, "gi")) || []).length;
  const esMatches = (clean.match(new RegExp(ES_WORDS, "gi")) || []).length;
  const enMatches = (clean.match(new RegExp(EN_WORDS, "gi")) || []).length;

  const total = frMatches + esMatches + enMatches;
  if (total === 0) {
    return { language: "unknown", confidence: "low" };
  }

  if (frMatches > esMatches && frMatches > enMatches) {
    return {
      language: "fr",
      confidence: frMatches >= 3 ? "high" : "medium",
    };
  }
  if (esMatches > frMatches && esMatches > enMatches) {
    return {
      language: "es",
      confidence: esMatches >= 3 ? "high" : "medium",
    };
  }
  if (enMatches > frMatches && enMatches > esMatches) {
    return {
      language: "en",
      confidence: enMatches >= 3 ? "high" : "medium",
    };
  }

  return { language: "unknown", confidence: "low" };
}

/**
 * Determine client's primary language through a multi-tiered hierarchy:
 * 1. Conversation message text (highest accuracy)
 * 2. Explicit "Langue / Language" tag or note
 * 3. Country / Pays
 * 4. International phone code (+33, +34, +1, +44, etc.)
 * 5. Email TLD (.fr, .es, .co.uk, etc.)
 * 6. Keyword heuristic on notes
 */
export function detectClientLanguage(
  lead: Pick<Lead, "name" | "email" | "phone" | "notes">,
  options?: {
    messagesText?: string;
    explicitCountry?: string;
  },
): LanguageDetectionResult {
  // 1. Text from actual messages sent to/from this client (Highest Confidence)
  if (options?.messagesText?.trim()) {
    const textResult = detectTextLanguage(options.messagesText);
    if (textResult.language !== "unknown") {
      return {
        language: textResult.language,
        confidence: "high",
        reason: `Email exchange matches ${textResult.language.toUpperCase()}`,
      };
    }
  }

  const notes = lead.notes ?? "";
  const details = parseLeadDetails(lead as Lead);

  // 2. Explicit Language field in notes or extras
  const notesLower = notes.toLowerCase();
  const langMatch = notesLower.match(/(?:langue|language|idioma)\s*:\s*([^\n;]+)/i);
  if (langMatch) {
    const val = langMatch[1].trim();
    if (/fr|french|français|francais/i.test(val)) {
      return { language: "fr", confidence: "high", reason: `Note field: ${langMatch[0].trim()}` };
    }
    if (/es|spanish|espagnol|español/i.test(val)) {
      return { language: "es", confidence: "high", reason: `Note field: ${langMatch[0].trim()}` };
    }
    if (/en|english|anglais|inglés|ingles/i.test(val)) {
      return { language: "en", confidence: "high", reason: `Note field: ${langMatch[0].trim()}` };
    }
  }

  // 3. Country match (explicitCountry or details.country or notes "Pays:")
  const country = (options?.explicitCountry || details.country || "").trim();
  if (country) {
    if (FR_COUNTRIES.test(country)) {
      return { language: "fr", confidence: "high", reason: `Country: ${country}` };
    }
    if (ES_COUNTRIES.test(country)) {
      return { language: "es", confidence: "high", reason: `Country: ${country}` };
    }
    if (EN_COUNTRIES.test(country)) {
      return { language: "en", confidence: "high", reason: `Country: ${country}` };
    }
  }

  const paysMatch = notes.match(/(?:pays|country|pais|país)\s*:\s*([^\n;]+)/i);
  if (paysMatch) {
    const val = paysMatch[1].trim();
    if (FR_COUNTRIES.test(val)) {
      return { language: "fr", confidence: "high", reason: `Country in note: ${val}` };
    }
    if (ES_COUNTRIES.test(val)) {
      return { language: "es", confidence: "high", reason: `Country in note: ${val}` };
    }
    if (EN_COUNTRIES.test(val)) {
      return { language: "en", confidence: "high", reason: `Country in note: ${val}` };
    }
  }

  // 4. Phone prefix
  const phoneClean = (lead.phone || "").replace(/\s+/g, "");
  const digits = phoneClean.replace(/\D/g, "");

  if (
    phoneClean.startsWith("+33") ||
    phoneClean.startsWith("0033") ||
    /^0[67]\d{8}$/.test(digits)
  ) {
    return { language: "fr", confidence: "medium", reason: `French phone format (${phoneClean})` };
  }
  if (
    phoneClean.startsWith("+32") ||
    phoneClean.startsWith("0032") ||
    phoneClean.startsWith("+41") ||
    phoneClean.startsWith("0041")
  ) {
    return { language: "fr", confidence: "medium", reason: `Belgian/Swiss phone (${phoneClean})` };
  }
  if (
    phoneClean.startsWith("+34") ||
    phoneClean.startsWith("0034") ||
    phoneClean.startsWith("+52") ||
    phoneClean.startsWith("+54") ||
    phoneClean.startsWith("+57") ||
    phoneClean.startsWith("+51")
  ) {
    return { language: "es", confidence: "medium", reason: `Spanish/LatAm phone (${phoneClean})` };
  }
  if (
    phoneClean.startsWith("+44") ||
    phoneClean.startsWith("0044") ||
    phoneClean.startsWith("+61") ||
    phoneClean.startsWith("+353") ||
    (phoneClean.startsWith("+1") && digits.length === 11)
  ) {
    return { language: "en", confidence: "medium", reason: `US/UK/AU phone (${phoneClean})` };
  }

  // 5. Email TLD
  const email = (lead.email || "").toLowerCase().trim();
  if (email.endsWith(".fr") || email.endsWith(".free.fr") || email.endsWith(".orange.fr")) {
    return { language: "fr", confidence: "medium", reason: `French email domain (${email})` };
  }
  if (email.endsWith(".be") || email.endsWith(".ch")) {
    return { language: "fr", confidence: "medium", reason: `BE/CH email domain (${email})` };
  }
  if (
    email.endsWith(".es") ||
    email.endsWith(".mx") ||
    email.endsWith(".ar") ||
    email.endsWith(".co") ||
    email.endsWith(".pe")
  ) {
    return { language: "es", confidence: "medium", reason: `Spanish/LatAm email domain (${email})` };
  }
  if (
    email.endsWith(".co.uk") ||
    email.endsWith(".com.au") ||
    email.endsWith(".ie") ||
    email.endsWith(".nz") ||
    email.endsWith(".us")
  ) {
    return { language: "en", confidence: "medium", reason: `UK/AU/US email domain (${email})` };
  }

  // 6. Keywords in freeform notes
  const noteLang = detectTextLanguage(notes);
  if (noteLang.language !== "unknown") {
    return {
      language: noteLang.language,
      confidence: "low",
      reason: `Vocabulary in notes (${noteLang.language.toUpperCase()})`,
    };
  }

  // 7. Event mentions in tags/notes (e.g., Barcelonnette moto festival = France)
  if (/barcelonnette|salon\s+moto\s+paris/i.test(notes) || /barcelonnette/i.test(details.tags)) {
    return { language: "fr", confidence: "medium", reason: "French event tag (Barcelonnette / Paris)" };
  }

  return { language: "unknown", confidence: "low", reason: "Insufficient signals" };
}

export const LANGUAGE_LABELS: Record<ClientLanguage, { name: string; flag: string; code: string }> = {
  en: { name: "English", flag: "🇬🇧", code: "EN" },
  fr: { name: "Français", flag: "🇫🇷", code: "FR" },
  es: { name: "Español", flag: "🇪🇸", code: "ES" },
  unknown: { name: "Unspecified", flag: "🌐", code: "?" },
};
