import { readFileSync } from "node:fs";
import React from "react";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

function jsxMount(file: string, name: string): string {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const mounts: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === name) mounts.push(node.getText(source));
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(mounts).toHaveLength(1);
  return mounts[0];
}

const primaryMount = jsxMount("client/src/pages/lms/CoursePlayer.tsx", "EmbeddedQuizPlayer");
function primary(data: unknown, save = vi.fn().mockResolvedValue({ success: true })) {
  const setOptimisticCompleted = vi.fn();
  const fireLessonCompleteEffect = vi.fn();
  const output = ts.transpileModule(`const mount = (${primaryMount});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    fileName: "actual-mount.tsx",
  }).outputText;
  const mount = new Function("React", "EmbeddedQuizPlayer", "lessonData", "slug", "data", "markComplete", "setOptimisticCompleted", "fireLessonCompleteEffect", `${output}\nreturn mount;`)(
    React, () => null, { id: 19, standaloneQuizId: "own-native-quiz" }, "own-course", data,
    { mutateAsync: save }, setOptimisticCompleted, fireLessonCompleteEffect,
  ) as React.ReactElement<{ quizId: string; sourceLessonId: number; courseSlug: string; authorPreview: boolean; onComplete: (score: number, passed: boolean) => Promise<void> }>;
  return { props: mount.props, save, setOptimisticCompleted, fireLessonCompleteEffect };
}

describe("actual enrolled Course Player native quiz integration", () => {
  it("retains exact quiz, source lesson and course references", () => {
    expect(primary({ isAdminPreview: false }).props).toMatchObject({ quizId: "own-native-quiz", sourceLessonId: 19, courseSlug: "own-course", authorPreview: false });
  });
  it("passes only literal trusted server preview intent, never role or enrollment inference", () => {
    expect(primary({ isAdminPreview: true }).props.authorPreview).toBe(true);
    expect(primary({ role: "admin", enrollment: { id: -1 } }).props.authorPreview).toBe(false);
    expect(primary({ isAdminPreview: "true" }).props.authorPreview).toBe(false);
    expect(primary(undefined).props.authorPreview).toBe(false);
  });
  it("preview callbacks never persist learner progress or fire completion effects", async () => {
    const view = primary({ isAdminPreview: true });
    await view.props.onComplete(100, true);
    expect(view.save).not.toHaveBeenCalled();
    expect(view.setOptimisticCompleted).not.toHaveBeenCalled();
    expect(view.fireLessonCompleteEffect).not.toHaveBeenCalled();
  });
  it("failed or pending grading callbacks do not persist completion", async () => {
    const view = primary({ isAdminPreview: false });
    await view.props.onComplete(60, false);
    expect(view.save).not.toHaveBeenCalled();
    expect(view.fireLessonCompleteEffect).not.toHaveBeenCalled();
  });
  it("awaits actual successful progress persistence before completion UI and effects", async () => {
    let resolve!: (value: unknown) => void;
    const view = primary({ isAdminPreview: false }, vi.fn(() => new Promise(done => { resolve = done; })));
    const pending = view.props.onComplete(100, true);
    expect(view.save).toHaveBeenCalledWith({ lessonId: 19, courseSlug: "own-course" });
    expect(view.setOptimisticCompleted).not.toHaveBeenCalled();
    expect(view.fireLessonCompleteEffect).not.toHaveBeenCalled();
    resolve({ success: true });
    await pending;
    const update = view.setOptimisticCompleted.mock.calls[0][0] as (previous: Set<number>) => Set<number>;
    expect([...update(new Set([7]))]).toEqual([7, 19]);
    expect(view.fireLessonCompleteEffect).toHaveBeenCalledOnce();
  });
  it("retains progress and effects unchanged when the server denies a stale-school save", async () => {
    const view = primary({ isAdminPreview: false }, vi.fn().mockRejectedValue(new Error("school changed")));
    await view.props.onComplete(100, true);
    expect(view.setOptimisticCompleted).not.toHaveBeenCalled();
    expect(view.fireLessonCompleteEffect).not.toHaveBeenCalled();
  });
  it("alternate renderer receives an explicit parent course slug instead of an undeclared variable", () => {
    const parent = jsxMount("client/src/pages/lms/CoursePlayerPage.tsx", "LessonContent");
    const child = jsxMount("client/src/pages/lms/CoursePlayerPage.tsx", "EmbeddedQuizPlayer");
    expect(parent).toContain("courseSlug={course.slug}");
    const output = ts.transpileModule(`const mount = (${child});`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React }, fileName: "alternate-mount.tsx",
    }).outputText;
    const onComplete = vi.fn();
    const mount = new Function("React", "EmbeddedQuizPlayer", "lesson", "courseSlug", "onComplete", `${output}\nreturn mount;`)(
      React, () => null, { id: 19, quizId: "own-native-quiz" }, "own-course", onComplete,
    ) as React.ReactElement<{ courseSlug: string; sourceLessonId: number; authorPreview?: boolean; onComplete: (score: number, passed: boolean) => void }>;
    expect(mount.props).toMatchObject({ courseSlug: "own-course", sourceLessonId: 19 });
    expect(mount.props.authorPreview).toBeUndefined();
    mount.props.onComplete(60, false);
    expect(onComplete).not.toHaveBeenCalled();
    mount.props.onComplete(100, true);
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
