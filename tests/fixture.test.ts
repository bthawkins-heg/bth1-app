// Writes a realistic used-for-a-while state for browser tests when FIXTURE_OUT is set.
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { seedState } from '../src/lib/seed';
import * as A from '../src/lib/actions';
import { addDays, today } from '../src/lib/date';

it('fixture', () => {
  const out = process.env.FIXTURE_OUT;
  if (!out) return;
  const s = seedState();
  s.profile = { ...s.profile, name: 'Test', startWeight: 145, goalWeight: 165, heightIn: 70, startDate: addDays(today(), -20) };
  const t = today();
  for (let i = 20; i >= 1; i--) {
    const d = addDays(t, -i);
    A.addWeight(s, d, 145 + (20 - i) * 0.1);
    A.ensureDay(s, d);
    for (const m of s.days[d].meals) if (i % 3) A.setMealConsumed(s, d, m.id, true);
  }
  const lift = A.createTemplate(s, { name: 'Upper A', type: 'strength', color: '#f00', exercises: [A.newExercise('Bench Press', 3, '8', 90, 135), A.newExercise('Row', 3, '10', 90, 95)] });
  const run = A.createTemplate(s, { name: 'Easy run', type: 'run-outdoor', color: '#0f0', exercises: [], run: { runType: 'easy', environment: 'outdoor', segments: [], distance: 4.8 } });
  A.addScheduleEntry(s, { templateId: lift, kind: 'weekly', weekdays: [1, 3, 5], everyWeeks: 1, startDate: addDays(t, -21) });
  A.addScheduleEntry(s, { templateId: run, kind: 'weekly', weekdays: [0, 2, 4, 6], everyWeeks: 1, startDate: addDays(t, -21) });
  for (const i of [14, 10, 7, 3]) {
    const id = A.startSession(s, lift, addDays(t, -i));
    const ses = s.sessions.find((x) => x.id === id)!;
    ses.exercises.forEach((e) => e.sets.forEach((st) => { st.done = true; st.reps = 8; st.weight = 135 + (14 - i); }));
    A.finishSession(s, id);
    const r = A.startSession(s, run, addDays(t, -i + 1));
    const rs = s.sessions.find((x) => x.id === r)!;
    rs.run!.distanceKm = 4.8 + i / 10; rs.run!.durationSec = 1700 + i * 10;
    A.finishSession(s, r);
  }
  writeFileSync(out, JSON.stringify(s));
});
