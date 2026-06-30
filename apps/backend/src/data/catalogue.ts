export type CelebrityRecord = {
  id: string;
  name: string;
  industry: string;
  bio: string;
  profileImage: string;
  bannerImage: string;
  styleTags: string[];
};

export type OutfitRecord = {
  id: string;
  celebrityId: string;
  movieName: string;
  occasion: string;
  category: string;
  colorPalette: string;
  price: number;
  imageUrl: string;
  images?: string[];       // multiple angle images (Myntra-style gallery)
  description: string;
  characterName?: string;
  year?: number;
  manufacturerIds?: string[];
};
import celebritySeed from "./celebs-seed.json" with { type: "json" };

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

export const celebrityRecords: CelebrityRecord[] = (celebritySeed.records as SeedCelebrity[]).map((entry) => ({
  id: entry.id,
  name: entry.name,
  industry: entry.industry,
  bio: entry.bio,
  profileImage: normalizeImage(entry.profileImage, entry.name),
  bannerImage: normalizeImage(entry.bannerImage, entry.name),
  styleTags: entry.styleTags
}));

const celebrityById = new Map(celebrityRecords.map((entry) => [entry.id, entry]));
const outfitImage = (celebrityId: string) => celebrityById.get(celebrityId)?.profileImage || "";

export const outfitRecords: OutfitRecord[] = [
  // ─────────────── BOLLYWOOD ───────────────
  {
    id: "look-shah-rukh-khan-red-carpet",
    celebrityId: "shah-rukh-khan",
    movieName: "Pathaan",
    occasion: "Party",
    category: "Bandhgala",
    colorPalette: "Black, charcoal, silver",
    price: 28999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Shah_Rukh_Khan_graces_the_launch_of_the_new_Santro.jpg/330px-Shah_Rukh_Khan_graces_the_launch_of_the_new_Santro.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Shah_Rukh_Khan_graces_the_launch_of_the_new_Santro.jpg/330px-Shah_Rukh_Khan_graces_the_launch_of_the_new_Santro.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/SRK_Filmfare_2023.jpg/330px-SRK_Filmfare_2023.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Pathaan_(film)",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Shah_Rukh_Khan_graces_the_launch_of_the_new_Santro.jpg/150px-Shah_Rukh_Khan_graces_the_launch_of_the_new_Santro.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Shah_Rukh_Khan"
    ],
    description: "Iconic black bandhgala suit worn by SRK at the Filmfare Awards. Sharp lapels, structured silhouette with subtle silver zari details.",
    characterName: "Pathaan / Vikram",
    year: 2023,
    manufacturerIds: ["mfr-tarun-tahiliani"]
  },
  {
    id: "look-shah-rukh-khan-jawan",
    celebrityId: "shah-rukh-khan",
    movieName: "Jawan",
    occasion: "Festival",
    category: "Military Kurta",
    colorPalette: "Olive green, khaki, black",
    price: 18999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c9/Jawan_film_poster.jpg/220px-Jawan_film_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/c/c9/Jawan_film_poster.jpg/220px-Jawan_film_poster.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Jawan_(2023_film)",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Shah_Rukh_Khan_graces_the_launch_of_the_new_Santro.jpg/330px-Shah_Rukh_Khan_graces_the_launch_of_the_new_Santro.jpg",
      "https://image.thum.io/get/width/400/noanimate/https://en.wikipedia.org/wiki/Shah_Rukh_Khan"
    ],
    description: "Rugged military-inspired kurta from Jawan's iconic action sequences. Olive green cotton with utility pockets and mandarin collar.",
    characterName: "Azad / Vikram Rathore",
    year: 2023,
    manufacturerIds: ["mfr-manish-malhotra"]
  },
  {
    id: "look-deepika-padukone-wedding",
    celebrityId: "deepika-padukone",
    movieName: "Gehraiyaan Press Tour",
    occasion: "Wedding",
    category: "Saree",
    colorPalette: "Gold, crimson, ivory",
    price: 32999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Deepika_Padukone_2025_%281%29.png/330px-Deepika_Padukone_2025_%281%29.png",
    images: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Deepika_Padukone_2025_%281%29.png/330px-Deepika_Padukone_2025_%281%29.png",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Deepika_Padukone_at_Cannes_2022.jpg/330px-Deepika_Padukone_at_Cannes_2022.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Deepika_Padukone",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Deepika_Padukone_2025_%281%29.png/150px-Deepika_Padukone_2025_%281%29.png",
      "https://image.thum.io/get/width/400/noanimate/https://en.wikipedia.org/wiki/Gehraiyaan"
    ],
    description: "Sabyasachi-inspired Banarasi silk saree with gold zari border. Deep crimson drape with ivory blouse worn at her Cannes appearance.",
    characterName: "Red Carpet / Promotional",
    year: 2022,
    manufacturerIds: ["mfr-sabyasachi"]
  },
  {
    id: "look-deepika-padukone-pathaan",
    celebrityId: "deepika-padukone",
    movieName: "Pathaan",
    occasion: "Party",
    category: "Action Bodysuit",
    colorPalette: "Red, black, gold",
    price: 22999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/5/5a/Pathaan_film_poster.jpg/220px-Pathaan_film_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/5/5a/Pathaan_film_poster.jpg/220px-Pathaan_film_poster.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Pathaan_(film)",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Deepika_Padukone_2025_%281%29.png/330px-Deepika_Padukone_2025_%281%29.png"
    ],
    description: "Iconic red combat look from Pathaan's Besharam Rang sequence. Sleek bodysuit with golden detailing for the bold Bollywood heroine.",
    characterName: "Rubina",
    year: 2023,
    manufacturerIds: ["mfr-manish-malhotra"]
  },
  {
    id: "look-priyanka-chopra-party",
    celebrityId: "priyanka-chopra",
    movieName: "Met Gala",
    occasion: "Party",
    category: "Gown",
    colorPalette: "Champagne, nude, gold",
    price: 35999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/45/Priyanka_Chopra_at_Bulgary_launch%2C_2024_%28cropped%29.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/commons/4/45/Priyanka_Chopra_at_Bulgary_launch%2C_2024_%28cropped%29.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Priyanka_Chopra_at_TIFF.jpg/330px-Priyanka_Chopra_at_TIFF.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Priyanka_Chopra",
      "https://upload.wikimedia.org/wikipedia/commons/4/45/Priyanka_Chopra_at_Bulgary_launch%2C_2024_%28cropped%29.jpg",
      "https://image.thum.io/get/width/400/noanimate/https://en.wikipedia.org/wiki/Met_Gala"
    ],
    description: "High-glamour champagne gown replica inspired by PC's Met Gala appearance. Structured bodice with floor-sweeping train for grand occasions.",
    characterName: "Global Event",
    year: 2024,
    manufacturerIds: ["mfr-manish-malhotra", "mfr-tarun-tahiliani"]
  },
  {
    id: "look-ranveer-singh-gully-boy",
    celebrityId: "ranveer-singh",
    movieName: "Gully Boy",
    occasion: "Festival",
    category: "Streetwear Set",
    colorPalette: "Black, white, neon yellow",
    price: 12999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/8/81/Gully_Boy_poster.jpg/220px-Gully_Boy_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/8/81/Gully_Boy_poster.jpg/220px-Gully_Boy_poster.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/3/32/Ranveer_Singh_in_2023_%281%29_%28cropped%29.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Gully_Boy",
      "https://upload.wikimedia.org/wikipedia/commons/3/32/Ranveer_Singh_in_2023_%281%29_%28cropped%29.jpg"
    ],
    description: "Urban streetwear inspired by Murad's iconic look from Gully Boy. Oversized hoodie, baggy cargo pants, and signature chain accessory.",
    characterName: "Murad",
    year: 2019,
    manufacturerIds: ["mfr-manish-malhotra"]
  },
  {
    id: "look-hrithik-roshan-war",
    celebrityId: "hrithik-roshan",
    movieName: "War",
    occasion: "Party",
    category: "Blazer Set",
    colorPalette: "Navy, white, gold",
    price: 29999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/1/14/War_2019_film_poster.jpg/220px-War_2019_film_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/1/14/War_2019_film_poster.jpg/220px-War_2019_film_poster.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/9/92/Hrithik_Roshan_in_2024_%28cropped%29.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/War_(2019_film)",
      "https://upload.wikimedia.org/wikipedia/commons/9/92/Hrithik_Roshan_in_2024_%28cropped%29.jpg",
      "https://image.thum.io/get/width/400/noanimate/https://en.wikipedia.org/wiki/Hrithik_Roshan"
    ],
    description: "Sleek navy double-breasted blazer inspired by Kabir's suave look from War. Premium fabric with sharp tailoring for cocktail evenings.",
    characterName: "Kabir",
    year: 2019,
    manufacturerIds: ["mfr-tarun-tahiliani"]
  },
  {
    id: "look-alia-bhatt-gangubai",
    celebrityId: "alia-bhatt",
    movieName: "Gangubai Kathiawadi",
    occasion: "Festival",
    category: "Cotton Saree",
    colorPalette: "White, black border, red",
    price: 14999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/8/83/Gangubai_Kathiawadi.jpg/220px-Gangubai_Kathiawadi.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/8/83/Gangubai_Kathiawadi.jpg/220px-Gangubai_Kathiawadi.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Alia_Bhatt_at_Berlinale_2022_Ausschnitt.jpg/330px-Alia_Bhatt_at_Berlinale_2022_Ausschnitt.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Gangubai_Kathiawadi",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Alia_Bhatt_at_Berlinale_2022_Ausschnitt.jpg/150px-Alia_Bhatt_at_Berlinale_2022_Ausschnitt.jpg"
    ],
    description: "The iconic white cotton saree with bold black border — Gangubai's signature look. Pure cotton drape with contrast petticoat and flower hair accessory.",
    characterName: "Gangubai",
    year: 2022,
    manufacturerIds: ["mfr-sabyasachi"]
  },
  {
    id: "look-katrina-kaif-tiger",
    celebrityId: "katrina-kaif",
    movieName: "Tiger 3",
    occasion: "Party",
    category: "Action Suit",
    colorPalette: "Beige, khaki, black",
    price: 19999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/7/7c/Tiger_3_poster.jpg/220px-Tiger_3_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/7/7c/Tiger_3_poster.jpg/220px-Tiger_3_poster.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Katrina_Kaif_at_the_Bharat_audio_launch.jpg/330px-Katrina_Kaif_at_the_Bharat_audio_launch.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Tiger_3",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Katrina_Kaif_at_the_Bharat_audio_launch.jpg/150px-Katrina_Kaif_at_the_Bharat_audio_launch.jpg"
    ],
    description: "Combat-ready tactical suit inspired by Zoya's fierce look in Tiger 3. Form-fitting utility fabric with modern cut for action-themed events.",
    characterName: "Zoya",
    year: 2023,
    manufacturerIds: ["mfr-manish-malhotra"]
  },
  {
    id: "look-akshay-kumar-kesari",
    celebrityId: "akshay-kumar",
    movieName: "Kesari",
    occasion: "Festival",
    category: "Sikh Warrior Sherwani",
    colorPalette: "Saffron, gold, dark blue",
    price: 24999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/8/8f/Kesari_film_poster.jpg/220px-Kesari_film_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/8/8f/Kesari_film_poster.jpg/220px-Kesari_film_poster.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Kesari_(film)",
      "https://image.thum.io/get/width/400/noanimate/https://en.wikipedia.org/wiki/Akshay_Kumar"
    ],
    description: "Saffron warrior sherwani inspired by Havildar Ishar Singh's battle attire from Kesari. Rich jacquard with gold-thread embroidery — perfect for festive occasions.",
    characterName: "Havildar Ishar Singh",
    year: 2019,
    manufacturerIds: ["mfr-rohit-bal"]
  },
  {
    id: "look-salman-khan-bajrangi",
    celebrityId: "salman-khan",
    movieName: "Bajrangi Bhaijaan",
    occasion: "Festival",
    category: "Casual Kurta",
    colorPalette: "White, sky blue, beige",
    price: 8999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/6/6c/Bajrangi_Bhaijaan.jpg/220px-Bajrangi_Bhaijaan.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/6/6c/Bajrangi_Bhaijaan.jpg/220px-Bajrangi_Bhaijaan.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Bajrangi_Bhaijaan",
      "https://image.thum.io/get/width/400/noanimate/https://en.wikipedia.org/wiki/Salman_Khan"
    ],
    description: "Simple yet iconic white kurta-pyjama look from Bajrangi Bhaijaan. Light cotton with easy drape — the quintessential festive family look.",
    characterName: "Pawan Kumar Chaturvedi",
    year: 2015,
    manufacturerIds: ["mfr-south-silk"]
  },
  // ─────────────── TOLLYWOOD ───────────────
  {
    id: "look-allu-arjun-pushpa",
    celebrityId: "allu-arjun",
    movieName: "Pushpa: The Rise",
    occasion: "Festival",
    category: "Kurta Set",
    colorPalette: "Ivory, beige, maroon",
    price: 16999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/a/ad/Pushpa_The_Rise_poster.jpg/220px-Pushpa_The_Rise_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/a/ad/Pushpa_The_Rise_poster.jpg/220px-Pushpa_The_Rise_poster.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Allu_Arjun_at_Ala_Vaikunthapurramuloo_Audio_Launch.jpg/330px-Allu_Arjun_at_Ala_Vaikunthapurramuloo_Audio_Launch.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Pushpa:_The_Rise",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Allu_Arjun_at_Ala_Vaikunthapurramuloo_Audio_Launch.jpg/150px-Allu_Arjun_at_Ala_Vaikunthapurramuloo_Audio_Launch.jpg"
    ],
    description: "Pushpa's legendary rugged kurta look — raw cotton half-sleeve with a signature half-tuck. The iconic swagger of Pushpa Raj brought to everyday fashion.",
    characterName: "Pushpa Raj",
    year: 2021,
    manufacturerIds: ["mfr-south-silk"]
  },
  {
    id: "look-allu-arjun-pushpa2",
    celebrityId: "allu-arjun",
    movieName: "Pushpa 2: The Rule",
    occasion: "Party",
    category: "Premium Dhoti Set",
    colorPalette: "Gold, black, deep red",
    price: 21999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/8/88/Pushpa2_poster.jpg/220px-Pushpa2_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/8/88/Pushpa2_poster.jpg/220px-Pushpa2_poster.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Pushpa_2:_The_Rule",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Allu_Arjun_at_Ala_Vaikunthapurramuloo_Audio_Launch.jpg/330px-Allu_Arjun_at_Ala_Vaikunthapurramuloo_Audio_Launch.jpg"
    ],
    description: "The upgraded royal avatar of Pushpa — a rich dhoti-sherwani set with bold gold accents. Worn in the climactic sequences of Pushpa 2: The Rule.",
    characterName: "Pushpa Raj",
    year: 2024,
    manufacturerIds: ["mfr-south-silk", "mfr-rohit-bal"]
  },
  {
    id: "look-prabhas-bahubali",
    celebrityId: "prabhas",
    movieName: "Baahubali",
    occasion: "Festival",
    category: "Royal Warrior Costume",
    colorPalette: "Gold, ivory, bronze",
    price: 34999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/Baahubali_poster.jpg/220px-Baahubali_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/Baahubali_poster.jpg/220px-Baahubali_poster.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Baahubali:_The_Beginning",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Prabhas",
      "https://image.thum.io/get/width/400/noanimate/https://en.wikipedia.org/wiki/Baahubali:_The_Conclusion"
    ],
    description: "Grand royal warrior costume inspired by Amarendra Baahubali's regalia. Intricate gold-thread dhoti with bronze chest armour and layered drape.",
    characterName: "Amarendra Baahubali",
    year: 2015,
    manufacturerIds: ["mfr-south-silk", "mfr-rohit-bal"]
  },
  {
    id: "look-rashmika-pushpa",
    celebrityId: "rashmika-mandanna",
    movieName: "Pushpa: The Rise",
    occasion: "Festival",
    category: "Folk Lehenga",
    colorPalette: "Red, gold, green",
    price: 18999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/a/ad/Pushpa_The_Rise_poster.jpg/220px-Pushpa_The_Rise_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/a/ad/Pushpa_The_Rise_poster.jpg/220px-Pushpa_The_Rise_poster.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Rashmika_Mandanna_2023.jpg/330px-Rashmika_Mandanna_2023.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Pushpa:_The_Rise",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Rashmika_Mandanna_2023.jpg/150px-Rashmika_Mandanna_2023.jpg"
    ],
    description: "Srivalli's vibrant folk lehenga from Pushpa — bold red with gold embroidery and traditional Andhra motifs. A joyful festive celebration look.",
    characterName: "Srivalli",
    year: 2021,
    manufacturerIds: ["mfr-south-silk"]
  },
  {
    id: "look-vijay-deverakonda-arjun",
    celebrityId: "vijay-deverakonda",
    movieName: "Arjun Reddy",
    occasion: "Party",
    category: "Casual Blazer",
    colorPalette: "Black, white, grey",
    price: 14999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/2/2d/Arjun_Reddy_poster.jpg/220px-Arjun_Reddy_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/2/2d/Arjun_Reddy_poster.jpg/220px-Arjun_Reddy_poster.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Vijay_Deverakonda_at_World_Famous_Lover_press_meet.jpg/330px-Vijay_Deverakonda_at_World_Famous_Lover_press_meet.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Arjun_Reddy"
    ],
    description: "The brooding Arjun Reddy look — casual black blazer over plain white tee with jeans. Effortlessly rebellious, now a cult fashion statement.",
    characterName: "Arjun Reddy",
    year: 2017,
    manufacturerIds: ["mfr-tarun-tahiliani"]
  },
  // ─────────────── KOLLYWOOD ───────────────
  {
    id: "look-rajinikanth-classic",
    celebrityId: "rajinikanth",
    movieName: "Kabali",
    occasion: "Festival",
    category: "Shirt + Veshti",
    colorPalette: "White, cream, gold",
    price: 14999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/5/51/Kabali_film_poster.jpg/220px-Kabali_film_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/5/51/Kabali_film_poster.jpg/220px-Kabali_film_poster.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Rajinikanth_at_audio_release_of_Kochadaiiyaan.jpg/330px-Rajinikanth_at_audio_release_of_Kochadaiiyaan.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Kabali",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Rajinikanth_at_audio_release_of_Kochadaiiyaan.jpg/150px-Rajinikanth_at_audio_release_of_Kochadaiiyaan.jpg"
    ],
    description: "The Thalaivar's legendary white formal shirt and veshti from Kabali. Crisp cotton with a gold border veshti — timeless South Indian elegance.",
    characterName: "Kabali",
    year: 2016,
    manufacturerIds: ["mfr-south-silk"]
  },
  {
    id: "look-vikram-enthiran",
    celebrityId: "vikram",
    movieName: "I (Iruvar)",
    occasion: "Party",
    category: "Bodybuilder Costume",
    colorPalette: "Black, gold, silver",
    price: 21999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/5/55/I_%28film%29_poster.jpg/220px-I_%28film%29_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/5/55/I_%28film%29_poster.jpg/220px-I_%28film%29_poster.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Vikram_at_Ponniyin_Selvan_event.jpg/330px-Vikram_at_Ponniyin_Selvan_event.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/I_(2015_film)"
    ],
    description: "Lee's iconic physique-forward look from the movie I — a sculpted black bodysuit ensemble representing peak form and golden ambition.",
    characterName: "Lee / Lingesan",
    year: 2015,
    manufacturerIds: ["mfr-manish-malhotra"]
  },
  {
    id: "look-nayanthara-mersal",
    celebrityId: "nayanthara",
    movieName: "Mersal",
    occasion: "Wedding",
    category: "Silk Saree",
    colorPalette: "Teal, gold, maroon",
    price: 26999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Mersal_poster.jpg/220px-Mersal_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Mersal_poster.jpg/220px-Mersal_poster.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Nayanthara_at_Bigil_audio_launch.jpg/330px-Nayanthara_at_Bigil_audio_launch.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Nayanthara",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Nayanthara_at_Bigil_audio_launch.jpg/150px-Nayanthara_at_Bigil_audio_launch.jpg"
    ],
    description: "Teal Kanjivaram silk saree with rich gold temple border — inspired by Nayanthara's timeless look in Mersal. Premium weave for grand wedding functions.",
    characterName: "Azhagiya Thendral",
    year: 2017,
    manufacturerIds: ["mfr-south-silk"]
  },
  // ─────────────── MOLLYWOOD ───────────────
  {
    id: "look-dulquer-salmaan-formal",
    celebrityId: "dulquer-salmaan",
    movieName: "Maniyarayile Ashokan",
    occasion: "Party",
    category: "Suit",
    colorPalette: "Slate, charcoal, white",
    price: 26999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Dulquer_Salmaan_at_Yatra_audio_launch.jpg/330px-Dulquer_Salmaan_at_Yatra_audio_launch.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Dulquer_Salmaan_at_Yatra_audio_launch.jpg/330px-Dulquer_Salmaan_at_Yatra_audio_launch.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Dulquer_Salmaan",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Dulquer_Salmaan_at_Yatra_audio_launch.jpg/150px-Dulquer_Salmaan_at_Yatra_audio_launch.jpg"
    ],
    description: "Sharp slate-grey slim-cut suit inspired by DQ's polished urban style. Structured lapels with white pocket square for cocktail and premiere events.",
    characterName: "Promotional",
    year: 2023,
    manufacturerIds: ["mfr-tarun-tahiliani"]
  },
  {
    id: "look-fahadh-malik",
    celebrityId: "fahadh-faasil",
    movieName: "Malik",
    occasion: "Festival",
    category: "Traditional Mundu Set",
    colorPalette: "White, gold, saffron",
    price: 12999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/3/35/Malik_film_poster.jpg/220px-Malik_film_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/3/35/Malik_film_poster.jpg/220px-Malik_film_poster.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Fahadh_Faasil_at_CineMAA_Awards.jpg/330px-Fahadh_Faasil_at_CineMAA_Awards.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Malik_(2021_film)"
    ],
    description: "Traditional Kerala mundu set with golden kasavu border inspired by Sulaiman's dignified look in Malik. The ultimate Kerala festive attire.",
    characterName: "Sulaiman Malik",
    year: 2021,
    manufacturerIds: ["mfr-south-silk"]
  },
  // ─────────────── HOLLYWOOD ───────────────
  {
    id: "look-zendaya-red-carpet",
    celebrityId: "zendaya",
    movieName: "Dune: Part Two Premiere",
    occasion: "Party",
    category: "Evening Dress",
    colorPalette: "Black, silver, chrome",
    price: 41999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Zendaya_2019_by_Glenn_Francis.jpg/330px-Zendaya_2019_by_Glenn_Francis.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Zendaya_2019_by_Glenn_Francis.jpg/330px-Zendaya_2019_by_Glenn_Francis.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Zendaya",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Dune:_Part_Two",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Zendaya_2019_by_Glenn_Francis.jpg/150px-Zendaya_2019_by_Glenn_Francis.jpg",
      "https://image.thum.io/get/width/400/noanimate/https://en.wikipedia.org/wiki/Dune_(franchise)"
    ],
    description: "Silver liquid-metal column dress inspired by Zendaya's Dune premiere look. Chrome couture silhouette with minimal accessories for galactic elegance.",
    characterName: "Chani / Red Carpet",
    year: 2024,
    manufacturerIds: ["mfr-manish-malhotra"]
  },
  {
    id: "look-margot-robbie-barbie",
    celebrityId: "margot-robbie",
    movieName: "Barbie",
    occasion: "Party",
    category: "Pink Gown",
    colorPalette: "Hot pink, white, silver",
    price: 36999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/2/2f/Barbie_2023_film_poster.jpg/220px-Barbie_2023_film_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/2/2f/Barbie_2023_film_poster.jpg/220px-Barbie_2023_film_poster.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Margot_Robbie_2023.jpg/330px-Margot_Robbie_2023.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Barbie_(film)",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Margot_Robbie_2023.jpg/150px-Margot_Robbie_2023.jpg"
    ],
    description: "The iconic hot-pink Western ensemble from Barbie. High-waist flared trousers with a structured cropped top — the most viral fashion look of 2023.",
    characterName: "Barbie",
    year: 2023,
    manufacturerIds: ["mfr-manish-malhotra"]
  },
  {
    id: "look-pedro-pascal-last-of-us",
    celebrityId: "pedro-pascal",
    movieName: "The Last of Us",
    occasion: "Festival",
    category: "Post-Apocalyptic Jacket",
    colorPalette: "Brown, khaki, worn grey",
    price: 15999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/e/ef/The_Last_of_Us_TV_series.jpg/220px-The_Last_of_Us_TV_series.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/e/ef/The_Last_of_Us_TV_series.jpg/220px-The_Last_of_Us_TV_series.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Pedro_Pascal_2022.jpg/330px-Pedro_Pascal_2022.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/The_Last_of_Us_(TV_series)"
    ],
    description: "Joel's survival jacket from The Last of Us — distressed brown leather look with cargo-style layering. The ultimate pop-culture cosplay-meets-everyday jacket.",
    characterName: "Joel Miller",
    year: 2023,
    manufacturerIds: ["mfr-tarun-tahiliani"]
  },
  // ─────────────── SANDALWOOD ───────────────
  {
    id: "look-yash-kgf",
    celebrityId: "yash-kannada",
    movieName: "KGF: Chapter 2",
    occasion: "Festival",
    category: "Rugged Denim Jacket Set",
    colorPalette: "Black, dark gold, brown",
    price: 17999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f3/KGF_Chapter_2_poster.jpg/220px-KGF_Chapter_2_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/f/f3/KGF_Chapter_2_poster.jpg/220px-KGF_Chapter_2_poster.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Yash_at_the_launch_of_KGF_Chapter_2_trailer.jpg/330px-Yash_at_the_launch_of_KGF_Chapter_2_trailer.jpg",
      "https://upload.wikimedia.org/wikipedia/en/thumb/5/5b/KGF_Chapter_1_film_poster.jpg/220px-KGF_Chapter_1_film_poster.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Yash_at_the_launch_of_KGF_Chapter_2_trailer.jpg/150px-Yash_at_the_launch_of_KGF_Chapter_2_trailer.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/KGF:_Chapter_2"
    ],
    description: "Rocky Bhai's iconic rugged denim jacket from KGF Chapter 2. Distressed black denim with gold chain accessory — the look that turned Yash into a national style icon.",
    characterName: "Rocky Bhai (Raja Krishnappa Bairya)",
    year: 2022,
    manufacturerIds: ["mfr-rohit-bal"]
  },
  {
    id: "look-yash-kgf-formal",
    celebrityId: "yash-kannada",
    movieName: "KGF: Chapter 2",
    occasion: "Party",
    category: "Black Sherwani",
    colorPalette: "Black, gold, silver",
    price: 31999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Yash_at_the_launch_of_KGF_Chapter_2_trailer.jpg/330px-Yash_at_the_launch_of_KGF_Chapter_2_trailer.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Yash_at_the_launch_of_KGF_Chapter_2_trailer.jpg/330px-Yash_at_the_launch_of_KGF_Chapter_2_trailer.jpg",
      "https://upload.wikimedia.org/wikipedia/en/thumb/f/f3/KGF_Chapter_2_poster.jpg/220px-KGF_Chapter_2_poster.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Yash_(actor)",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Yash_at_the_launch_of_KGF_Chapter_2_trailer.jpg/150px-Yash_at_the_launch_of_KGF_Chapter_2_trailer.jpg"
    ],
    description: "Yash's signature black bandhgala sherwani worn at KGF Chapter 2 trailer launch events. Rich matte black with subtle gold borders — commanding presence for any event.",
    characterName: "Rocky Bhai / Event Appearance",
    year: 2022,
    manufacturerIds: ["mfr-tarun-tahiliani"]
  },
  {
    id: "look-sudeep-vikrant-rona",
    celebrityId: "sudeep-sandalwood",
    movieName: "Vikrant Rona",
    occasion: "Festival",
    category: "Warrior Costume",
    colorPalette: "Dark brown, copper, black",
    price: 29999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Vikrant_Rona_poster.jpg/220px-Vikrant_Rona_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Vikrant_Rona_poster.jpg/220px-Vikrant_Rona_poster.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Kichcha_Sudeepa_at_Vikrant_Rona_trailer_launch_%28cropped%29.jpg/330px-Kichcha_Sudeepa_at_Vikrant_Rona_trailer_launch_%28cropped%29.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Vikrant_Rona",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Kichcha_Sudeepa_at_Vikrant_Rona_trailer_launch_%28cropped%29.jpg/150px-Kichcha_Sudeepa_at_Vikrant_Rona_trailer_launch_%28cropped%29.jpg"
    ],
    description: "Vikrant Rona's dramatic jungle-warrior look — raw leather vest over a dark linen shirt with copper hardware. A monsoon-mystery adventure feel for festive occasions.",
    characterName: "Vikrant Rona",
    year: 2022,
    manufacturerIds: ["mfr-rohit-bal"]
  },
  {
    id: "look-rishab-shetty-kantara",
    celebrityId: "rishab-shetty",
    movieName: "Kantara",
    occasion: "Festival",
    category: "Traditional Tribal Look",
    colorPalette: "Ochre, earthy red, ivory",
    price: 13999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/4/46/Kantara_poster.jpg/220px-Kantara_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/4/46/Kantara_poster.jpg/220px-Kantara_poster.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Rishab_Shetty_at_Kantara_press_conference.jpg/330px-Rishab_Shetty_at_Kantara_press_conference.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Kantara_(film)",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Rishab_Shetty_at_Kantara_press_conference.jpg/150px-Rishab_Shetty_at_Kantara_press_conference.jpg",
      "https://image.thum.io/get/width/400/noanimate/https://en.wikipedia.org/wiki/Rishab_Shetty"
    ],
    description: "Shiva's iconic Tulu tribal look from Kantara — raw cotton dhoti with earth-pigment detailing and a rudraksha mala. Deeply rooted in Coastal Karnataka tradition.",
    characterName: "Shiva",
    year: 2022,
    manufacturerIds: ["mfr-south-silk"]
  },
  {
    id: "look-darshan-yajamana",
    celebrityId: "darshan-thoogudeepa",
    movieName: "Yajamana",
    occasion: "Wedding",
    category: "Silk Sherwani",
    colorPalette: "Ivory, gold, deep maroon",
    price: 24999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/e/e7/Yajamana_2019.jpg/220px-Yajamana_2019.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/e/e7/Yajamana_2019.jpg/220px-Yajamana_2019.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Darshan_Thoogudeepa.jpg/330px-Darshan_Thoogudeepa.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Yajamana_(2019_film)",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Darshan_Thoogudeepa.jpg/150px-Darshan_Thoogudeepa.jpg"
    ],
    description: "Challenging Star's wedding-scene ivory silk sherwani from Yajamana — intricately embroidered with gold thread and classic Kannada zari work.",
    characterName: "Gowda / Hero",
    year: 2019,
    manufacturerIds: ["mfr-south-silk"]
  },
  {
    id: "look-srinidhi-kgf",
    celebrityId: "srinidhi-shetty",
    movieName: "KGF: Chapter 1",
    occasion: "Party",
    category: "Glam Gown",
    colorPalette: "Deep teal, gold, ivory",
    price: 28999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Srinidhi_Shetty_at_KGF2_audio_launch_%28cropped%29.jpg/330px-Srinidhi_Shetty_at_KGF2_audio_launch_%28cropped%29.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Srinidhi_Shetty_at_KGF2_audio_launch_%28cropped%29.jpg/330px-Srinidhi_Shetty_at_KGF2_audio_launch_%28cropped%29.jpg",
      "https://upload.wikimedia.org/wikipedia/en/thumb/5/5b/KGF_Chapter_1_film_poster.jpg/220px-KGF_Chapter_1_film_poster.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/KGF:_Chapter_1",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Srinidhi_Shetty_at_KGF2_audio_launch_%28cropped%29.jpg/150px-Srinidhi_Shetty_at_KGF2_audio_launch_%28cropped%29.jpg",
      "https://image.thum.io/get/width/400/noanimate/https://en.wikipedia.org/wiki/Srinidhi_Shetty"
    ],
    description: "Reena's elegant teal gown from KGF — the beauty among the brutality. An A-line silhouette with gold accent detailing for high-glamour evening events.",
    characterName: "Reena",
    year: 2018,
    manufacturerIds: ["mfr-manish-malhotra"]
  },
  {
    id: "look-rachita-ram-raajakumara",
    celebrityId: "rachita-ram",
    movieName: "Raajakumara",
    occasion: "Wedding",
    category: "Silk Saree",
    colorPalette: "Crimson, gold, ivory",
    price: 22999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Rachita_Ram_in_2023.jpg/330px-Rachita_Ram_in_2023.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Rachita_Ram_in_2023.jpg/330px-Rachita_Ram_in_2023.jpg",
      "https://upload.wikimedia.org/wikipedia/en/thumb/e/e6/Raajakumara_film.jpg/220px-Raajakumara_film.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Rachita_Ram",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Rachita_Ram_in_2023.jpg/150px-Rachita_Ram_in_2023.jpg"
    ],
    description: "Rachita Ram's stunning crimson Mysore silk saree from Raajakumara — rich zari border with traditional temple blouse. The perfect Sandalwood bridal look.",
    characterName: "Shruthi",
    year: 2017,
    manufacturerIds: ["mfr-south-silk"]
  },
  {
    id: "look-puneeth-yuvarathnaa",
    celebrityId: "puneeth-rajkumar",
    movieName: "Yuvarathnaa",
    occasion: "Festival",
    category: "Action Jacket Set",
    colorPalette: "Navy, white, gold",
    price: 15999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/2/25/Yuvarathnaa_poster.jpg/220px-Yuvarathnaa_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/2/25/Yuvarathnaa_poster.jpg/220px-Yuvarathnaa_poster.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Puneeth_Rajkumar_in_2019.jpg/330px-Puneeth_Rajkumar_in_2019.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/Yuvarathnaa",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Puneeth_Rajkumar_in_2019.jpg/150px-Puneeth_Rajkumar_in_2019.jpg"
    ],
    description: "Appu's energetic navy jacket set from Yuvarathnaa. Youth-focused smart casual — block-colour jacket over crisp white t-shirt, celebrating Power Star's legacy.",
    characterName: "Yuva",
    year: 2021,
    manufacturerIds: ["mfr-tarun-tahiliani"]
  },
  {
    id: "look-rakshit-777-charlie",
    celebrityId: "rakshit-shetty",
    movieName: "777 Charlie",
    occasion: "Festival",
    category: "Casual Linen Set",
    colorPalette: "Earthy tan, olive, white",
    price: 8999,
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/3/39/777_Charlie_poster.jpg/220px-777_Charlie_poster.jpg",
    images: [
      "https://upload.wikimedia.org/wikipedia/en/thumb/3/39/777_Charlie_poster.jpg/220px-777_Charlie_poster.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Rakshit_Shetty_at_777_Charlie_press_meet.jpg/330px-Rakshit_Shetty_at_777_Charlie_press_meet.jpg",
      "https://image.thum.io/get/width/600/noanimate/https://en.wikipedia.org/wiki/777_Charlie",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Rakshit_Shetty_at_777_Charlie_press_meet.jpg/150px-Rakshit_Shetty_at_777_Charlie_press_meet.jpg"
    ],
    description: "Dharma's understated tan linen set from 777 Charlie — minimalist, earthy, and authentic. A journey-inspired look for the modern minimalist.",
    characterName: "Dharma",
    year: 2022,
    manufacturerIds: ["mfr-south-silk"]
  },
  // ─────────────── LEGACY / OTHER ───────────────
  {
    id: "look-khesari-lal-yadav-wedding",
    celebrityId: "khesari-lal-yadav",
    movieName: "Dulhan Wahi Jo Piya Man Bhaaye",
    occasion: "Wedding",
    category: "Kurta",
    colorPalette: "Royal blue, white, silver",
    price: 12999,
    imageUrl: outfitImage("khesari-lal-yadav"),
    description: "Bhojpuri wedding stage look — bright royal blue kurta with silver embroidery. Crowd-pleasing festive styling from Khesari's hit films.",
    year: 2022,
    manufacturerIds: ["mfr-south-silk"]
  },
  {
    id: "look-anubhav-mohanty-festival",
    celebrityId: "anubhav-mohanty",
    movieName: "Love Station",
    occasion: "Festival",
    category: "Nehru Jacket Set",
    colorPalette: "Olive, cream, rust",
    price: 13999,
    imageUrl: outfitImage("anubhav-mohanty"),
    description: "Heritage Odia festive set — Nehru jacket over cream kurta with rust dhoti. Suitable for regional celebrations and cultural gatherings.",
    year: 2019,
    manufacturerIds: ["mfr-south-silk"]
  }
];
