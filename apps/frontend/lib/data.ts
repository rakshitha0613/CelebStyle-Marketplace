export type Celebrity = {
  id: string;
  name: string;
  industry: string;
  bio: string;
  profileImage: string;
  bannerImage: string;
  styleTags: string[];
};

export type Outfit = {
  id: string;
  celebrityId: string;
  celebrityName: string;
  movieName: string;
  occasion: string;
  category: string;
  colorPalette: string;
  price: number;
  imageUrl: string;
  description: string;
};
import celebritySeed from "../../backend/src/data/celebs-seed.json";

type SeedCelebrity = {
  id: string;
  name: string;
  industry: string;
  bio: string;
  profileImage: string;
  bannerImage: string;
  styleTags: string[];
};

const NO_IMAGE_MARKER = "No_image_available.svg";
const wikiScreenshot = (name: string) =>
  `https://image.thum.io/get/width/1200/noanimate/https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/\s+/g, "_"))}`;
const normalizeImage = (imageUrl: string, name: string) =>
  imageUrl.includes(NO_IMAGE_MARKER) ? wikiScreenshot(name) : imageUrl;

export const celebrities: Celebrity[] = (celebritySeed.records as SeedCelebrity[]).map((entry) => ({
  id: entry.id,
  name: entry.name,
  industry: entry.industry,
  bio: entry.bio,
  profileImage: normalizeImage(entry.profileImage, entry.name),
  bannerImage: normalizeImage(entry.bannerImage, entry.name),
  styleTags: entry.styleTags
}));

const celebrityNameById = new Map(celebrities.map((entry) => [entry.id, entry.name]));

export const outfits: Outfit[] = [
  {
    id: "look-shah-rukh-khan-red-carpet",
    celebrityId: "shah-rukh-khan",
    celebrityName: celebrityNameById.get("shah-rukh-khan") || "Shah Rukh Khan",
    movieName: "Award Night Edit",
    occasion: "Party",
    category: "Bandhgala",
    colorPalette: "Black, charcoal, silver",
    price: 28999,
    imageUrl: celebrities.find((entry) => entry.id === "shah-rukh-khan")?.profileImage || "",
    description: "Signature polished eveningwear inspired by iconic award-season appearances."
  },
  {
    id: "look-deepika-padukone-wedding",
    celebrityId: "deepika-padukone",
    celebrityName: celebrityNameById.get("deepika-padukone") || "Deepika Padukone",
    movieName: "Wedding Edit",
    occasion: "Wedding",
    category: "Saree",
    colorPalette: "Gold, crimson, ivory",
    price: 32999,
    imageUrl: celebrities.find((entry) => entry.id === "deepika-padukone")?.profileImage || "",
    description: "Grand drape styling with premium embellishment for bridal and festive functions."
  },
  {
    id: "look-priyanka-chopra-party",
    celebrityId: "priyanka-chopra",
    celebrityName: celebrityNameById.get("priyanka-chopra") || "Priyanka Chopra",
    movieName: "Global Gala Edit",
    occasion: "Party",
    category: "Gown",
    colorPalette: "Champagne, nude, gold",
    price: 35999,
    imageUrl: celebrities.find((entry) => entry.id === "priyanka-chopra")?.profileImage || "",
    description: "High-glamour replica gown built for evening events and destination celebrations."
  },
  {
    id: "look-allu-arjun-festive",
    celebrityId: "allu-arjun",
    celebrityName: celebrityNameById.get("allu-arjun") || "Allu Arjun",
    movieName: "Festive Hero Edit",
    occasion: "Festival",
    category: "Kurta Set",
    colorPalette: "Ivory, beige, maroon",
    price: 16999,
    imageUrl: celebrities.find((entry) => entry.id === "allu-arjun")?.profileImage || "",
    description: "Contemporary festive set inspired by celebratory public appearances."
  },
  {
    id: "look-prabhas-party",
    celebrityId: "prabhas",
    celebrityName: celebrityNameById.get("prabhas") || "Prabhas",
    movieName: "Premiere Edit",
    occasion: "Party",
    category: "Blazer",
    colorPalette: "Navy, black, white",
    price: 22499,
    imageUrl: celebrities.find((entry) => entry.id === "prabhas")?.profileImage || "",
    description: "Structured blazer ensemble for premium social and launch events."
  },
  {
    id: "look-rajinikanth-classic",
    celebrityId: "rajinikanth",
    celebrityName: celebrityNameById.get("rajinikanth") || "Rajinikanth",
    movieName: "Classic Star Edit",
    occasion: "Festival",
    category: "Shirt + Veshti",
    colorPalette: "White, cream, gold",
    price: 14999,
    imageUrl: celebrities.find((entry) => entry.id === "rajinikanth")?.profileImage || "",
    description: "Timeless South-style traditional set with clean tailoring and comfort finish."
  },
  {
    id: "look-dulquer-salmaan-formal",
    celebrityId: "dulquer-salmaan",
    celebrityName: celebrityNameById.get("dulquer-salmaan") || "Dulquer Salmaan",
    movieName: "Urban Formal Edit",
    occasion: "Party",
    category: "Suit",
    colorPalette: "Slate, charcoal, white",
    price: 26999,
    imageUrl: celebrities.find((entry) => entry.id === "dulquer-salmaan")?.profileImage || "",
    description: "Modern soft-structured suit replica for polished city events."
  },
  {
    id: "look-yash-festival",
    celebrityId: "yash",
    celebrityName: celebrityNameById.get("yash") || "Yash",
    movieName: "Mass Festive Edit",
    occasion: "Festival",
    category: "Sherwani",
    colorPalette: "Black, bronze, tan",
    price: 27999,
    imageUrl: celebrities.find((entry) => entry.id === "yash")?.profileImage || "",
    description: "Statement festive sherwani inspired by high-profile celebratory appearances."
  },
  {
    id: "look-khesari-lal-yadav-wedding",
    celebrityId: "khesari-lal-yadav",
    celebrityName: celebrityNameById.get("khesari-lal-yadav") || "Khesari Lal Yadav",
    movieName: "Wedding Stage Edit",
    occasion: "Wedding",
    category: "Kurta",
    colorPalette: "Royal blue, white, silver",
    price: 12999,
    imageUrl: celebrities.find((entry) => entry.id === "khesari-lal-yadav")?.profileImage || "",
    description: "Bhojpuri-inspired wedding look with bright stage-ready detailing."
  },
  {
    id: "look-anubhav-mohanty-festival",
    celebrityId: "anubhav-mohanty",
    celebrityName: celebrityNameById.get("anubhav-mohanty") || "Anubhav Mohanty",
    movieName: "Odia Festive Edit",
    occasion: "Festival",
    category: "Nehru Jacket Set",
    colorPalette: "Olive, cream, rust",
    price: 13999,
    imageUrl: celebrities.find((entry) => entry.id === "anubhav-mohanty")?.profileImage || "",
    description: "Heritage-inspired festive set suitable for regional celebrations and gatherings."
  },
  {
    id: "look-zendaya-red-carpet",
    celebrityId: "zendaya",
    celebrityName: celebrityNameById.get("zendaya") || "Zendaya",
    movieName: "Red Carpet Edit",
    occasion: "Party",
    category: "Evening Dress",
    colorPalette: "Black, silver, chrome",
    price: 41999,
    imageUrl: celebrities.find((entry) => entry.id === "zendaya")?.profileImage || "",
    description: "International red-carpet silhouette replica with precision evening tailoring."
  },
  {
    id: "look-tom-cruise-formal",
    celebrityId: "tom-cruise",
    celebrityName: celebrityNameById.get("tom-cruise") || "Tom Cruise",
    movieName: "Premiere Formal Edit",
    occasion: "Party",
    category: "Tuxedo",
    colorPalette: "Black, white, satin",
    price: 38999,
    imageUrl: celebrities.find((entry) => entry.id === "tom-cruise")?.profileImage || "",
    description: "Classic tuxedo replica inspired by global film premiere styling."
  }
];
