import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Button, StatusPill, Stepper } from './index';
import { CategoryIcon } from './CategoryIcon';
import { SafetyPictogram } from './SafetyPictogram';
import { STRINGS, SAFETY_CARDS, LOT_STATUS_NAMES, TX_STATUS_NAMES } from '../../i18n/strings';
import { MATERIAL_CATEGORIES } from '../../data/models';

test('presentation preserves translated labels, status cues and accessible control states', () => {
  for (const lang of ['en', 'hi', 'mr'] as const) {
    for (const [key, text] of Object.entries(STRINGS[lang])) {
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
      expect([...text.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort()).toEqual(
        [...STRINGS.en[key as keyof typeof STRINGS.en].matchAll(/\{\w+\}/g)].map((m) => m[0]).sort(),
      );
    }
    for (const [status, label] of Object.entries({
      ...LOT_STATUS_NAMES[lang],
      ...TX_STATUS_NAMES[lang],
    })) {
      const html = renderToStaticMarkup(createElement(StatusPill, { status, children: label }));
      expect(html).toContain('<svg');
      expect(html).toContain(label);
    }
    for (const card of SAFETY_CARDS[lang]) {
      const html = renderToStaticMarkup(createElement(SafetyPictogram, { kind: card.icon }));
      expect(html).toContain('<path');
    }
  }
  const categories = MATERIAL_CATEGORIES.map((category) =>
    renderToStaticMarkup(createElement(CategoryIcon, { category })),
  );
  expect(new Set(categories).size).toBe(MATERIAL_CATEGORIES.length);
  const button = renderToStaticMarkup(
    createElement(Button, {
      type: 'submit',
      loading: true,
      children: 'Confirm',
    }),
  );
  expect(button).toContain('type="submit"');
  expect(button).toContain('disabled=""');
  expect(button).toContain('aria-busy="true"');
  const stepper = renderToStaticMarkup(
    createElement(Stepper, {
      current: 1,
      items: [
        { label: 'Photo', icon: 'camera', done: true, detail: '10:00' },
        { label: 'Material', icon: 'package' },
      ],
    }),
  );
  expect(stepper).toContain('aria-current="step"');
  expect(stepper).toContain('10:00');
});
