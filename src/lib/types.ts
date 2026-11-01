// Core data model. Everything the user can change lives in AppState and is persisted.

export type Unit =
  | 'g' | 'oz' | 'lb'
  | 'ml' | 'fl oz' | 'cup' | 'tbsp' | 'tsp'
  | 'each' | 'serving' | 'scoop' | 'bottle' | 'slice';

export type Verification = 'label' | 'retailer-label' | 'database' | 'estimate' | 'user';

export interface Nutrients {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number | null;
}

export type GroceryCategory =
  | 'Dairy & Eggs' | 'Bakery' | 'Meat & Seafood' | 'Pantry' | 'Beverages'
  | 'Snacks' | 'Produce' | 'Supplements' | 'Other';

export interface Food {
  id: string;
  brand: string;
  name: string;
  flavor?: string;
  /** Size of one label serving, expressed in servingUnit (e.g. 1 each, 2 tbsp, 8 fl oz, 100 g). */
  servingSize: number;
  servingUnit: Unit;
  /** Optional weight / volume of one label serving, used to convert between mass and volume. */
  gramsPerServing?: number;
  mlPerServing?: number;
  /** Nutrition per ONE label serving. */
  nutrients: Nutrients;
  /** cooked / raw / dry / as sold — what the nutrition values refer to. */
  state?: 'cooked' | 'raw' | 'dry' | 'as sold' | 'prepared';
  sourceName: string;
  sourceUrl: string;
  verification: Verification;
  notes?: string;
  category: GroceryCategory;
  /** How to buy it. Required quantity is converted into purchase units, then into packages. */
  purchase?: PurchaseInfo;
  /** Cook in batches on prep day (beef, rice). */
  prepable?: boolean;
  archived?: boolean;
}

export interface PurchaseInfo {
  /** Unit the store sells it in, e.g. 'each', 'fl oz', 'lb', 'serving'. */
  unit: Unit;
  /** Multiply the amount eaten (converted to `fromUnit`) by this factor to get the amount to buy. Used for cooked→raw and cooked→dry. */
  conversion?: { fromUnit: Unit; factor: number; label: string };
  packageSize: number;
  packageLabel: string; // e.g. "18-count carton"
  pricePerPackage?: number; // only if the user entered it
  /** How it's sold when it differs from how it's eaten, e.g. 'raw' beef or 'dry' rice. */
  buyAs?: string;
}

export interface MealItem {
  id: string;
  foodId: string;
  qty: number;
  unit: Unit;
  /** Food ids that can be swapped in for this line (juice substitutions, protein swaps). */
  alternatives?: string[];
}

export interface MealTemplate {
  id: string;
  name: string;
  emoji: string;
  items: MealItem[];
  archived?: boolean;
}

export interface PlanSlot {
  id: string;
  mealId: string;
  time?: string; // "HH:MM", optional, user chosen
}

export interface DayPlan {
  id: string;
  name: string;
  slots: PlanSlot[];
}

export interface MealSchedule {
  /** weekday (0=Sun..6=Sat) -> plan id */
  weekdays: Record<number, string>;
  /** date (YYYY-MM-DD) -> plan id, overrides the weekday rule */
  overrides: Record<string, string>;
}

export interface DayItem {
  id: string;
  foodId: string;
  name: string;
  brand: string;
  qty: number;
  unit: Unit;
  alternatives?: string[];
  /** Snapshot of the nutrition for this quantity, frozen so later food edits never rewrite history. */
  n: Nutrients;
  verification: Verification;
  consumed: boolean;
  consumedAt?: string;
}

export interface DayMeal {
  id: string;
  mealId?: string;
  name: string;
  emoji: string;
  time?: string;
  items: DayItem[];
}

export interface DayLog {
  date: string;
  planId?: string;
  planSig?: string; // signature of the plan this log was built from
  meals: DayMeal[];
  supplements: Record<string, boolean>; // supplement id -> taken
}

export interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export interface GoalChange { date: string; goals: Goals; note?: string }

export interface Profile {
  name: string;
  startWeight: number;
  goalWeight: number;
  heightIn: number;
  startDate: string;
}

export interface Preferences {
  distanceUnit: 'mi' | 'km';
  weightUnit: 'lb';
  notifications: boolean;
  groceryDays: number;
  prepDays: number[]; // weekdays
  weekStartsOn: 0 | 1;
}

// ---------- Supplements ----------
/** Which days a supplement shows up. ('unset' and 'as-needed' are legacy values migrated to the Optional group.) */
export type SupplementFrequency = 'daily' | 'training' | 'rest' | 'days' | 'unset' | 'as-needed';
/** Where it appears on Today. Optional items are always available but never counted as missed. */
export type SupplementGroup = 'daily' | 'pre' | 'post' | 'optional';

export interface Supplement {
  id: string;
  brand: string;
  name: string;
  servingSize: string;
  frequency: SupplementFrequency;
  days?: number[];
  group: SupplementGroup;
  /** legacy flags from v1, folded into `group` by migrate() */
  preWorkout?: boolean;
  postWorkout?: boolean;
  withMeal: string; // meal template id or ''
  reminderTime?: string;
  active: boolean;
  tags: { creatine: boolean; vitaminD: boolean; stimulant: boolean };
  tagSource: string; // where the ingredient tag came from
  notes?: string;
  servingsPerContainer?: number;
}

// ---------- Training ----------
export type WorkoutType =
  | 'strength' | 'hypertrophy' | 'run-outdoor' | 'run-treadmill' | 'intervals'
  | 'recovery' | 'mobility' | 'custom';

export type RunType = 'easy' | 'long' | 'tempo' | 'intervals' | 'recovery' | 'race' | 'other';

export interface TemplateExercise {
  id: string;
  name: string;
  sets: number;
  reps: string; // "8" or "8-10"
  weight?: number;
  restSec: number;
  notes?: string;
}

export interface IntervalSegment {
  id: string;
  label: string;
  repeats: number;
  workSec?: number;
  workDist?: number; // in user distance unit
  recoverySec?: number;
  recoveryDist?: number;
  note?: string;
}

export interface RunPlan {
  runType: RunType;
  environment: 'outdoor' | 'treadmill';
  distance?: number; // user's unit at time of planning (stored in km internally)
  durationMin?: number;
  incline?: number;
  segments: IntervalSegment[];
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  type: WorkoutType;
  customType?: string;
  programId?: string;
  exercises: TemplateExercise[];
  run?: RunPlan;
  notes?: string;
  color: string;
  archived?: boolean;
}

export interface Program {
  id: string;
  name: string;
  paused: boolean;
}

export interface ScheduleEntry {
  id: string;
  /** template id or 'rest' */
  templateId: string;
  programId?: string;
  kind: 'once' | 'weekly';
  date?: string; // for once
  weekdays?: number[]; // for weekly
  everyWeeks?: number; // 1 = every week, 2 = every other week
  startDate: string;
  endDate?: string;
}

export interface Occurrence {
  key: string; // entryId@originalDate
  entryId: string;
  templateId: string;
  date: string;
  originalDate: string;
  status: 'planned' | 'skipped' | 'done';
  sessionId?: string;
}

export interface OccurrenceException {
  skipped?: boolean;
  movedTo?: string;
}

export interface SetLog {
  id: string;
  reps: number | null;
  weight: number | null;
  done: boolean;
}

export interface SessionExercise {
  id: string;
  name: string;
  planned: { sets: number; reps: string; weight?: number; restSec: number };
  sets: SetLog[];
  notes?: string;
}

export interface RunLog {
  runType: RunType;
  environment: 'outdoor' | 'treadmill';
  distanceKm: number | null;
  durationSec: number | null;
  incline?: number | null;
  rpe?: number | null;
  segments: (IntervalSegment & { done: boolean })[];
}

export interface WorkoutSession {
  id: string;
  date: string;
  occurrenceKey?: string;
  templateId?: string;
  name: string;
  type: WorkoutType;
  customType?: string;
  status: 'in-progress' | 'completed';
  startedAt: string;
  finishedAt?: string;
  exercises: SessionExercise[];
  run?: RunLog;
  notes?: string;
}

export interface WeightEntry { date: string; lb: number }

export interface PrepRecord { date: string; done: Record<string, boolean>; completed: boolean }

export interface AppState {
  version: number;
  updatedAt: number;
  profile: Profile;
  goals: Goals;
  goalHistory: GoalChange[];
  prefs: Preferences;
  foods: Food[];
  meals: MealTemplate[];
  plans: DayPlan[];
  schedule: MealSchedule;
  days: Record<string, DayLog>;
  pantry: Record<string, number>; // foodId -> amount on hand in purchase units
  groceryChecked: Record<string, string>; // key -> date it was checked (checks expire after a few days)
  lastBackup?: string; // date of the last downloaded/copied backup
  supplements: Supplement[];
  programs: Program[];
  activeProgramId?: string;
  templates: WorkoutTemplate[];
  scheduleEntries: ScheduleEntry[];
  exceptions: Record<string, OccurrenceException>;
  sessions: WorkoutSession[];
  weights: WeightEntry[];
  prep: Record<string, PrepRecord>;
}
