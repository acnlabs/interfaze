import assert from "node:assert/strict";
import {
  decideFromMetadata,
  labsTaskDescription,
  labsTaskTaken,
  planFromMetadata,
} from "./orchestration";

const short = "画一只会走路的鸭子";
assert.equal(short.length, 9);

const joined = labsTaskDescription("走路的鸭子", short);
assert.ok(joined.length >= 10);
assert.ok(joined.includes(short));
assert.ok(joined.includes("走路的鸭子"));

const long = "画一只会走路的鸭子，要能走";
assert.equal(labsTaskDescription("走路的鸭子", long), long);

const padded = labsTaskDescription("鸭");
assert.ok(padded.length >= 10);
assert.ok(padded.startsWith("鸭"));

assert.equal(labsTaskTaken({ status: "open", assignee_id: null }), false);
assert.equal(labsTaskTaken({ status: "in_progress", assignee_id: "cd7ec18a" }), true);
assert.equal(labsTaskTaken({ status: "open", assignee_id: "cd7ec18a" }), true);
assert.equal(labsTaskTaken(null), false);

const plan = planFromMetadata({
  orchestration: { plan: { title: " 15秒介绍视频 ", summary: " 不要再问确认 " } },
});
assert.equal(plan?.title, "15秒介绍视频");
assert.equal(plan?.summary, "不要再问确认");
assert.equal(planFromMetadata({ orchestration: { plan: { title: "  " } } }), null);

const decide = decideFromMetadata({
  orchestration: {
    decide: {
      options: [
        { id: "path_a", label: "走 A 路" },
        { id: "path_b", label: "走 B 路" },
      ],
      shadow: { status: "scored", choice: "path_a", gate: { ask_human: false } },
      applied: { option_id: "path_b", by: "user" },
    },
  },
});
assert.equal(decide?.options.length, 2);
assert.equal(decide?.shadow?.status, "scored");
assert.equal(decide?.shadow?.choice, "path_a");
assert.equal(decide?.applied?.option_id, "path_b");
assert.equal(decideFromMetadata({ orchestration: { decide: { options: [{ id: "x", label: "one" }] } } }), null);

console.log("ok");
