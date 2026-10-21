import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ListEditor, type ListEditorProps } from './list-editor';

afterEach(cleanup);

/** A list editor with state of its own, as the form keeps it. */
function Harness({
  initial,
  ...rest
}: { initial: string[] } & Partial<ListEditorProps>) {
  const [rows, setRows] = useState(initial);
  return (
    <>
      <ListEditor
        rows={rows}
        onChange={setRows}
        rowLabel={(n) => `Rândul ${n}`}
        addLabel="Adaugă rând"
        {...rest}
      />
      <output data-testid="rows">{JSON.stringify(rows)}</output>
    </>
  );
}

const rowsNow = () =>
  JSON.parse(screen.getByTestId('rows').textContent ?? '[]') as string[];
const inputs = () => screen.getAllByRole('textbox') as HTMLInputElement[];
const removeButtons = () =>
  screen.getAllByRole('button', {
    name: 'Șterge rândul',
  }) as HTMLButtonElement[];

describe('ListEditor', () => {
  it('shows one text field per row, named by its number', () => {
    render(<Harness initial={['unu', 'doi']} />);
    expect(inputs().map((input) => input.value)).toEqual(['unu', 'doi']);
    expect(screen.getByRole('textbox', { name: 'Rândul 2' })).toBeTruthy();
  });

  it('numbers the rows when asked to, as 01, 02', () => {
    const { container } = render(<Harness initial={['unu', 'doi']} numbered />);
    expect(
      [...container.querySelectorAll('.list-editor-number')].map(
        (number) => number.textContent,
      ),
    ).toEqual(['01', '02']);
  });

  it('edits a row', () => {
    render(<Harness initial={['unu', 'doi']} />);
    fireEvent.change(inputs()[1] as HTMLInputElement, {
      target: { value: 'doi!' },
    });
    expect(rowsNow()).toEqual(['unu', 'doi!']);
  });

  it('adds an empty row with the button and focuses it', () => {
    render(<Harness initial={['unu']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă rând' }));
    expect(rowsNow()).toEqual(['unu', '']);
    expect(document.activeElement).toBe(inputs()[1]);
  });

  it('adds an empty row on Enter in the last row, not in another', () => {
    render(<Harness initial={['unu', 'doi']} />);
    fireEvent.keyDown(inputs()[0] as HTMLInputElement, { key: 'Enter' });
    expect(rowsNow()).toEqual(['unu', 'doi']);

    const event = fireEvent.keyDown(inputs()[1] as HTMLInputElement, {
      key: 'Enter',
    });
    expect(event).toBe(false); // the default (a submit) was prevented
    expect(rowsNow()).toEqual(['unu', 'doi', '']);
    expect(document.activeElement).toBe(inputs()[2]);
  });

  it('removes a row with its ×, without asking', () => {
    render(<Harness initial={['unu', 'doi', 'trei']} />);
    fireEvent.click(removeButtons()[1] as HTMLButtonElement);
    expect(rowsNow()).toEqual(['unu', 'trei']);
    // The focus stays where the row was.
    expect(document.activeElement).toBe(inputs()[1]);
  });

  it('can remove the last row when no minimum is set', () => {
    render(<Harness initial={['unu']} />);
    fireEvent.click(removeButtons()[0] as HTMLButtonElement);
    expect(rowsNow()).toEqual([]);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('disables the × of the last remaining rows, up to the minimum', () => {
    render(<Harness initial={['unu']} minRows={1} />);
    expect(removeButtons()[0]?.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă rând' }));
    expect(removeButtons().map((button) => button.disabled)).toEqual([
      false,
      false,
    ]);
  });

  it('locks every field and button when disabled', () => {
    render(<Harness initial={['unu']} disabled />);
    expect(inputs()[0]?.disabled).toBe(true);
    expect(removeButtons()[0]?.disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Adaugă rând' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('shows an error under its row and one under the list', () => {
    render(
      <Harness
        initial={['unu', 'doi']}
        rowErrors={{ 1: 'Domeniu interzis.' }}
        error="Lista nu e bună."
      />,
    );
    const second = screen.getByRole('textbox', { name: 'Rândul 2' });
    expect(second.getAttribute('aria-invalid')).toBe('true');
    const row = second.closest('li') as HTMLElement;
    expect(within(row).getByRole('alert').textContent).toBe(
      'Domeniu interzis.',
    );
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    // A list-level error marks the rows that have no error of their own.
    const first = screen.getByRole('textbox', { name: 'Rândul 1' });
    const listAlert = screen.getByText('Lista nu e bună.');
    expect(first.getAttribute('aria-invalid')).toBe('true');
    expect(first.getAttribute('aria-describedby')).toBe(listAlert.id);
  });
});
