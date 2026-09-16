/* =========================================================================
   Shared imports and helpers.

   Radix is used for behaviour only: tabs, dialogs, tooltips, focus traps.
   Everything with a visual identity (buttons, tags, panels, tables) is our
   own markup, so the editorial system is not fighting a component library.
   ========================================================================= */
import React from 'react';
import htm from 'htm';
import { Theme, Tabs, Dialog, AlertDialog, Tooltip } from '@radix-ui/themes';

export const html = htm.bind(React.createElement);
export { React, Theme, Tabs, Dialog, AlertDialog, Tooltip };
export const { useState, useEffect, useMemo, useRef, useCallback } = React;

/* The curriculum data layer, loaded by the classic scripts before this runs. */
export const FQ = window.FQ;
export const CFG = window.FQ_CONFIG;
export const store = window.FQ.store;

/* Content is authored in this repository, never user input, so rendering the
   small inline-markdown subset as HTML is safe here. */
export function md(text) {
  return html`<span dangerouslySetInnerHTML=${{ __html: FQ.md(text) }} />`;
}

export function rawHtml(markup, props = {}) {
  return html`<div ...${props} dangerouslySetInnerHTML=${{ __html: markup }} />`;
}

export function navigate(hash) { window.location.hash = hash; }

/* Difficulty as a measured bar: ten ticks, filled to the level. */
export function Gauge({ value, max = 10 }) {
  return html`
    <span class="gauge" title=${`Difficulty ${value} of ${max}`}
          aria-label=${`Difficulty ${value} of ${max}`}>
      ${Array.from({ length: max }, (_, i) => html`<i key=${i} class=${i < value ? 'on' : ''} />`)}
    </span>`;
}

/* Structural button: square, mono label, optional trailing arrow. */
export function Btn({ children, onClick, href, variant = '', small, disabled, arrow, type = 'button', ...rest }) {
  const cls = ['btn', variant && 'btn-' + variant, small && 'btn-s'].filter(Boolean).join(' ');
  const inner = html`${children}${arrow ? html`<span class="arrow" aria-hidden="true">→</span>` : null}`;
  if (href) return html`<a class=${cls} href=${href} ...${rest}>${inner}</a>`;
  return html`
    <button class=${cls} type=${type} onClick=${onClick} disabled=${disabled} ...${rest}>${inner}</button>`;
}

export function Tag({ children, variant = '' }) {
  return html`<span class=${'tag' + (variant ? ' tag-' + variant : '')}>${children}</span>`;
}

/* A rule, a title, and an optional right-hand note. */
export function SectionHead({ title, note }) {
  return html`
    <div class="section-head">
      <h2>${title}</h2>
      ${note ? html`<span class="mono">${note}</span>` : null}
    </div>`;
}
