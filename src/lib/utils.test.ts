import assert from "node:assert/strict";
import { test } from "node:test";
import { isCorrectOption } from "./utils";

test("Q12021562 accepts option B despite capitalization in the stored answer", () => {
  const options = [
    "(a) Legal right available to citizens only",
    "(b) Legal right available to any person",
    "(c) Fundamental Right available to citizens only",
    "(d) Neither Fundamental Right nor legal right",
  ];
  const answer = "(b) legal right available to any person";
  assert.deepEqual(options.map(option => isCorrectOption(option, answer, options)), [false, true, false, false]);
  assert.equal(isCorrectOption(options[1], answer), true);
});

test("complete single-option answers do not accept a shorter option contained within them", () => {
  const options = ["Right", "Right to Property"];
  for (const answer of ["Right to Property", "right to property"]) {
    assert.deepEqual(options.map(option => isCorrectOption(option, answer, options)), [false, true]);
  }
});

test("multi-answer keys retain each explicitly named option across capitalization differences", () => {
  const options = ["(a) Alpha", "(b) Beta", "(c) Gamma"];
  const answer = "(b) beta and (c) Gamma";
  assert.deepEqual(options.map(option => isCorrectOption(option, answer, options)), [false, true, true]);
  assert.equal(isCorrectOption("", answer), false);
  assert.equal(isCorrectOption(options[0], ""), false);
});

test("exact case-sensitive options win and ambiguous case-only alternatives are not guessed", () => {
  const options = ["CO", "Co"];
  assert.deepEqual(options.map(option => isCorrectOption(option, "Co", options)), [false, true]);
  assert.deepEqual(options.map(option => isCorrectOption(option, "co", options)), [false, false]);
});
