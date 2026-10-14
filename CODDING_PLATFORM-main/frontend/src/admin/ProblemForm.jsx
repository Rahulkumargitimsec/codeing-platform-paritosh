import { useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Editor from '@monaco-editor/react';
import { Plus, Trash2, Copy } from 'lucide-react';
import '../lib/monaco';
import { editorTheme } from '../lib/monaco';
import { useTheme } from '../lib/theme';
import { LANGUAGES, TAGS, codeFor } from '../lib/format';
import { Alert, Spinner } from '../components/ui';

const LANG_NAMES = ['C++', 'Java', 'JavaScript'];
const LANG_ID = { 'C++': 'cpp', Java: 'java', JavaScript: 'javascript' };

const schema = z.object({
  title: z.string().trim().min(1, 'Add a title'),
  description: z.string().trim().min(1, 'Add a description'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  tags: z.enum(Object.keys(TAGS)),
  visibleTestCases: z.array(z.object({
    input: z.string().min(1, 'Add the input'),
    output: z.string().min(1, 'Add the expected output'),
    explanation: z.string().min(1, 'Explain this example'),
  })).min(1, 'Add at least one example'),
  hiddenTestCases: z.array(z.object({
    input: z.string().min(1, 'Add the input'),
    output: z.string().min(1, 'Add the expected output'),
  })).min(1, 'Add at least one hidden test case'),
  startCode: z.array(z.object({ language: z.enum(LANG_NAMES), initialCode: z.string().trim().min(1, 'Add starter code') })).length(3),
  referenceSolution: z.array(z.object({ language: z.enum(LANG_NAMES), completeCode: z.string().trim().min(1, 'Add a reference solution') })).length(3),
});

export const emptyProblem = {
  title: '',
  description: '',
  difficulty: 'easy',
  tags: 'array',
  visibleTestCases: [{ input: '', output: '', explanation: '' }],
  hiddenTestCases: [{ input: '', output: '' }],
  startCode: LANG_NAMES.map((language) => ({ language, initialCode: '' })),
  referenceSolution: LANG_NAMES.map((language) => ({ language, completeCode: '' })),
};

// Normalise whatever the API returns into the three fixed language slots
export const toFormValues = (p) => ({
  title: p.title || '',
  description: p.description || '',
  difficulty: p.difficulty || 'easy',
  tags: TAGS[p.tags] ? p.tags : 'array',
  visibleTestCases: p.visibleTestCases?.length ? p.visibleTestCases.map(({ input, output, explanation }) => ({ input, output, explanation: explanation || '' })) : emptyProblem.visibleTestCases,
  hiddenTestCases: p.hiddenTestCases?.length ? p.hiddenTestCases.map(({ input, output }) => ({ input, output })) : emptyProblem.hiddenTestCases,
  startCode: LANG_NAMES.map((language) => ({ language, initialCode: codeFor(p.startCode, LANG_ID[language]) })),
  referenceSolution: LANG_NAMES.map((language) => ({ language, completeCode: codeFor(p.referenceSolution, LANG_ID[language], 'completeCode') })),
});

function Section({ title, hint, children, aside }) {
  return (
    <section className="panel">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {hint && <p className="text-sm text-ink-2 mt-0.5">{hint}</p>}
        </div>
        {aside}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function CodeTabs({ control, name, field, errors, onCopyFromStarter }) {
  const [theme] = useTheme();
  const [active, setActive] = useState(0);
  const errs = errors?.[name] || [];
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="segmented" role="group">
          {LANG_NAMES.map((l, i) => (
            <button type="button" key={l} aria-pressed={active === i} onClick={() => setActive(i)}>
              {l}{errs[i] ? <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-bad align-middle" /> : null}
            </button>
          ))}
        </div>
        {onCopyFromStarter && (
          <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => onCopyFromStarter(active)}>
            <Copy size={14} /> Start from starter code
          </button>
        )}
      </div>
      <Controller
        control={control}
        name={`${name}.${active}.${field}`}
        render={({ field: f }) => (
          <div className={`rounded-lg overflow-hidden border ${errs[active] ? 'border-bad' : 'border-line-strong'}`}>
            <Editor key={`${name}-${active}`} height="340px" language={LANGUAGES.find((l) => l.id === LANG_ID[LANG_NAMES[active]])?.monaco}
              value={f.value} onChange={(v) => f.onChange(v ?? '')} theme={editorTheme(theme)}
              options={{ minimap: { enabled: false }, fontSize: 13, fontFamily: 'JetBrains Mono Variable, monospace', scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4, padding: { top: 10 } }} />
          </div>
        )}
      />
      {errs[active]?.[field] && <p className="field-error">{errs[active][field].message}</p>}
      {errs.length > 0 && !errs[active] && <p className="field-error">Another language tab is missing code.</p>}
    </div>
  );
}

export default function ProblemForm({ defaultValues = emptyProblem, onSubmit, submitLabel, busyLabel, serverError }) {
  const { register, control, handleSubmit, getValues, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const visible = useFieldArray({ control, name: 'visibleTestCases' });
  const hidden = useFieldArray({ control, name: 'hiddenTestCases' });

  const copyStarter = (i) => setValue(`referenceSolution.${i}.completeCode`, getValues(`startCode.${i}.initialCode`), { shouldDirty: true });
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <Section title="Basics">
        <div className="grid sm:grid-cols-[1fr_10rem_12rem] gap-4">
          <div>
            <label className="field-label" htmlFor="title">Title</label>
            <input id="title" className={`input ${errors.title ? 'is-invalid' : ''}`} {...register('title')} />
            {errors.title && <p className="field-error">{errors.title.message}</p>}
          </div>
          <div>
            <label className="field-label" htmlFor="difficulty">Difficulty</label>
            <select id="difficulty" className="select" {...register('difficulty')}>
              <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="tags">Topic</label>
            <select id="tags" className="select" {...register('tags')}>
              {Object.entries(TAGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="field-label" htmlFor="description">Description</label>
          <textarea id="description" rows={10} className={`textarea ${errors.description ? 'is-invalid' : ''}`} {...register('description')} />
          <p className="field-hint">Separate paragraphs with a blank line. A paragraph starting with a line like "Input format" or "Constraints" becomes a heading. Write powers as 10^5.</p>
          {errors.description && <p className="field-error">{errors.description.message}</p>}
        </div>
      </Section>

      <Section title="Examples" hint="Shown on the problem page and used by Run."
        aside={<button type="button" className="btn btn-outline btn-sm" onClick={() => visible.append({ input: '', output: '', explanation: '' })}><Plus size={15} /> Add example</button>}>
        <div className="space-y-4">
          {visible.fields.map((f, i) => (
            <div key={f.id} className="rounded-lg border border-line p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-[0.95rem]">Example {i + 1}</h3>
                {visible.fields.length > 1 && (
                  <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => visible.remove(i)}><Trash2 size={14} /> Remove</button>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Input</label>
                  <textarea rows={3} className={`textarea font-code ${errors.visibleTestCases?.[i]?.input ? 'is-invalid' : ''}`} {...register(`visibleTestCases.${i}.input`)} />
                  {errors.visibleTestCases?.[i]?.input && <p className="field-error">{errors.visibleTestCases[i].input.message}</p>}
                </div>
                <div>
                  <label className="field-label">Expected output</label>
                  <textarea rows={3} className={`textarea font-code ${errors.visibleTestCases?.[i]?.output ? 'is-invalid' : ''}`} {...register(`visibleTestCases.${i}.output`)} />
                  {errors.visibleTestCases?.[i]?.output && <p className="field-error">{errors.visibleTestCases[i].output.message}</p>}
                </div>
              </div>
              <div className="mt-3">
                <label className="field-label">Explanation</label>
                <input className={`input ${errors.visibleTestCases?.[i]?.explanation ? 'is-invalid' : ''}`} {...register(`visibleTestCases.${i}.explanation`)} />
                {errors.visibleTestCases?.[i]?.explanation && <p className="field-error">{errors.visibleTestCases[i].explanation.message}</p>}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Hidden test cases" hint="Submissions are judged on these. Include edge cases and large inputs."
        aside={<button type="button" className="btn btn-outline btn-sm" onClick={() => hidden.append({ input: '', output: '' })}><Plus size={15} /> Add test case</button>}>
        <div className="space-y-3">
          {hidden.fields.map((f, i) => (
            <div key={f.id} className="grid md:grid-cols-[2.5rem_1fr_1fr_auto] gap-3 items-start">
              <span className="text-sm font-semibold text-ink-3 pt-2.5 tabular-nums">{i + 1}.</span>
              <div>
                <textarea rows={2} placeholder="Input" aria-label={`Hidden test ${i + 1} input`} className={`textarea font-code min-h-[3.2rem] ${errors.hiddenTestCases?.[i]?.input ? 'is-invalid' : ''}`} {...register(`hiddenTestCases.${i}.input`)} />
                {errors.hiddenTestCases?.[i]?.input && <p className="field-error">{errors.hiddenTestCases[i].input.message}</p>}
              </div>
              <div>
                <textarea rows={2} placeholder="Expected output" aria-label={`Hidden test ${i + 1} output`} className={`textarea font-code min-h-[3.2rem] ${errors.hiddenTestCases?.[i]?.output ? 'is-invalid' : ''}`} {...register(`hiddenTestCases.${i}.output`)} />
                {errors.hiddenTestCases?.[i]?.output && <p className="field-error">{errors.hiddenTestCases[i].output.message}</p>}
              </div>
              <button type="button" className="btn btn-danger-ghost btn-sm btn-icon mt-1.5" onClick={() => hidden.remove(i)} disabled={hidden.fields.length === 1} aria-label={`Remove hidden test ${i + 1}`}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {errors.hiddenTestCases?.root && <p className="field-error">{errors.hiddenTestCases.root.message}</p>}
        </div>
      </Section>

      <Section title="Starter code" hint="What people see when they open the problem. Include the input/output handling so they only write the function.">
        <CodeTabs control={control} name="startCode" field="initialCode" errors={errors} />
      </Section>

      <Section title="Reference solutions" hint="Each one must pass every example and hidden test case before the problem is saved.">
        <CodeTabs control={control} name="referenceSolution" field="completeCode" errors={errors} onCopyFromStarter={copyStarter} />
      </Section>

      <div className="sticky bottom-0 z-10 -mx-1 px-1 py-3 bg-bg/90 backdrop-blur border-t border-line flex flex-wrap items-center gap-3">
        {serverError && <Alert className="flex-1 min-w-[16rem] max-h-40 overflow-auto font-code text-xs">{serverError}</Alert>}
        {!serverError && hasErrors && <p className="text-sm text-bad flex-1">Some fields need attention. They're marked in red above.</p>}
        <button type="submit" className="btn btn-primary btn-lg ml-auto" disabled={isSubmitting}>
          {isSubmitting ? <><Spinner size={16} /> {busyLabel}</> : submitLabel}
        </button>
      </div>
    </form>
  );
}
