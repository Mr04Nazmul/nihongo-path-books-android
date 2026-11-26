// Bundle against adaptive-learning from e5780b44e59e1789f83ea1df0d0e12ad8d3dff53.
import { createProfileCache, dailyStudyPlan } from "../../../adaptive-learning/session.mjs";
import { curriculumGraphs } from "../../../adaptive-learning/android/curriculum-graph.mjs";
import { selectQuestion } from "../../../adaptive-learning/models.mjs";
import { strategyPriorities } from "../../../adaptive-learning/exploration.mjs";

export function selectPractice(request) {
    const { events, items, level, preview, review, used, now, remaining } = JSON.parse(request);
    if (!review && remaining <= 0) return null;
    const profile = createProfileCache()(events);
    const seen = new Set(used);
    const candidates = items.filter(item => !seen.has(item.id));
    const due = candidates.filter(item => {
        const card = profile.cards.get(item.id);
        return card && card.due.getTime() <= now;
    }).sort((first, second) => profile.cards.get(first.id).due - profile.cards.get(second.id).due);
    if (review || due.length) return due[0]?.id ?? null;

    const { required } = curriculumGraphs(items, level, preview);
    const accessible = new Set(required.order);
    const mastery = new Map([...profile.skills].map(([id, state]) => [id, state.mastery]));
    const eligible = candidates.filter(item => item.seconds <= remaining &&
        required.weakPrerequisites(item.skill, mastery, accessible, 0.55).length === 0);
    if (!profile.readiness.entropy) {
        const unresolved = eligible.find(item => !profile.cards.has(item.id));
        return unresolved?.id ?? eligible[0]?.id ?? null;
    }

    const plan = dailyStudyPlan(eligible, profile, required, {
        at: now, seconds: remaining, maxLoad: 16, masteryThreshold: 0.55,
        weights: { retention: 2, mastery: 2, exam: 1, time: 0.06, load: 0.04 }
    });
    const priorities = strategyPriorities(events, Math.random, 12);
    const questions = plan.flatMap(row => {
        const meaning = { ...row, priority: priorities.get("meaning") };
        return row.examAligned ? [meaning, { ...row, id: row.id + ":reading", difficulty: 0.2,
            priority: priorities.get("reading") }] : [meaning];
    });
    const profiles = new Map(questions.map(row => [row.skill, profile.skillProfile(row.skill)]));
    return selectQuestion(questions, profiles, { offset: profile.pacing.output, radius: 0.2 }, 0.05)?.question.id
        ?? plan[0]?.id ?? null;
}
