import { marked } from 'marked';
import React from 'react';

import { cn } from './utils.js';

marked.setOptions({ gfm: true, breaks: true });

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/giu, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/giu, '')
    .replace(/<embed\b[^>]*>/giu, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/giu, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/giu, '')
    .replace(/javascript:/giu, '');
}

export function renderMarkdown(source: string): string {
  const text = typeof source === 'string' ? source.trim() : '';
  if (text === '') return '';
  const parsed = marked.parse(text, { async: false });
  return sanitizeHtml(typeof parsed === 'string' ? parsed : '');
}

export interface MarkdownProps {
  source: string;
  className?: string;
}

export function Markdown({ source, className }: MarkdownProps) {
  const html = React.useMemo(() => renderMarkdown(source), [source]);
  if (html === '') return null;
  return <div className={cn('bn-md', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
