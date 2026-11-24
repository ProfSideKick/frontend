const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const creation = read('src/components/sessions/ClassCreation.tsx');
const preview = read('src/components/sessions/SlidesPreview.tsx');
const modelList = read('src/constants/visionModels.ts');
const types = read('src/types/types.ts');

test('all current GPT-6, GPT-5.6 and legacy GPT-4o choices are exposed', () => {
  const actual = [...modelList.matchAll(/value: "([^"]+)"/g)].map(x => x[1]);
  const expected = ['gpt-4o', 'gpt-6.2-astra', 'gpt-6.2-sol', 'gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'];
  assert.deepEqual(actual, expected);
  assert.match(modelList, /DEFAULT_VISION_MODEL = "gpt-4o"/);
});

test('session creation stores a user-selected slide vision model', () => {
  assert.match(creation, /name="visionModel"/);
  assert.match(creation, /visionModel: DEFAULT_VISION_MODEL/);
  assert.match(creation, /visionModel: classDetails\.visionModel \|\| DEFAULT_VISION_MODEL/);
});

test('slide regeneration, add and image replacement use the selected or stored model', () => {
  assert.match(preview, /id="slide-analysis-model"/);
  assert.match(preview, /visionModel: model/);
  assert.match(preview, /requestSlideRegeneration\(slide, editingVisionInstructions, editingVisionModel\)/);
  assert.match(preview, /formData\.append\('vision_model', allSlides\[0\]\?\.visionModel \|\| DEFAULT_VISION_MODEL\)/);
  assert.match(preview, /selectedSlide\?\.id === slideId \? editingVisionModel/);
  assert.doesNotMatch(preview, /visionModel: 'gpt-4o'/);
});

test('regeneration exposes detailed error and never shows a success banner', () => {
  assert.match(preview, /setRegenerationFeedback\(\{ message \}\)/);
  assert.match(preview, /role="alert"/);
  assert.match(preview, /response\.text\(\)/);
  assert.match(preview, /errorBody\?\.detail/);
  assert.match(preview, /updatedSlide\.visionModel !== model/);
  assert.doesNotMatch(preview, /Content regenerated successfully with/);
});

test('all edited TSX and TS sources transpile syntactically', () => {
  for (const [file, content] of [
    ['ClassCreation.tsx', creation], ['SlidesPreview.tsx', preview],
    ['types.ts', types], ['visionModels.ts', modelList]
  ]) {
    const result = ts.transpileModule(content, {
      fileName: file, reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
    });
    const errors = (result.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error);
    assert.equal(errors.length, 0, file + ': ' + errors.map(x => x.messageText).join('; '));
  }
});

test('shared selection defaults to GPT-4o and only explicit regeneration calls the backend', () => {
  assert.match(preview, /\[sharedVisionModel, setSharedVisionModel\] = useState\(DEFAULT_VISION_MODEL\)/);
  assert.match(preview, /setEditingVisionModel\(sharedVisionModel\)/);
  assert.match(preview, /onChange=\{e => setSharedVisionModel\(e.target.value\)\}/);
  assert.match(preview, /Last used: \{selectedSlide.visionModel/);
});
test('bulk regeneration awaits each slide, preserves instructions and tracks partial failures', () => {
  assert.match(preview, /for \(const slide of targets\)/);
  assert.match(preview, /await requestSlideRegeneration\(slide, slide.visionInstructions \|\| '', model\)/);
  assert.match(preview, /bulkRunning.current = true/);
  assert.match(preview, /bulkRunning.current = false/);
  assert.match(preview, /failures.push\(/);
  assert.match(preview, /if \(!confirm\(\x60Regenerate all/);
});
