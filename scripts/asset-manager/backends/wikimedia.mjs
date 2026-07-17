/**
 * Wikimedia Commons backend — looks up each celebrity's Wikipedia lead
 * image, resolves it to its Wikimedia Commons file, verifies the file
 * carries a reusable copyright license, and returns everything needed to
 * download it and record proper attribution.
 *
 * Disambiguation matters a lot here: several celebs-seed.json entries are
 * single common words (e.g. "Samantha", "Vikram") that collide with
 * unrelated Wikipedia pages — a bare "Samantha" summary lookup initially
 * landed on Elizabeth Montgomery's "Bewitched" character page, a completely
 * different real person. Note that adding an industry qualifier to the
 * *search* query (tried first, then abandoned) made this worse, not better:
 * it can shift MediaWiki's full-text relevance ranking away from the
 * correct exact-title page toward some other same-industry page (e.g.
 * "Chiranjeevi Telugu cinema actor" ranked "Pradeep Rawat (actor)" — another
 * real Telugu actor — above "Chiranjeevi" itself). The reliable approach:
 * take the bare-name direct-title match plus the top few bare-name search
 * results as ordered candidates, and accept the first one whose Wikipedia
 * extract actually mentions the expected industry/language context.
 *
 * NOTE (recorded, not re-litigated here): a reusable *copyright* license
 * (CC-BY, CC-BY-SA, CC0, public domain) only covers redistributing the
 * photo itself. It does not by itself grant a right-of-publicity/
 * personality-rights clearance to use a real person's likeness in a
 * commercial, endorsement-flavored context — that tradeoff was raised with
 * and explicitly accepted by the user before this module was built.
 */

const WIKI_USER_AGENT = "CelebStyle-AssetManager/1.0 (local fashion-catalogue asset pipeline, non-commercial development use)";
const WIKIPEDIA_API = "https://en.wikipedia.org";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

// Input is normalized (lowercased, spaces -> dashes) before this test runs.
// GODL-India = Government Open Data License – India: an official open
// license requiring attribution, comparable to CC-BY, used on Indian
// government-published photos/content.
const ALLOWED_LICENSE_RE = /^(cc0|cc-by(-sa)?-[\d.]+|pd\b|pd-.*|public-domain|godl-india)/i;

const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 2000;

// industry -> context-verification regex tested against the candidate page's extract/description
const INDUSTRY_CONTEXT = {
  Bollywood: /hindi|bollywood|indian/i,
  Tollywood: /telugu/i,
  Kollywood: /tamil/i,
  Mollywood: /malayalam/i,
  Sandalwood: /kannada/i,
  Bhojpuri: /bhojpuri/i,
  Ollywood: /odia|oriya/i,
  Hollywood: /american|british|english|actor|actress|hollywood/i,
};
const DEFAULT_CONTEXT_RE = /actor|actress|performer|celebrity|singer|politician/i;
const SEARCH_CANDIDATE_LIMIT = 5;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Normalizes "CC BY-SA 3.0" / "CC BY 3.0" / "cc-by-sa-3.0" etc. to a single dashed form for matching. */
function normalizeLicense(licenseShort) {
  return (licenseShort || "").trim().toLowerCase().replace(/\s+/g, "-");
}

async function wikiFetch(url) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": WIKI_USER_AGENT }, signal: AbortSignal.timeout(30_000) });
      if ((res.status >= 500 || res.status === 429) && attempt < RETRY_LIMIT) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_LIMIT) await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw lastErr ?? new Error("wikiFetch failed after retries");
}

async function fetchSummary(title) {
  const res = await wikiFetch(`${WIKIPEDIA_API}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
  if (!res.ok) return null;
  return res.json();
}

/** @returns {Promise<string[]>} ranked candidate titles */
async function searchWikipediaTitles(query, limit) {
  const url = `${WIKIPEDIA_API}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=${limit}`;
  const res = await wikiFetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return (json?.query?.search ?? []).map((r) => r.title);
}

function commonsFileTitleFromUrl(imageUrl) {
  const parts = new URL(imageUrl).pathname.split("/").filter(Boolean);
  // Thumbnail rendition URLs look like .../commons/thumb/a/bb/Real_Name.jpg/1920px-Real_Name.jpg —
  // the last segment is the RENDITION's own filename (size-prefixed), not the real Commons title;
  // the real filename is the segment immediately before it.
  const thumbIdx = parts.indexOf("thumb");
  const filename = thumbIdx !== -1 && parts.length > thumbIdx + 3 ? parts[parts.length - 2] : parts[parts.length - 1];
  return `File:${decodeURIComponent(filename)}`;
}

async function fetchCommonsMetadata(fileTitle) {
  const url = `${COMMONS_API}?action=query&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url|extmetadata|user&format=json`;
  const res = await wikiFetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const pages = json?.query?.pages ?? {};
  const page = Object.values(pages)[0];
  return page?.imageinfo?.[0] ?? null;
}

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, "").trim();
}

function contextMatches(summary, contextRe) {
  const text = `${summary.description ?? ""} ${summary.extract ?? ""}`;
  return contextRe.test(text);
}

/**
 * Finds the correct, disambiguated Wikipedia summary for a celebrity.
 * Candidates are tried in order — the exact bare-name title first (correct
 * for the common case), then ranked bare-name search results (catches
 * disambiguation pages and title collisions) — and the first candidate
 * whose extract/description actually matches the expected industry/language
 * context is accepted. This ordering deliberately does NOT industry-qualify
 * the search query itself (see module docstring for why that backfired).
 */
async function findVerifiedSummary(celebrityName, industry) {
  const contextRe = INDUSTRY_CONTEXT[industry] ?? DEFAULT_CONTEXT_RE;

  const candidateTitles = [celebrityName];
  const searchResults = await searchWikipediaTitles(celebrityName, SEARCH_CANDIDATE_LIMIT);
  for (const t of searchResults) {
    if (!candidateTitles.includes(t)) candidateTitles.push(t);
  }

  const rejected = [];
  for (const title of candidateTitles) {
    const summary = await fetchSummary(title);
    if (!summary) continue;
    if (contextMatches(summary, contextRe)) {
      return { summary, matchedTitle: title };
    }
    rejected.push(title);
  }
  return { summary: null, rejectedCandidates: rejected };
}

/**
 * @param {string} celebrityName
 * @param {string} industry
 * @returns {Promise<{found: boolean, reason?: string, imageUrl?: string, wikipediaUrl?: string,
 *   commonsFileTitle?: string, commonsPageUrl?: string, license?: string, licenseUrl?: string,
 *   attribution?: string, personalityRightsNote?: boolean}>}
 */
export async function lookupCelebrityImage(celebrityName, industry) {
  const { summary, rejectedCandidates } = await findVerifiedSummary(celebrityName, industry);
  if (!summary) {
    return {
      found: false,
      reason: rejectedCandidates?.length
        ? `No Wikipedia page matched the expected "${industry}" context (candidates checked: ${rejectedCandidates.join(", ")}) — likely name collision, needs manual review`
        : "No Wikipedia page found",
    };
  }
  if (!summary.originalimage?.source) {
    return { found: false, reason: "Wikipedia page has no lead image" };
  }

  const imageUrl = summary.originalimage.source;
  const wikipediaUrl = summary.content_urls?.desktop?.page ?? null;

  // Only files actually hosted on Commons (upload.wikimedia.org/wikipedia/commons/...)
  // carry the extmetadata/licensing this pipeline verifies against.
  if (!imageUrl.includes("/wikipedia/commons/")) {
    return { found: false, reason: "Lead image is not hosted on Wikimedia Commons (likely a local, non-free file)" };
  }

  const fileTitle = commonsFileTitleFromUrl(imageUrl);
  const info = await fetchCommonsMetadata(fileTitle);
  if (!info) {
    return { found: false, reason: `Could not fetch Commons metadata for ${fileTitle}` };
  }

  const meta = info.extmetadata ?? {};
  const licenseShort = meta.LicenseShortName?.value ?? meta.License?.value ?? "";
  if (!ALLOWED_LICENSE_RE.test(normalizeLicense(licenseShort))) {
    return {
      found: false,
      reason: `License not in the reusable allowlist: "${licenseShort || "unknown"}"`,
      commonsFileTitle: fileTitle,
      commonsPageUrl: info.descriptionurl,
    };
  }

  const attribution = stripHtml(meta.Attribution?.value) || stripHtml(meta.Artist?.value) || info.user || "Wikimedia Commons contributor";
  const categories = (meta.Categories?.value || "").toLowerCase();

  return {
    found: true,
    imageUrl: info.url || imageUrl,
    wikipediaUrl,
    commonsFileTitle: fileTitle,
    commonsPageUrl: info.descriptionurl,
    license: licenseShort,
    licenseUrl: meta.LicenseUrl?.value ?? null,
    attribution,
    personalityRightsNote: categories.includes("personality rights"),
  };
}

/** @returns {Promise<Buffer>} */
export async function downloadImage(imageUrl) {
  const res = await wikiFetch(imageUrl);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
