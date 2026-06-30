import { Router } from "express";
import type { Request, Response } from "express";

export type Manufacturer = {
  id: string;
  name: string;
  location: string;
  rating: number;
  contactEmail: string;
  verified: boolean;
  specialties: string[];
};

export const manufacturerStore: Manufacturer[] = [
  {
    id: "mfr-ritu-kumar",
    name: "Ritu Kumar Atelier",
    location: "Delhi, India",
    rating: 4.9,
    contactEmail: "orders@ritukumar.com",
    verified: true,
    specialties: ["Saree", "Lehenga", "Anarkali"]
  },
  {
    id: "mfr-manish-malhotra",
    name: "Manish Malhotra Studio",
    location: "Mumbai, India",
    rating: 4.8,
    contactEmail: "studio@manishmalhotra.in",
    verified: true,
    specialties: ["Gown", "Lehenga", "Sherwani"]
  },
  {
    id: "mfr-sabyasachi",
    name: "Sabyasachi Mukherjee",
    location: "Kolkata, India",
    rating: 5.0,
    contactEmail: "couture@sabyasachi.com",
    verified: true,
    specialties: ["Saree", "Bridal", "Kurta"]
  },
  {
    id: "mfr-tarun-tahiliani",
    name: "Tarun Tahiliani Couture",
    location: "Delhi, India",
    rating: 4.7,
    contactEmail: "info@taruntahiliani.com",
    verified: true,
    specialties: ["Gown", "Suit", "Bandhgala"]
  },
  {
    id: "mfr-rohit-bal",
    name: "Rohit Bal Designs",
    location: "Delhi, India",
    rating: 4.6,
    contactEmail: "design@rohitbal.com",
    verified: true,
    specialties: ["Sherwani", "Kurta Set", "Nehru Jacket Set"]
  },
  {
    id: "mfr-south-silk",
    name: "South Silk House",
    location: "Chennai, India",
    rating: 4.5,
    contactEmail: "contact@southsilkhouse.com",
    verified: true,
    specialties: ["Shirt + Veshti", "Saree", "Kurta"]
  }
];

export const manufacturersRouter = Router();

manufacturersRouter.get("/", (_req: Request, res: Response) => {
  res.json({ data: manufacturerStore });
});

manufacturersRouter.get("/:id", (req: Request, res: Response) => {
  const item = manufacturerStore.find((m) => m.id === req.params.id);
  if (!item) { res.status(404).json({ message: "Manufacturer not found" }); return; }
  res.json({ data: item });
});

manufacturersRouter.post("/", (req: Request, res: Response) => {
  const { name, location, rating, contactEmail, verified, specialties } = req.body;
  if (!name || !location || !contactEmail) {
    res.status(400).json({ message: "name, location, and contactEmail are required" });
    return;
  }
  const newItem: Manufacturer = {
    id: `mfr-${Date.now()}`,
    name,
    location,
    rating: Number(rating) || 4.0,
    contactEmail,
    verified: Boolean(verified),
    specialties: Array.isArray(specialties) ? specialties : []
  };
  manufacturerStore.push(newItem);
  res.status(201).json({ data: newItem });
});

manufacturersRouter.put("/:id", (req: Request, res: Response) => {
  const idx = manufacturerStore.findIndex((m) => m.id === req.params.id);
  if (idx === -1) { res.status(404).json({ message: "Manufacturer not found" }); return; }
  manufacturerStore[idx] = { ...manufacturerStore[idx], ...req.body, id: req.params.id };
  res.json({ data: manufacturerStore[idx] });
});

manufacturersRouter.delete("/:id", (req: Request, res: Response) => {
  const idx = manufacturerStore.findIndex((m) => m.id === req.params.id);
  if (idx === -1) { res.status(404).json({ message: "Manufacturer not found" }); return; }
  manufacturerStore.splice(idx, 1);
  res.json({ message: "Deleted" });
});
