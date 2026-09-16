/* =========================================================================
   Shared imports and small helpers for the Radix interface.
   Everything UI-related goes through here so the component files stay short.
   ========================================================================= */
import React from 'react';
import htm from 'htm';
import * as RT from '@radix-ui/themes';

export const html = htm.bind(React.createElement);
export { React, RT };
export const { useState, useEffect, useMemo, useRef, useCallback } = React;

export const {
  Theme, Container, Flex, Grid, Box, Section, Separator, Card, Heading, Text,
  Badge, Button, IconButton, Link, Tabs, Progress, Callout, ScrollArea, Dialog,
  TextField, TextArea, Table, Code, Blockquote, Kbd, Tooltip, Avatar, Inset,
  Strong, Em, Spinner, Switch, SegmentedControl, DataList, AlertDialog
} = RT;

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

export function navigate(hash) {
  window.location.hash = hash;
}

/* Difficulty shown as filled pips — denser and more legible than "7/10". */
export function Pips({ value, max = 10 }) {
  return html`
    <span className="pips" title=${`Difficulty ${value} of ${max}`} aria-label=${`Difficulty ${value} of ${max}`}>
      ${Array.from({ length: max }, (_, i) =>
        html`<i key=${i} className=${i < value ? 'on' : ''} />`)}
    </span>`;
}

/* Monospace figure — used for every number in the interface. */
export function Figure({ children, size = '2', color }) {
  return html`<${Text} as="span" size=${size} color=${color} className="figure">${children}<//>`;
}
