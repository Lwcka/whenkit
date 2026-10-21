import { useEffect, useRef } from 'react';
import type { CategoryDto, EntryDto } from '../../shared/ipc';
import {
  appStrings,
  entryStrings,
  resourceTypeLabels,
} from '../../shared/strings.ro';
import { CategoryPicker } from './category-picker';
import type { Draft, FieldErrors, ResourceType } from './edit-draft';
import { ListEditor } from './list-editor';
import { SelectField } from './select-field';
import { TextField } from './text-field';
import './entry-edit-form.css';

const RESOURCE_TYPE_OPTIONS = (
  Object.keys(resourceTypeLabels) as ResourceType[]
).map((value) => ({ value, label: resourceTypeLabels[value] }));

export interface EntryEditFormProps {
  kind: EntryDto['kind'];
  /** The initial in the mark, as in reading. */
  mark: string;
  draft: Draft;
  /** The fields the user changed; the rest of the draft stays. */
  onChange: (changes: Partial<Draft>) => void;
  errors: FieldErrors;
  /** A save is running: nothing can be changed. */
  locked: boolean;
  /** The categories of the entry's zone. */
  categories: readonly CategoryDto[];
  slots: ReadonlyMap<string, number>;
}

/** The errors of the source rows, by row index. */
function rowErrorsOf(errors: FieldErrors): Record<number, string> {
  const rows: Record<number, string> = {};
  for (const [key, text] of Object.entries(errors)) {
    const match = /^sources\.(\d+)$/.exec(key);
    if (match?.[1] !== undefined && text !== undefined)
      rows[Number(match[1])] = text;
  }
  return rows;
}

/**
 * The fields Claude writes, as a form (DESIGN, entry-sheet in edit): a
 * controlled view of the draft that `App` keeps. The focus starts in „Nume”.
 * The form holds no state of its own; validation and saving live above it.
 */
export function EntryEditForm({
  kind,
  mark,
  draft,
  onChange,
  errors,
  locked,
  categories,
  slots,
}: EntryEditFormProps) {
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameInput.current?.focus({ preventScroll: true });
  }, []);

  const concept = kind === 'concept';
  const situationCount = draft.situations.filter(
    (situation) => situation.trim() !== '',
  ).length;

  return (
    <div className="entry-edit-form">
      <div className="entry-edit-head">
        <div className="sheet-mark" aria-hidden="true">
          {mark}
        </div>
        <div className="entry-edit-head-fields">
          <TextField
            label={entryStrings.name}
            value={draft.name}
            inputRef={nameInput}
            error={errors.name}
            disabled={locked}
            onChange={(name) => onChange({ name })}
          />
          <div
            className="entry-edit-head-row"
            data-concept={concept ? '' : undefined}
          >
            <TextField
              label={entryStrings.url}
              value={draft.url}
              mono
              error={errors.url}
              disabled={locked}
              onChange={(url) => onChange({ url })}
            />
            {!concept && (
              <SelectField
                label={entryStrings.resourceType}
                value={draft.resourceType ?? 'site'}
                options={RESOURCE_TYPE_OPTIONS}
                error={errors.resourceType}
                disabled={locked}
                onChange={(value) =>
                  onChange({ resourceType: value as ResourceType })
                }
              />
            )}
          </div>
        </div>
      </div>

      <section>
        <h2 className="sheet-section-label">{entryStrings.categories}</h2>
        <CategoryPicker
          ariaLabel={entryStrings.categories}
          categories={categories}
          slots={slots}
          selected={draft.categoryIds}
          error={errors.categories}
          disabled={locked}
          onChange={(categoryIds) => onChange({ categoryIds })}
        />
      </section>

      <section>
        <h2 className="sheet-section-label">{entryStrings.whatItDoes}</h2>
        <TextField
          ariaLabel={entryStrings.whatItDoes}
          multiline
          value={draft.whatItDoes}
          error={errors.whatItDoes}
          disabled={locked}
          onChange={(whatItDoes) => onChange({ whatItDoes })}
        />
      </section>

      <section>
        <h2 className="sheet-section-label">
          {appStrings.sheetSituations(kind, situationCount)}
        </h2>
        <ListEditor
          numbered
          rows={draft.situations}
          rowLabel={appStrings.situationRow}
          addLabel={appStrings.addSituation}
          minRows={1}
          error={errors.situations}
          disabled={locked}
          onChange={(situations) => onChange({ situations })}
        />
      </section>

      <section>
        <h2 className="sheet-section-label">{entryStrings.keywords}</h2>
        <ListEditor
          rows={draft.keywords}
          rowLabel={appStrings.keywordRow}
          addLabel={appStrings.addKeyword}
          error={errors.keywords}
          disabled={locked}
          onChange={(keywords) => onChange({ keywords })}
        />
      </section>

      {concept && (
        <>
          <section>
            <h2 className="sheet-section-label">{entryStrings.content}</h2>
            <TextField
              ariaLabel={entryStrings.content}
              multiline
              rows={10}
              mono
              value={draft.content}
              error={errors.content}
              disabled={locked}
              onChange={(content) => onChange({ content })}
            />
          </section>
          <section>
            <h2 className="sheet-section-label">{entryStrings.sources}</h2>
            <ListEditor
              mono
              rows={draft.sources}
              rowLabel={appStrings.sourceRow}
              addLabel={appStrings.addSource}
              error={errors.sources}
              rowErrors={rowErrorsOf(errors)}
              disabled={locked}
              onChange={(sources) => onChange({ sources })}
            />
          </section>
        </>
      )}
    </div>
  );
}
