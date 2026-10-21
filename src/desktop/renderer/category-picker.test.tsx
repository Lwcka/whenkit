import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoryPicker } from './category-picker';
import { makeCategory } from './test-fixtures';

afterEach(cleanup);

const categories = [
  makeCategory('a', 'AI & LLM'),
  makeCategory('b', 'Imagini & video'),
  makeCategory('c', 'Securitate'),
];
const slots = new Map([
  ['a', 1],
  ['b', 2],
  ['c', 3],
]);

function renderPicker(selected: string[], onChange = vi.fn(), error?: string) {
  render(
    <CategoryPicker
      ariaLabel="Categorii"
      categories={categories}
      slots={slots}
      selected={selected}
      onChange={onChange}
      error={error}
    />,
  );
  return onChange;
}

const chip = (name: string) =>
  screen.getByRole('button', { name }) as HTMLButtonElement;

describe('CategoryPicker', () => {
  it('is a group of toggle chips, the chosen ones pressed', () => {
    renderPicker(['b']);
    expect(screen.getByRole('group', { name: 'Categorii' })).toBeTruthy();
    expect(chip('AI & LLM').getAttribute('aria-pressed')).toBe('false');
    expect(chip('Imagini & video').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Securitate').getAttribute('aria-pressed')).toBe('false');
    expect(chip('Imagini & video').getAttribute('data-slot')).toBe('2');
    expect(chip('Imagini & video').classList.contains('category-chip')).toBe(
      true,
    );
  });

  it('adds a category on click, after the ones chosen', () => {
    const onChange = renderPicker(['b']);
    fireEvent.click(chip('AI & LLM'));
    expect(onChange).toHaveBeenCalledWith(['b', 'a']);
  });

  it('removes a pressed category on click', () => {
    const onChange = renderPicker(['b', 'a']);
    fireEvent.click(chip('Imagini & video'));
    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('can empty the choice (the form then says a category is needed)', () => {
    const onChange = renderPicker(['b']);
    fireEvent.click(chip('Imagini & video'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('disables the others once two are chosen, but not the chosen ones', () => {
    const onChange = renderPicker(['a', 'b']);
    expect(chip('Securitate').disabled).toBe(true);
    expect(chip('AI & LLM').disabled).toBe(false);
    expect(chip('Imagini & video').disabled).toBe(false);
    fireEvent.click(chip('Securitate'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves every chip enabled with fewer than two chosen', () => {
    renderPicker(['a']);
    expect(chip('Securitate').disabled).toBe(false);
    expect(chip('Imagini & video').disabled).toBe(false);
  });

  it('shows its error as an alert tied to the group', () => {
    renderPicker([], vi.fn(), 'Alege cel puțin o categorie.');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Alege cel puțin o categorie.');
    for (const name of ['AI & LLM', 'Imagini & video', 'Securitate']) {
      expect(chip(name).getAttribute('aria-invalid')).toBe('true');
      expect(chip(name).getAttribute('aria-describedby')).toBe(alert.id);
    }
  });
});
