import assert from "node:assert/strict";
import { labsTaskDescription, labsTaskTaken } from "./orchestration";

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

console.log("ok");
