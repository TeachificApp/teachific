import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import AdmZip from "adm-zip";
import { JSDOM } from "jsdom";
import { quizzes, quizAttempts, organizations, orgSubscriptions } from "../drizzle/schema";
import { createNativeQuizGrader, gradeQuizQuestion, scoreNativeQuizAttempt } from "../shared/quizScoring";
import { nativeQuizSaveFields, readNativeQuizConfig, nativeQuizPlayerSettings, redactNativeQuizQuestions } from "./lib/quizNativeConfigRuntime";
import { generateScormPackage } from "./scormGenerator";

const fixture = vi.hoisted(() => ({ orgId: 9, denied: false, quiz: null as any, inserts: [] as any[], updates: [] as any[], queries: [] as any[] }));
vi.mock("./lib/course360AppCapabilities", () => ({
  requireCourse360AppCapability: vi.fn(async () => { if (fixture.denied) throw new Error("No active selected school capability"); return { orgId: fixture.orgId, access: { isInTrial: false, isPaid: true } }; }),
  requireCourse360AppOrganization: vi.fn(async (_id: number, hint?: number) => { if (fixture.denied || hint && hint !== fixture.orgId) throw new Error("School mismatch"); return { orgId: fixture.orgId }; }),
}));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn(() => { throw new Error("Provider forbidden"); }) }));
vi.mock("./lib/publicQuizDeliveryScope", () => ({ assertPublicQuizDeliveryHost: vi.fn() }));
vi.mock("./db", () => ({ getDb: async () => {
  const dialect = new MySqlDialect();
  const conditions = (where: any) => { const compiled = dialect.sqlToQuery(where); fixture.queries.push(compiled); return compiled; };
  const checkFields = (table: any, values: any) => { const columns = getTableColumns(table); for (const key of Object.keys(values)) if (!columns[key]) throw new Error("Unknown Drizzle property " + key); };
  return {
    select: (selection?: any) => ({ from: (table: any) => ({ where: (where: any) => {
      const sql = conditions(where); let rows: any[] = [];
      if (table === quizzes) rows = fixture.quiz && (!sql.sql.includes('`orgId` = ?') || sql.params.includes(fixture.quiz.orgId)) ? [fixture.quiz] : [];
      if (table === organizations) rows = [{ id: 9, slug: "north", isActive: true }];
      if (table === orgSubscriptions) rows = [{ plan: "free", status: "active" }];
      if (selection?.count) rows = [{ count: 0 }];
      return { limit: async () => rows, orderBy: async () => rows, then: (resolve: any) => Promise.resolve(rows).then(resolve) };
    } }) }),
    insert: (table: any) => ({ values: async (values: any) => { checkFields(table, values); fixture.inserts.push({ table, values }); if (table === quizzes) fixture.quiz = { ...fixture.quiz, ...values, id: 44 }; return [{ insertId: 44 }]; } }),
    update: (table: any) => ({ set: (values: any) => { checkFields(table, values); return { where: async (where: any) => { fixture.updates.push({ table, values, sql: conditions(where) }); if (table === quizzes) fixture.quiz = { ...fixture.quiz, ...values }; return [{ affectedRows: 1 }]; } }; } }),
  };
} }));
import { quizMakerRouter } from "./quizMakerRouter";

export const seven = [
  { id: "mc", type: "mcq", stem: "Select", points: 0.25, data: { multiSelect: false, choices: [{ id: "a", text: "A", correct: true }, { id: "b", text: "B", correct: false }] } },
  { id: "tf", type: "tf", stem: "True?", points: 0.5, data: { correct: false } },
  { id: "hot", type: "hotspot", stem: "Region", points: 1.25, data: { imageUrl: "data:image/png;base64,aA==", imageAlt: "Image", multiSelect: false, regions: [{ id: "region", shape: "rect", x: 50, y: 50, width: 20, height: 20, correct: true, label: "Center", feedback: "Zone feedback" }] } },
  { id: "match", type: "matching", stem: "Match", points: 0.75, data: { pairs: [{ id: "pair", premise: "Term", response: "Definition" }] } },
  { id: "blank", type: "fill_blank", stem: "Blank", points: 1.5, data: { template: "A {{blank}}", blanks: [{ id: "blank", acceptedAnswers: ["test"], caseSensitive: false }] } },
  { id: "short", type: "short_answer", stem: "Explain", points: 0.5, data: { autoGrade: true, keywords: ["pressure"], sampleAnswer: "Model answer" } },
  { id: "image", type: "image_choice", stem: "Image choice", points: 0.25, data: { multiSelect: false, choices: [{ id: "img", label: "Pick", imageUrl: "data:image/png;base64,aA==", correct: true }] } },
];
const answers = { mc: ["a"], tf: false, hot: [{ x: 50, y: 50 }], match: { pair: "pair" }, blank: { blank: "TEST" }, short: "Pressure is important", image: ["img"] };
const meta = { id: "native-uuid", title: "Full native", description: "Retained", passingScore: 85.125, timeLimit: 2.5, author: "Author", tags: ["existing"], shuffleQuestions: false, shuffleAnswers: true, showFeedback: "deferred", allowRetry: false, maxAttempts: 0, editorViewMode: "slides", branding: { primaryColor: "#123456", backgroundColor: "#ffffff" }, introSlide: { enabled: true, title: "Intro" }, resultSlide: { enabled: true, passMessage: "Done" }, futureMeta: { keep: true } };
const config = { meta, questions: seven };
const caller = () => quizMakerRouter.createCaller({ user: { id: 5, role: "org_admin" }, req: { headers: {}, hostname: "test" } } as any);
beforeEach(() => { fixture.quiz = { id: 44, orgId: 9, title: meta.title, description: "Retained", instructions: JSON.stringify(seven), themeConfig: { historicalTheme: "keep" }, visibility: "private", maxAttempts: 0, mockExamEnabled: false, shareToken: null, isPublished: false }; fixture.orgId = 9; fixture.denied = false; fixture.inserts.length = 0; fixture.updates.length = 0; fixture.queries.length = 0; });

describe("native quiz persistence against actual Drizzle contracts", () => {
  it("first save retains full metadata/settings and fractional points, reopen and SQL use only real columns", async () => {
    await caller().saveQuiz({ title: meta.title, description: meta.description, questionsJson: JSON.stringify(seven), settingsJson: JSON.stringify(meta) });
    const saved = fixture.inserts[0].values;
    expect(saved.timeLimitSeconds).toBe(150); expect(saved.legacyPassingScore).toBe(85.125); expect(saved.createdBy).toBeUndefined();
    const reopened = readNativeQuizConfig(fixture.quiz); expect(reopened.questions).toEqual(seven); expect(reopened.meta).toMatchObject(meta); expect(reopened.meta.cloudId).toBe(44);
    const sql = drizzle.mock().insert(quizzes).values(saved).toSQL(); expect(sql.sql).toContain('`theme_config`'); expect(sql.sql).toContain('`timeLimit`');
    expect(nativeQuizPlayerSettings(fixture.quiz).timeLimit).toBe(150);
  });
  it("update preserves unrelated theme and unknown forward metadata and guards SQL revision", async () => {
    await caller().saveQuiz({ quizId: 44, title: meta.title, questionsJson: JSON.stringify(seven), settingsJson: JSON.stringify(meta), expectedRevision: 0 });
    await caller().saveQuiz({ quizId: 44, title: meta.title, questionsJson: JSON.stringify(seven), settingsJson: JSON.stringify({ author: "Changed" }), expectedRevision: 1 });
    expect(fixture.quiz.themeConfig.historicalTheme).toBe("keep"); expect(readNativeQuizConfig(fixture.quiz).meta.futureMeta).toEqual({ keep: true });
    expect(fixture.updates[1].sql.sql).toContain("JSON_EXTRACT"); expect(fixture.updates[1].sql.params).toContain(1);
    await expect(caller().saveQuiz({ quizId: 44, title: "Stale", questionsJson: "[]", expectedRevision: 0 })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it.each([0, 10])("no legacy unscoped adoption or cross-school rehome for org %s", async orgId => {
    fixture.quiz.orgId = orgId; await expect(caller().getQuiz({ quizId: 44 })).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(fixture.updates).toHaveLength(0);
  });
  it("author capability denial prevents list/create/save/publish/export before writes/providers", async () => {
    fixture.denied = true;
    for (const operation of [() => caller().listQuizzes(), () => caller().createQuiz({ title: "No" }), () => caller().saveQuiz({ title: "No", questionsJson: "[]" }), () => caller().publish({ quizId: 44 }), () => caller().exportScorm({ quizId: 44, format: "scorm12" })]) await expect(operation()).rejects.toThrow("No active selected school");
    expect(fixture.inserts).toHaveLength(0); expect(fixture.updates).toHaveLength(0);
  });
  it("legacy array reads do not rewrite or adopt historical IDs/config", () => {
    const raw = JSON.stringify(fixture.quiz); const read = readNativeQuizConfig({ ...fixture.quiz, legacyPassingScore: 78.75, timeLimitSeconds: 90 }); expect(read.meta.passingScore).toBe(78.75); expect(read.meta.timeLimit).toBe(1.5); expect(JSON.stringify(fixture.quiz)).toBe(raw);
  });
  it("duplicate retains config and legacy raw questions but generates new native identity", async () => {
    fixture.quiz = { ...fixture.quiz, ...nativeQuizSaveFields({ title: meta.title, questionsJson: JSON.stringify(seven), settingsJson: JSON.stringify(meta) }, fixture.quiz) };
    // Router's legacy table query returns empty; no unrelated rows are replaced.
    await caller().duplicateQuiz({ quizId: 44 }); const copy = fixture.inserts[0].values; expect(copy.instructions).toBe(JSON.stringify(seven)); expect(readNativeQuizConfig(copy).meta.id).not.toBe(meta.id); expect(readNativeQuizConfig(copy).meta.author).toBe("Author");
  });
  it("private publish requires an explicit visibility decision, new token cryptographic and old token retained", async () => {
    await expect(caller().publish({ quizId: 44 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await caller().publish({ quizId: 44, visibility: "hidden" }); expect(fixture.quiz.visibility).toBe("hidden"); expect(fixture.quiz.shareToken).toMatch(/^[\w-]{32}$/); const token = fixture.quiz.shareToken;
    await caller().publish({ quizId: 44 }); expect(fixture.quiz.shareToken).toBe(token);
  });
  it("public payload redacted while server submission preserves fractional scores and grading snapshot", async () => {
    fixture.quiz = { ...fixture.quiz, ...nativeQuizSaveFields({ title: meta.title, questionsJson: JSON.stringify(seven), settingsJson: JSON.stringify(meta) }, fixture.quiz), visibility: "published", isPublished: true, shareToken: "old-token" };
    const publicCaller = quizMakerRouter.createCaller({ user: null, req: {} } as any), payload = await publicCaller.getPublishedQuiz({ shareToken: "old-token" });
    const raw = JSON.stringify(payload.questions); expect(raw).not.toContain('"correct":'); expect(raw).not.toContain("Model answer"); expect(raw).not.toContain('"acceptedAnswers":'); expect(raw).not.toContain('"explanation":');
    const result = await publicCaller.submitAttempt({ shareToken: "old-token", answersJson: JSON.stringify(answers) }); expect(result).toMatchObject({ earnedPoints: 5, totalPoints: 5, scorePercent: 100, passed: true, gradingStatus: "graded" });
    const values = fixture.inserts.at(-1)!.values; expect(values.questionSnapshot.nativeConfig.questions).toEqual(seven); expect(values.legacyScoreRaw).toBe(5);
    fixture.quiz.instructions = JSON.stringify([{ id: "fraction", type: "tf", data: { correct: true }, points: 0.25 }]); fixture.quiz.themeConfig = null;
    await publicCaller.submitAttempt({ shareToken: "old-token", answersJson: '{"fraction":true}' }); const fraction = fixture.inserts.at(-1)!.values; expect(fraction.earnedPoints).toBeUndefined(); expect(fraction.legacyScoreRaw).toBe(0.25); expect(fraction.questionSnapshot.scoring.earnedPoints).toBe(0.25);
  });
  it("subjective pending answers never pass/complete or masquerade as automatic zero", async () => {
    fixture.quiz = { ...fixture.quiz, visibility: "published", isPublished: true, shareToken: "old", instructions: JSON.stringify([{ id: "essay", type: "essay", points: 2, data: { rubric: "Private" } }]) };
    const result = await quizMakerRouter.createCaller({ user: null, req: {} } as any).submitAttempt({ shareToken: "old", answersJson: '{"essay":"Review me"}' });
    expect(result).toMatchObject({ passed: false, gradingStatus: "pending_manual" }); const attempt = fixture.inserts.at(-1)!.values; expect(attempt.status).toBe("in_progress"); expect(attempt.completedAt).toBeNull(); expect(attempt.legacyIsCompleted).toBe(false);
  });
});

describe("precise canonical native grades", () => {
  it("all advertised seven score from nested data", () => { expect(scoreNativeQuizAttempt(seven, answers)).toMatchObject({ earnedPoints: 5, totalPoints: 5, scorePercent: 100, pendingManual: false }); });
  it("default exact-set preserved; partial opt-in weighted selections and explicit wrong-choice policy", () => { const q: any = { id: "q", type: "mcq", points: 1.5, data: { choices: [{ id: "a", correct: true }, { id: "b", correct: true }, { id: "c", correct: false }] } }; expect(gradeQuizQuestion(q, ["a"]).earnedPoints).toBe(0); q.scoring = { partialCredit: true }; expect(gradeQuizQuestion(q, ["a"]).earnedPoints).toBe(0.75); expect(gradeQuizQuestion(q, ["a", "c"]).earnedPoints).toBe(0); q.scoring.wrongChoicePolicy = "subtract"; expect(gradeQuizQuestion(q, ["a", "b", "c"]).earnedPoints).toBe(0.75); expect(gradeQuizQuestion(q, ["a", "a"]).earnedPoints).toBe(0); });
  it("hotspot centered rectangle, circle, polygon edges and outside clicks", () => { const hit = createNativeQuizGrader().hit; expect(hit({ shape: "rect", x: 50, y: 50, width: 20, height: 20 }, { x: 40, y: 40 })).toBe(true); expect(hit({ shape: "circle", x: 50, y: 50, radius: 10 }, { x: 60, y: 50 })).toBe(true); expect(hit({ shape: "polygon", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }] }, { x: 5, y: 5 })).toBe(true); expect(gradeQuizQuestion(seven[2], [{ x: 5, y: 5 }]).earnedPoints).toBe(0); });
  it("keywords literal bounded tokens, blank keyword opt-in, exact variants and missing numeric rejection", () => { expect(gradeQuizQuestion(seven[5], "depressure").correct).toBe(false); expect(gradeQuizQuestion(seven[5], "Pressure").correct).toBe(true); expect(gradeQuizQuestion({ id: "b", type: "fill_blank", data: { blanks: [{ id: "x", gradingMode: "keyword", acceptedAnswers: ["flow"] }] } }, { x: "good flow" }).correct).toBe(true); for (const empty of [null, "", undefined, false]) expect(gradeQuizQuestion({ id: "n", type: "numeric", data: { correctValue: 0 } }, empty).correct).toBe(false); });
});

describe.each(["scorm12", "scorm2004"] as const)("native save → reopen → %s export VM", format => {
  it("renders all seven, uses same grader, exact mastery, fractional score and suspend resume", async () => {
    const fields = nativeQuizSaveFields({ title: meta.title, questionsJson: JSON.stringify(seven), settingsJson: JSON.stringify(meta) }, fixture.quiz), reopened = readNativeQuizConfig({ ...fixture.quiz, ...fields });
    const zip = new AdmZip(await generateScormPackage({ title: meta.title, description: "Retained", questions: reopened.questions, passingScore: meta.passingScore, timeLimit: 150, shuffleQuestions: false, nativeConfig: reopened, watermark: "Course360 trial", format }));
    const manifest = zip.readAsText("imsmanifest.xml"); expect(manifest).toContain(format === "scorm12" ? "85.125</adlcp:masteryscore>" : "0.85125</imsss:minNormalizedMeasure>");
    const html = zip.readAsText("index.html"), script = html.match(/<script>([\s\S]*?)<\/script>/)![1]; const values: Record<string, string> = {}; let init = 0, finish = 0;
    const api: any = {}; for (const [name, fn] of Object.entries({ Initialize: () => { init++; return "true"; }, GetValue: (key: string) => values[key] || "", SetValue: (key: string, value: string) => { values[key] = value; return "true"; }, Commit: () => "true", Terminate: () => { finish++; return "true"; } })) api[format === "scorm12" ? ({ Initialize: "LMSInitialize", GetValue: "LMSGetValue", SetValue: "LMSSetValue", Commit: "LMSCommit", Terminate: "LMSFinish" } as any)[name] : name] = fn;
    const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://offline.invalid" }); (dom.window as any)[format === "scorm12" ? "API" : "API_1484_11"] = api; dom.window.eval(script); const runtime = (dom.window as any).Course360NativeQuiz; runtime.start();
    for (const [index, q] of seven.entries()) { runtime.getState().index = index; runtime.render(); expect(dom.window.document.getElementById("question-container")!.querySelector("input,select,textarea,button")).not.toBeNull(); runtime.answer(q.id, (answers as any)[q.id]); }
    expect(runtime.score()).toMatchObject({ earned: 5, total: 5, pct: 100, pending: false }); expect(values["cmi.suspend_data"]).toContain('"tf":false'); expect(dom.window.document.getElementById("watermark")!.textContent).toBe("Course360 trial");
    dom.window.dispatchEvent(new dom.window.Event("beforeunload")); expect(finish).toBe(1); const resumeDom = new JSDOM(html, { runScripts: "outside-only", url: "https://offline.invalid" }); (resumeDom.window as any)[format === "scorm12" ? "API" : "API_1484_11"] = api; resumeDom.window.eval(script); const resumed = (resumeDom.window as any).Course360NativeQuiz; expect(resumed.getState().answers).toEqual(answers); resumed.submit(); expect(values[format === "scorm12" ? "cmi.core.lesson_status" : "cmi.success_status"]).toBe("passed"); expect(init).toBe(2); dom.window.close(); resumeDom.window.close();
  });
  it("safe script serialization cannot execute malicious stem/URL data", async () => {
    const malicious = { meta: { ...meta, title: '</script><script>window.PWNED=true</script>' }, questions: [{ ...seven[0], stem: '<img src=x onerror="window.PWNED=true">', image: { url: 'javascript:alert(1)' } }] };
    const zip = new AdmZip(await generateScormPackage({ title: malicious.meta.title, description: "", questions: malicious.questions, passingScore: 70, timeLimit: null, shuffleQuestions: false, nativeConfig: malicious, format })); const html = zip.readAsText("index.html"); expect(html.match(/<script>/g)).toHaveLength(1); const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://offline.invalid" }); dom.window.eval(html.match(/<script>([\s\S]*?)<\/script>/)![1]); (dom.window as any).Course360NativeQuiz.start(); expect((dom.window as any).PWNED).toBeUndefined(); expect(dom.window.document.querySelector('[src^="javascript:"]')).toBeNull(); dom.window.close();
  });
});

describe("additional declared native runtime coverage", () => {
 it("all sixteen native types render usable controls or explicit unscored activity; manual pending does not complete", async () => {
  const extras = [
   { id:"ordering",type:"ordering",stem:"Order",points:0.25,data:{items:[{id:"one",text:"One"},{id:"two",text:"Two"}]} },
   { id:"drag_drop",type:"drag_drop",stem:"Place",points:0.25,data:{targets:[{id:"target",label:"Target"}],items:[{id:"item",text:"Item",targetId:"target"}]} },
   { id:"drag_words",type:"drag_words",stem:"Words",points:0.25,data:{template:"{{word}}",blanks:[{id:"word",correctWord:"flow"}]} },
   { id:"dropdown",type:"dropdown",stem:"Dropdown",points:0.25,data:{template:"{{drop}}",blanks:[{id:"drop",options:["A","B"],correctIndex:0}]} },
   { id:"numeric",type:"numeric",stem:"Number",points:0.25,data:{correctValue:0,tolerance:0} },
   { id:"label",type:"image_labeling",stem:"Label",points:0.25,data:{labels:[{id:"label",text:"Label"}],targets:[{id:"target",x:50,y:50,labelId:"label"}]} },
   { id:"comparison",type:"image_comparison",stem:"Compare",points:0,data:{comparisonImageA:"data:image/png;base64,aA==",comparisonImageB:"data:image/png;base64,aA=="} },
   { id:"likert",type:"likert",stem:"Rate",points:0,data:{statements:[{id:"stmt",text:"Rate this"}],scaleLabels:["Yes","No"]} },
   { id:"essay",type:"essay",stem:"Write",points:0.25,data:{rubric:"Private rubric"} },
  ];
  const native={meta:{...meta,timeLimit:null},questions:[...seven,...extras]};
  const zip=new AdmZip(await generateScormPackage({title:meta.title,description:"",questions:native.questions,passingScore:70,timeLimit:null,shuffleQuestions:false,nativeConfig:native,format:"scorm2004"}));
  const html=zip.readAsText("index.html"),dom=new JSDOM(html,{runScripts:"outside-only",url:"https://offline.invalid"}),values:Record<string,string>={};
  (dom.window as any).API_1484_11={Initialize:()=>"true",GetValue:()=>"",SetValue:(k:string,v:string)=>{values[k]=v;return "true"},Commit:()=>"true",Terminate:()=>"true"}; dom.window.eval(html.match(/<script>([\s\S]*?)<\/script>/)![1]); const runtime=(dom.window as any).Course360NativeQuiz;runtime.start();
  for (let i=0;i<native.questions.length;i++){runtime.getState().index=i;runtime.render();expect(dom.window.document.getElementById("question-container")!.textContent).not.toContain("requires instructor review");}
  for(const [id,value] of Object.entries({...answers,ordering:["one","two"],drag_drop:{item:"target"},drag_words:{word:"flow"},dropdown:{drop:"0"},numeric:"0",label:{target:"label"},essay:"Review me"}))runtime.answer(id,value);
  expect(runtime.score()).toMatchObject({earned:6.5,total:6.75,pending:true});runtime.submit();expect(values["cmi.success_status"]).toBe("unknown");expect(values["cmi.completion_status"]).toBe("incomplete");dom.window.close();
 });
 it("deadline survives suspend and an expired resumed attempt submits once with exact fractional score", async () => {
  const native={meta:{...meta,timeLimit:0.1},questions:[seven[0]]}; const zip=new AdmZip(await generateScormPackage({title:meta.title,description:"",questions:native.questions,passingScore:85.125,timeLimit:6,shuffleQuestions:false,nativeConfig:native,format:"scorm12"})); const html=zip.readAsText("index.html");
  const values:Record<string,string>={"cmi.suspend_data":JSON.stringify({version:1,answers:{mc:["a"]},ids:["mc"],index:0,startedAt:Date.now()-10000,submitted:false})}; const dom=new JSDOM(html,{runScripts:"outside-only",url:"https://offline.invalid"});(dom.window as any).API={LMSInitialize:()=>"true",LMSGetValue:(k:string)=>values[k]||"",LMSSetValue:(k:string,v:string)=>{values[k]=v;return "true"},LMSCommit:()=>"true",LMSFinish:()=>"true"};dom.window.eval(html.match(/<script>([\s\S]*?)<\/script>/)![1]);expect((dom.window as any).Course360NativeQuiz.getState().submitted).toBe(true);expect(values["cmi.core.score.raw"]).toBe("100");expect(values["cmi.core.score.max"]).toBe("100");expect(values["cmi.core.lesson_status"]).toBe("passed");dom.window.close();
 });
});
