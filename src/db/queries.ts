import type Database from "better-sqlite3";

export type ExerciseDirection = "higher" | "lower";
export type ChallengeStatus = "active" | "ended";

export interface Challenge {
  id: number;
  name: string;
  deadline: string;
  status: ChallengeStatus;
  created_at: string;
}

export interface Exercise {
  id: number;
  challenge_id: number;
  name: string;
  unit: string;
  direction: ExerciseDirection;
}

export interface UserGoal {
  challenge_id: number;
  user_id: string;
  exercise_id: number;
  tier: number;
  threshold: number;
}

export interface Submission {
  id: number;
  challenge_id: number;
  user_id: string;
  exercise_id: number;
  value: number;
  points: number;
  submitted_at: string;
}

export interface UserScore {
  user_id: string;
  total_points: number;
  exercise_count: number;
}

export interface ExerciseScore {
  exercise_id: number;
  exercise_name: string;
  unit: string;
  direction: ExerciseDirection;
  value: number | null;
  points: number;
  max_points: number;
}

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      deadline TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('higher', 'lower')),
      UNIQUE(challenge_id, name)
    );

    CREATE TABLE IF NOT EXISTS user_goals (
      challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 5),
      threshold REAL NOT NULL,
      PRIMARY KEY (challenge_id, user_id, exercise_id, tier)
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      value REAL NOT NULL,
      points REAL NOT NULL,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(challenge_id, user_id, exercise_id)
    );
  `);
}

export function getActiveChallenge(db: Database.Database): Challenge | undefined {
  return db
    .prepare("SELECT * FROM challenges WHERE status = 'active' ORDER BY id DESC LIMIT 1")
    .get() as Challenge | undefined;
}

export function createChallenge(
  db: Database.Database,
  name: string,
  deadline: string
): Challenge {
  const existing = getActiveChallenge(db);
  if (existing) {
    throw new Error(
      `An active challenge already exists: "${existing.name}". End it first with /challenge end.`
    );
  }

  const result = db
    .prepare("INSERT INTO challenges (name, deadline, status) VALUES (?, ?, 'active')")
    .run(name, deadline);

  return db
    .prepare("SELECT * FROM challenges WHERE id = ?")
    .get(result.lastInsertRowid) as Challenge;
}

export function endActiveChallenge(db: Database.Database): Challenge | undefined {
  const active = getActiveChallenge(db);
  if (!active) return undefined;

  db.prepare("UPDATE challenges SET status = 'ended' WHERE id = ?").run(active.id);
  return { ...active, status: "ended" };
}

export function addExercise(
  db: Database.Database,
  challengeId: number,
  name: string,
  unit: string,
  direction: ExerciseDirection
): Exercise {
  const result = db
    .prepare(
      "INSERT INTO exercises (challenge_id, name, unit, direction) VALUES (?, ?, ?, ?)"
    )
    .run(challengeId, name, unit, direction);

  return db
    .prepare("SELECT * FROM exercises WHERE id = ?")
    .get(result.lastInsertRowid) as Exercise;
}

export function getExercises(db: Database.Database, challengeId: number): Exercise[] {
  return db
    .prepare("SELECT * FROM exercises WHERE challenge_id = ? ORDER BY name")
    .all(challengeId) as Exercise[];
}

export function getExerciseById(
  db: Database.Database,
  exerciseId: number
): Exercise | undefined {
  return db.prepare("SELECT * FROM exercises WHERE id = ?").get(exerciseId) as
    | Exercise
    | undefined;
}

export function getExerciseByName(
  db: Database.Database,
  challengeId: number,
  name: string
): Exercise | undefined {
  return db
    .prepare("SELECT * FROM exercises WHERE challenge_id = ? AND name = ? COLLATE NOCASE")
    .get(challengeId, name) as Exercise | undefined;
}

export function setUserGoals(
  db: Database.Database,
  challengeId: number,
  userId: string,
  exerciseId: number,
  tiers: { tier: number; threshold: number }[]
): void {
  const deleteStmt = db.prepare(
    "DELETE FROM user_goals WHERE challenge_id = ? AND user_id = ? AND exercise_id = ?"
  );
  const insertStmt = db.prepare(
    "INSERT INTO user_goals (challenge_id, user_id, exercise_id, tier, threshold) VALUES (?, ?, ?, ?, ?)"
  );

  const transaction = db.transaction(() => {
    deleteStmt.run(challengeId, userId, exerciseId);
    for (const { tier, threshold } of tiers) {
      insertStmt.run(challengeId, userId, exerciseId, tier, threshold);
    }
  });

  transaction();
}

export function getUserGoals(
  db: Database.Database,
  challengeId: number,
  userId: string,
  exerciseId?: number
): UserGoal[] {
  if (exerciseId !== undefined) {
    return db
      .prepare(
        "SELECT * FROM user_goals WHERE challenge_id = ? AND user_id = ? AND exercise_id = ? ORDER BY tier"
      )
      .all(challengeId, userId, exerciseId) as UserGoal[];
  }

  return db
    .prepare(
      "SELECT * FROM user_goals WHERE challenge_id = ? AND user_id = ? ORDER BY exercise_id, tier"
    )
    .all(challengeId, userId) as UserGoal[];
}

export function hasUserGoalsForExercise(
  db: Database.Database,
  challengeId: number,
  userId: string,
  exerciseId: number
): boolean {
  const row = db
    .prepare(
      "SELECT COUNT(*) as count FROM user_goals WHERE challenge_id = ? AND user_id = ? AND exercise_id = ?"
    )
    .get(challengeId, userId, exerciseId) as { count: number };
  return row.count === 5;
}

export function getSubmission(
  db: Database.Database,
  challengeId: number,
  userId: string,
  exerciseId: number
): Submission | undefined {
  return db
    .prepare(
      "SELECT * FROM submissions WHERE challenge_id = ? AND user_id = ? AND exercise_id = ?"
    )
    .get(challengeId, userId, exerciseId) as Submission | undefined;
}

export function upsertSubmission(
  db: Database.Database,
  challengeId: number,
  userId: string,
  exerciseId: number,
  value: number,
  points: number
): Submission {
  db.prepare(
    `INSERT INTO submissions (challenge_id, user_id, exercise_id, value, points, submitted_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(challenge_id, user_id, exercise_id)
     DO UPDATE SET value = excluded.value, points = excluded.points, submitted_at = datetime('now')`
  ).run(challengeId, userId, exerciseId, value, points);

  return db
    .prepare(
      "SELECT * FROM submissions WHERE challenge_id = ? AND user_id = ? AND exercise_id = ?"
    )
    .get(challengeId, userId, exerciseId) as Submission;
}

export function getUserExerciseScores(
  db: Database.Database,
  challengeId: number,
  userId: string
): ExerciseScore[] {
  return db
    .prepare(
      `SELECT
         e.id as exercise_id,
         e.name as exercise_name,
         e.unit,
         e.direction,
         s.value,
         COALESCE(s.points, 0) as points,
         5 as max_points
       FROM exercises e
       LEFT JOIN submissions s
         ON s.exercise_id = e.id
         AND s.challenge_id = e.challenge_id
         AND s.user_id = ?
       WHERE e.challenge_id = ?
       ORDER BY e.name`
    )
    .all(userId, challengeId) as ExerciseScore[];
}

export function getLeaderboard(
  db: Database.Database,
  challengeId: number
): UserScore[] {
  return db
    .prepare(
      `SELECT
         s.user_id,
         COALESCE(SUM(s.points), 0) as total_points,
         COUNT(s.id) as exercise_count
       FROM submissions s
       WHERE s.challenge_id = ?
       GROUP BY s.user_id
       ORDER BY total_points DESC, exercise_count DESC, s.user_id`
    )
    .all(challengeId) as UserScore[];
}

export function getParticipantsWithGoals(
  db: Database.Database,
  challengeId: number
): string[] {
  const rows = db
    .prepare(
      "SELECT DISTINCT user_id FROM user_goals WHERE challenge_id = ? ORDER BY user_id"
    )
    .all(challengeId) as { user_id: string }[];
  return rows.map((r) => r.user_id);
}

export function getParticipantsWithGoalsForExercise(
  db: Database.Database,
  challengeId: number,
  exerciseId: number
): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT user_id FROM user_goals
       WHERE challenge_id = ? AND exercise_id = ?
       ORDER BY user_id`
    )
    .all(challengeId, exerciseId) as { user_id: string }[];
  return rows.map((r) => r.user_id);
}

export function getExerciseSubmissions(
  db: Database.Database,
  challengeId: number,
  exerciseId: number
): Pick<Submission, "user_id" | "points" | "value">[] {
  return db
    .prepare(
      `SELECT user_id, points, value FROM submissions
       WHERE challenge_id = ? AND exercise_id = ?`
    )
    .all(challengeId, exerciseId) as Pick<Submission, "user_id" | "points" | "value">[];
}

export function isDeadlinePassed(deadline: string): boolean {
  return new Date(deadline).getTime() <= Date.now();
}
