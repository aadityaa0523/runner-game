
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

async function seedDatabase() {
  const existingScores = await storage.getTopScores();
  if (existingScores.length === 0) {
    console.log("Seeding database with initial scores...");
    await storage.createScore({ username: "Runner99", score: 5000, coins: 150 });
    await storage.createScore({ username: "SpeedyG", score: 3500, coins: 90 });
    await storage.createScore({ username: "UrbanDash", score: 2000, coins: 45 });
    await storage.createScore({ username: "Newbie", score: 500, coins: 10 });
    console.log("Seeding complete.");
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seed data on startup
  seedDatabase().catch(err => console.error("Failed to seed database:", err));

  app.get(api.scores.list.path, async (_req, res) => {
    const scores = await storage.getTopScores();
    res.json(scores);
  });

  app.post(api.scores.create.path, async (req, res) => {
    try {
      const input = api.scores.create.input.parse(req.body);
      const score = await storage.createScore(input);
      res.status(201).json(score);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  return httpServer;
}
