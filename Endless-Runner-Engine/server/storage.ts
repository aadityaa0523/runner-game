
import { db } from "./db";
import { scores, type InsertScore, type Score } from "@shared/schema";
import { desc } from "drizzle-orm";

export interface IStorage {
  getTopScores(): Promise<Score[]>;
  createScore(score: InsertScore): Promise<Score>;
}

export class DatabaseStorage implements IStorage {
  async getTopScores(): Promise<Score[]> {
    return await db.select()
      .from(scores)
      .orderBy(desc(scores.score))
      .limit(10);
  }

  async createScore(insertScore: InsertScore): Promise<Score> {
    const [score] = await db.insert(scores)
      .values(insertScore)
      .returning();
    return score;
  }
}

export const storage = new DatabaseStorage();
